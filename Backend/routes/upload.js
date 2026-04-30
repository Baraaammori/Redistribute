// ─── Upload Route ────────────────────────────────────────────────────────────
// POST /api/upload           — Upload video from computer
// GET  /api/upload           — List user's uploaded videos
// GET  /api/upload/:id       — Get single video details + clips
// POST /api/upload/:id/analyze  — Analyze video (ffprobe)
// POST /api/upload/:id/process  — Process: smart engine → clip generation
// POST /api/upload/:id/distribute — Distribute to platforms
// DELETE /api/upload/:id     — Delete video + clips
// ──────────────────────────────────────────────────────────────────────────────
const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { Queue } = require("bullmq");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const { analyzeVideo, generateClips, generateThumbnail } = require("../lib/ffmpeg");
const { decide, calculateClipTimestamps } = require("../lib/smartEngine");
const { uploadFile, cleanupTemp, cleanupTempDir } = require("../lib/storage");
const connection = require("../lib/redis");

// ── Multer config ─────────────────────────────────────────────────────────────
const tmpDir = path.join(os.tmpdir(), "redistribute_uploads");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/avi"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only video files are allowed (mp4, mov, webm, mkv, avi)"));
  },
});

// ── Queue setup ───────────────────────────────────────────────────────────────
const processQueue = new Queue("video-processing", { connection });

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload — Upload a video file
// ──────────────────────────────────────────────────────────────────────────────
router.post("/", authenticateToken, upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No video file provided" });

  const { title, description, tags, mode } = req.body;
  const userId = req.user.userId;
  const videoId = uuidv4();

  try {
    // 1. Upload to Supabase Storage
    const storagePath = `${userId}/${videoId}${path.extname(req.file.originalname) || ".mp4"}`;
    const { url: fileUrl, path: filePath } = await uploadFile(req.file.path, storagePath, req.file.mimetype);

    // 2. Generate thumbnail
    let thumbnailUrl = null;
    try {
      const thumbPath = path.join(tmpDir, `thumb_${videoId}.jpg`);
      await generateThumbnail(req.file.path, thumbPath);
      const thumbStoragePath = `${userId}/${videoId}_thumb.jpg`;
      const thumbResult = await uploadFile(thumbPath, thumbStoragePath, "image/jpeg");
      thumbnailUrl = thumbResult.url;
      cleanupTemp(thumbPath);
    } catch (thumbErr) {
      console.warn("Thumbnail generation failed (non-fatal):", thumbErr.message);
    }

    // 3. Quick analysis (duration, resolution)
    let videoMeta = {};
    try {
      videoMeta = await analyzeVideo(req.file.path);
    } catch (analyzeErr) {
      console.warn("Quick analysis failed (non-fatal):", analyzeErr.message);
    }

    // 4. Store in DB
    const { data: video, error } = await supabase
      .from("uploaded_videos")
      .insert({
        id: videoId,
        user_id: userId,
        title: title || req.file.originalname || "Untitled",
        description: description || null,
        tags: tags ? (typeof tags === "string" ? tags.split(",").map(t => t.trim()) : tags) : null,
        thumbnail_url: thumbnailUrl,
        file_url: fileUrl,
        file_path: filePath,
        file_size: req.file.size,
        duration_seconds: videoMeta.duration_seconds || null,
        width: videoMeta.width || null,
        height: videoMeta.height || null,
        orientation: videoMeta.orientation || null,
        aspect_ratio: videoMeta.aspect_ratio || null,
        fps: videoMeta.fps || null,
        codec: videoMeta.codec || null,
        status: videoMeta.duration_seconds ? "analyzed" : "uploaded",
        mode: mode || "auto",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // 5. Log the upload
    await supabase.from("job_logs").insert({
      user_id: userId,
      video_id: videoId,
      action: "upload",
      details: { file_size: req.file.size, original_name: req.file.originalname },
      status: "success",
    });

    // 6. Cleanup temp file
    cleanupTemp(req.file.path);

    // 7. If analysis succeeded, auto-run smart engine
    if (videoMeta.duration_seconds) {
      const smartDecision = decide(videoMeta);
      await supabase.from("uploaded_videos")
        .update({ smart_decision: smartDecision })
        .eq("id", videoId);
      video.smart_decision = smartDecision;
    }

    res.json(video);
  } catch (err) {
    cleanupTemp(req.file.path);
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/upload — List uploaded videos
// ──────────────────────────────────────────────────────────────────────────────
router.get("/", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("uploaded_videos")
    .select("*")
    .eq("user_id", req.user.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/upload/:id — Get video details with clips
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id", authenticateToken, async (req, res) => {
  const { data: video, error } = await supabase
    .from("uploaded_videos")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.userId)
    .single();

  if (error || !video) return res.status(404).json({ error: "Video not found" });

  // Fetch clips for this video
  const { data: clips } = await supabase
    .from("clips")
    .select("*")
    .eq("video_id", req.params.id)
    .order("start_time", { ascending: true });

  // Fetch distributions
  const { data: distributions } = await supabase
    .from("distributions")
    .select("*")
    .eq("video_id", req.params.id)
    .order("created_at", { ascending: true });

  res.json({ ...video, clips: clips || [], distributions: distributions || [] });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/:id/analyze — Re-analyze video with FFprobe
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:id/analyze", authenticateToken, async (req, res) => {
  const { data: video } = await supabase
    .from("uploaded_videos")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.userId)
    .single();

  if (!video) return res.status(404).json({ error: "Video not found" });

  try {
    await supabase.from("uploaded_videos")
      .update({ status: "analyzing" })
      .eq("id", req.params.id);

    // Download from storage to temp
    const { downloadToTemp } = require("../lib/storage");
    const tempPath = await downloadToTemp(video.file_url, `analyze_${video.id}.mp4`);

    // Analyze
    const meta = await analyzeVideo(tempPath);
    const smartDecision = decide(meta);

    // Update DB
    await supabase.from("uploaded_videos")
      .update({
        duration_seconds: meta.duration_seconds,
        width: meta.width,
        height: meta.height,
        orientation: meta.orientation,
        aspect_ratio: meta.aspect_ratio,
        fps: meta.fps,
        codec: meta.codec,
        smart_decision: smartDecision,
        status: "analyzed",
      })
      .eq("id", req.params.id);

    cleanupTemp(tempPath);

    await supabase.from("job_logs").insert({
      user_id: req.user.userId,
      video_id: req.params.id,
      action: "analyze",
      details: { ...meta, decision: smartDecision },
      status: "success",
    });

    res.json({ ...meta, smart_decision: smartDecision });
  } catch (err) {
    await supabase.from("uploaded_videos")
      .update({ status: "failed", error: err.message })
      .eq("id", req.params.id);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/:id/process — Generate clips based on smart decision
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:id/process", authenticateToken, async (req, res) => {
  const { data: video } = await supabase
    .from("uploaded_videos")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.userId)
    .single();

  if (!video) return res.status(404).json({ error: "Video not found" });

  // Accept user overrides for manual/custom mode
  const userConfig = req.body || {};
  let clipCount = userConfig.clip_count;
  let clipDuration = userConfig.clip_duration;
  let platforms = userConfig.platforms; // { youtube: 'full_upload', tiktok: 'generate_clips', ... }

  // Use smart decision if in auto mode and no overrides
  const decision = platforms ? { ...video.smart_decision, ...platforms } : video.smart_decision;

  if (!decision) {
    return res.status(400).json({ error: "Video has not been analyzed yet. Call /analyze first." });
  }

  // If no clips needed, skip
  if (!decision.generate_clips && !clipCount) {
    await supabase.from("uploaded_videos")
      .update({ status: "processing", mode: userConfig.mode || video.mode })
      .eq("id", req.params.id);
    return res.json({ message: "No clips needed. Ready to distribute.", decision });
  }

  try {
    await supabase.from("uploaded_videos")
      .update({ status: "processing", mode: userConfig.mode || video.mode })
      .eq("id", req.params.id);

    // Download video from storage
    const { downloadToTemp } = require("../lib/storage");
    const tempPath = await downloadToTemp(video.file_url, `process_${video.id}.mp4`);

    // Calculate clip timestamps
    const count = clipCount || decision.clip_count || 3;
    const duration = clipDuration || decision.clip_duration || 45;
    const timestamps = calculateClipTimestamps(video.duration_seconds, count, duration);

    // Generate clips
    const clipsDir = path.join(os.tmpdir(), "redistribute_clips", video.id);
    const clipResults = await generateClips(tempPath, clipsDir, timestamps);

    // Upload clips to storage and save to DB
    const savedClips = [];
    for (const clip of clipResults) {
      if (!clip.success) continue;

      const clipStoragePath = `${video.user_id}/${video.id}/clip_${clip.index}.mp4`;
      const { url: clipUrl, path: clipPath } = await uploadFile(clip.path, clipStoragePath, "video/mp4");

      const { data: savedClip } = await supabase.from("clips").insert({
        video_id: video.id,
        user_id: video.user_id,
        file_url: clipUrl,
        file_path: clipPath,
        start_time: clip.start_time,
        end_time: clip.end_time,
        duration_seconds: clip.duration,
        width: video.width,
        height: video.height,
        title: `${video.title} - Clip ${clip.index}`,
        platform: "tiktok",
        status: "generated",
      }).select().single();

      if (savedClip) savedClips.push(savedClip);
    }

    // Update video status
    await supabase.from("uploaded_videos")
      .update({ status: "analyzed" })
      .eq("id", req.params.id);

    // Log
    await supabase.from("job_logs").insert({
      user_id: req.user.userId,
      video_id: req.params.id,
      action: "clip",
      details: { clip_count: savedClips.length, timestamps },
      status: "success",
    });

    // Cleanup temp files
    cleanupTemp(tempPath);
    cleanupTempDir(clipsDir);

    res.json({ clips: savedClips, decision });
  } catch (err) {
    console.error("Process error:", err);
    await supabase.from("uploaded_videos")
      .update({ status: "failed", error: err.message })
      .eq("id", req.params.id);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/:id/distribute — Distribute video + clips to platforms
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:id/distribute", authenticateToken, async (req, res) => {
  const { data: video } = await supabase
    .from("uploaded_videos")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.userId)
    .single();

  if (!video) return res.status(404).json({ error: "Video not found" });

  const userConfig = req.body || {};
  const decision = video.smart_decision || {};

  // Determine what to distribute
  const actions = userConfig.actions || decision;
  const scheduledAt = userConfig.scheduled_at || null;

  const distributions = [];

  // Full YouTube upload
  if (actions.youtube === "full_upload") {
    const { data: dist } = await supabase.from("distributions").insert({
      user_id: video.user_id,
      video_id: video.id,
      platform: "youtube",
      upload_type: "full",
      status: scheduledAt ? "queued" : "queued",
      scheduled_at: scheduledAt,
    }).select().single();
    if (dist) distributions.push(dist);
  }

  // YouTube Shorts
  if (actions.youtube_shorts === "full_upload") {
    const { data: dist } = await supabase.from("distributions").insert({
      user_id: video.user_id,
      video_id: video.id,
      platform: "youtube_shorts",
      upload_type: "shorts",
      status: "queued",
      scheduled_at: scheduledAt,
    }).select().single();
    if (dist) distributions.push(dist);
  }

  // TikTok full upload
  if (actions.tiktok === "full_upload") {
    const { data: dist } = await supabase.from("distributions").insert({
      user_id: video.user_id,
      video_id: video.id,
      platform: "tiktok",
      upload_type: "full",
      status: "queued",
      scheduled_at: scheduledAt,
    }).select().single();
    if (dist) distributions.push(dist);
  }

  // TikTok clips
  if (actions.tiktok === "generate_clips") {
    const { data: clips } = await supabase.from("clips")
      .select("*")
      .eq("video_id", video.id)
      .in("status", ["generated", "approved"]);

    for (const clip of (clips || [])) {
      const { data: dist } = await supabase.from("distributions").insert({
        user_id: video.user_id,
        video_id: video.id,
        clip_id: clip.id,
        platform: "tiktok",
        upload_type: "clip",
        status: "queued",
        scheduled_at: scheduledAt,
      }).select().single();
      if (dist) distributions.push(dist);
    }
  }

  // Queue all distributions for processing
  for (const dist of distributions) {
    const delay = scheduledAt ? Math.max(0, new Date(scheduledAt) - Date.now()) : 0;
    await processQueue.add("distribute", {
      distributionId: dist.id,
      videoId: video.id,
      userId: video.user_id,
    }, {
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  }

  // Update video status
  await supabase.from("uploaded_videos")
    .update({ status: "distributing" })
    .eq("id", video.id);

  // Log
  await supabase.from("job_logs").insert({
    user_id: video.user_id,
    video_id: video.id,
    action: "distribute",
    details: { distribution_count: distributions.length, platforms: distributions.map(d => d.platform) },
    status: "info",
  });

  res.json({ distributions, message: `${distributions.length} distribution(s) queued` });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/upload/:id/clips — List clips for a video
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/clips", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("clips")
    .select("*")
    .eq("video_id", req.params.id)
    .eq("user_id", req.user.userId)
    .order("start_time", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/clips/:clipId/approve — Approve a clip for distribution
// ──────────────────────────────────────────────────────────────────────────────
router.post("/clips/:clipId/approve", authenticateToken, async (req, res) => {
  const { data, error } = await supabase.from("clips")
    .update({ status: "approved" })
    .eq("id", req.params.clipId)
    .eq("user_id", req.user.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/upload/clips/:clipId — Delete a clip
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/clips/:clipId", authenticateToken, async (req, res) => {
  const { data: clip } = await supabase.from("clips")
    .select("file_path")
    .eq("id", req.params.clipId)
    .eq("user_id", req.user.userId)
    .single();

  if (clip?.file_path) {
    const { deleteFile } = require("../lib/storage");
    await deleteFile(clip.file_path);
  }

  await supabase.from("clips").delete()
    .eq("id", req.params.clipId)
    .eq("user_id", req.user.userId);

  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/upload/:id — Delete video + all clips
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/:id", authenticateToken, async (req, res) => {
  const { data: video } = await supabase.from("uploaded_videos")
    .select("file_path")
    .eq("id", req.params.id)
    .eq("user_id", req.user.userId)
    .single();

  if (!video) return res.status(404).json({ error: "Video not found" });

  // Delete clips from storage
  const { data: clips } = await supabase.from("clips")
    .select("file_path")
    .eq("video_id", req.params.id);

  const { deleteFile } = require("../lib/storage");
  for (const clip of (clips || [])) {
    if (clip.file_path) await deleteFile(clip.file_path);
  }

  // Delete video from storage
  if (video.file_path) await deleteFile(video.file_path);

  // Delete from DB (cascades to clips, distributions, logs)
  await supabase.from("uploaded_videos").delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.userId);

  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/upload/logs — Get job logs for dashboard
// ──────────────────────────────────────────────────────────────────────────────
router.get("/logs/all", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("job_logs")
    .select("*")
    .eq("user_id", req.user.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/upload/stats — Dashboard stats
// ──────────────────────────────────────────────────────────────────────────────
router.get("/stats/overview", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  const [
    { count: totalVideos },
    { count: totalClips },
    { count: totalDistributions },
    { count: successDistributions },
    { count: failedDistributions },
  ] = await Promise.all([
    supabase.from("uploaded_videos").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("clips").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("distributions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("distributions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "success"),
    supabase.from("distributions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "failed"),
  ]);

  res.json({
    total_videos: totalVideos || 0,
    total_clips: totalClips || 0,
    total_distributions: totalDistributions || 0,
    success_distributions: successDistributions || 0,
    failed_distributions: failedDistributions || 0,
  });
});

module.exports = router;
