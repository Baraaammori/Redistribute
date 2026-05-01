const router  = require("express").Router();
const { Queue, Worker, UnrecoverableError } = require("bullmq");
const axios   = require("axios");
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const { execFile } = require("child_process");
const { google } = require("googleapis");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const connection = require("../lib/redis");
const { transcodeToMP4 } = require("../lib/ffmpeg");
const youtubeDownloader = require("../lib/youtube-downloader");

// ── Queue setup ───────────────────────────────────────────────────────────────
const repostQueue = new Queue("reposts", { connection });

// ── Worker (processes jobs) ───────────────────────────────────────────────────
let worker = null;
if (process.env.DISABLE_WORKERS !== 'true') {
  worker = new Worker("reposts", async job => {
  const startTime = Date.now();
  const { repostId } = job.data;
  console.log(`\n🔄 [reposts] Job ${job.id} starting | repostId=${repostId} | attempt=${job.attemptsMade + 1}/${job.opts?.attempts || 3}`);

  const { data: repost } = await supabase
    .from("reposts")
    .select("*, source_account:platform_accounts(*)")
    .eq("id", repostId)
    .single();

  if (!repost) throw new Error("Repost not found");

  await supabase.from("reposts").update({ status: "processing" }).eq("id", repostId);

  let videoPath;
  let transcodedPath;
  try {
    // 1. Download source video
    console.log(`📥 [reposts] Downloading video: ${repost.source_video_url?.slice(0, 80)}...`);
    videoPath = await downloadVideo(repost.source_video_url, repost.id, job.attemptsMade);
    const dlSize = fs.statSync(videoPath).size;
    console.log(`📥 [reposts] Downloaded to ${videoPath} (${dlSize} bytes)`);

    // 1b. Check if download is valid (not an HTML error page)
    if (dlSize < 1000) {
      const head = fs.readFileSync(videoPath, 'utf8').slice(0, 200);
      if (head.includes('<html') || head.includes('<!DOCTYPE')) {
        const permErr = new Error(`Downloaded file is an HTML page, not a video: ${head.slice(0, 100)}`);
        permErr.unrecoverable = true;
        throw permErr;
      }
    }

    // 2. Upload to each destination
    for (const dest of repost.destinations) {
      console.log(`🎯 [reposts] Processing destination: ${dest}`);
      const { data: destAccount } = await supabase
        .from("platform_accounts")
        .select("*")
        .eq("user_id", repost.user_id)
        .eq("platform", dest)
        .single();

      if (!destAccount) {
        console.warn(`⚠️ [reposts] No ${dest} account for user ${repost.user_id}, skipping`);
        continue;
      }

      // Log token state (without exposing the actual token)
      const tokenAge = destAccount.expires_at ? `expires ${new Date(destAccount.expires_at).toISOString()}` : "no expiry set";
      console.log(`🔑 [reposts] ${dest} token: ${tokenAge}`);

      if (dest === "youtube")   await uploadToYouTube(videoPath, repost.title, destAccount);
      if (dest === "tiktok") {
        // TikTok requires valid MP4 with H264 — transcode if needed
        const uploadPath = await ensureTikTokMP4(videoPath, repost.id);
        if (uploadPath !== videoPath) transcodedPath = uploadPath;
        await uploadToTikTok(uploadPath, repost.title, destAccount);
      }
      if (dest === "instagram") await uploadToInstagram(videoPath, repost.title, destAccount);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [reposts] Job ${job.id} completed in ${duration}s`);
    await supabase.from("reposts").update({ status: "done" }).eq("id", repostId);
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`❌ [reposts] Job ${job.id} failed after ${duration}s:`, err.message);
    
    // Auto-detect permanent errors even if sub-functions forgot to use UnrecoverableError
    const msg = (err.message || '').toLowerCase();
    const permanentPatterns = [
      'invalid credentials', 'invalid_grant', 'token has been expired or revoked',
      'account needs reconnection', 'no refresh_token', 'permission denied',
      'quota exceeded', 'unrecoverable', 'reconnect',
    ];
    const isPermanent = err instanceof UnrecoverableError || err.unrecoverable || permanentPatterns.some(p => msg.includes(p));

    if (isPermanent) {
      console.error(`🚫 [reposts] PERMANENT failure — will not retry: ${err.message}`);
      await supabase.from("reposts").update({ status: "failed", error: err.message }).eq("id", repostId);
      throw err instanceof UnrecoverableError ? err : new UnrecoverableError(err.message);
    }

    console.log(`🔄 [reposts] Transient failure — BullMQ may retry (attempt ${job.attemptsMade + 1})`);
    await supabase.from("reposts").update({ status: "failed", error: err.message }).eq("id", repostId);
    throw err;
  } finally {
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (transcodedPath && fs.existsSync(transcodedPath)) fs.unlinkSync(transcodedPath);
  }
  }, { connection, concurrency: 2 });

  worker.on("completed", (job) => {
    console.log(`✅ [reposts] Job ${job.id} completed successfully`);
  });
  worker.on("failed", (job, err) => {
    console.error(`❌ [reposts] Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
  });
} else {
  console.log(`⚠️ [reposts] Worker disabled on this instance (DISABLE_WORKERS=true)`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect if a URL is a YouTube watch/shorts/embed URL.
 */
function isYouTubeUrl(url) {
  return /(?:youtube\.com\/(?:watch|shorts|embed)|youtu\.be\/)/.test(url || '');
}

/**
 * Detect if a URL is a TikTok video URL.
 */
function isTikTokUrl(url) {
  return /tiktok\.com/.test(url || '');
}

/**
 * Download video using yt-dlp for YouTube/TikTok, or Axios for direct URLs.
 * yt-dlp downloads TikTok videos WITHOUT watermarks automatically.
 */
async function downloadVideo(url, id, jobAttemptsMade = 0) {
  if (isYouTubeUrl(url) || isTikTokUrl(url)) {
    return downloadWithYtDlp(url, id, jobAttemptsMade);
  }
  return downloadDirect(url, id);
}

/**
 * Download from YouTube/TikTok using the dedicated downloader class.
 * Supports cookies, proxy rotation, and anti-bot evasion.
 */
function downloadWithYtDlp(url, id, jobAttemptsMade = 0) {
  // Pass the attempt count to the downloader so it can switch strategies
  return youtubeDownloader.download(url, id, jobAttemptsMade + 1);
}

/**
 * Direct HTTP download for non-YouTube URLs (Supabase storage, S3, etc.).
 */
async function downloadDirect(url, id) {
  const dest = path.join("/tmp", `redistribute_${id}_raw`);
  const writer = fs.createWriteStream(dest);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  const contentType = response.headers['content-type'] || 'unknown';
  console.log(`📥 [reposts] Direct download content-type: ${contentType}`);

  // Reject HTML responses immediately (don't even save the file)
  if (contentType.includes('text/html')) {
    writer.close();
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    throw new UnrecoverableError(`Download returned HTML page (content-type: ${contentType}), not a video file. URL may be a webpage, not a direct video link.`);
  }

  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(dest));
    writer.on("error", reject);
  });
}

/**
 * Validate file is a proper MP4 for TikTok, transcode if not.
 * Returns the path to a guaranteed-valid MP4.
 */
async function ensureTikTokMP4(videoPath, id) {
  // Read first 12 bytes for signature check (efficient, no full-file read)
  const headerBuf = Buffer.alloc(12);
  const fd = fs.openSync(videoPath, 'r');
  fs.readSync(fd, headerBuf, 0, 12, 0);
  fs.closeSync(fd);
  const hasFtyp = headerBuf.slice(4, 8).toString('ascii') === 'ftyp';
  const header = headerBuf.toString('hex');
  const fileSize = fs.statSync(videoPath).size;

  console.log(`🔍 [reposts] File validation: size=${fileSize}, ftyp=${hasFtyp}, header=${header.slice(0, 24)}`);

  // Check for HTML error page (YouTube HTML pages are ~1MB!)
  if (header.startsWith('3c21444f') || header.startsWith('3c68746d') || header.startsWith('3c48544d')) {
    // 3c21444f = "<!DO", 3c68746d = "<htm", 3c48544d = "<HTM"
    throw new UnrecoverableError('Downloaded file is an HTML page, not a video. Source URL likely requires yt-dlp for extraction.');
  }

  // Check for zero-length or tiny files
  if (fileSize < 10000) {
    throw new UnrecoverableError(`File too small to be a valid video: ${fileSize} bytes`);
  }

  // If valid MP4, return as-is
  if (hasFtyp) {
    console.log('✅ [reposts] File is a valid MP4, no transcoding needed');
    return videoPath;
  }

  // Check for WebM signature (1a45dfa3 = EBML header for WebM/MKV)
  if (header.startsWith('1a45dfa3')) {
    console.log('🔧 [reposts] File is WebM/MKV — transcoding to MP4...');
  } else {
    console.log(`🔧 [reposts] Unknown format (header: ${header.slice(0, 16)}) — attempting transcode...`);
  }

  const mp4Path = path.join("/tmp", `redistribute_${id}_tiktok.mp4`);

  try {
    await transcodeToMP4(videoPath, mp4Path);

    // Verify the output
    const outBuf = Buffer.alloc(8);
    const outFd = fs.openSync(mp4Path, 'r');
    fs.readSync(outFd, outBuf, 0, 8, 0);
    fs.closeSync(outFd);
    const outFtyp = outBuf.slice(4, 8).toString('ascii') === 'ftyp';
    const outSize = fs.statSync(mp4Path).size;
    console.log(`✅ [reposts] Transcode output: ${outSize} bytes, ftyp=${outFtyp}`);

    if (!outFtyp || outSize < 1000) {
      throw new UnrecoverableError('Transcoded file is still invalid');
    }

    return mp4Path;
  } catch (err) {
    if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
    if (err instanceof UnrecoverableError) throw err;
    throw new UnrecoverableError(`FFmpeg transcode failed: ${err.message}`);
  }
}

/**
 * Refresh a YouTube/Google OAuth2 access token using the refresh_token.
 * Saves new tokens to the database.
 */
async function refreshYouTubeToken(account) {
  console.log(`🔑 [youtube] Refreshing token for account ${account.id}...`);
  try {
    const auth = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || 'postmessage'
    );
    auth.setCredentials({ refresh_token: account.refresh_token });
    const { credentials } = await auth.refreshAccessToken();

    // Save refreshed tokens to DB
    const updates = {
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600000),
    };
    if (credentials.refresh_token) updates.refresh_token = credentials.refresh_token;

    await supabase.from("platform_accounts").update(updates).eq("id", account.id);

    account.access_token = credentials.access_token;
    if (credentials.refresh_token) account.refresh_token = credentials.refresh_token;
    account.expires_at = updates.expires_at;

    console.log(`✅ [youtube] Token refreshed, new expiry: ${updates.expires_at.toISOString()}`);
    return account;
  } catch (err) {
    const msg = err.message || '';
    console.error(`❌ [youtube] Token refresh failed: ${msg}`);
    // If refresh token is revoked/invalid, this is permanent
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
      throw new UnrecoverableError(`YouTube account needs reconnection: ${msg}. Go to Accounts → Reconnect YouTube.`);
    }
    throw err; // Transient error, allow retry
  }
}

