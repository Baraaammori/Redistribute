// ─── Reposts Route + Worker ───────────────────────────────────────────────────
// POST   /api/reposts          — create a repost job
// GET    /api/reposts          — list user's reposts
// DELETE /api/reposts/:id      — remove a repost
// POST   /api/reposts/:id/retry — retry a failed repost
// GET    /api/reposts/queue-health — BullMQ health check
// ─────────────────────────────────────────────────────────────────────────────
const router  = require("express").Router();
const { Queue, Worker, UnrecoverableError } = require("bullmq");
const axios   = require("axios");
const fs      = require("fs");
const path    = require("path");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const connection = require("../lib/redis");
const { transcodeToMP4 } = require("../lib/ffmpeg");
const youtubeDownloader  = require("../lib/youtube-downloader");
const { refreshTokenIfExpired } = require("../lib/tokenRefresh");
const { uploadFile } = require("../lib/storage");

// ── Queue ─────────────────────────────────────────────────────────────────────
const repostQueue = new Queue("reposts", { connection });
module.exports.repostQueue = repostQueue; // exported for use by auto-republish poller

// ── Worker ────────────────────────────────────────────────────────────────────
if (process.env.DISABLE_WORKERS !== "true") {
  const worker = new Worker("reposts", async job => {
    const { repostId, autoJobId } = job.data;
    const label = `[reposts][job:${job.id}]`;
    console.log(`\n🔄 ${label} starting | attempt=${job.attemptsMade + 1}/3`);

    const { data: repost } = await supabase
      .from("reposts")
      .select("*, source_account:platform_accounts(*)")
      .eq("id", repostId)
      .single();

    if (!repost) throw new Error("Repost not found");

    await supabase.from("reposts").update({ status: "processing" }).eq("id", repostId);
    if (autoJobId) {
      await supabase.from("auto_republish_jobs").update({ status: "processing" }).eq("id", autoJobId);
    }

    let videoPath = null;
    let transcodedPath = null;

    try {
      // 1. Download source video
      console.log(`📥 ${label} Downloading: ${repost.source_video_url?.slice(0, 80)}…`);
      videoPath = await downloadVideo(repost.source_video_url, repost.id);
      const dlSize = fs.statSync(videoPath).size;
      console.log(`📥 ${label} Downloaded ${dlSize} bytes`);

      if (dlSize < 1000) {
        const head = fs.readFileSync(videoPath, "utf8").slice(0, 200);
        if (head.includes("<html") || head.includes("<!DOCTYPE")) {
          throw Object.assign(
            new Error(`Downloaded file is HTML, not a video: ${head.slice(0, 80)}`),
            { unrecoverable: true }
          );
        }
      }

      // 2. Upload to each destination
      for (const dest of repost.destinations) {
        console.log(`🎯 ${label} Uploading to: ${dest}`);
        let { data: destAccount } = await supabase
          .from("platform_accounts")
          .select("*")
          .eq("user_id", repost.user_id)
          .eq("platform", dest)
          .single();

        if (!destAccount) {
          console.warn(`⚠️ ${label} No ${dest} account for user ${repost.user_id}, skipping`);
          continue;
        }

        // Refresh token if needed
        destAccount = await refreshTokenIfExpired(destAccount);

        if (dest === "youtube") {
          await uploadToYouTube(videoPath, repost.title, destAccount);
        }
        if (dest === "tiktok") {
          const uploadPath = await ensureTikTokMP4(videoPath, repost.id);
          if (uploadPath !== videoPath) transcodedPath = uploadPath;
          await uploadToTikTok(uploadPath, repost.title, destAccount);
        }
        if (dest === "instagram") {
          await uploadToInstagram(videoPath, repost.title, repost.user_id, destAccount);
        }
      }

      console.log(`✅ ${label} Completed`);
      await supabase.from("reposts").update({ status: "done" }).eq("id", repostId);
      if (autoJobId) {
        await supabase.from("auto_republish_jobs")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", autoJobId);
      }
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      const permanentPatterns = [
        "invalid credentials", "invalid_grant", "token has been expired or revoked",
        "account needs reconnection", "no refresh_token", "permission denied",
        "quota exceeded", "unrecoverable", "reconnect", "access_token_invalid",
      ];
      const isPermanent = err instanceof UnrecoverableError || err.unrecoverable
        || permanentPatterns.some(p => msg.includes(p));

      const errMsg = err.message || "Unknown error";
      await supabase.from("reposts").update({ status: "failed", error: errMsg }).eq("id", repostId);
      if (autoJobId) {
        await supabase.from("auto_republish_jobs")
          .update({ status: "failed", error_message: errMsg })
          .eq("id", autoJobId);
      }

      if (isPermanent) {
        console.error(`🚫 ${label} PERMANENT failure: ${errMsg}`);
        throw err instanceof UnrecoverableError ? err : new UnrecoverableError(errMsg);
      }
      console.error(`❌ ${label} Transient failure (will retry): ${errMsg}`);
      throw err;
    } finally {
      if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (transcodedPath && fs.existsSync(transcodedPath)) fs.unlinkSync(transcodedPath);
    }
  }, { connection, concurrency: 2, attempts: 3, backoff: { type: "exponential", delay: 5000 } });

  worker.on("completed", job => console.log(`✅ [reposts] Job ${job.id} done`));
  worker.on("failed",    (job, err) => console.error(`❌ [reposts] Job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`));
} else {
  console.log("⚠️ [reposts] Worker disabled (DISABLE_WORKERS=true)");
}

