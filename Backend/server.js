require("dotenv").config();
const express = require("express");
const cors    = require("cors");

// ── STRIPE ENV CHECK — warn only, do not exit (routes use lazy-init) ──────────
const REQUIRED_STRIPE = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_PRICE_ID"];
const missingStripe = REQUIRED_STRIPE.filter(k => !process.env[k]);
if (missingStripe.length) {
  console.error(`⚠️  Missing Stripe env vars: ${missingStripe.join(", ")} — billing routes will return 503`);
}

const app = express();

// ── BINARY STARTUP CHECKS ─────────────────────────────────────────────────────
const { existsSync } = require("fs");
const { execSync }   = require("child_process");

const ytDlpPath = process.env.YT_DLP_PATH || require("path").join(__dirname, "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
const ytDlpOk = existsSync(ytDlpPath) || (() => { try { execSync(`${ytDlpPath} --version`, { stdio: "ignore" }); return true; } catch { return false; } })();
console.log(`[yt-dlp]    ${ytDlpOk ? `✓ found at ${ytDlpPath}` : `🚨 NOT FOUND at ${ytDlpPath} — repost jobs will fail. Set YT_DLP_PATH=yt-dlp and add yt-dlp to nixpacks.toml`}`);

try { execSync("ffmpeg -version", { stdio: "ignore" }); console.log("[ffmpeg]    ✓ found"); }
catch { console.error("[ffmpeg]    🚨 NOT FOUND — auto-cutter and captions will fail"); }

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

app.use(express.json());

// ── SAFE REQUIRE — one broken module won't take down the whole server ─────────
const routeStatus = {};
function safeRequire(modPath) {
  try {
    const mod = require(modPath);
    routeStatus[modPath] = "ok";
    return mod;
  } catch (e) {
    routeStatus[modPath] = e.message;
    console.error(`[boot] FAILED to load ${modPath}: ${e.message}`);
    const stub = require("express").Router();
    stub.use((_req, res) => res.status(503).json({ error: `Route module unavailable: ${e.message}` }));
    return stub;
  }
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
// Core SaaS (simple-saas)
app.use("/api/auth",           safeRequire("./routes/auth"));
app.use("/api/accounts",       safeRequire("./routes/accounts"));
app.use("/api/videos",         safeRequire("./routes/videos"));
app.use("/api/reposts",        safeRequire("./routes/reposts"));
app.use("/api/stripe",         safeRequire("./routes/stripe"));
app.use("/api/billing",        safeRequire("./routes/billing"));
app.use("/api/best-time",      safeRequire("./routes/besttime"));
app.use("/api/auto-republish", safeRequire("./routes/autoRepublish"));

// Video editor (v2-video-editor)
app.use("/api/upload",         safeRequire("./routes/upload"));
app.use("/api/captions",       safeRequire("./routes/captions"));
app.use("/api/ai-clip",        safeRequire("./routes/ai-clip"));
app.use("/api/broll",          safeRequire("./routes/broll"));
app.use("/api/settings",       safeRequire("./routes/settings"));

// Auto-cut
app.use("/api/auto-cut",       safeRequire("./routes/auto-cut"));

// Admin & shop
app.use("/api/admin",          safeRequire("./routes/admin"));
app.use("/api/shop",           safeRequire("./routes/shop"));

// ── WORKERS & POLLERS ─────────────────────────────────────────────────────────
try { require("./lib/distributionWorker"); }   catch (e) { console.error("[distributionWorker] failed to load:", e.message); }
try { require("./workers/autoCutterWorker"); } catch (e) { console.error("[autoCutterWorker] failed to load:", e.message); }

try {
  const { startAnalyticsPoller }     = require("./lib/analyticsPoller");
  const { startAutoRepublishPoller } = require("./workers/autoRepublishPoller");
  const { startMonthlyResetCron }    = require("./workers/resetMonthlyLimits");
  startAnalyticsPoller();
  startAutoRepublishPoller();
  startMonthlyResetCron();
} catch (e) {
  console.error("[pollers] failed to start:", e.message);
}

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date(), routeStatus }));

// ── 404 JSON HANDLER ──────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not Found", path: req.path }));

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
app.listen(PORT, '0.0.0.0', () => console.log(`✅  Redistribute API running on port ${PORT}`));