async function uploadToYouTube(videoPath, title, account) {
  // 1. Check token expiry — refresh if within 5 minutes of expiring
  const expiresAt = account.expires_at ? new Date(account.expires_at) : null;
  const isExpired = !expiresAt || expiresAt < new Date(Date.now() + 5 * 60 * 1000);

  if (isExpired) {
    console.log(`⏰ [youtube] Token expired or expiring soon (${expiresAt?.toISOString() || 'no expiry'}), refreshing...`);
    if (!account.refresh_token) {
      throw new UnrecoverableError('YouTube account has no refresh_token. Reconnect in Accounts page.');
    }
    account = await refreshYouTubeToken(account);
  }

  // 2. Upload with valid token
  console.log(`📤 [youtube] Uploading: "${(title || '').slice(0, 60)}" (token valid until ${new Date(account.expires_at).toISOString()})`);
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || 'postmessage'
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
    console.log(`✅ [youtube] Upload success! Video ID: ${res.data.id}`);
    return res.data;
  } catch (err) {
    const status = err.code || err.response?.status;
    const msg = err.message || '';
    console.error(`❌ [youtube] Upload failed [${status}]: ${msg}`);

    // Permanent auth failures — don't retry
    if (status === 401 || msg.includes('Invalid Credentials') || msg.includes('invalid_grant')) {
      throw new UnrecoverableError(`YouTube auth failed: ${msg}. Reconnect your YouTube account.`);
    }
    if (status === 403 && msg.includes('quotaExceeded')) {
      throw new UnrecoverableError(`YouTube API quota exceeded. Try again tomorrow.`);
    }
    throw err; // 500, timeout, network errors → allow BullMQ retry
  }
}

