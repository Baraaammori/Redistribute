// ─── Shared OAuth Token Refresh Helpers ──────────────────────────────────────
// Used by the reposts worker, auto-republish poller, and any future worker
// that needs to call a platform API on behalf of a user.
// ─────────────────────────────────────────────────────────────────────────────
const axios   = require("axios");
const { google } = require("googleapis");
const { UnrecoverableError } = require("bullmq");
const supabase = require("./supabase");

/**
 * Returns true if an account's access token is expired or expiring within
 * the given grace-period window (default 5 minutes).
 */
function isTokenExpired(account, gracePeriodMs = 5 * 60 * 1000) {
  if (!account.expires_at) return true;
  return new Date(account.expires_at) < new Date(Date.now() + gracePeriodMs);
}

/**
 * Refresh a YouTube OAuth2 token.
 * Mutates `account` in-place and persists new tokens to Supabase.
 * Throws UnrecoverableError if the refresh token is revoked/invalid.
 */
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
    };
    if (credentials.refresh_token) updates.refresh_token = credentials.refresh_token;

    await supabase.from("platform_accounts").update(updates).eq("id", account.id);

    account.access_token = updates.access_token;
    account.expires_at   = updates.expires_at;
    if (updates.refresh_token) account.refresh_token = updates.refresh_token;

    return account;
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("invalid_grant") || msg.includes("Token has been expired or revoked")) {
      throw new UnrecoverableError(`YouTube account needs reconnection: ${msg}`);
    }
    throw err;
  }
}

/**
 * Refresh a TikTok OAuth2 token.
 * Mutates `account` in-place and persists new tokens to Supabase.
 * Throws UnrecoverableError if the refresh token is revoked/invalid.
 */
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

    // Always log raw response so future token issues are instantly diagnosable
    console.error("[tokenRefresh] TikTok raw response:", JSON.stringify(data));

    // TikTok returns HTTP 200 with an error body instead of a non-2xx status
    if (data.error) {
      const desc = data.error_description || data.error;
      const reconnectCodes = ["invalid_grant", "refresh_token_not_found", "access_token_invalid", "10005"];
      if (reconnectCodes.some(c => String(data.error).includes(c) || desc.includes(c))) {
        throw new UnrecoverableError(
          `TikTok refresh token is invalid or expired (${desc}). ` +
          `Go to Accounts → Disconnect → Reconnect TikTok.`
        );
      }
      throw new UnrecoverableError(`TikTok token refresh error: ${desc}`);
    }

    if (!data.access_token) {
      // Unrecoverable — retrying the same expired/bad token will never produce a different result
      throw new UnrecoverableError(
        `TikTok token refresh: no access_token in response. ` +
        `Full response: ${JSON.stringify(data)}. ` +
        `Go to Accounts → Disconnect → Reconnect TikTok.`
      );
    }

    const updates = {
      access_token:  data.access_token,
      // TikTok v2 rotates the refresh token on every refresh — always save the new one
      refresh_token: data.refresh_token || account.refresh_token,
      expires_at:    new Date(Date.now() + (data.expires_in || 86400) * 1000),
    };
    await supabase.from("platform_accounts").update(updates).eq("id", account.id);

    account.access_token  = updates.access_token;
    account.refresh_token = updates.refresh_token;
    account.expires_at    = updates.expires_at;

    return account;
  } catch (err) {
    if (err instanceof UnrecoverableError) throw err;
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error("[tokenRefresh] TikTok HTTP error response:", detail);
    if (detail.includes("invalid_grant") || detail.includes("access_token_invalid")) {
      throw new UnrecoverableError(`TikTok account needs reconnection. Go to Accounts → Reconnect TikTok.`);
    }
    throw err;
  }
}

/**
 * Refresh an Instagram (Facebook Graph API) long-lived token.
 * Instagram tokens last 60 days. This exchanges a token for a fresh 60-day one.
 * Mutates `account` in-place and persists to Supabase.
 */
async function refreshInstagramToken(account) {
  try {
    const { data } = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          grant_type:    "fb_exchange_token",
          client_id:     process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          fb_exchange_token: account.access_token,
        },
      }
    );

    const updates = {
      access_token: data.access_token,
      expires_at:   new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    };
    await supabase.from("platform_accounts").update(updates).eq("id", account.id);

    account.access_token = updates.access_token;
    account.expires_at   = updates.expires_at;

    return account;
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Instagram token refresh failed: ${detail}`);
  }
}

/**
 * Refresh a token for any platform if it is expired (or expiring soon).
 * Safe to call unconditionally before every API call.
 *
 * @param {object} account - platform_accounts row from Supabase
 * @param {number} [gracePeriodMs=300000] - refresh if expiring within this many ms
 * @returns {object} account with updated tokens
 */
async function refreshTokenIfExpired(account, gracePeriodMs = 5 * 60 * 1000) {
  if (!isTokenExpired(account, gracePeriodMs)) return account;

  console.log(`[tokenRefresh] ${account.platform} token expired for account ${account.id}, refreshing…`);

  switch (account.platform) {
    case "youtube":   return refreshYouTubeToken(account);
    case "tiktok":    return refreshTikTokToken(account);
    case "instagram": return refreshInstagramToken(account);
    default:          return account;
  }
}

/**
 * Call a platform API function with automatic retry logic.
 *
 * Retry rules:
 *  - 429: wait for Retry-After header value (seconds) then retry
 *  - 401: refresh token via refreshFn then retry ONCE
 *  - 500/503: exponential backoff (2s → 4s → 8s)
 *  - 400/403: throw immediately — permanent client error, do not retry
 *
 * @param {function} fn - async function that performs the API call; receives no args
 * @param {object}  [opts]
 * @param {number}  [opts.maxAttempts=3]
 * @param {object}  [opts.account]     - platform_accounts row (used for 401 token refresh)
 * @param {function}[opts.onRefresh]   - called after a successful token refresh with the updated account
 * @returns {*} whatever fn() resolves to
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
      const status   = err.response?.status;
      const headers  = err.response?.headers || {};
      const isPermanent = status === 400 || status === 403;

      // Permanent failures — do NOT retry
      if (isPermanent) {
        console.error(`[apiCallWithRetry] Permanent error ${status} on attempt ${attempt}:`, err.message);
        throw err;
      }

      if (attempt >= maxAttempts) {
        console.error(`[apiCallWithRetry] Exhausted ${maxAttempts} attempts. Last error:`, err.message);
        throw err;
      }

      // 429 — respect Retry-After
      if (status === 429) {
        const retryAfter = parseInt(headers["retry-after"] || "5", 10);
        console.warn(`[apiCallWithRetry] 429 rate limit — waiting ${retryAfter}s before retry ${attempt + 1}/${maxAttempts}`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      // 401 — token expired; refresh once then retry
      if (status === 401 && account && !tokenRefreshed) {
        console.warn(`[apiCallWithRetry] 401 — refreshing token for account ${account.id}`);
        try {
          const refreshed = await refreshTokenIfExpired({ ...account, expires_at: new Date(0) }); // force refresh
          if (onRefresh) onRefresh(refreshed);
          Object.assign(account, refreshed);
          tokenRefreshed = true;
          continue; // retry once with fresh token
        } catch (refreshErr) {
          console.error(`[apiCallWithRetry] Token refresh failed:`, refreshErr.message);
          throw refreshErr;
        }
      }

      // 500/503 — server error, exponential backoff
      if (status === 500 || status === 503 || !status) {
        const backoff = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`[apiCallWithRetry] ${status || 'network'} error — backoff ${backoff}ms before retry ${attempt + 1}/${maxAttempts}`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      // Unknown error — throw
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
