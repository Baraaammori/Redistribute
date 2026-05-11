// ─── Auto-Cut Route ───────────────────────────────────────────────────────────
// POST /api/auto-cut                  — start an auto-cut job
// GET  /api/auto-cut/:jobId/status    — poll job progress
// ─────────────────────────────────────────────────────────────────────────────
const router   = require("express").Router();
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const { autoCutQueue }      = require("../workers/autoCutterWorker");

// POST /api/auto-cut
router.post("/", authenticateToken, async (req, res) => {
  const { videoId, clipLengthSeconds, targetPlatforms } = req.body;
  const userId = req.user.userId;

  if (!videoId || !clipLengthSeconds || !targetPlatforms?.length) {
    return res.status(400).json({ error: "videoId, clipLengthSeconds, and targetPlatforms required" });
  }
  const secs = Number(clipLengthSeconds);
  if (secs < 15 || secs > 600) {
    return res.status(400).json({ error: "Clip length must be between 15 seconds and 10 minutes" });
  }

  const { data: video } = await supabase
    .from("uploaded_videos").select("*")
    .eq("id", videoId).eq("user_id", userId).single();
  if (!video) return res.status(404).json({ error: "Video not found" });

  // Plan check: free users limited to videos under 5 minutes
  const { data: user } = await supabase
    .from("users").select("plan, trial_ends_at").eq("id", userId).single();
  const isPro    = user?.plan === "pro" || user?.plan === "team";
  const onTrial  = user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();
  if (!isPro && !onTrial && video.duration_seconds && video.duration_seconds > 300) {
    return res.status(403).json({
      error: "Free plan: Auto-Cutter is limited to videos under 5 minutes. Upgrade to Pro for unlimited.",
    });
  }

  const job = await autoCutQueue.add("auto-cut", {
    videoId,
    clipLengthSeconds: secs,
    targetPlatforms,
    userId,
  }, {
    attempts:         1,
    removeOnComplete: { age: 3600 * 24 }, // keep job 24h so frontend can poll
  });

  res.json({ jobId: job.id, message: "Auto-cut started" });
});

// GET /api/auto-cut/:jobId/status
router.get("/:jobId/status", authenticateToken, async (req, res) => {
  try {
    const job = await autoCutQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const state = await job.getState();
    res.json({ jobId: job.id, state, progress: job.progress || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
