// ─── FFmpeg Service ──────────────────────────────────────────────────────────
// Video analysis (ffprobe) and clip cutting (ffmpeg)
// ──────────────────────────────────────────────────────────────────────────────
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { getOrientation } = require("./smartEngine");

/**
 * Analyze video file with ffprobe
 * Returns: duration, width, height, orientation, aspect_ratio, fps, codec
 */
function analyzeVideo(filePath) {
  return new Promise((resolve, reject) => {
    execFile("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      filePath,
    ], { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`FFprobe failed: ${err.message}`));

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find(s => s.codec_type === "video");
        if (!videoStream) return reject(new Error("No video stream found"));

        const width = parseInt(videoStream.width, 10);
        const height = parseInt(videoStream.height, 10);
        const duration = parseFloat(data.format?.duration || videoStream.duration || "0");

        // Parse FPS from avg_frame_rate like "30/1" or "29.97/1"
        let fps = 30;
        if (videoStream.avg_frame_rate) {
          const parts = videoStream.avg_frame_rate.split("/");
          if (parts.length === 2 && parseFloat(parts[1]) !== 0) {
            fps = Math.round((parseFloat(parts[0]) / parseFloat(parts[1])) * 100) / 100;
          }
        }

        resolve({
          duration_seconds: Math.round(duration * 100) / 100,
          width,
          height,
          orientation: getOrientation(width, height),
          aspect_ratio: simplifyRatio(width, height),
          fps,
          codec: videoStream.codec_name || "unknown",
          bitrate: parseInt(data.format?.bit_rate || "0", 10),
          file_size: parseInt(data.format?.size || "0", 10),
        });
      } catch (parseErr) {
        reject(new Error(`FFprobe output parse failed: ${parseErr.message}`));
      }
    });
  });
}

/**
 * Cut a clip from a video using FFmpeg
 * Uses stream copy when possible (fast), re-encodes if needed
 */
function cutClip(inputPath, outputPath, startTime, duration, options = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-ss", String(startTime),
      "-i", inputPath,
      "-t", String(duration),
    ];

    if (options.reencode) {
      // Re-encode for better quality / compatibility
      args.push(
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart"
      );
    } else {
      // Stream copy (fast, no re-encode)
      args.push(
        "-c", "copy",
        "-movflags", "+faststart"
      );
    }

    args.push(outputPath);

    execFile("ffmpeg", args, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`FFmpeg clip cut failed: ${err.message}`));
      if (!fs.existsSync(outputPath)) return reject(new Error("Output file was not created"));
      resolve(outputPath);
    });
  });
}

/**
 * Generate multiple clips from a video
 * @param {string} inputPath - source video
 * @param {string} outputDir - directory for clips
 * @param {Array} clipTimestamps - [{start_time, duration, index}]
 * @returns {Array} paths to generated clips
 */
async function generateClips(inputPath, outputDir, clipTimestamps) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];

  for (const clip of clipTimestamps) {
    const ext = path.extname(inputPath) || ".mp4";
    const outputPath = path.join(outputDir, `clip_${clip.index}${ext}`);

    try {
      await cutClip(inputPath, outputPath, clip.start_time, clip.duration, { reencode: true });
      const stats = fs.statSync(outputPath);
      results.push({
        index: clip.index,
        path: outputPath,
        start_time: clip.start_time,
        end_time: clip.start_time + clip.duration,
        duration: clip.duration,
        file_size: stats.size,
        success: true,
      });
    } catch (err) {
      results.push({
        index: clip.index,
        path: null,
        start_time: clip.start_time,
        end_time: clip.start_time + clip.duration,
        duration: clip.duration,
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Generate a thumbnail from a video at a specific timestamp
 */
function generateThumbnail(inputPath, outputPath, timestamp = 1) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y",
      "-ss", String(timestamp),
      "-i", inputPath,
      "-vframes", "1",
      "-q:v", "2",
      "-s", "640x360",
      outputPath,
    ], (err) => {
      if (err) return reject(new Error(`Thumbnail generation failed: ${err.message}`));
      resolve(outputPath);
    });
  });
}

/**
 * Simplify aspect ratio (e.g., 1920x1080 → "16:9")
 */
function simplifyRatio(width, height) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  const w = width / d;
  const h = height / d;

  // Map common ratios
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(ratio - 4 / 3) < 0.05) return "4:3";
  if (Math.abs(ratio - 1) < 0.05) return "1:1";

  return `${w}:${h}`;
}

module.exports = { analyzeVideo, cutClip, generateClips, generateThumbnail, simplifyRatio };
