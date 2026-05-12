// ─── Shared OAuth Token Refresh Helpers ──────────────────────────────────────
// Used by the reposts worker, auto-republish poller, and any future worker
// that needs to call a platform API on behalf of a user.
// ─────────────────────────────────────────────────────────────────────────────
const axios   = require("axios");
const { google } = require("googleapis");
const { UnrecoverableError } = require("bullmq");
const supabase = require("./supabase");

// Instagram tokens last 60 days — refresh proactively when within 7 days of expiry
const INSTAGRAM_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
// TikTok access tokens last 24h; refresh 2h early so a retry window exists
const TIKTOK_GRACE_MS    = 2 * 60 * 60 * 1000;
const DEFAULT_GRACE_MS   = 5 * 60 * 1000;

function isTokenExpired(account, gracePeriodMs = DEFAULT_GRACE_MS) {
  if (!account.expires_at) return true;
  return new Date(account.expires_at) < new Date(Date.now() + gracePeriodMs);
}

async function markAccountError(accountId, message) {
  try {
    await supabase.from("platform_accounts")
      .update({ error_message: message })
      .eq("id", accountId);
  } catch {}
}

async function refreshYouTubeToken(account) {
  if (!account.refresh_token) {
    throw new UnrecoverableError("YouTube account has no refresh_token. Reconnect in Accounts page.");
  }
  try {
    const auth = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || "postmessage"
    );
    auth.setCredentials({ refresh_token: account.refresh_token });
    const { credentials } = await auth.refreshAccessToken();

    const updates = {
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600_000),
      error_message: null,
    };
    if (credentials.refresh_token) updates.refresh_token = credentials.refresh_token;

    await supabase.from("platform_accounts").update(updates).eq("id", account.id);

    Object.assign(account, updates);
    return account;
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("invalid_grant") || msg.includes("Token has been expired or revoked")) {
      await markAccountError(account.id, "Token revoked — reconnect your YouTube account");
      throw new UnrecoverableError(`YouTube account needs reconnection: ${msg}`);
    }
    await markAccountError(account.id, `Refresh failed: ${msg}`);
    throw err;
  }
}

async function refreshTikTokToken(account) {
  if (!account.refresh_token) {
    throw new UnrecoverableError("TikTok account has no refresh_token. Reconnect in Accounts page.");
  }
  try {
    const { data } = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key:    process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        grant_type:    "refresh_token",
        refresh_token: account.refresh_token,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("[tokenRefresh] TikTok raw response:", JSON.stringify(data));

    if (data.error) {
      const desc = data.error_description || data.error;
      const reconnectCodes = ["invalid_grant", "invalid_client", "refresh_token_not_found", "access_token_invalid", "10005"];
      if (reconnectCodes.some(c => String(data.error).includes(c) || desc.includes(c))) {
        await markAccountError(account.id, "Refresh token expired — reconnect TikTok");
        throw new UnrecoverableError(
          `TikTok refresh token is invalid or expired (${desc}). Go to Accounts → Disconnect → Reconnect TikTok.`
        );
      }
      throw new UnrecoverableError(`TikTok token refresh error: ${desc}`);
    }

    if (!data.access_token) {
      await markAccountError(account.id, "Token refresh returned no access_token");
      throw new UnrecoverableError(
        `TikTok token refresh: no access_token in response. Full response: ${JSON.stringify(data)}. Go to Accounts → Disconnect → Reconnect TikTok.`
      );
    }

    const expiresIn = data.expires_in || 86400;
    const updates = {
      access_token:  data.access_token,
      refresh_token: data.refresh_token || account.refresh_token,
      expires_at:    new Date(Date.now() + expiresIn * 1000).toISOString(),
      error_message: null,
    };

    const { error: saveError } = await supabase
      .from("platform_accounts")
      .update(updates)
      .eq("id", account.id);

    if (saveError) {
      console.error(`[tokenRefresh] ❌ FAILED to save TikTok token for account ${account.id}: ${saveError.message}`);
    } else {
      console.log(`[tokenRefresh] ✅ TikTok token saved | account=${account.id} | expires_in=${expiresIn}s`);
    }

    Object.assign(account, updates);
    return account;
  } catch (err) {
    if (err instanceof UnrecoverableError) throw err;
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error("[tokenRefresh] TikTok HTTP error response:", detail);
    if (detail.includes("invalid_grant") || detail.includes("access_token_invalid")) {
      await markAccountError(account.id, "Token invalid — reconnect TikTok");
      throw new UnrecoverableError("TikTok account needs reconnection. Go to Accounts → Reconnect TikTok.");
    }
    await markAccountError(account.id, `Refresh failed: ${detail}`);
    throw err;
  }
}

