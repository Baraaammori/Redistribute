// ─── Auto-Cutter Worker ───────────────────────────────────────────────────────
// Receives a BullMQ job, cuts a long video into equal-length clips using
// FFmpeg stream copy (-c copy = no re-encode, near-zero RAM), uploads each
// clip to Supabase Storage, and queues each clip as a repost job.
// ─────────────────────────────────────────────────────────────────────────────
const { Worker, Queue } = require("bullmq");
const { execFile }      = require("child_process");
const fs                = require("fs");
const path              = require("path");
const os                = require("os");
const { v4: uuidv4 }    = require("uuid");
const supabase          = require("../lib/supabase");
const { downloadToTemp, uploadFile, cleanupTemp, cleanupTempDir } = require("../lib/storage");
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
    let sourcePath = null;

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // Step 1: Download source video to disk
      console.log(`${label} Downloading video…`);
      sourcePath = await downloadToTemp(video.file_url, `autocut_src_${videoId}.mp4`);

      // Step 2: Get duration via ffprobe
      const duration = await getVideoDuration(sourcePath);
      console.log(`${label} Duration: ${duration.toFixed(1)}s`);

      const totalClips = Math.ceil(duration / clipLengthSeconds);
      console.log(`${label} Will create ${totalClips} clips of ${clipLengthSeconds}s each`);

      await job.updateProgress({ phase: "cutting", current: 0, total: totalClips, clips: [] });

      const createdClips = [];

      // Step 3: Cut each clip with stream copy — no re-encode, minimal RAM
      for (let n = 0; n < totalClips; n++) {
        const start = n * clipLengthSeconds;
        const end   = Math.min((n + 1) * clipLengthSeconds, duration);
        const clipPath = path.join(tmpDir, `clip_${n}.mp4`);

        try {
          await cutClip(sourcePath, clipPath, start, end);

          // Upload clip to Supabase Storage
          const clipStoragePath = `${userId}/${videoId}/autocut_clip_${n}_${uuidv4()}.mp4`;
          const { url: clipUrl, path: storagePath } = await uploadFile(clipPath, clipStoragePath, "video/mp4");

          // Save clip row to DB
          const { data: clip } = await supabase.from("clips").insert({
            video_id:         videoId,
            user_id:          userId,
            file_url:         clipUrl,
            file_path:        storagePath,
            start_time:       start,
            end_time:         end,
            duration_seconds: Math.round(end - start),
            width:            video.width,
            height:           video.height,
            title:            `${video.title || "Video"} — Part ${n + 1}`,
            platform:         targetPlatforms[0] || "tiktok",
            status:           "generated",
          }).select().single();

          let repostId = null;
          if (clip) {
            // Feed clip into the existing repost queue
            const { repostQueue } = require("../routes/reposts");
            const { data: repost } = await supabase.from("reposts").insert({
              user_id:          userId,
              source_video_url: clipUrl,
              source_platform:  "library",
              title:            clip.title,
              destinations:     targetPlatforms,
              status:           "pending",
            }).select().single();

            if (repost) {
              const queueJob = await repostQueue.add(
                "repost",
                { repostId: repost.id },
                { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
              );
              await supabase.from("reposts").update({ job_id: queueJob.id }).eq("id", repost.id);
              repostId = repost.id;
            }

            createdClips.push({
              clipId:   clip.id,
              title:    clip.title,
              duration: Math.round(end - start),
              repostId,
            });
          }

          cleanupTemp(clipPath);
        } catch (clipErr) {
          console.error(`${label} Clip ${n} failed (skipping): ${clipErr.message}`);
          cleanupTemp(clipPath);
        }

        await job.updateProgress({
          phase:   "cutting",
          current: n + 1,
          total:   totalClips,
          clips:   createdClips,
        });
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
      if (sourcePath) cleanupTemp(sourcePath);
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

// ── ffmpeg: stream-copy cut (no re-encode, ~50MB RAM regardless of video size) ─
function cutClip(inputPath, outputPath, startSeconds, endSeconds) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y",
      "-ss", String(startSeconds),
      "-to", String(endSeconds),
      "-i", inputPath,
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      outputPath,
    ], { timeout: 120_000 }, (err, _, stderr) => {
      if (err) return reject(new Error("FFmpeg cut failed: " + (stderr || "").slice(-200)));
      if (!fs.existsSync(outputPath)) return reject(new Error("Clip file not created"));
      resolve(outputPath);
    });
  });
}
