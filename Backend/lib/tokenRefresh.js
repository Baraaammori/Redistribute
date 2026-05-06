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

    if (!data.access_token) throw new Error("TikTok token refresh: no access_token in response");

    const updates = {
      access_token:  data.access_token,
      refresh_token: data.refresh_token || account.refresh_token,
      expires_at:    new Date(Date.now() + data.expires_in * 1000),
    };
    await supabase.from("platform_accounts").update(updates).eq("id", account.id);

    account.access_token  = updates.access_token;
    account.refresh_token = updates.refresh_token;
    account.expires_at    = updates.expires_at;

    return account;
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
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

module.exports = {
  isTokenExpired,
  refreshTokenIfExpired,
  refreshYouTubeToken,
  refreshTikTokToken,
  refreshInstagramToken,
};
