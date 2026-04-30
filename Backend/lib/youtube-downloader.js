const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { UnrecoverableError } = require('bullmq');

/**
 * YouTube Downloader with Anti-Bot Evasion
 * Implements proxy rotation, user-agent spoofing, and cookie management.
 */
class YouTubeDownloader {
  constructor() {
    this.binPath = this._getBinPath();
    this.proxies = process.env.YOUTUBE_PROXIES ? process.env.YOUTUBE_PROXIES.split(',') : [];
    this.proxyIndex = 0;
  }

  _getBinPath() {
    const filename = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    return path.join(__dirname, '..', 'bin', filename);
  }

  /**
   * Get the next proxy in the rotation pool
   */
  _getNextProxy() {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  /**
   * Builds the yt-dlp arguments with all anti-bot evasions
   */
  _buildArgs(url, dest, options = {}) {
    const args = [
      url,
      '-f', 'bestvideo+bestaudio/best',
      '--merge-output-format', 'mkv',
      '-o', dest,
      '--no-playlist',
      '--no-check-certificates',
      '--extractor-args', 'youtube:player_client=ios,android,web',
      '--socket-timeout', '30',
      '--retries', '3',
      '--no-warnings',
    ];

    // 1. Cookie Authentication (Primary bypass)
    const cookieFile = process.env.YOUTUBE_COOKIES_FILE;
    if (cookieFile && fs.existsSync(cookieFile)) {
      // yt-dlp needs write access to the cookies file, but /etc/secrets is read-only.
      // Copy it to /tmp/ which is always writable.
      const writableCookieFile = path.join(os.tmpdir(), 'youtube_cookies_writable.txt');
      
      try {
        fs.copyFileSync(cookieFile, writableCookieFile);
        console.log(`🍪 [youtube-dl] Copied cookies to writable path: ${writableCookieFile}`);
        args.push('--cookies', writableCookieFile);
      } catch (err) {
        console.error(`⚠️ [youtube-dl] Failed to copy cookies to writable path: ${err.message}`);
        // Fallback to original just in case
        args.push('--cookies', cookieFile);
      }
    } else if (options.useBrowserCookies) {
      // Fallback for local development
      args.push('--cookies-from-browser', 'chrome');
    }

    // 2. Proxy Rotation (Secondary bypass)
    const proxy = this._getNextProxy();
    if (proxy) {
      console.log(`🌐 [youtube-dl] Routing through proxy: ${proxy.split('@')[1] || proxy}`);
      args.push('--proxy', proxy);
    }

    // 3. Header Spoofing
    args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');
    
    return args;
  }

  /**
   * Checks if an error is an anti-bot challenge
   */
  _detectAntiBotError(stderr) {
    if (!stderr) return false;
    const botPatterns = [
      'Sign in to confirm you’re not a bot',
      'HTTP Error 429',
      'Rate-limit exceeded',
      'Video unavailable'
    ];
    return botPatterns.some(pattern => stderr.includes(pattern));
  }

  /**
   * Main download method with fallback strategies
   */
  async download(url, id, attempt = 1) {
    const dest = path.join("/tmp", `redistribute_${id}_ytdlp.mkv`);

    if (!fs.existsSync(this.binPath)) {
      throw new Error(`yt-dlp binary not found at ${this.binPath}. Run npm run build.`);
    }

    // Strategy 1: Standard download with available cookies/proxies
    let options = {};
    
    // Strategy 2: If we failed previously, try browser cookies (if local)
    if (attempt > 1 && !process.env.YOUTUBE_COOKIES_FILE) {
      options.useBrowserCookies = true;
    }

    const args = this._buildArgs(url, dest, options);

    return new Promise((resolve, reject) => {
      console.log(`📥 [youtube-dl] Downloading: ${url} (Attempt ${attempt})`);
      
      execFile(this.binPath, args, {
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 10,
      }, async (err, stdout, stderr) => {
        
        if (err) {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          const stderrStr = stderr || err.message || '';
          
          if (this._detectAntiBotError(stderrStr)) {
            console.error(`❌ [youtube-dl] Anti-bot challenge detected!`);
            
            // If we have proxies, we might want to throw a normal error to trigger a BullMQ retry 
            // which will pick a new proxy on the next attempt.
            if (this.proxies.length > 0 && attempt < 3) {
               return reject(new Error(`YouTube blocked request. Retrying with new proxy...`));
            }
            
            // Exhausted all options -> Permanent failure
            return reject(new UnrecoverableError(`YouTube blocked download (Anti-bot challenge). Provide a valid cookies.txt file or residential proxy.`));
          }
          
          return reject(new Error(`yt-dlp download failed: ${stderrStr.slice(-300)}`));
        }

        if (!fs.existsSync(dest)) {
          return reject(new Error('yt-dlp completed but output file not found'));
        }

        const size = fs.statSync(dest).size;
        
        if (size < 10000) {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          return reject(new UnrecoverableError(`Output file too small (${size} bytes) — likely an HTML challenge page.`));
        }

        console.log(`✅ [youtube-dl] Download complete: ${size} bytes`);
        resolve(dest);
      });
    });
  }
}

module.exports = new YouTubeDownloader();
