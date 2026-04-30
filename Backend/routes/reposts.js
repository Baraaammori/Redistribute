const router  = require("express").Router();
const { Queue, Worker } = require("bullmq");
const axios   = require("axios");
const fs      = require("fs");
const path    = require("path");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const connection = require("../lib/redis");

// ── Queue setup ───────────────────────────────────────────────────────────────
const repostQueue = new Queue("reposts", { connection });

// ── Worker (processes jobs) ───────────────────────────────────────────────────
const worker = new Worker("reposts", async job => {
  const { repostId } = job.data;

  const { data: repost } = await supabase
    .from("reposts")
    .select("*, source_account:platform_accounts(*)")
    .eq("id", repostId)
    .single();

  if (!repost) throw new Error("Repost not found");

  await supabase.from("reposts").update({ status: "processing" }).eq("id", repostId);

  let videoPath;
  try {
    // 1. Download source video
    videoPath = await downloadVideo(repost.source_video_url, repost.id);

    // 2. Upload to each destination
    for (const dest of repost.destinations) {
      const { data: destAccount } = await supabase
        .from("platform_accounts")
        .select("*")
        .eq("user_id", repost.user_id)
        .eq("platform", dest)
        .single();

      if (!destAccount) {
        console.warn(`No ${dest} account for user ${repost.user_id}, skipping`);
        continue;
      }

      if (dest === "youtube")   await uploadToYouTube(videoPath, repost.title, destAccount);
      if (dest === "tiktok")    await uploadToTikTok(videoPath, repost.title, destAccount);
      if (dest === "instagram") await uploadToInstagram(videoPath, repost.title, destAccount);
    }

    await supabase.from("reposts").update({ status: "done" }).eq("id", repostId);
  } catch (err) {
    await supabase.from("reposts").update({ status: "failed", error: err.message }).eq("id", repostId);
    throw err;
  } finally {
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
  }
}, { connection, concurrency: 2 });

worker.on("failed", (job, err) => console.error(`Job ${job.id} failed:`, err.message));

// ── Helpers ───────────────────────────────────────────────────────────────────
async function downloadVideo(url, id) {
  const dest = path.join("/tmp", `redistribute_${id}.mp4`);
  const writer = fs.createWriteStream(dest);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(dest));
    writer.on("error", reject);
  });
}

async function uploadToYouTube(videoPath, title, account) {
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
  const yt = google.youtube({ version: "v3", auth });
  await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title: title || "Posted via Redistribute.io", description: "Redistributed via redistribute.io" },
      status:  { privacyStatus: "public" },
    },
    media: { body: fs.createReadStream(videoPath) },
  });
}

async function uploadToTikTok(videoPath, title, account) {
  const stat = fs.statSync(videoPath);
  const { data: init } = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      post_info: { title: title || "Posted via Redistribute.io", privacy_level: "PUBLIC_TO_EVERYONE", disable_duet: false, disable_stitch: false, disable_comment: false },
      source_info: { source: "FILE_UPLOAD", video_size: stat.size, chunk_size: stat.size, total_chunk_count: 1 },
    },
    { headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" } }
  );
  const buffer = fs.readFileSync(videoPath);
  await axios.put(init.data.upload_url, buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${buffer.length - 1}/${buffer.length}`,
    },
  });
}

async function uploadToInstagram(videoPath, title, account) {
  // Instagram requires a public URL — you need to upload to storage first.
  // Implement uploadToStorage() using Supabase Storage or S3.
  throw new Error(
    "Instagram upload requires a public video URL. Implement uploadToStorage() using Supabase Storage."
  );
}

// ── ROUTES ────────────────────────────────────────────────────────────────────

// POST /api/reposts
router.post("/", authenticateToken, async (req, res) => {
  const { sourceVideoId, sourceVideoUrl, sourcePlatform, title, thumbnailUrl, destinations, scheduledFor } = req.body;

  if (!destinations?.length) return res.status(400).json({ error: "At least one destination required" });

  // Plan/trial check
  const { data: user } = await supabase.from("users").select("plan, trial_ends_at").eq("id", req.user.userId).single();
  const onTrial = user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();
  const isPro = user?.plan === "pro" || user?.plan === "team";

  if (!isPro && !onTrial) {
    // Free plan: 3 reposts/month
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { count } = await supabase.from("reposts").select("id", { count: "exact" })
      .eq("user_id", req.user.userId).gte("created_at", monthStart.toISOString());
    if (count >= 3) return res.status(403).json({ error: "Free plan limit reached. Upgrade to Pro." });
  }

  const { data: sourceAccount } = await supabase
    .from("platform_accounts").select("id").eq("user_id", req.user.userId).eq("platform", sourcePlatform).single();
  if (!sourceAccount) return res.status(404).json({ error: `${sourcePlatform} account not connected` });

  const { data: repost, error } = await supabase.from("reposts").insert({
    user_id: req.user.userId,
    source_account_id: sourceAccount.id,
    source_video_id: sourceVideoId,
    source_video_url: sourceVideoUrl,
    title,
    thumbnail_url: thumbnailUrl,
    destinations,
    scheduled_for: scheduledFor || null,
    status: scheduledFor ? "scheduled" : "pending",
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  const delay = scheduledFor ? Math.max(0, new Date(scheduledFor) - Date.now()) : 0;
  const job = await repostQueue.add("repost", { repostId: repost.id }, { delay, attempts: 3, backoff: { type: "exponential", delay: 5000 } });

  await supabase.from("reposts").update({ job_id: job.id }).eq("id", repost.id);
  res.json(repost);
});

// GET /api/reposts
router.get("/", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("reposts")
    .select("*")
    .eq("user_id", req.user.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/reposts/:id
router.delete("/:id", authenticateToken, async (req, res) => {
  await supabase.from("reposts").delete().eq("id", req.params.id).eq("user_id", req.user.userId);
  res.json({ ok: true });
});

// POST /api/reposts/:id/retry
router.post("/:id/retry", authenticateToken, async (req, res) => {
  const { data: repost } = await supabase.from("reposts").select("*").eq("id", req.params.id).eq("user_id", req.user.userId).single();
  if (!repost) return res.status(404).json({ error: "Not found" });
  await supabase.from("reposts").update({ status: "pending", error: null }).eq("id", req.params.id);
  await repostQueue.add("repost", { repostId: repost.id }, { attempts: 3 });
  res.json({ ok: true });
});

module.exports = router;
