require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ── TIKTOK VERIFICATION (must be FIRST, before any other middleware) ──────────
const tiktokStr = "tiktok-developers-site-verification=bghKrrlfRtF6BKysbfBCv0nrPTK70xQW";
app.use((req, res, next) => {
  if (req.path.toLowerCase().includes("tiktok-developers-site-verification")) {
    console.log(`🔍 TikTok verification hit: ${req.method} ${req.originalUrl}`);
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
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/admin",    require("./routes/admin"));
app.use("/api/shop",     require("./routes/shop"));
app.use("/api/accounts", require("./routes/accounts"));
app.use("/api/videos",   require("./routes/videos"));
app.use("/api/reposts",  require("./routes/reposts"));
app.use("/api/stripe",   require("./routes/stripe"));
app.use("/api/upload",   require("./routes/upload"));

// ── DISTRIBUTION WORKER (processes upload → platform jobs) ────────────────────
require("./lib/distributionWorker");

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok", ts: new Date() }));

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅  Redistribute API running on http://localhost:${PORT}`));
