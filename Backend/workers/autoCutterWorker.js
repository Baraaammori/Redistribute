// ─── Auto-Cutter Worker ───────────────────────────────────────────────────────
// Receives a BullMQ job, cuts a long video into equal-length clips using
// FFmpeg stream copy (-c copy = no re-encode, near-zero RAM), uploads each
// clip to Supabase Storage, and queues each clip as a repost job.
// ─────────────────────────────────────────────────────────────────────────────
const { Worker, Queue } = require("bullmq");
const { execFile, spawn } = require("child_process");
const fs                = require("fs");
const path              = require("path");
const os                = require("os");
const { v4: uuidv4 }    = require("uuid");
const supabase          = require("../lib/supabase");
const { uploadFile, cleanupTemp, cleanupTempDir } = require("../lib/storage");
const axios = require("axios");
const connection        = require("../lib/redis");

const autoCutQueue = new Queue("auto-cut", { connection });
module.exports = { autoCutQueue };

if (process.env.DISABLE_WORKERS !== "true") {
  const worker = new Worker("auto-cut", async job => {
    const { videoId, clipLengthSeconds, targetPlatforms, userId } = job.data;
    const label = `[auto-cut][job:${job.id}]`;
    console.log(`\n✂️  ${label} starting | videoId=${videoId} | clipLen=${clipLengthSeconds}s | platforms=${targetPlatforms}`);

    const { data: video } = await supabase
      .from("uploaded_videos").select("*").eq("id", videoId).single();
    if (!video) throw new Error("Video not found");

    const tmpDir = path.join(os.tmpdir(), `autocut_${videoId}_${Date.now()}`);

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // Step 1: probe duration directly from R2 URL (ffprobe only reads headers — no full download)
      const sourceUrl = video.file_url;
      console.log(`${label} Probing duration from R2…`);
      const duration = await getVideoDuration(sourceUrl);
      console.log(`${label} Duration: ${duration.toFixed(1)}s`);

      // Step 2: stream source to /tmp ONCE — never pass an HTTP URL to FFmpeg.
      // When FFmpeg reads a 16 Mbps OBS recording from HTTP it buffers large
      // chunks in RAM to satisfy container seeks, causing OOM (exit 255).
      // Streaming to disk first is zero-RAM; disk is cleaned up in finally.
      const sourceLocalPath = path.join(tmpDir, "source.mp4");
      console.log(`${label} Streaming source to disk: ${sourceLocalPath}…`);
      await streamToDisk(sourceUrl, sourceLocalPath);
      const sourceMB = (fs.statSync(sourceLocalPath).size / 1e6).toFixed(1);
      console.log(`${label} Source ready on disk: ${sourceMB} MB`);

      const totalClips = Math.ceil(duration / clipLengthSeconds);
      console.log(`${label} Will create ${totalClips} clips of ${clipLengthSeconds}s each`);

      await job.updateProgress({ phase: "cutting", current: 0, total: totalClips, clips: [] });

      const createdClips = [];

      // Step 3: Cut each clip with stream copy — no re-encode, minimal RAM
      let failedClips = 0;

      for (let n = 0; n < totalClips; n++) {
        const start = n * clipLengthSeconds;
        const end   = Math.min((n + 1) * clipLengthSeconds, duration);
        const clipPath = path.join(tmpDir, `clip_${n}.mp4`);

        try {
          await cutClip(sourceLocalPath, clipPath, start, end);
          console.log(`${label} ✅ Clip ${n} cut → ${clipPath}`);

          // Upload clip to Supabase Storage
          const clipStoragePath = `${userId}/${videoId}/autocut_clip_${n}_${uuidv4()}.mp4`;
          const { url: clipUrl, path: storagePath } = await uploadFile(clipPath, clipStoragePath, "video/mp4");

          const clipTitle = `${video.title || "Video"} — Part ${n + 1}`;

          // Save clip row to DB (best-effort — a missing/broken clips table must not
          // block the repost queue; we log the error and continue regardless)
          const { data: clip, error: clipInsertErr } = await supabase.from("clips").insert({
            video_id:         videoId,
            user_id:          userId,
            file_url:         clipUrl,
            file_path:        storagePath,
            start_time:       start,
            end_time:         end,
            duration_seconds: Math.round(end - start),
            width:            video.width,
            height:           video.height,
            title:            clipTitle,
            platform:         targetPlatforms[0] || "tiktok",
            status:           "generated",
          }).select().single();

          if (clipInsertErr) {
            console.error(`${label} clips table insert failed (non-fatal): ${clipInsertErr.message}`);
          }

          // Queue the repost unconditionally — we only need clipUrl, not the clip row
          let repostId = null;
          const { repostQueue } = require("../routes/reposts");
          const { data: repost, error: repostInsertErr } = await supabase.from("reposts").insert({
            user_id:          userId,
            source_video_url: clipUrl,
            source_platform:  "library",
            title:            clip?.title || clipTitle,
            destinations:     targetPlatforms,
            status:           "pending",
          }).select().single();

          if (repostInsertErr) {
            console.error(`${label} reposts insert failed: ${repostInsertErr.message}`);
          } else if (repost) {
            const queueJob = await repostQueue.add(
              "repost",
              { repostId: repost.id },
              { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            );
            await supabase.from("reposts").update({ job_id: queueJob.id }).eq("id", repost.id);
            repostId = repost.id;
            console.log(`${label} 📤 Clip ${n} queued as repost ${repost.id}`);
          }

          createdClips.push({
            clipId:   clip?.id || null,
            title:    clip?.title || clipTitle,
            duration: Math.round(end - start),
            repostId,
          });

          cleanupTemp(clipPath);
        } catch (clipErr) {
          failedClips++;
          console.error(`${label} ❌ Clip ${n} failed (skipping): ${clipErr.message}`);
          cleanupTemp(clipPath);
        }

        await job.updateProgress({
          phase:   "cutting",
          current: n + 1,
          total:   totalClips,
          clips:   createdClips,
        });
      }

      if (failedClips === totalClips) {
        throw new Error(`All ${totalClips} clips failed — check FFmpeg and the source video URL`);
      }

      await job.updateProgress({
        phase:   "done",
        current: totalClips,
        total:   totalClips,
        clips:   createdClips,
      });

      await supabase.from("job_logs").insert({
        user_id:  userId,
        video_id: videoId,
        action:   "auto_cut",
        details:  { clip_count: createdClips.length, clip_length_seconds: clipLengthSeconds, platforms: targetPlatforms },
        status:   "success",
      });

      console.log(`✅ ${label} Done — ${createdClips.length}/${totalClips} clips created and queued`);

    } finally {
      cleanupTempDir(tmpDir);
    }
  }, {
    connection,
    concurrency: 1, // one auto-cut job at a time — RAM constraint
  });

  worker.on("failed", (job, err) =>
    console.error(`❌ [auto-cut] Job ${job?.id} failed: ${err.message}`)
  );
}

