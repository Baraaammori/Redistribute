const router = require("express").Router();
const supabase = require("../lib/supabase");
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw Object.assign(new Error("Stripe not configured"), { status: 503 });
    _stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
const { authenticateToken } = require("../middleware/auth");

// In-memory cache: { [userId]: { data, cachedAt } }
const statusCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function withStripeRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.statusCode === 500 || err.statusCode === 503) {
      await new Promise(r => setTimeout(r, 2000));
      return await fn();
    }
    throw err;
  }
}

// GET /api/billing/status
router.get("/status", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  const cached = statusCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const { data: user } = await supabase
      .from("users")
      .select("plan, stripe_customer_id, stripe_sub_id, trial_ends_at")
      .eq("id", userId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });

    // Compute monthly reposts used live from reposts table
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count: repostsUsed } = await supabase
      .from("reposts")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString());

    // Auto-republish enabled platform count
    const { data: arAccounts } = await supabase
      .from("platform_accounts")
      .select("platform")
      .eq("user_id", userId)
      .eq("auto_republish_enabled", true);
    const autoRepublishCount = arAccounts?.length ?? 0;

    const isPro = user.plan === "pro" || user.plan === "team";
    const repostsLimit = isPro ? null : 3;

    // Reset date: 1st of next month
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let stripeStatus = {
      status: isPro ? "active" : "free",
      current_period_end: null,
      cancel_at: null,
    };

    if (user.stripe_sub_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const sub = await withStripeRetry(() =>
          getStripe().subscriptions.retrieve(user.stripe_sub_id)
        );
        stripeStatus = {
          status: sub.status, // active, past_due, canceled, trialing, etc.
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        };
      } catch (err) {
        console.error("[billing/status] Stripe subscription lookup failed:", err.message);
      }
    }

    const result = {
      plan: user.plan || "free",
      status: stripeStatus.status,
      current_period_end: stripeStatus.current_period_end,
      cancel_at: stripeStatus.cancel_at,
      reposts_used: repostsUsed ?? 0,
      reposts_limit: repostsLimit,
      auto_republish_count: autoRepublishCount,
      reset_date: resetDate.toISOString(),
    };

    statusCache.set(userId, { data: result, cachedAt: Date.now() });
    res.json(result);
  } catch (err) {
    console.error("[billing/status] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/invoices — last 5 invoices from Stripe
router.get("/invoices", authenticateToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", req.user.userId)
      .single();

    if (!user?.stripe_customer_id) return res.json([]);

    const invoices = await withStripeRetry(() =>
      getStripe().invoices.list({ customer: user.stripe_customer_id, limit: 5 })
    );

    const result = invoices.data.map(inv => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: inv.amount_paid / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status, // paid, open, void, uncollectible
      pdf: inv.invoice_pdf,
    }));

    res.json(result);
  } catch (err) {
    console.error("[billing/invoices] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