// ── Download helpers ──────────────────────────────────────────────────────────

function isYouTubeUrl(url) { return /(?:youtube\.com\/(?:watch|shorts|embed)|youtu\.be\/)/.test(url || ""); }
function isTikTokUrl(url)  { return /tiktok\.com/.test(url || ""); }

async function downloadVideo(url, id) {
  if (isYouTubeUrl(url) || isTikTokUrl(url)) {
    return youtubeDownloader.download(url, id);
  }
  return downloadDirect(url, id);
}

async function downloadDirect(url, id) {
  const dest = path.join("/tmp", `redistribute_${id}_raw`);
  const writer = fs.createWriteStream(dest);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  const ct = response.headers["content-type"] || "";
  if (ct.includes("text/html")) {
    writer.close();
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    throw new UnrecoverableError(`Download returned HTML page (${ct}) — not a video URL.`);
  }
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(dest));
    writer.on("error", reject);
  });
}

async function ensureTikTokMP4(videoPath, id) {
  const headerBuf = Buffer.alloc(12);
  const fd = fs.openSync(videoPath, "r");
  fs.readSync(fd, headerBuf, 0, 12, 0);
  fs.closeSync(fd);
  const hasFtyp = headerBuf.subarray(4, 8).toString("ascii") === "ftyp";
  const fileSize = fs.statSync(videoPath).size;

  if (fileSize < 10000) throw new UnrecoverableError(`File too small (${fileSize} bytes)`);
  if (hasFtyp) return videoPath;

  const mp4Path = path.join("/tmp", `redistribute_${id}_tiktok.mp4`);
  try {
    await transcodeToMP4(videoPath, mp4Path);
    const outBuf = Buffer.alloc(8);
    const outFd = fs.openSync(mp4Path, "r");
    fs.readSync(outFd, outBuf, 0, 8, 0);
    fs.closeSync(outFd);
    if (outBuf.subarray(4, 8).toString("ascii") !== "ftyp" || fs.statSync(mp4Path).size < 1000) {
      throw new UnrecoverableError("Transcoded file is still invalid");
    }
    return mp4Path;
  } catch (err) {
    if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
    throw err instanceof UnrecoverableError ? err : new UnrecoverableError(`FFmpeg transcode failed: ${err.message}`);
  }
}

// ── Platform upload functions ─────────────────────────────────────────────────

async function uploadToYouTube(videoPath, title, account) {
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || "postmessage"
  );
  auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
  const yt = google.youtube({ version: "v3", auth });

  try {
    const res = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: title || "Posted via Redistribute.io", description: "Redistributed via redistribute.io" },
        status:  { privacyStatus: "public" },
      },
      media: { body: fs.createReadStream(videoPath) },
    });
    console.log(`✅ [youtube] Uploaded: ${res.data.id}`);
  } catch (err) {
    const status = err.code || err.response?.status;
    const msg    = err.message || "";
    if (status === 401 || msg.includes("Invalid Credentials") || msg.includes("invalid_grant")) {
      throw new UnrecoverableError(`YouTube auth failed: ${msg}. Reconnect your YouTube account.`);
    }
    if (status === 403 && msg.includes("quotaExceeded")) {
      throw new UnrecoverableError(`YouTube API quota exceeded. Try again tomorrow.`);
    }
    if (status === 413) throw new UnrecoverableError(`Video too large for YouTube API (${status}).`);
    throw err;
  }
}

