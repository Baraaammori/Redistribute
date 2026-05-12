// ─── Auto-Republish Poller ────────────────────────────────────────────────────
// Runs as a BullMQ repeatable job every 10 minutes.
// For each user with auto_republish_enabled = true on any platform_account,
// checks for new videos and enqueues a repost job when a new one is found.
// ─────────────────────────────────────────────────────────────────────────────
const { Queue, Worker } = require("bullmq");
const axios   = require("axios");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const connection = require("../lib/redis");
const { refreshTokenIfExpired } = require("../lib/tokenRefresh");

const POLL_QUEUE_NAME = "auto-republish-poll";
const pollQueue = new Queue(POLL_QUEUE_NAME, { connection });

// ── Platform API helpers ──────────────────────────────────────────────────────

async function fetchLatestYouTubeVideo(account) {
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || "postmessage"
  );
  auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
  const yt = google.youtube({ version: "v3", auth });

  // Get the channel ID from the account handle (stored during OAuth)
  const channelsRes = await yt.channels.list({ part: ["id"], mine: true });
  const channelId = channelsRes.data.items?.[0]?.id;
  if (!channelId) return null;

  const res = await yt.search.list({
    part:      ["snippet"],
    channelId,
    maxResults: 1,
    order:      "date",
    type:       ["video"],
  });
  const item = res.data.items?.[0];
  if (!item) return null;
  return {
    id:    item.id.videoId,
    title: item.snippet.title,
    url:   `https://www.youtube.com/watch?v=${item.id.videoId}`,
  };
}

async function fetchLatestTikTokVideo(account) {
  const res = await axios.post(
    "https://open.tiktokapis.com/v2/video/list/",
    { max_count: 1 },
    {
      params:  { fields: "id,create_time,title,embed_link" },
      headers: { Authorization: `Bearer ${account.access_token}` },
    }
  );
  const video = res.data.data?.videos?.[0];
  if (!video) return null;
  return {
    id:    video.id,
    title: video.title || "TikTok video",
    url:   video.embed_link || `https://www.tiktok.com/@${account.handle}/video/${video.id}`,
  };
}

async function fetchLatestInstagramVideo(account) {
  const igUserId = account.handle;
  const res = await axios.get(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    {
      params: {
        fields:       "id,media_type,timestamp,permalink",
        limit:         1,
        access_token: account.access_token,
      },
    }
  );
  const item = res.data.data?.[0];
  if (!item || item.media_type !== "VIDEO") return null;
  return {
    id:    item.id,
    title: "Instagram video",
    url:   item.permalink,
  };
}

async function fetchLatestVideo(account) {
  switch (account.platform) {
    case "youtube":   return fetchLatestYouTubeVideo(account);
    case "tiktok":    return fetchLatestTikTokVideo(account);
    case "instagram": return fetchLatestInstagramVideo(account);
    default:          return null;
  }
}

// ── Enqueue a repost job using the reposts queue ──────────────────────────────

