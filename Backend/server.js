require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app = express();

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

app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/accounts",      require("./routes/accounts"));
app.use("/api/videos",        require("./routes/videos"));
app.use("/api/reposts",       require("./routes/reposts"));
app.use("/api/stripe",        require("./routes/stripe"));
app.use("/api/upload",        require("./routes/upload"));
app.use("/api/best-time",     require("./routes/besttime"));
app.use("/api/auto-republish",require("./routes/autoRepublish"));

// ── WORKERS & POLLERS ─────────────────────────────────────────────────────────
require("./lib/distributionWorker");

const { startAnalyticsPoller }     = require("./lib/analyticsPoller");
const { startAutoRepublishPoller } = require("./workers/autoRepublishPoller");
startAnalyticsPoller();
startAutoRepublishPoller();

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
