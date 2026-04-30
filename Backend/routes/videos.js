const router  = require("express").Router();
const axios   = require("axios");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

// GET /api/videos?platform=youtube|tiktok|instagram
router.get("/", authenticateToken, async (req, res) => {
  const { platform } = req.query;
  if (!platform) return res.status(400).json({ error: "platform query param required" });

  const { data: account } = await supabase
    .from("platform_accounts")
    .select("*")
    .eq("user_id", req.user.userId)
    .eq("platform", platform)
    .single();

  if (!account) return res.status(404).json({ error: `${platform} account not connected` });

  try {
    if (platform === "youtube") {
      const auth = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET
      );
      auth.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });
      const yt = google.youtube({ version: "v3", auth });
      const { data } = await yt.search.list({
        part: ["snippet"],
        forMine: true,
        type: ["video"],
        maxResults: 25,
        order: "date",
      });
      return res.json(data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.medium?.url,
        publishedAt: item.snippet.publishedAt,
        platform: "youtube",
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      })));
    }

    if (platform === "tiktok") {
      const { data } = await axios.post(
        "https://open.tiktokapis.com/v2/video/list/",
        { max_count: 20 },
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            "Content-Type": "application/json",
          },
          params: { fields: "id,title,cover_image_url,create_time,duration,share_url" },
        }
      );
      return res.json((data.data?.videos || []).map(v => ({
        id: v.id,
        title: v.title || "Untitled",
        thumbnail: v.cover_image_url,
        publishedAt: new Date(v.create_time * 1000),
        duration: v.duration,
        platform: "tiktok",
        url: v.share_url,
      })));
    }

    if (platform === "instagram") {
      const { data } = await axios.get("https://graph.instagram.com/me/media", {
        params: {
          fields: "id,caption,media_type,thumbnail_url,media_url,timestamp,permalink",
          access_token: account.access_token,
        },
      });
      return res.json(
        (data.data || [])
          .filter(m => m.media_type === "VIDEO" || m.media_type === "REELS")
          .map(m => ({
            id: m.id,
            title: m.caption?.split("\n")[0]?.slice(0, 80) || "Untitled",
            thumbnail: m.thumbnail_url,
            publishedAt: m.timestamp,
            platform: "instagram",
            url: m.permalink,
          }))
      );
    }

    res.status(400).json({ error: "Unknown platform" });
  } catch (err) {
    console.error("Video fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch videos: " + err.message });
  }
});

module.exports = router;
