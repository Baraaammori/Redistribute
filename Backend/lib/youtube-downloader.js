const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { UnrecoverableError } = require('bullmq');

// Errors where the video itself is the problem — retrying will never help
const PERMANENT_PATTERNS = [
  'Video unavailable',
  'This video is private',
  'This video has been removed',
  'not available in your country',
  'This video requires payment',
  'Music Premium members',
  'This account has been terminated',
  'The uploader has not made this video available',
];

class VideoDownloader {
  constructor() {
    this.binPath = this._getBinPath();
    this.proxies = process.env.YOUTUBE_PROXIES ? process.env.YOUTUBE_PROXIES.split(',') : [];
    this.proxyIndex = 0;
  }

  _getBinPath() {
    // YT_DLP_PATH env var wins — set to "yt-dlp" on Railway (system PATH via Nixpacks)
    if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;
    const filename = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const localBin = path.join(__dirname, '..', 'bin', filename);
    // Fall back to system PATH if the local binary doesn't exist
    return fs.existsSync(localBin) ? localBin : filename;
  }

  _getNextProxy() {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  _isTikTokUrl(url) {
    return /tiktok\.com/.test(url || '');
  }

  /**
   * Returns the path to a writable cookies file, or null if none configured.
   * Supports two env vars:
   *   YOUTUBE_COOKIES_TXT  — the raw Netscape cookie file content (set as a secret)
   *   YOUTUBE_COOKIES_FILE — path to an existing cookies.txt file on disk
   *
   * yt-dlp needs write access to the cookies file (it updates expiry times).
   * We copy to /tmp/ which is always writable, even on read-only secret mounts.
   */
  _getCookiePath() {
    const tmpPath = path.join(os.tmpdir(), 'yt_cookies.txt');

    if (process.env.YOUTUBE_COOKIES_TXT) {
      // Write the raw cookie content from the env secret once per process
      if (!fs.existsSync(tmpPath)) {
        fs.writeFileSync(tmpPath, process.env.YOUTUBE_COOKIES_TXT, 'utf8');
        console.log('[youtube-dl] Wrote YOUTUBE_COOKIES_TXT to', tmpPath);
      }
      return tmpPath;
    }

    if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
      try {
        fs.copyFileSync(process.env.YOUTUBE_COOKIES_FILE, tmpPath);
        return tmpPath;
      } catch (err) {
        console.warn('[youtube-dl] Failed to copy cookie file:', err.message);
      }
    }

    return null;
  }

  _buildArgs(url, dest, cookiePath) {
    const args = [
      url,
      '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-check-certificates',
      '--socket-timeout', '30',
      '--retries', '3',
      '--no-warnings',
      '-o', dest,
    ];

    // Use iOS + Android player clients only.
    // IMPORTANT: never include 'web' here — yt-dlp's web client tries to
    // read Chrome browser cookies for authentication, which throws
    // "Could not copy Chrome cookie database" on any server with no browser installed.
    if (!this._isTikTokUrl(url)) {
      args.push('--extractor-args', 'youtube:player_client=ios,android');
    }

    // Cookie file authentication — never --cookies-from-browser
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }

    const proxy = this._getNextProxy();
    if (proxy) {
      args.push('--proxy', proxy);
    }

    args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');

    return args;
  }

  /**
   * Download a YouTube or TikTok video to /tmp.
   * Strategy:
   *   1. Clean download (no cookies) — works for most public videos
   *   2. If step 1 fails: retry with cookies.txt (YOUTUBE_COOKIES_TXT or YOUTUBE_COOKIES_FILE)
   *   3. If both fail: throw UnrecoverableError (retrying won't help)
   *
   * Download failures are always UnrecoverableError — the video URL won't
   * suddenly become accessible on a BullMQ retry. Only upload failures
   * (transient 429/503) should trigger retries.
   */
  async download(url, id) {
    if (!fs.existsSync(this.binPath) && path.isAbsolute(this.binPath)) {
      throw new UnrecoverableError(
        `yt-dlp binary not found at ${this.binPath}. ` +
        `Set YT_DLP_PATH=yt-dlp in Railway env vars and ensure nixpacks.toml includes yt-dlp.`
      );
    }

    const dest = path.join(os.tmpdir(), `redistribute_${id}_ytdlp.mp4`);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);

    // Step 1 — clean (no cookies)
    try {
      await this._exec(url, dest, null);
      return dest;
    } catch (err) {
      if (err instanceof UnrecoverableError) throw err;
      console.warn(`[youtube-dl] Clean download failed: ${err.message}`);
    }

    // Step 2 — cookies.txt fallback
    const cookiePath = this._getCookiePath();
    if (cookiePath) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      try {
        await this._exec(url, dest, cookiePath);
        return dest;
      } catch (err) {
        if (err instanceof UnrecoverableError) throw err;
        console.warn(`[youtube-dl] Cookie download failed: ${err.message}`);
      }
    }

    // Step 3 — permanent failure
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    throw new UnrecoverableError(
      `Video download failed after all attempts. The video may be private, ` +
      `age-restricted, or region-blocked. ` +
      `To download bot-protected videos, set YOUTUBE_COOKIES_TXT in your environment.`
    );
  }

  _exec(url, dest, cookiePath) {
    const args = this._buildArgs(url, dest, cookiePath);
    return new Promise((resolve, reject) => {
      console.log(`[youtube-dl] Downloading: ${url}${cookiePath ? ' (with cookies)' : ''}`);
      execFile(this.binPath, args, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
        if (err) {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          const msg = (stderr || err.message || '').trim();
          if (PERMANENT_PATTERNS.some(p => msg.includes(p))) {
            return reject(new UnrecoverableError(`Video unavailable: ${msg.slice(-200)}`));
          }
          return reject(new Error(`yt-dlp: ${msg.slice(-300)}`));
        }

        if (!fs.existsSync(dest)) {
          return reject(new Error('yt-dlp finished but output file not found'));
        }

        const size = fs.statSync(dest).size;
        if (size < 10_000) {
          fs.unlinkSync(dest);
          return reject(new UnrecoverableError(`Output file too small (${size} bytes) — likely an error page`));
        }

        console.log(`[youtube-dl] Done: ${size} bytes`);
        resolve(dest);
      });
    });
  }
}

module.exports = new VideoDownloader();
