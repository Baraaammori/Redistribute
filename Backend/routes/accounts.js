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
    scope: "user.info.basic,user.info.profile,user.info.stats,video.list,video.upload,video.publish",
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
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management",
    response_type: "code",
    state: req.user.userId,
  });
  res.json({ url: `https://www.facebook.com/v19.0/dialog/oauth?${params}` });
});

// GET /api/accounts/instagram/callback
router.get("/instagram/callback", async (req, res) => {
  const { code, state: userId } = req.query;
  try {
    // 1. Exchange code for access token using Facebook Graph
    const { data: tokenData } = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          client_id: process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
          code,
        }
      }
    );

    console.log("✅ Got Facebook access token");

    // 2. Fetch Facebook Pages (use fields to get page access_token)
    const { data: pages } = await axios.get("https://graph.facebook.com/v19.0/me/accounts", {
      params: {
        fields: "id,name,access_token,instagram_business_account",
        access_token: tokenData.access_token,
      }
    });

    console.log(`📄 Found ${pages.data?.length || 0} Facebook Pages`);

    let igUserId = null;
    let pageName = "Instagram Account";
    let pageAccessToken = null;

    for (const page of (pages.data || [])) {
      console.log(`  → Checking page: ${page.name} (${page.id})`);

      // Check if instagram_business_account is already in the response
      if (page.instagram_business_account) {
        igUserId = page.instagram_business_account.id;
        pageName = page.name;
        pageAccessToken = page.access_token;
        console.log(`  ✅ Found IG account ${igUserId} directly on page ${page.name}`);
        break;
      }

      // If not, query the page using the PAGE access token (not user token)
      try {
        const { data: pageDetails } = await axios.get(
          `https://graph.facebook.com/v19.0/${page.id}`,
          {
            params: {
              fields: "instagram_business_account",
              access_token: page.access_token, // Use PAGE token, not user token
            }
          }
        );
        console.log(`  → Page details for ${page.name}:`, JSON.stringify(pageDetails));
        if (pageDetails.instagram_business_account) {
          igUserId = pageDetails.instagram_business_account.id;
          pageName = page.name;
          pageAccessToken = page.access_token;
          console.log(`  ✅ Found IG account ${igUserId} via page query`);
          break;
        }
      } catch (e) {
        console.error(`  ❌ Error checking page ${page.name}:`, e.response?.data || e.message);
      }
    }

    if (!igUserId) {
      console.error("❌ No linked Instagram Professional account found on any Facebook Page.");
      console.error("Pages data:", JSON.stringify(pages.data, null, 2));
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/accounts?error=no_ig_linked`);
    }

    // 3. Save the IG User ID and the PAGE access token (not user token)
    await supabase.from("platform_accounts").upsert({
      user_id: userId,
      platform: "instagram",
      handle: igUserId,
      display_name: `Linked via ${pageName}`,
      follower_count: 0,
      access_token: pageAccessToken || tokenData.access_token,
      expires_at: new Date(Date.now() + 5184000 * 1000), // ~60 days
    }, { onConflict: "user_id,platform" });

    console.log(`✅ Instagram connected! IG User ID: ${igUserId}, Page: ${pageName}`);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/accounts?connected=instagram`);
  } catch (error) {
    console.error("❌ Instagram Auth Error:", error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/accounts?error=instagram_auth_failed`);
  }
});

module.exports = router;
