// ─── Distribution Worker ─────────────────────────────────────────────────────
// BullMQ worker that processes distribution jobs: uploads to YouTube, TikTok, etc.
// ──────────────────────────────────────────────────────────────────────────────
const { Worker } = require("bullmq");
const axios = require("axios");
const fs = require("fs");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const { downloadToTemp, cleanupTemp } = require("../lib/storage");
const connection = require("../lib/redis");

// ── YouTube upload helper ─────────────────────────────────────────────────────
async function uploadToYouTube(videoPath, title, description, account, isShorts = false) {
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  auth.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  // Refresh token if needed
  try {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);
    // Update token in DB
    await supabase.from("platform_accounts")
      .update({
        access_token: credentials.access_token,
        expires_at: new Date(credentials.expiry_date),
      })
      .eq("id", account.id);
  } catch (refreshErr) {
    console.warn("Token refresh warning:", refreshErr.message);
  }

  const yt = google.youtube({ version: "v3", auth });

  const shortsSuffix = isShorts ? " #Shorts" : "";
  const result = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: `${title}${shortsSuffix}`.slice(0, 100),
        description: description || "Distributed via Redistribute.io",
      },
      status: { privacyStatus: "public" },
    },
    media: { body: fs.createReadStream(videoPath) },
  });

  return {
    platform_video_id: result.data.id,
    platform_url: `https://www.youtube.com/watch?v=${result.data.id}`,
  };
}

// ── TikTok upload helper ──────────────────────────────────────────────────────
async function uploadToTikTok(videoPath, title, account) {
  const stat = fs.statSync(videoPath);

  const { data: init } = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      post_info: {
        title: (title || "Posted via Redistribute.io").slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: stat.size,
        chunk_size: stat.size,
        total_chunk_count: 1,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const buffer = fs.readFileSync(videoPath);
  await axios.put(init.data.upload_url, buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${buffer.length - 1}/${buffer.length}`,
    },
  });

  return {
    platform_video_id: init.data.publish_id || null,
    platform_url: null,
  };
}

// ── Instagram upload helper ───────────────────────────────────────────────────
async function uploadToInstagram(videoUrl, title, account) {
  // `account.handle` stores the `ig-user-id` we fetched during OAuth
  const igUserId = account.handle;

  // Step 1: Create media container
  const { data: container } = await axios.post(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    null,
    {
      params: {
        media_type: "REELS",
        video_url: videoUrl,
        caption: title || "Distributed via Redistribute.io",
        access_token: account.access_token,
      },
    }
  );

  if (!container?.id) throw new Error("Failed to create Instagram media container");

  // Step 2: Wait for processing (poll status)
  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 30) {
    await new Promise(r => setTimeout(r, 5000)); // wait 5 sec
    const { data: statusCheck } = await axios.get(
      `https://graph.facebook.com/v19.0/${container.id}`,
      { params: { fields: "status_code", access_token: account.access_token } }
    );
    status = statusCheck.status_code;
    attempts++;
  }

  if (status !== "FINISHED") throw new Error(`Instagram processing failed: ${status}`);

  // Step 3: Publish
  const { data: published } = await axios.post(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    null,
    {
      params: {
        creation_id: container.id,
        access_token: account.access_token,
      },
    }
  );

  return {
    platform_video_id: published?.id || null,
    platform_url: null,
  };
}

// ── Worker ────────────────────────────────────────────────────────────────────
const distributionWorker = new Worker("video-processing", async (job) => {
  const { distributionId, videoId, userId } = job.data;

  // Fetch distribution record
  const { data: dist } = await supabase
    .from("distributions")
    .select("*")
    .eq("id", distributionId)
    .single();

  if (!dist) throw new Error("Distribution not found");

  // Update status
  await supabase.from("distributions")
    .update({ status: "uploading" })
    .eq("id", distributionId);

  let videoPath = null;

  try {
    // Get video or clip file URL
    let fileUrl, title, description;

    if (dist.clip_id) {
      const { data: clip } = await supabase.from("clips").select("*").eq("id", dist.clip_id).single();
      if (!clip) throw new Error("Clip not found");
      fileUrl = clip.file_url;
      title = clip.title;
    } else {
      const { data: video } = await supabase.from("uploaded_videos").select("*").eq("id", videoId).single();
      if (!video) throw new Error("Video not found");
      fileUrl = video.file_url;
      title = video.title;
      description = video.description;
    }

    // Download to temp
    videoPath = await downloadToTemp(fileUrl, `dist_${distributionId}.mp4`);

    // Get platform account
    const platformName = dist.platform === "youtube_shorts" ? "youtube" : dist.platform;
    const { data: account } = await supabase
      .from("platform_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", platformName)
      .single();

    if (!account) throw new Error(`${platformName} account not connected`);

    // Upload to platform
    let result;
    if (dist.platform === "youtube") {
      result = await uploadToYouTube(videoPath, title, description, account, false);
    } else if (dist.platform === "youtube_shorts") {
      result = await uploadToYouTube(videoPath, title, description, account, true);
    } else if (dist.platform === "tiktok") {
      result = await uploadToTikTok(videoPath, title, account);
    } else if (dist.platform === "instagram") {
      // Instagram uses URL directly, doesn't need local file
      result = await uploadToInstagram(fileUrl, title, account);
    } else {
      throw new Error(`Unknown platform: ${dist.platform}`);
    }

    // Update distribution as success
    await supabase.from("distributions")
      .update({
        status: "success",
        platform_video_id: result.platform_video_id,
        platform_url: result.platform_url,
        completed_at: new Date().toISOString(),
      })
      .eq("id", distributionId);

    // Update clip status if applicable
    if (dist.clip_id) {
      await supabase.from("clips")
        .update({ status: "uploaded", platform_video_id: result.platform_video_id, platform_url: result.platform_url })
        .eq("id", dist.clip_id);
    }

    // Log success
    await supabase.from("job_logs").insert({
      user_id: userId,
      video_id: videoId,
      clip_id: dist.clip_id || null,
      action: "distribute",
      platform: dist.platform,
      details: { result, upload_type: dist.upload_type },
      status: "success",
    });

    // Check if all distributions for this video are done
    const { data: remaining } = await supabase.from("distributions")
      .select("status")
      .eq("video_id", videoId)
      .in("status", ["queued", "uploading"]);

    if (!remaining?.length) {
      await supabase.from("uploaded_videos")
        .update({ status: "done" })
        .eq("id", videoId);
    }

  } catch (err) {
    // Update distribution as failed
    await supabase.from("distributions")
      .update({
        status: "failed",
        error: err.message,
        retry_count: (dist.retry_count || 0) + 1,
      })
      .eq("id", distributionId);

    // Log failure
    await supabase.from("job_logs").insert({
      user_id: userId,
      video_id: videoId,
      action: "distribute",
      platform: dist.platform,
      details: { error: err.message },
      status: "error",
    });

    throw err;
  } finally {
    cleanupTemp(videoPath);
  }
}, {
  connection,
  concurrency: 2,
});

distributionWorker.on("completed", (job) => {
  console.log(`✅ Distribution ${job.id} completed`);
});

distributionWorker.on("failed", (job, err) => {
  console.error(`❌ Distribution ${job.id} failed:`, err.message);
});

module.exports = distributionWorker;
