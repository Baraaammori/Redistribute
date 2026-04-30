const fs = require('fs');
const https = require('https');
const path = require('path');
const os = require('os');

const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

const isWin = os.platform() === 'win32';
const filename = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const dest = path.join(binDir, filename);

// The direct release URL redirects to objects.githubusercontent.com, avoiding the REST API rate limit
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${filename}`;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status code: ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        if (!isWin) fs.chmodSync(dest, 0o755); // Make executable on Linux/Mac
        resolve();
      });
    }).on('error', (err) => {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

console.log(`Downloading yt-dlp to ${dest}...`);
download(url, dest)
  .then(() => console.log('✅ yt-dlp downloaded successfully'))
  .catch(err => {
    console.error('❌ Failed to download yt-dlp:', err.message);
    process.exit(1);
  });
