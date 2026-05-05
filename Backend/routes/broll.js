// ─── B-Roll Auto-Fill Route ──────────────────────────────────────────────────
// POST /api/broll/:videoId/analyze   — Detect silent/low-energy segments
// POST /api/broll/:videoId/apply     — Download Pexels B-roll + splice into video
// GET  /api/broll/:videoId/segments  — Get detected silence segments
// ─────────────────────────────────────────────────────────────────────────────
const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const axios = require("axios");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const { downloadToTemp, uploadFile, cleanupTemp } = require("../lib/storage");

const PEXELS_API = "https://api.pexels.com/videos/search";
const MIN_SILENCE_DURATION = 1.5; // seconds — only replace gaps >= 1.5s
const MAX_BROLL_SEGMENTS = 5;     // cap at 5 B-roll insertions per video

// POST /api/broll/:videoId/analyze — Detect silence + low-energy gaps
router.post("/:videoId/analyze", authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.userId;

  const { data: video } = await supabase.from("uploaded_videos").select("*")
    .eq("id", videoId).eq("user_id", userId).single();
  if (!video) return res.status(404).json({ error: "Video not found" });

  const tmpDir = path.join(os.tmpdir(), "redistribute_broll", videoId);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const videoPath = await downloadToTemp(video.file_url, `broll_src_${videoId}.mp4`);

    // Detect silence segments with ffmpeg silencedetect filter
    const segments = await detectSilenceSegments(videoPath, MIN_SILENCE_DURATION);

    // Cap to MAX segments and avoid first/last 5 seconds
    const filtered = segments
      .filter(s => s.start > 5 && s.end < (video.duration_seconds - 5))
      .slice(0, MAX_BROLL_SEGMENTS);

    // Save segments to DB
    await supabase.from("broll_segments").delete().eq("video_id", videoId);
    if (filtered.length > 0) {
      await supabase.from("broll_segments").insert(
        filtered.map((s, i) => ({
          video_id: videoId,
          user_id: userId,
          segment_index: i,
          start_time: s.start,
          end_time: s.end,
          duration: s.end - s.start,
          status: "detected",
        }))
      );
    }

    cleanupTemp(videoPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    res.json({
      segments_detected: filtered.length,
      total_silence_found: segments.length,
      segments: filtered,
      message: filtered.length > 0
        ? `Found ${filtered.length} gap(s) where B-roll can be inserted`
        : "No significant gaps found — video has continuous speech",
    });
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error("B-roll analysis failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/broll/:videoId/segments
router.get("/:videoId/segments", authenticateToken, async (req, res) => {
  const { data, error } = await supabase.from("broll_segments").select("*")
    .eq("video_id", req.params.videoId).eq("user_id", req.user.userId)
    .order("segment_index");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/broll/:videoId/apply — Fetch Pexels B-roll + splice
router.post("/:videoId/apply", authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.userId;
  const keywords = req.body.keywords || [];          // user-provided search terms
  const segmentIds = req.body.segment_ids || null;   // specific segments, or null for all

  if (!process.env.PEXELS_API_KEY) {
    return res.status(500).json({ error: "Pexels API key not configured" });
  }

  const { data: video } = await supabase.from("uploaded_videos").select("*")
    .eq("id", videoId).eq("user_id", userId).single();
  if (!video) return res.status(404).json({ error: "Video not found" });

  // Respond immediately
  res.json({ message: "B-roll application started", videoId });

  const tmpDir = path.join(os.tmpdir(), "redistribute_broll_apply", videoId);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const { data: segments } = await supabase.from("broll_segments").select("*")
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .in("status", ["detected", "ready"])
      .order("segment_index");

    const targetSegments = segmentIds
      ? (segments || []).filter(s => segmentIds.includes(s.id))
      : (segments || []);

    if (!targetSegments.length) {
      console.log("No segments to process for B-roll");
      return;
    }

    // Download original video
    const videoPath = await downloadToTemp(video.file_url, `broll_orig_${videoId}.mp4`);

    // Build search query from keywords + video title
    const searchTerms = keywords.length > 0
      ? keywords.join(" ")
      : video.title?.replace(/[^a-zA-Z0-9 ]/g, " ").split(" ").slice(0, 3).join(" ");

    // Fetch B-roll clips from Pexels
    const pexelsClips = await fetchPexelsVideos(searchTerms, targetSegments.length);

    if (!pexelsClips.length) {
      console.log("No Pexels B-roll found for query:", searchTerms);
      return;
    }

    // Download each Pexels clip to tmp
    const brollPaths = [];
    for (let i = 0; i < Math.min(targetSegments.length, pexelsClips.length); i++) {
      const clip = pexelsClips[i];
      const brollPath = path.join(tmpDir, `broll_${i}.mp4`);
      await downloadVideoFile(clip.url, brollPath);
      brollPaths.push({ path: brollPath, duration: clip.duration, pexelsId: clip.id, attribution: clip.attribution });
    }

    // Splice B-roll into original video
    const outputPath = path.join(tmpDir, "with_broll.mp4");
    await spliceBroll(videoPath, brollPaths, targetSegments, outputPath, video);

    // Upload result
    const storagePath = `${userId}/${videoId}/with_broll.mp4`;
    const { url: brollVideoUrl } = await uploadFile(outputPath, storagePath, "video/mp4");

    // Update segments status + save Pexels attribution
    for (let i = 0; i < Math.min(targetSegments.length, brollPaths.length); i++) {
      await supabase.from("broll_segments").update({
        status: "applied",
        pexels_video_id: String(brollPaths[i].pexelsId),
        pexels_attribution: brollPaths[i].attribution,
      }).eq("id", targetSegments[i].id);
    }

    // Save the B-roll video as a new clip variant
    await supabase.from("clips").insert({
      video_id: videoId,
      user_id: userId,
      file_url: brollVideoUrl,
      file_path: storagePath,
      start_time: 0,
      end_time: video.duration_seconds,
      duration_seconds: video.duration_seconds,
      width: video.width,
      height: video.height,
      title: `${video.title} — with B-Roll`,
      platform: "tiktok",
      status: "generated",
      ai_reason: `B-roll from Pexels inserted at ${targetSegments.length} gap(s). Search: "${searchTerms}"`,
    });

    await supabase.from("job_logs").insert({
      user_id: userId, video_id: videoId, action: "broll",
      details: { segments_filled: targetSegments.length, search_terms: searchTerms, broll_video_url: brollVideoUrl },
      status: "success",
    });

    // Cleanup
    cleanupTemp(videoPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`✅ B-roll applied: ${videoId} | ${targetSegments.length} segments filled`);
  } catch (err) {
    console.error("B-roll apply failed:", err.message);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Use FFmpeg silencedetect filter to find quiet segments.
 * Returns [{start, end, duration}]
 */
function detectSilenceSegments(videoPath, minDuration) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-i", videoPath,
      "-af", `silencedetect=noise=-35dB:d=${minDuration}`,
      "-f", "null", "-",
    ], { timeout: 120000 }, (err, stdout, stderr) => {
      // silencedetect output goes to stderr
      const output = stderr || "";
      const segments = [];

      const startMatches = [...output.matchAll(/silence_start: ([\d.]+)/g)];
      const endMatches = [...output.matchAll(/silence_end: ([\d.]+)/g)];

      for (let i = 0; i < Math.min(startMatches.length, endMatches.length); i++) {
        const start = parseFloat(startMatches[i][1]);
        const end = parseFloat(endMatches[i][1]);
        if (end - start >= minDuration) {
          segments.push({ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, duration: end - start });
        }
      }

      resolve(segments);
    });
  });
}

/**
 * Fetch video clips from Pexels API matching the search query.
 * Returns [{id, url, duration, attribution}]
 */
async function fetchPexelsVideos(query, count) {
  const { data } = await axios.get(PEXELS_API, {
    params: { query, per_page: count * 2, orientation: "portrait", size: "medium" },
    headers: { Authorization: process.env.PEXELS_API_KEY },
    timeout: 10000,
  });

  const clips = [];
  for (const video of (data.videos || []).slice(0, count)) {
    // Pick the best quality file that is <= 1080p
    const file = video.video_files
      .filter(f => f.quality !== "hd4k" && f.width <= 1080)
      .sort((a, b) => (b.width || 0) - (a.width || 0))[0];

    if (file?.link) {
      clips.push({
        id: video.id,
        url: file.link,
        duration: video.duration,
        attribution: `Video by ${video.user.name} on Pexels`,
      });
    }
  }
  return clips;
}

async function downloadVideoFile(url, outputPath) {
  const response = await axios({ url, method: "GET", responseType: "stream", timeout: 60000 });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

/**
 * Splice B-roll clips into the original video at silence segments.
 * Strategy: REPLACE the silence segment with B-roll of same duration.
 * Uses FFmpeg complex filter with concat demuxer approach.
 */
async function spliceBroll(videoPath, brollPaths, segments, outputPath, videoMeta) {
  // Build a concat list: alternate original segments with B-roll
  const concatListPath = outputPath.replace(".mp4", "_concat.txt");
  const parts = [];
  let cursor = 0;
  const tmpBase = path.dirname(outputPath);

  // For each segment, cut: [cursor → segment.start] (original) + [0 → seg.duration] (B-roll)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const broll = brollPaths[i];
    if (!broll) continue;

    // Cut original segment before the silence
    if (seg.start > cursor) {
      const partPath = path.join(tmpBase, `orig_${i}.mp4`);
      await cutSegment(videoPath, partPath, cursor, seg.start - cursor);
      parts.push(partPath);
    }

    // Cut B-roll to match silence duration (trim or loop)
    const brollDuration = Math.min(seg.end - seg.start, broll.duration);
    const brollPartPath = path.join(tmpBase, `broll_trimmed_${i}.mp4`);
    await cutAndScaleBroll(broll.path, brollPartPath, brollDuration, videoMeta.width || 1080, videoMeta.height || 1920);
    parts.push(brollPartPath);

    cursor = seg.end;
  }

  // Add remaining original footage after last segment
  if (cursor < videoMeta.duration_seconds) {
    const finalPartPath = path.join(tmpBase, "orig_final.mp4");
    await cutSegment(videoPath, finalPartPath, cursor, videoMeta.duration_seconds - cursor);
    parts.push(finalPartPath);
  }

  // Concatenate all parts
  const concatContent = parts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(concatListPath, concatContent);

  await concatVideos(concatListPath, outputPath);

  // Cleanup part files
  for (const p of parts) cleanupTemp(p);
  cleanupTemp(concatListPath);
}

function cutSegment(inputPath, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y", "-ss", String(startTime), "-i", inputPath,
      "-t", String(duration), "-c", "copy", "-avoid_negative_ts", "1",
      outputPath,
    ], { timeout: 120000 }, (err) => {
      if (err) return reject(new Error("Cut failed: " + err.message));
      resolve(outputPath);
    });
  });
}

function cutAndScaleBroll(inputPath, outputPath, duration, width, height) {
  return new Promise((resolve, reject) => {
    // Scale B-roll to match video dimensions, crop to fill (no letterbox)
    const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=30`;
    execFile("ffmpeg", [
      "-y", "-i", inputPath,
      "-t", String(duration),
      "-vf", vf,
      "-c:v", "libx264", "-preset", "fast", "-crf", "24",
      "-an",  // B-roll: mute audio, keep original audio from main video
      "-movflags", "+faststart",
      outputPath,
    ], { timeout: 120000 }, (err) => {
      if (err) return reject(new Error("B-roll cut/scale failed: " + err.message));
      resolve(outputPath);
    });
  });
}

function concatVideos(concatListPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0",
      "-i", concatListPath,
      "-c:v", "libx264", "-preset", "fast", "-crf", "22",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 1024 * 1024 * 50, timeout: 600000 }, (err, _, stderr) => {
      if (err) return reject(new Error("Concat failed: " + stderr?.slice(-300)));
      resolve(outputPath);
    });
  });
}

module.exports = router;