async function enqueueAutoRepost({ account, video, userId, autoJobId }) {
  // Import lazily to avoid circular-require issues (reposts.js imports from lib)
  const { repostQueue } = require("../routes/reposts");

  // Create a reposts row first so the worker can find it
  const { data: repost, error } = await supabase.from("reposts").insert({
    user_id:          userId,
    source_account_id: account.id,
    source_video_id:  video.id,
    source_video_url: video.url,
    title:            video.title,
    destinations:     account.auto_republish_targets,
    status:           "pending",
  }).select().single();

  if (error) throw new Error(`Failed to create repost row: ${error.message}`);

  const job = await repostQueue.add(
    "repost",
    { repostId: repost.id, autoJobId },
    { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
  );
  await supabase.from("reposts").update({ job_id: job.id }).eq("id", repost.id);
}

// ── Main poll function ────────────────────────────────────────────────────────

async function runPollCycle() {
  // Fetch all enabled platform accounts (across all users)
  const { data: accounts, error } = await supabase
    .from("platform_accounts")
    .select("*, users!inner(plan)")
    .eq("auto_republish_enabled", true);

  if (error) {
    console.error("[autoRepublish] Failed to fetch enabled accounts:", error.message);
    return;
  }

  if (!accounts?.length) return;

  console.log(`[autoRepublish] Polling ${accounts.length} enabled account(s)…`);

  for (const account of accounts) {
    // Rate-limit: 500ms between accounts to avoid hitting platform API limits
    await new Promise(r => setTimeout(r, 500));

    // Enforce plan — free users cannot use auto-republish
    const userPlan = account.users?.plan || "free";
    if (userPlan !== "pro" && userPlan !== "team") {
      console.warn(`[autoRepublish] Skipping account ${account.id} — user plan is '${userPlan}' (pro required)`);
      continue;
    }

    if (!account.auto_republish_targets?.length) continue;

    try {
      // Refresh token if needed
      let acc = await refreshTokenIfExpired(account);

      // Fetch latest video from the source platform
      const latest = await fetchLatestVideo(acc);

      // Always update last_polled_at
      const pollUpdate = { last_polled_at: new Date().toISOString() };

      if (!latest) {
        await supabase.from("platform_accounts").update(pollUpdate).eq("id", acc.id);
        continue;
      }

      // No new video
      if (latest.id === acc.last_seen_video_id) {
        await supabase.from("platform_accounts").update(pollUpdate).eq("id", acc.id);
        continue;
      }

      // New video found!
      console.log(`[autoRepublish] New video on ${acc.platform} for account ${acc.id}: ${latest.id}`);

      // Dedup guard — skip if a job for this exact video was already created in the last 24h
      const { data: existingJob } = await supabase
        .from("auto_republish_jobs")
        .select("id")
        .eq("source_video_id", latest.id)
        .eq("user_id", acc.user_id)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingJob) {
        console.warn(`[autoRepublish] Skipping duplicate — video ${latest.id} already queued (job ${existingJob.id})`);
        await supabase.from("platform_accounts").update({
          ...pollUpdate,
          last_seen_video_id: latest.id,
        }).eq("id", acc.id);
        continue;
      }

      // Save last_seen_video_id BEFORE enqueueing so a queuing failure never causes re-detection
      const { error: updateErr } = await supabase.from("platform_accounts").update({
        ...pollUpdate,
        last_seen_video_id: latest.id,
      }).eq("id", acc.id);
      if (updateErr) {
        console.error(`[autoRepublish] FAILED to save last_seen_video_id for account ${acc.id}: ${updateErr.message}`);
      } else {
        console.log(`[autoRepublish] Saved last_seen_video_id=${latest.id} for account ${acc.id}`);
      }

      // Create an auto_republish_jobs row
      const { data: autoJob, error: jobErr } = await supabase.from("auto_republish_jobs").insert({
        user_id:          acc.user_id,
        source_platform:  acc.platform,
        source_video_id:  latest.id,
        video_title:      latest.title,
        video_url:        latest.url,
        target_platforms: acc.auto_republish_targets,
        status:           "pending",
      }).select().single();

      if (jobErr) {
        console.error(`[autoRepublish] Failed to create auto_republish_job: ${jobErr.message}`);
        continue;
      }

      // Enqueue the actual upload job
      await enqueueAutoRepost({
        account: acc,
        video:   latest,
        userId:  acc.user_id,
        autoJobId: autoJob.id,
      });

      console.log(`[autoRepublish] Queued auto-repost job for auto_job=${autoJob.id}`);
    } catch (err) {
      console.error(`[autoRepublish] Error processing account ${account.id} (${account.platform}): ${err.message}`);
      // Update last_polled_at even on error so the next cycle is aware
      try {
        await supabase.from("platform_accounts")
          .update({ last_polled_at: new Date().toISOString() })
          .eq("id", account.id);
      } catch(e) {}
    }
  }
}

// ── BullMQ worker that executes the poll cycle ────────────────────────────────

let pollWorker = null;

function startAutoRepublishPoller() {
  if (process.env.DISABLE_WORKERS === "true") {
    console.log("⚠️ [autoRepublish] Poller disabled (DISABLE_WORKERS=true)");
    return;
  }

  // Register the repeatable job (runs every 10 minutes)
  pollQueue.add(
    "poll",
    {},
    {
      repeat:   { cron: "*/10 * * * *" },
      jobId:    "auto-republish-poller",
      removeOnComplete: { count: 5 },
      removeOnFail:     { count: 10 },
    }
  ).then(() => {
    console.log("✅ [autoRepublish] Poller scheduled (every 10 min)");
  }).catch(err => {
    console.error("❌ [autoRepublish] Failed to schedule poller:", err.message);
  });

  pollWorker = new Worker(
    POLL_QUEUE_NAME,
    async () => { await runPollCycle(); },
    { connection, concurrency: 1 }
  );

  pollWorker.on("completed", () => console.log(`✅ [autoRepublish] Poll cycle done`));
  pollWorker.on("failed", (job, err) => console.error(`❌ [autoRepublish] Poll cycle failed: ${err.message}`));
}

module.exports = { startAutoRepublishPoller, runPollCycle };