async function uploadToTikTok(videoPath, title, account) {
  const fileSize  = fs.statSync(videoPath).size;
  // TikTok: chunk_size must be 5 MB–64 MB (except the final chunk which can be smaller)
  const MAX_CHUNK = 64 * 1024 * 1024;
  const chunkSize    = Math.min(fileSize, MAX_CHUNK);
  const totalChunks  = Math.ceil(fileSize / chunkSize);

  let init;
  try {
    const resp = await axios.post(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        post_info: {
          title:           (title || "Posted via Redistribute").slice(0, 150),
          privacy_level:   "SELF_ONLY",
          disable_duet:    false,
          disable_stitch:  false,
          disable_comment: false,
        },
        source_info: {
          source:            "FILE_UPLOAD",
          video_size:        fileSize,
          chunk_size:        chunkSize,
          total_chunk_count: totalChunks,
        },
      },
      {
        headers: {
          Authorization:  `Bearer ${account.access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    );
    init = resp.data;
  } catch (err) {
    const body   = err.response?.data;
    const detail = body ? JSON.stringify(body) : err.message;
    const status = err.response?.status;
    const errCode = String(body?.error?.code || body?.error || "");
    const permanent = [
      "unaudited_client_can_only_post_to_private_accounts",
      "scope_not_authorized", "access_token_invalid", "token_not_authorized_for_scope",
    ];
    if ((status === 401 || status === 403) && permanent.some(p => errCode.includes(p))) {
      throw new UnrecoverableError(`TikTok permanent auth error [${status}]: ${detail}`);
    }
    if (status === 429) throw new Error(`TikTok rate limited (429). Will retry.`);
    throw new Error(`TikTok API [${status}]: ${detail}`);
  }

  const uploadUrl = init.data?.upload_url;
  if (!uploadUrl) throw new Error("TikTok: no upload_url returned: " + JSON.stringify(init));

  // Upload in chunks — reads 64 MB at a time so large files don't fill RAM
  const fd = fs.openSync(videoPath, "r");
  try {
    for (let i = 0; i < totalChunks; i++) {
      const start         = i * chunkSize;
      const thisChunk     = Math.min(chunkSize, fileSize - start);
      const end           = start + thisChunk - 1;
      const buf           = Buffer.allocUnsafe(thisChunk);
      fs.readSync(fd, buf, 0, thisChunk, start);

      await axios.put(uploadUrl, buf, {
        headers: {
          "Content-Type":   "video/mp4",
          "Content-Length": thisChunk,
          "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
        },
        maxBodyLength:    Infinity,
        maxContentLength: Infinity,
        transformRequest: [(d) => d],
      });
      console.log(`✅ [tiktok] Chunk ${i + 1}/${totalChunks} uploaded (${(thisChunk / 1e6).toFixed(1)} MB)`);
    }
  } finally {
    fs.closeSync(fd);
  }
  console.log("✅ [tiktok] All chunks uploaded");
  return { platform_video_id: init.data?.publish_id || null, platform_url: null };
}

async function uploadToInstagram(videoPath, title, userId, account) {
  // Instagram Graph API requires a public URL for video containers.
  // We upload to Supabase Storage first (temp public URL), then publish.
  const storagePath = `temp_reposts/${userId}/${Date.now()}_repost.mp4`;
  let publicUrl;
  try {
    const { url } = await uploadFile(videoPath, storagePath, "video/mp4");
    publicUrl = url;
  } catch (err) {
    throw new Error(`Instagram pre-upload to storage failed: ${err.message}`);
  }

  const igUserId = account.handle;
  const token    = account.access_token;

  try {
    // 1. Create media container
    const { data: container } = await axios.post(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      null,
      {
        params: {
          video_url:   publicUrl,
          caption:     title || "Posted via Redistribute.io",
          media_type:  "REELS",
          access_token: token,
        },
      }
    );

    if (!container.id) throw new Error("Instagram: no container ID returned");

    // 2. Wait for container to finish processing (poll up to 60s)
    let ready = false;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const { data: status } = await axios.get(
        `https://graph.facebook.com/v19.0/${container.id}`,
        { params: { fields: "status_code", access_token: token } }
      );
      if (status.status_code === "FINISHED") { ready = true; break; }
      if (status.status_code === "ERROR") throw new Error(`Instagram container processing failed: ${JSON.stringify(status)}`);
    }
    if (!ready) throw new Error("Instagram media container did not finish processing within 60s");

    // 3. Publish
    await axios.post(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
      null,
      { params: { creation_id: container.id, access_token: token } }
    );
    console.log("✅ [instagram] Reels published");
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      throw new UnrecoverableError(`Instagram auth failed (${status}). Reconnect your Instagram account.`);
    }
    throw err;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/queue-health", authenticateToken, async (_req, res) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      repostQueue.getWaitingCount(),
      repostQueue.getActiveCount(),
      repostQueue.getCompletedCount(),
      repostQueue.getFailedCount(),
      repostQueue.getDelayedCount(),
    ]);
    res.json({ waiting, active, completed, failed, delayed, workerEnabled: process.env.DISABLE_WORKERS !== "true" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  const { sourceVideoId, sourceVideoUrl, sourcePlatform, title, thumbnailUrl, destinations, scheduledFor } = req.body;

  if (!destinations?.length) return res.status(400).json({ error: "At least one destination required" });

  // Plan enforcement
  const { data: user } = await supabase.from("users").select("plan, trial_ends_at").eq("id", req.user.userId).single();
  const onTrial = user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();
  const isPro   = user?.plan === "pro" || user?.plan === "team";

  if (!isPro && !onTrial) {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { count } = await supabase.from("reposts")
      .select("id", { count: "exact" })
      .eq("user_id", req.user.userId)
      .gte("created_at", monthStart.toISOString());
    if (count >= 3) return res.status(403).json({ error: "Free plan limit reached (3 reposts/month). Upgrade to Pro." });
  }

  let sourceAccountId = null;
  if (sourcePlatform !== "library") {
    const { data: sourceAccount } = await supabase
      .from("platform_accounts").select("id")
      .eq("user_id", req.user.userId).eq("platform", sourcePlatform).single();
    if (!sourceAccount) return res.status(404).json({ error: `${sourcePlatform} account not connected` });
    sourceAccountId = sourceAccount.id;
  }

  const { data: repost, error } = await supabase.from("reposts").insert({
    user_id:          req.user.userId,
    source_account_id: sourceAccountId,
    source_video_id:  sourceVideoId,
    source_video_url: sourceVideoUrl,
    title,
    thumbnail_url:    thumbnailUrl,
    destinations,
    scheduled_for:    scheduledFor || null,
    status:           scheduledFor ? "scheduled" : "pending",
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  const delay = scheduledFor ? Math.max(0, new Date(scheduledFor) - Date.now()) : 0;
  const job   = await repostQueue.add(
    "repost",
    { repostId: repost.id },
    { delay, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
  );
  await supabase.from("reposts").update({ job_id: job.id }).eq("id", repost.id);
  res.json(repost);
});

router.get("/", authenticateToken, async (req, res) => {
  // Paginated response when ?page is provided; flat array otherwise (backward compat)
  if (req.query.page !== undefined) {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status;
    const from   = (page - 1) * limit;
    const to     = from + limit - 1;

    let query = supabase
      .from("reposts")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.userId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error, count } = await query.range(from, to);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      jobs: data ?? [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  }

  // Legacy: return flat array
  const { data, error } = await supabase
    .from("reposts")
    .select("*")
    .eq("user_id", req.user.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete("/:id", authenticateToken, async (req, res) => {
  await supabase.from("reposts").delete().eq("id", req.params.id).eq("user_id", req.user.userId);
  res.json({ ok: true });
});

router.post("/:id/retry", authenticateToken, async (req, res) => {
  const { data: repost } = await supabase.from("reposts")
    .select("*").eq("id", req.params.id).eq("user_id", req.user.userId).single();
  if (!repost) return res.status(404).json({ error: "Not found" });
  await supabase.from("reposts").update({ status: "pending", error: null }).eq("id", req.params.id);
  await repostQueue.add("repost", { repostId: repost.id }, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
  res.json({ ok: true });
});

module.exports = router;
module.exports.repostQueue = repostQueue;
