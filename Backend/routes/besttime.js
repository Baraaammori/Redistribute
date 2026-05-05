// ─── Best Time to Post Route ─────────────────────────────────────────────────
// GET /api/best-time              — Recommend best posting time per platform
// ─────────────────────────────────────────────────────────────────────────────
const router = require("express").Router();
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");

// Industry benchmark fallbacks (used when user has < MIN_DATA_POINTS posts)
// Based on published studies: Buffer 2024, Sprout Social 2024, Hootsuite 2024
const BENCHMARKS = {
  tiktok: [
    { dow: 2, hour: 9,  label: "Tuesday 9 AM",   reason: "Morning commute scroll peak" },
    { dow: 4, hour: 18, label: "Thursday 6 PM",  reason: "After-work TikTok session peak" },
    { dow: 5, hour: 20, label: "Friday 8 PM",    reason: "Weekend wind-down top engagement" },
    { dow: 0, hour: 11, label: "Sunday 11 AM",   reason: "Lazy Sunday browsing peak" },
  ],
  youtube: [
    { dow: 5, hour: 15, label: "Friday 3 PM",    reason: "End-of-week upload spike" },
    { dow: 6, hour: 10, label: "Saturday 10 AM", reason: "Weekend morning views peak" },
    { dow: 0, hour: 14, label: "Sunday 2 PM",    reason: "Sunday afternoon home viewing" },
    { dow: 3, hour: 17, label: "Wednesday 5 PM", reason: "Mid-week post-work traffic" },
  ],
  youtube_shorts: [
    { dow: 2, hour: 8,  label: "Tuesday 8 AM",   reason: "Morning Shorts feed scroll" },
    { dow: 4, hour: 19, label: "Thursday 7 PM",  reason: "Evening Shorts engagement peak" },
    { dow: 6, hour: 12, label: "Saturday 12 PM", reason: "Weekend midday Shorts peak" },
  ],
  instagram: [
    { dow: 1, hour: 11, label: "Monday 11 AM",   reason: "Monday Reels peak engagement" },
    { dow: 3, hour: 14, label: "Wednesday 2 PM", reason: "Mid-week Reels discovery peak" },
    { dow: 5, hour: 10, label: "Friday 10 AM",   reason: "Friday morning Reels scroll" },
  ],
  facebook: [
    { dow: 3, hour: 13, label: "Wednesday 1 PM", reason: "Mid-week Facebook peak" },
    { dow: 4, hour: 15, label: "Thursday 3 PM",  reason: "Thursday afternoon engagement" },
    { dow: 5, hour: 11, label: "Friday 11 AM",   reason: "Friday pre-weekend activity" },
  ],
};

const MIN_DATA_POINTS = 5; // need at least 5 posts to use personal data

// GET /api/best-time
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const timezone = req.query.timezone || "UTC";

  // Fetch user's analytics — join distributions (has created_at = actual post time)
  // with video_analytics (has views at fetched_at)
  const { data: analyticsData } = await supabase
    .from("video_analytics")
    .select(`
      views,
      likes,
      comments,
      fetched_at,
      platform,
      distribution_id,
      distributions!inner(created_at, completed_at)
    `)
    .eq("user_id", userId)
    .not("views", "is", null)
    .order("fetched_at", { ascending: true })
    .limit(500);

  const results = {};
  const platforms = ["tiktok", "youtube", "youtube_shorts", "instagram"];

  for (const platform of platforms) {
    const platformData = (analyticsData || []).filter(r => r.platform === platform);

    if (platformData.length >= MIN_DATA_POINTS) {
      results[platform] = analyzeUserData(platformData, timezone);
      results[platform].source = "your_data";
      results[platform].data_points = platformData.length;
    } else {
      // Fall back to benchmarks
      results[platform] = {
        source: "benchmarks",
        data_points: platformData.length,
        needed_for_personal: MIN_DATA_POINTS - platformData.length,
        recommendations: BENCHMARKS[platform] || [],
        best: BENCHMARKS[platform]?.[0] || null,
        note: `Post ${MIN_DATA_POINTS - platformData.length} more times to unlock your personal best-time data`,
      };
    }
  }

  res.json({
    timezone,
    generated_at: new Date().toISOString(),
    platforms: results,
  });
});

/**
 * Analyze user's actual post performance data to find best times.
 * Groups by day-of-week and hour, averages engagement score.
 */
function analyzeUserData(analyticsData, timezone) {
  const buckets = {}; // key: "dow_hour" → { totalEngagement, count }

  for (const row of analyticsData) {
    // Use completed_at (actual post time) if available, else created_at
    const postTimeStr = row.distributions?.completed_at || row.distributions?.created_at;
    if (!postTimeStr) continue;

    // Convert to target timezone
    const postDate = new Date(postTimeStr);
    const localStr = postDate.toLocaleString("en-US", { timeZone: timezone, hour12: false,
      weekday: "short", hour: "numeric" });

    // Parse dow and hour from locale string like "Thu, 18"
    const parts = localStr.split(", ");
    if (parts.length < 2) continue;

    const dowMap = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
    const dow = dowMap[parts[0]] ?? -1;
    const hour = parseInt(parts[1]);
    if (dow < 0 || isNaN(hour)) continue;

    const key = `${dow}_${hour}`;
    if (!buckets[key]) buckets[key] = { dow, hour, totalViews: 0, totalLikes: 0, count: 0 };

    const engagementScore = (row.views || 0) + (row.likes || 0) * 3 + (row.comments || 0) * 5;
    buckets[key].totalViews += row.views || 0;
    buckets[key].totalLikes += row.likes || 0;
    buckets[key].count++;
    buckets[key].totalEngagement = (buckets[key].totalEngagement || 0) + engagementScore;
  }

  const sorted = Object.values(buckets)
    .map(b => ({
      dow: b.dow,
      hour: b.hour,
      avgViews: Math.round(b.totalViews / b.count),
      avgLikes: Math.round(b.totalLikes / b.count),
      avgEngagement: Math.round(b.totalEngagement / b.count),
      sampleSize: b.count,
      label: formatDowHour(b.dow, b.hour),
      reason: `Your posts at this time average ${Math.round(b.totalViews / b.count).toLocaleString()} views`,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 4);

  return {
    recommendations: sorted,
    best: sorted[0] || null,
    heatmap: buildHeatmap(buckets),
  };
}

function formatDowHour(dow, hour) {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${days[dow]} ${h12} ${ampm}`;
}

function buildHeatmap(buckets) {
  // Returns a 7×24 matrix for the frontend heatmap chart
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  const values = Object.values(buckets).map(b => b.totalEngagement / b.count);
  const maxVal = Math.max(...values, 1);

  for (const [key, bucket] of Object.entries(buckets)) {
    const normalized = Math.round((bucket.totalEngagement / bucket.count / maxVal) * 100);
    matrix[bucket.dow][bucket.hour] = normalized;
  }
  return matrix;
}

module.exports = router;