// ── ffprobe: get video duration in seconds ────────────────────────────────────
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    execFile("ffprobe", [
      "-v", "quiet", "-print_format", "json", "-show_format", "-i", videoPath,
    ], { timeout: 30_000 }, (err, stdout) => {
      if (err) return reject(new Error("Could not read video duration — is the file a valid MP4?"));
      try {
        const data = JSON.parse(stdout);
        const dur  = parseFloat(data.format?.duration);
        if (!dur || isNaN(dur)) return reject(new Error("Video has no duration"));
        resolve(dur);
      } catch {
        reject(new Error("Failed to parse ffprobe output"));
      }
    });
  });
}

// ── ffmpeg: stream-copy cut ────────────────────────────────────────────────────
// Uses spawn so stderr is collected without ever triggering a reject.
// The Promise resolves/rejects ONLY on process exit code.
function cutClip(inputPath, outputPath, startSeconds, endSeconds) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-ss", String(startSeconds),
      "-to", String(endSeconds),
      "-i",  inputPath,
      "-c",  "copy",
      "-avoid_negative_ts", "make_zero",
      "-movflags", "+faststart",
      "-y",
      outputPath,
    ]);

    const stderrChunks = [];
    proc.stderr.on("data", chunk => stderrChunks.push(chunk.toString()));

    proc.on("close", exitCode => {
      if (exitCode === 0) {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error("FFmpeg exited 0 but output file missing"));
        }
        return resolve(outputPath);
      }

      if (exitCode === 255 || exitCode === null) {
        return reject(new Error(
          "FFmpeg was killed by the OS (exit 255) — likely OOM or SIGKILL. " +
          "Ensure the source video is downloaded to disk before cutting."
        ));
      }

      // Any other non-zero exit — find the first error-looking line in stderr
      const fullStderr = stderrChunks.join("");
      const errorLine = fullStderr
        .split(/[\r\n]+/)
        .find(l => /error|invalid|no such|failed|unable|moov/i.test(l))
        || fullStderr.slice(-300);
      reject(new Error(`FFmpeg exited ${exitCode}: ${errorLine.trim()}`));
    });

    proc.on("error", err => reject(new Error("FFmpeg spawn error: " + err.message)));

    // Kill if it runs too long
    setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("FFmpeg timed out after 120s"));
    }, 120_000);
  });
}

// ── Stream a URL to a local file — zero RAM, all disk ─────────────────────────
function streamToDisk(url, destPath) {
  return new Promise((resolve, reject) => {
    axios({ url, method: "GET", responseType: "stream" })
      .then(res => {
        if (res.status < 200 || res.status >= 300) {
          return reject(new Error(`Download failed: HTTP ${res.status} for ${url}`));
        }
        const writer = fs.createWriteStream(destPath);
        res.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
        res.data.on("error", reject);
      })
      .catch(reject);
  });
}