async function refreshInstagramToken(account) {
  try {
    // Instagram Basic Display / Graph API: refresh a long-lived token (60 days → new 60 days)
    const { data } = await axios.get(
      "https://graph.instagram.com/refresh_access_token",
      {
        params: {
          grant_type:   "ig_refresh_token",
          access_token: account.access_token,
        },
      }
    );

    const updates = {
      access_token:  data.access_token,
      expires_at:    new Date(Date.now() + (data.expires_in || 5184000) * 1000),
      error_message: null,
    };
    await supabase.from("platform_accounts").update(updates).eq("id", account.id);

    Object.assign(account, updates);
    return account;
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    await markAccountError(account.id, `Instagram refresh failed: ${detail}`);
    throw new Error(`Instagram token refresh failed: ${detail}`);
  }
}

async function refreshTokenIfExpired(account, gracePeriodMs) {
  const grace = gracePeriodMs !== undefined
    ? gracePeriodMs
    : account.platform === "instagram" ? INSTAGRAM_GRACE_MS
    : account.platform === "tiktok" ? TIKTOK_GRACE_MS
    : DEFAULT_GRACE_MS;

  if (!isTokenExpired(account, grace)) return account;

  console.log(`[tokenRefresh] ${account.platform} token expired/expiring for account ${account.id}, refreshing…`);

  switch (account.platform) {
    case "youtube":   return refreshYouTubeToken(account);
    case "tiktok":    return refreshTikTokToken(account);
    case "instagram": return refreshInstagramToken(account);
    default:          return account;
  }
}

/**
 * Call a platform API function with automatic retry logic.
 * - 429: wait for Retry-After header then retry
 * - 401: refresh token once then retry
 * - 500/503: exponential backoff (2s → 4s → 8s)
 * - 400/403: throw immediately — permanent error
 */
async function apiCallWithRetry(fn, opts = {}) {
  const { maxAttempts = 3, account, onRefresh } = opts;
  let attempt = 0;
  let tokenRefreshed = false;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      const status      = err.response?.status;
      const headers     = err.response?.headers || {};
      const isPermanent = status === 400 || status === 403;

      if (isPermanent) {
        console.error(`[apiCallWithRetry] Permanent error ${status} on attempt ${attempt}:`, err.message);
        throw err;
      }

      if (attempt >= maxAttempts) {
        console.error(`[apiCallWithRetry] Exhausted ${maxAttempts} attempts. Last error:`, err.message);
        throw err;
      }

      if (status === 429) {
        const retryAfter = parseInt(headers["retry-after"] || "5", 10);
        console.warn(`[apiCallWithRetry] 429 rate limit — waiting ${retryAfter}s before retry ${attempt + 1}/${maxAttempts}`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (status === 401 && account && !tokenRefreshed) {
        console.warn(`[apiCallWithRetry] 401 — refreshing token for account ${account.id}`);
        try {
          const refreshed = await refreshTokenIfExpired({ ...account, expires_at: new Date(0) });
          if (onRefresh) onRefresh(refreshed);
          Object.assign(account, refreshed);
          tokenRefreshed = true;
          continue;
        } catch (refreshErr) {
          console.error(`[apiCallWithRetry] Token refresh failed:`, refreshErr.message);
          throw refreshErr;
        }
      }

      if (status === 500 || status === 503 || !status) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.warn(`[apiCallWithRetry] ${status || "network"} error — backoff ${backoff}ms before retry ${attempt + 1}/${maxAttempts}`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      throw err;
    }
  }
}

module.exports = {
  isTokenExpired,
  refreshTokenIfExpired,
  refreshYouTubeToken,
  refreshTikTokToken,
  refreshInstagramToken,
  apiCallWithRetry,
};
