const router  = require("express").Router();
const axios   = require("axios");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

// ── GET /api/accounts  ─────────────────────────────────────────────────────────
router.get("/", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("platform_accounts")
    .select("id, platform, handle, display_name, follower_count, connected_at")
    .eq("user_id", req.user.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/accounts/:platform  ───────────────────────────────────────────
router.delete("/:platform", authenticateToken, async (req, res) => {
  await supabase
    .from("platform_accounts")
    .delete()
    .eq("user_id", req.user.userId)
    .eq("platform", req.params.platform);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════
// YOUTUBE
// ════════════════════════════════════════════════════════════════════
function getYtOAuth() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

// GET /api/accounts/youtube/auth-url
router.get("/youtube/auth-url", authenticateToken, (req, res) => {
  const url = getYtOAuth().generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    state: req.user.userId,
  });
  res.json({ url });
});

// GET /api/accounts/youtube/callback
router.get("/youtube/callback", async (req, res) => {
  const { code, state: userId } = req.query;
  const auth = getYtOAuth();
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  const yt = google.youtube({ version: "v3", auth });
  const { data } = await yt.channels.list({ part: ["snippet"], mine: true });
  const ch = data.items[0];

  await supabase.from("platform_accounts").upsert({
    user_id: userId,
    platform: "youtube",
    handle: ch.snippet.customUrl || ch.snippet.title,
    display_name: ch.snippet.title,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expiry_date),
  }, { onConflict: "user_id,platform" });

  res.redirect(`${process.env.FRONTEND_URL}/dashboard/accounts?connected=youtube`);
});

// ════════════════════════════════════════════════════════════════════
// TIKTOK
// ════════════════════════════════════════════════════════════════════

// GET /api/accounts/tiktok/auth-url
router.get("/tiktok/auth-url", authenticateToken, (req, res) => {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    scope: "video.list,video.upload",
    response_type: "code",
    redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    state: req.user.userId,
  });
  res.json({ url: `https://www.tiktok.com/v2/auth/authorize/?${params}` });
});

// GET /api/accounts/tiktok/callback
router.get("/tiktok/callback", async (req, res) => {
  const { code, state: userId } = req.query;
  const { data: tokenData } = await axios.post(
    "https://open.tiktokapis.com/v2/oauth/token/",
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const { data: userInfo } = await axios.get(
    "https://open.tiktokapis.com/v2/user/info/",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      params: { fields: "open_id,display_name,follower_count" },
    }
  );
  const u = userInfo.data.user;
  await supabase.from("platform_accounts").upsert({
    user_id: userId,
    platform: "tiktok",
    handle: u.display_name,
    display_name: u.display_name,
    follower_count: u.follower_count,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
  }, { onConflict: "user_id,platform" });

  res.redirect(`${process.env.FRONTEND_URL}/dashboard/accounts?connected=tiktok`);
});

// ════════════════════════════════════════════════════════════════════
// INSTAGRAM
// ════════════════════════════════════════════════════════════════════

// GET /api/accounts/instagram/auth-url
router.get("/instagram/auth-url", authenticateToken, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
    scope: "instagram_basic,instagram_content_publish",
    response_type: "code",
    state: req.user.userId,
  });
  res.json({ url: `https://api.instagram.com/oauth/authorize?${params}` });
});

// GET /api/accounts/instagram/callback
router.get("/instagram/callback", async (req, res) => {
  const { code, state: userId } = req.query;
  // Short-lived token
  const { data: shortToken } = await axios.post(
    "https://api.instagram.com/oauth/access_token",
    new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
      code,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  // Exchange for long-lived token
  const { data: longToken } = await axios.get("https://graph.instagram.com/access_token", {
    params: {
      grant_type: "ig_exchange_token",
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      access_token: shortToken.access_token,
    },
  });
  const { data: profile } = await axios.get("https://graph.instagram.com/me", {
    params: { fields: "username,followers_count", access_token: longToken.access_token },
  });
  await supabase.from("platform_accounts").upsert({
    user_id: userId,
    platform: "instagram",
    handle: `@${profile.username}`,
    display_name: profile.username,
    follower_count: profile.followers_count,
    access_token: longToken.access_token,
    expires_at: new Date(Date.now() + longToken.expires_in * 1000),
  }, { onConflict: "user_id,platform" });

  res.redirect(`${process.env.FRONTEND_URL}/dashboard/accounts?connected=instagram`);
});

module.exports = router;
