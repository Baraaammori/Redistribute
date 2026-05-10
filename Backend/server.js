require("dotenv").config();
const express = require("express");
const cors    = require("cors");

// ── STRIPE ENV CHECK (fail fast before accepting traffic) ─────────────────────
const REQUIRED_STRIPE = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_PRICE_ID"];
const missingStripe = REQUIRED_STRIPE.filter(k => !process.env[k]);
if (missingStripe.length) {
  console.error(`❌  Missing required Stripe env vars: ${missingStripe.join(", ")}`);
  console.error("    Add them to .env and restart the server.");
  process.exit(1);
}

const app = express();

// ── PLATFORM CREDENTIAL STARTUP HEALTH CHECK ──────────────────────────────────
const ytOk = !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
const ttOk = !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
const igOk = !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);

console.log(`[youtube]   ${ytOk ? "✓ credentials loaded" : "⚠ MISSING — YouTube OAuth will fail"}`);
console.log(`[tiktok]    ${ttOk ? "✓ credentials loaded | client_key=" + (process.env.TIKTOK_CLIENT_KEY?.slice(0, 6) || "") + "…" : "⚠ MISSING — TikTok token refresh WILL fail"}`);
console.log(`[instagram] ${igOk ? "✓ credentials loaded" : "⚠ MISSING — Instagram OAuth will fail"}`);

// ── TIKTOK VERIFICATION (must be first, before any other middleware) ──────────
const tiktokStr = "tiktok-developers-site-verification=bghKrrlfRtF6BKysbfBCv0nrPTK70xQW";
app.use((req, res, next) => {
  if (req.path.toLowerCase().includes("tiktok-developers-site-verification")) {
    return res.status(200).type("text/plain").send(tiktokStr);
  }
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// Stripe webhook needs raw body — must be before express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Apple callback is form_post
app.use("/api/auth/apple/callback", express.urlencoded({ extended: true }));

app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/accounts",      require("./routes/accounts"));
app.use("/api/videos",        require("./routes/videos"));
app.use("/api/reposts",       require("./routes/reposts"));
app.use("/api/stripe",        require("./routes/stripe"));
app.use("/api/billing",       require("./routes/billing"));
app.use("/api/best-time",     require("./routes/besttime"));
app.use("/api/auto-republish",require("./routes/autoRepublish"));

// ── WORKERS & POLLERS ─────────────────────────────────────────────────────────
require("./lib/distributionWorker");

const { startAnalyticsPoller }     = require("./lib/analyticsPoller");
const { startAutoRepublishPoller } = require("./workers/autoRepublishPoller");
const { startMonthlyResetCron }    = require("./workers/resetMonthlyLimits");

startAnalyticsPoller();
startAutoRepublishPoller();
startMonthlyResetCron();

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const isDev = process.env.NODE_ENV !== "production";
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(isDev ? { stack: err.stack } : {}),
  });
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅  Redistribute API running on http://localhost:${PORT}`));