async function refreshTikTokToken(account) {
  try {
    const { data } = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    if (data.access_token) {
      await supabase.from("platform_accounts").update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
      }).eq("id", account.id);
      account.access_token = data.access_token;
      account.refresh_token = data.refresh_token;
      console.log("🔑 [reposts] TikTok token refreshed");
    }
    return account;
  } catch (err) {
    console.error("🔑 [reposts] TikTok token refresh failed:", err.response?.data || err.message);
    return account; // proceed with existing token
  }
}

async function uploadToTikTok(videoPath, title, account) {
  // Refresh token if expiring within 1 hour
  if (account.expires_at && new Date(account.expires_at) < new Date(Date.now() + 3600000)) {
    console.log("🔑 [reposts] Token expiring soon, refreshing...");
    account = await refreshTikTokToken(account);
  }

  const stat = fs.statSync(videoPath);
  console.log(`📤 [reposts] TikTok upload: size=${stat.size}, title="${(title || "").slice(0, 50)}"`);

  let init;
  try {
    const resp = await axios.post(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        post_info: {
          title: (title || "Posted via Redistribute").slice(0, 150),
          privacy_level: "SELF_ONLY",
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
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    );
    init = resp.data;
    console.log("✅ [reposts] TikTok init OK:", JSON.stringify(init));
  } catch (err) {
    const body = err.response?.data;
    const detail = body ? JSON.stringify(body) : err.message;
    const status = err.response?.status;
    console.error(`❌ [reposts] TikTok init failed [${status}]:`, detail);

    // Classify: permanent vs transient
    const errCode = body?.error?.code || body?.error || "";
    const permanent = [
      "unaudited_client_can_only_post_to_private_accounts",
      "scope_not_authorized",
      "access_token_invalid",
      "token_not_authorized_for_scope",
    ];
    if (status === 403 && permanent.some(p => String(errCode).includes(p))) {
      const permErr = new Error(`TikTok PERMANENT 403: ${detail}`);
      permErr.unrecoverable = true;
      throw permErr;
    }
    throw new Error(`TikTok API [${status}]: ${detail}`);
  }

  const uploadUrl = init.data?.upload_url;
  if (!uploadUrl) throw new Error("TikTok no upload_url: " + JSON.stringify(init));

  const buffer = fs.readFileSync(videoPath);
  const fileSize = buffer.length;

  // Validate MP4 signature
  const hasFtyp = buffer.slice(4, 8).toString('ascii') === 'ftyp';
  console.log(`📤 [reposts] Uploading ${fileSize} bytes | MP4 ftyp: ${hasFtyp}`);
  if (!hasFtyp) {
    console.warn('⚠️ [reposts] File may not be a valid MP4 — ftyp box not found');
  }

  try {
    await axios.put(uploadUrl, buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': fileSize,
        'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      // Prevent Axios from transforming the raw binary buffer
      transformRequest: [(data) => data],
    });
    console.log("✅ [reposts] TikTok upload complete!");
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    const status = err.response?.status;
    console.error(`❌ [reposts] TikTok file upload error [${status}]:`, detail);
    throw new Error(`TikTok Upload Error [${status}]: ${detail}`);
  }
}

