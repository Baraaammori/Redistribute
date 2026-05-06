// ─── Auto-Republish Routes ────────────────────────────────────────────────────
// PATCH /api/auto-republish/accounts/:platform   — toggle + set targets
// GET   /api/auto-republish/activity             — last 50 auto jobs
// PATCH /api/auto-republish/:jobId/retry         — retry a failed job
// ─────────────────────────────────────────────────────────────────────────────
const router   = require("express").Router();
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

const VALID_PLATFORMS = ["youtube", "tiktok", "instagram"];

// PATCH /api/auto-republish/accounts/:platform
router.patch("/accounts/:platform", authenticateToken, async (req, res) => {
  const userId   = req.user.userId;
  const platform = req.params.platform;

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `Invalid platform: ${platform}` });
  }

  // Plan gate: only pro users can enable auto-republish
  const { data: user } = await supabase.from("users").select("plan").eq("id", userId).single();
  if (!user || (user.plan !== "pro" && user.plan !== "team")) {
    return res.status(403).json({ error: "pro_required", message: "Auto-republish requires a Pro plan." });
  }

  const { enabled, targets } = req.body;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
  if (!Array.isArray(targets)) return res.status(400).json({ error: "targets must be an array" });

  // Validate targets are real connected accounts (excluding source)
  const validTargets = targets.filter(t => VALID_PLATFORMS.includes(t) && t !== platform);
  if (validTargets.length !== targets.length) {
    return res.status(400).json({ error: "targets contains invalid platform names" });
  }

  // Only allow targets the user actually has connected
  const { data: connectedAccounts } = await supabase
    .from("platform_accounts")
    .select("platform")
    .eq("user_id", userId);
  const connectedPlatforms = (connectedAccounts || []).map(a => a.platform);
  const finalTargets = validTargets.filter(t => connectedPlatforms.includes(t));

  const { data: updated, error } = await supabase
    .from("platform_accounts")
    .update({ auto_republish_enabled: enabled, auto_republish_targets: finalTargets })
    .eq("user_id", userId)
    .eq("platform", platform)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, account: updated });
});

// GET /api/auto-republish/activity
router.get("/activity", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("auto_republish_jobs")
    .select("*")
    .eq("user_id", req.user.userId)
    .order("triggered_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ jobs: data || [] });
});

// PATCH /api/auto-republish/:jobId/retry
router.patch("/:jobId/retry", authenticateToken, async (req, res) => {
  const { data: job } = await supabase
    .from("auto_republish_jobs")
    .select("*")
    .eq("id", req.params.jobId)
    .eq("user_id", req.user.userId)
    .single();

  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "failed") return res.status(400).json({ error: "Only failed jobs can be retried" });

  // Reset status and re-enqueue
  await supabase.from("auto_republish_jobs")
    .update({ status: "pending", error_message: null })
    .eq("id", job.id);

  // Get the platform account to build the enqueue payload
  const { data: account } = await supabase
    .from("platform_accounts")
    .select("*")
    .eq("user_id", req.user.userId)
    .eq("platform", job.source_platform)
    .single();

  if (account) {
    const { repostQueue } = require("./reposts");
    const { data: repost, error: repErr } = await supabase.from("reposts").insert({
      user_id:          req.user.userId,
      source_account_id: account.id,
      source_video_id:  job.source_video_id,
      source_video_url: job.video_url,
      title:            job.video_title,
      destinations:     job.target_platforms,
      status:           "pending",
    }).select().single();

    if (!repErr && repost) {
      await repostQueue.add(
        "repost",
        { repostId: repost.id, autoJobId: job.id },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );
    }
  }

  res.json({ success: true });
});

module.exports = router;
