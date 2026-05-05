// ─── Analytics Poller ────────────────────────────────────────────────────────
// Polls YouTube & TikTok analytics every 6 hours via node-cron.
// Stores metrics in `video_analytics` table for the Best Time widget.
// Also handles monthly reposts reset on the 1st of each month.
// ─────────────────────────────────────────────────────────────────────────────
const cron = require("node-cron");
const axios = require("axios");
const { google } = require("googleapis");
const supabase = require("./supabase");

// ── YouTube Analytics ─────────────────────────────────────────────────────────

async function pollYouTubeAnalytics() {
  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("user_id, access_token, refresh_token")
    .eq("platform", "youtube");

  if (!accounts?.length) return;

  for (const account of accounts) {
    try {
      const auth = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
      );
      auth.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      // Get recent distributions to this account
      const { data: dists } = await supabase
        .from("distributions")
        .select("id, platform_post_id, distributed_at")
        .eq("user_id", account.user_id)
        .eq("platform", "youtube")
        .eq("status", "success")
        .not("platform_post_id", "is", null)
        .order("distributed_at", { ascending: false })
        .limit(50);

      if (!dists?.length) continue;

      const youtube = google.youtube({ version: "v3", auth });

      for (const dist of dists) {
        try {
          const statsRes = await youtube.videos.list({
            part: ["statistics"],
            id: [dist.platform_post_id],
          });
          const video = statsRes.data.items?.[0];
          if (!video) continue;

          const stats = video.statistics;
          const postedAt = new Date(dist.distributed_at);

          await supabase.from("video_analytics").upsert({
            distribution_id: dist.id,
            user_id: account.user_id,
            platform: "youtube",
            views: parseInt(stats.viewCount) || 0,
            likes: parseInt(stats.likeCount) || 0,
            comments: parseInt(stats.commentCount) || 0,
            posted_at: dist.distributed_at,
            day_of_week: postedAt.getDay(),
            hour_of_day: postedAt.getHours(),
            fetched_at: new Date().toISOString(),
          }, { onConflict: "distribution_id" });
        } catch (e) {
          // Individual video errors don't abort the loop
        }
      }
    } catch (err) {
      console.error(`[analytics] YouTube poll error (user ${account.user_id}):`, err.message);
    }
  }
}

// ── TikTok Analytics ──────────────────────────────────────────────────────────

async function pollTikTokAnalytics() {
  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("user_id, access_token")
    .eq("platform", "tiktok");

  if (!accounts?.length) return;

  for (const account of accounts) {
    try {
      const { data: dists } = await supabase
        .from("distributions")
        .select("id, platform_post_id, distributed_at")
        .eq("user_id", account.user_id)
        .eq("platform", "tiktok")
        .eq("status", "success")
        .not("platform_post_id", "is", null)
        .order("distributed_at", { ascending: false })
        .limit(20);

      if (!dists?.length) continue;

      const videoIds = dists.map(d => d.platform_post_id).filter(Boolean);

      const res = await axios.post(
        "https://open.tiktokapis.com/v2/video/query/",
        {
          filters: { video_ids: videoIds },
          fields: ["id", "view_count", "like_count", "comment_count"],
        },
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );

      const videos = res.data?.data?.videos || [];
      for (const v of videos) {
        const dist = dists.find(d => d.platform_post_id === v.id);
        if (!dist) continue;
        const postedAt = new Date(dist.distributed_at);

        await supabase.from("video_analytics").upsert({
          distribution_id: dist.id,
          user_id: account.user_id,
          platform: "tiktok",
          views: v.view_count || 0,
          likes: v.like_count || 0,
          comments: v.comment_count || 0,
          posted_at: dist.distributed_at,
          day_of_week: postedAt.getDay(),
          hour_of_day: postedAt.getHours(),
          fetched_at: new Date().toISOString(),
        }, { onConflict: "distribution_id" });
      }
    } catch (err) {
      console.error(`[analytics] TikTok poll error (user ${account.user_id}):`, err.message);
    }
  }
}

// ── Monthly Reposts Reset ─────────────────────────────────────────────────────

async function resetMonthlyReposts() {
  console.log("[cron] Resetting monthly repost counters…");
  const { error } = await supabase
    .from("users")
    .update({
      reposts_used_this_month: 0,
      reposts_reset_at: new Date().toISOString(),
    })
    .lt("reposts_reset_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  if (error) console.error("[cron] Monthly reset error:", error.message);
  else console.log("[cron] Monthly repost counters reset.");
}

// ── Schedule ──────────────────────────────────────────────────────────────────

function startAnalyticsPoller() {
  // Poll analytics every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    console.log("[analytics] Starting analytics poll…");
    await Promise.allSettled([
      pollYouTubeAnalytics(),
      pollTikTokAnalytics(),
    ]);
  });

  // Reset reposts on 1st of every month at midnight
  cron.schedule("0 0 1 * *", resetMonthlyReposts);

  console.log("[analytics] Poller scheduled (every 6h) + monthly reset on 1st");
}

module.exports = { startAnalyticsPoller };
