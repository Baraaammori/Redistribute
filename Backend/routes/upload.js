// ─── Upload Route ────────────────────────────────────────────────────────────
// POST /api/upload/init          — Reserve a storage path for TUS upload
// POST /api/upload/complete      — Register completed TUS upload in DB
// GET  /api/upload               — List user's uploaded videos
// GET  /api/upload/:id           — Get single video details + clips
// POST /api/upload/:id/analyze   — Analyze video with ffprobe (reads URL directly)
// POST /api/upload/:id/process   — Process: smart engine → clip generation
// POST /api/upload/:id/distribute — Distribute to platforms
// DELETE /api/upload/:id         — Delete video + clips
// ──────────────────────────────────────────────────────────────────────────────
const router = require("express").Router();
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { Queue } = require("bullmq");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const { analyzeVideo, generateClips } = require("../lib/ffmpeg");
const { decide, calculateClipTimestamps } = require("../lib/smartEngine");
const {
  uploadFile, cleanupTemp, cleanupTempDir, fileExists,
  createMultipartUpload, getPresignedPartUrls, completeMultipartUpload, abortMultipartUpload,
  PART_SIZE,
} = require("../lib/storage");
const connection = require("../lib/redis");

const processQueue = new Queue("video-processing", { connection });

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/init — Create R2 multipart upload + return presigned part URLs
// ──────────────────────────────────────────────────────────────────────────────
router.post("/init", authenticateToken, async (req, res) => {
  const { fileName, fileSize, mimeType } = req.body;
  if (!fileName || !fileSize) return res.status(400).json({ error: "fileName and fileSize are required" });

  const userId = req.user.userId;

  const { data: user } = await supabase.from("users").select("plan").eq("id", userId).single();
  const isPro = user?.plan === "pro" || user?.plan === "team";
  if (!isPro && fileSize > 500 * 1024 * 1024) {
    return res.status(403).json({ error: "File too large for free plan (max 500 MB). Upgrade to Pro." });
  }

  const safe       = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const key        = `uploads/${userId}/${Date.now()}_${safe}`;
  const totalParts = Math.max(1, Math.ceil(fileSize / PART_SIZE));

  try {
    const uploadId = await createMultipartUpload(key, mimeType || "video/mp4");
    const parts    = await getPresignedPartUrls(key, uploadId, totalParts);
    res.json({ key, uploadId, parts, partSize: PART_SIZE });
  } catch (err) {
    console.error("[upload/init]", err.message);
    res.status(500).json({ error: `Failed to initialise upload: ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/complete-multipart — Finalise R2 multipart upload
// ──────────────────────────────────────────────────────────────────────────────
router.post("/complete-multipart", authenticateToken, async (req, res) => {
  const { key, uploadId } = req.body;
  const userId = req.user.userId;

  if (!key || !uploadId) return res.status(400).json({ error: "key and uploadId are required" });
  if (!key.startsWith(`uploads/${userId}/`)) return res.status(403).json({ error: "Invalid key" });

  try {
    const fileUrl = await completeMultipartUpload(key, uploadId);
    res.json({ url: fileUrl, key });
  } catch (err) {
    await abortMultipartUpload(key, uploadId).catch(() => {});
    console.error("[upload/complete-multipart]", err.message);
    res.status(500).json({ error: `Failed to complete upload: ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/complete — Register a completed R2 upload in the database
// ──────────────────────────────────────────────────────────────────────────────
router.post("/complete", authenticateToken, async (req, res) => {
  const {
    key, fileName, fileSize,
    duration, width, height, orientation, aspectRatio,
    title, description, tags, mode,
  } = req.body;

  const userId = req.user.userId;

  if (!key) return res.status(400).json({ error: "key is required" });
  if (!key.startsWith(`uploads/${userId}/`)) {
    return res.status(403).json({ error: "Invalid key" });
  }

  // Verify the file actually exists in R2
  const exists = await fileExists(key);
  if (!exists) {
    return res.status(400).json({ error: "Upload not found in R2 — did the multipart upload complete?" });
  }

  // Plan check for duration
  const { data: user } = await supabase.from("users").select("plan").eq("id", userId).single();
  const isPro = user?.plan === "pro" || user?.plan === "team";
  if (!isPro && duration && duration > 600) {
    return res.status(403).json({ error: "Video too long for free plan (max 10 minutes). Upgrade to Pro." });
  }

  const fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  // Run smart engine with client-supplied metadata
  let smartDecision = null;
  if (duration || width) {
    try {
      smartDecision = decide({
        duration_seconds: duration || 0,
        width: width || 0,
        height: height || 0,
        orientation: orientation || (width && height ? (width > height ? "landscape" : "portrait") : "landscape"),
        aspect_ratio: aspectRatio || "16:9",
      });
    } catch { /* smart engine failure is non-fatal */ }
  }

  const videoId = uuidv4();
  const { data: video, error } = await supabase
    .from("uploaded_videos")
    .insert({
      id: videoId,
      user_id: userId,
      title: title || fileName || "Untitled",
      description: description || null,
      tags: tags ? (typeof tags === "string" ? tags.split(",").map(t => t.trim()) : tags) : null,
      file_url: fileUrl,
      file_path: key,
      file_size: fileSize || null,
      duration_seconds: duration || null,
      width: width || null,
      height: height || null,
      orientation: orientation || null,
      aspect_ratio: aspectRatio || null,
      smart_decision: smartDecision,
      status: smartDecision ? "analyzed" : "uploaded",
      mode: mode || "auto",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("job_logs").insert({
    user_id: userId,
    video_id: videoId,
    action: "upload",
    details: { file_size: fileSize, original_name: fileName, source: "tus" },
    status: "success",
  });

  res.json(video);
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

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/upload/logs — Job logs
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

  const [{ data: clips }, { data: distributions }] = await Promise.all([
    supabase.from("clips").select("*").eq("video_id", req.params.id).order("start_time", { ascending: true }),
    supabase.from("distributions").select("*").eq("video_id", req.params.id).order("created_at", { ascending: true }),
  ]);

  res.json({ ...video, clips: clips || [], distributions: distributions || [] });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/:id/analyze — Re-analyze with FFprobe (reads URL directly)
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
    await supabase.from("uploaded_videos").update({ status: "analyzing" }).eq("id", req.params.id);

    // Pass the public URL directly — ffprobe reads container headers over HTTP
    // (no full download needed; for MP4 this is just the moov atom, ~KB)
    const meta = await analyzeVideo(video.file_url);
    const smartDecision = decide(meta);

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
// POST /api/upload/:id/process — Generate clips
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:id/process", authenticateToken, async (req, res) => {
  const { data: video } = await supabase
    .from("uploaded_videos")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.userId)
    .single();

  if (!video) return res.status(404).json({ error: "Video not found" });

  const userConfig = req.body || {};
  const decision = userConfig.platforms ? { ...video.smart_decision, ...userConfig.platforms } : video.smart_decision;

  if (!decision) {
    return res.status(400).json({ error: "Video has not been analyzed yet. Call /analyze first." });
  }

  if (!decision.generate_clips && !userConfig.clip_count) {
    await supabase.from("uploaded_videos").update({ status: "processing", mode: userConfig.mode || video.mode }).eq("id", req.params.id);
    return res.json({ message: "No clips needed. Ready to distribute.", decision });
  }

  try {
    await supabase.from("uploaded_videos").update({ status: "processing", mode: userConfig.mode || video.mode }).eq("id", req.params.id);

    const { downloadToTemp } = require("../lib/storage");
    const tempPath = await downloadToTemp(video.file_url, `process_${video.id}.mp4`);

    const count = userConfig.clip_count || decision.clip_count || 3;
    const duration = userConfig.clip_duration || decision.clip_duration || 45;
    const timestamps = calculateClipTimestamps(video.duration_seconds, count, duration);

    const clipsDir = path.join(os.tmpdir(), "redistribute_clips", video.id);
    const clipResults = await generateClips(tempPath, clipsDir, timestamps);

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

    await supabase.from("uploaded_videos").update({ status: "analyzed" }).eq("id", req.params.id);
    await supabase.from("job_logs").insert({
      user_id: req.user.userId,
      video_id: req.params.id,
      action: "clip",
      details: { clip_count: savedClips.length, timestamps },
      status: "success",
    });

    cleanupTemp(tempPath);
    cleanupTempDir(clipsDir);

    res.json({ clips: savedClips, decision });
  } catch (err) {
    console.error("Process error:", err);
    await supabase.from("uploaded_videos").update({ status: "failed", error: err.message }).eq("id", req.params.id);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/:id/distribute
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
  const actions = userConfig.actions || decision;
  const scheduledAt = userConfig.scheduled_at || null;

  const distributions = [];

  if (actions.youtube === "full_upload") {
    const { data: dist } = await supabase.from("distributions").insert({
      user_id: video.user_id, video_id: video.id, platform: "youtube",
      upload_type: "full", status: "queued", scheduled_at: scheduledAt,
    }).select().single();
    if (dist) distributions.push(dist);
  }
  if (actions.youtube_shorts === "full_upload") {
    const { data: dist } = await supabase.from("distributions").insert({
      user_id: video.user_id, video_id: video.id, platform: "youtube_shorts",
      upload_type: "shorts", status: "queued", scheduled_at: scheduledAt,
    }).select().single();
    if (dist) distributions.push(dist);
  }
  if (actions.tiktok === "full_upload") {
    const { data: dist } = await supabase.from("distributions").insert({
      user_id: video.user_id, video_id: video.id, platform: "tiktok",
      upload_type: "full", status: "queued", scheduled_at: scheduledAt,
    }).select().single();
    if (dist) distributions.push(dist);
  }
  if (actions.tiktok === "generate_clips") {
    const { data: clips } = await supabase.from("clips").select("*").eq("video_id", video.id).in("status", ["generated", "approved"]);
    for (const clip of (clips || [])) {
      const { data: dist } = await supabase.from("distributions").insert({
        user_id: video.user_id, video_id: video.id, clip_id: clip.id,
        platform: "tiktok", upload_type: "clip", status: "queued", scheduled_at: scheduledAt,
      }).select().single();
      if (dist) distributions.push(dist);
    }
  }

  for (const dist of distributions) {
    const delay = scheduledAt ? Math.max(0, new Date(scheduledAt) - Date.now()) : 0;
    await processQueue.add("distribute", { distributionId: dist.id, videoId: video.id, userId: video.user_id }, {
      delay, attempts: 3, backoff: { type: "exponential", delay: 5000 },
    });
  }

  await supabase.from("uploaded_videos").update({ status: "distributing" }).eq("id", video.id);
  await supabase.from("job_logs").insert({
    user_id: video.user_id, video_id: video.id, action: "distribute",
    details: { distribution_count: distributions.length, platforms: distributions.map(d => d.platform) },
    status: "info",
  });

  res.json({ distributions, message: `${distributions.length} distribution(s) queued` });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/upload/:id/clips
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/clips", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("clips").select("*")
    .eq("video_id", req.params.id)
    .eq("user_id", req.user.userId)
    .order("start_time", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/upload/clips/:clipId/approve
// ──────────────────────────────────────────────────────────────────────────────
router.post("/clips/:clipId/approve", authenticateToken, async (req, res) => {
  const { data, error } = await supabase.from("clips")
    .update({ status: "approved" })
    .eq("id", req.params.clipId)
    .eq("user_id", req.user.userId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/upload/clips/:clipId
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/clips/:clipId", authenticateToken, async (req, res) => {
  const { data: clip } = await supabase.from("clips").select("file_path")
    .eq("id", req.params.clipId).eq("user_id", req.user.userId).single();
  if (clip?.file_path) {
    const { deleteFile } = require("../lib/storage");
    await deleteFile(clip.file_path);
  }
  await supabase.from("clips").delete().eq("id", req.params.clipId).eq("user_id", req.user.userId);
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/upload/:id
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/:id", authenticateToken, async (req, res) => {
  const { data: video } = await supabase.from("uploaded_videos").select("file_path")
    .eq("id", req.params.id).eq("user_id", req.user.userId).single();
  if (!video) return res.status(404).json({ error: "Video not found" });

  const { data: clips } = await supabase.from("clips").select("file_path").eq("video_id", req.params.id);
  const { deleteFile } = require("../lib/storage");
  for (const clip of (clips || [])) {
    if (clip.file_path) await deleteFile(clip.file_path);
  }
  if (video.file_path) await deleteFile(video.file_path);

  await supabase.from("uploaded_videos").delete().eq("id", req.params.id).eq("user_id", req.user.userId);
  res.json({ ok: true });
});

module.exports = router;