async function uploadToInstagram(videoPath, title, account) {
  // Instagram requires a public URL — you need to upload to storage first.
  // Implement uploadToStorage() using Supabase Storage or S3.
  throw new Error(
    "Instagram upload requires a public video URL. Implement uploadToStorage() using Supabase Storage."
  );
}

// ── ROUTES ────────────────────────────────────────────────────────────────────

// GET /api/reposts/queue-health
router.get("/queue-health", authenticateToken, async (req, res) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      repostQueue.getWaitingCount(),
      repostQueue.getActiveCount(),
      repostQueue.getCompletedCount(),
      repostQueue.getFailedCount(),
      repostQueue.getDelayedCount(),
    ]);
    res.json({ waiting, active, completed, failed, delayed, workerEnabled: process.env.DISABLE_WORKERS !== 'true' });
  } catch (err) {
    res.json({ error: err.message, workerEnabled: process.env.DISABLE_WORKERS !== 'true' });
  }
});

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

  // For library uploads, no source account needed (direct URL from Supabase Storage)
  let sourceAccountId = null;
  if (sourcePlatform !== 'library') {
    const { data: sourceAccount } = await supabase
      .from("platform_accounts").select("id").eq("user_id", req.user.userId).eq("platform", sourcePlatform).single();
    if (!sourceAccount) return res.status(404).json({ error: `${sourcePlatform} account not connected` });
    sourceAccountId = sourceAccount.id;
  }

  const { data: repost, error } = await supabase.from("reposts").insert({
    user_id: req.user.userId,
    source_account_id: sourceAccountId,
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
