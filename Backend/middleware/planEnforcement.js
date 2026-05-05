// ─── Plan Enforcement Middleware ──────────────────────────────────────────────
// Checks the user's subscription plan before allowing distribution actions.
// Mount on routes that consume reposts (e.g., POST /api/reposts).
// ─────────────────────────────────────────────────────────────────────────────
const supabase = require("../lib/supabase");

const PLAN_LIMITS = {
  free: 5,
  starter: 50,
  pro: 300,
  business: Infinity,
};

async function enforcePlan(req, res, next) {
  const userId = req.user?.userId || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: user, error } = await supabase
    .from("users")
    .select("plan, reposts_used_this_month, reposts_reset_at")
    .eq("id", userId)
    .single();

  if (error || !user) return res.status(401).json({ error: "User not found" });

  const plan = user.plan || "free";
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  // Auto-reset if past the 1st of this month (safety net if cron missed)
  const now = new Date();
  const resetAt = user.reposts_reset_at ? new Date(user.reposts_reset_at) : null;
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!resetAt || resetAt < firstOfMonth) {
    await supabase
      .from("users")
      .update({ reposts_used_this_month: 0, reposts_reset_at: now.toISOString() })
      .eq("id", userId);
    user.reposts_used_this_month = 0;
  }

  const used = user.reposts_used_this_month || 0;

  if (used >= limit) {
    return res.status(402).json({
      error: "Monthly repost limit reached",
      plan,
      used,
      limit,
      upgrade_url: "/dashboard/billing",
    });
  }

  // Attach plan info for downstream use
  req.planInfo = { plan, used, limit };
  next();
}

module.exports = { enforcePlan };
