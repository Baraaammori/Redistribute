// ─── Storage Service ─────────────────────────────────────────────────────────
// Uses Supabase Storage for video files and clips
// ──────────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const supabase = require("./supabase");

const BUCKET_NAME = "videos";

/**
 * Ensure the storage bucket exists
 */
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET_NAME);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 524288000, // 500MB
      allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm", "video/avi", "video/x-matroska", "image/jpeg", "image/png", "image/webp"],
    });
  }
}

/**
 * Upload a file to Supabase Storage
 * @param {string} localPath - absolute path to file on disk
 * @param {string} storagePath - path within bucket (e.g., "user123/video_abc.mp4")
 * @param {string} contentType - MIME type
 * @returns {{ url: string, path: string }}
 */
async function uploadFile(localPath, storagePath, contentType = "video/mp4") {
  await ensureBucket();

  const fileBuffer = fs.readFileSync(localPath);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    url: urlData.publicUrl,
    path: storagePath,
  };
}

/**
 * Delete a file from Supabase Storage
 */
async function deleteFile(storagePath) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);
  if (error) console.warn(`Storage delete warning: ${error.message}`);
}

/**
 * Download a file from URL to local temp path
 */
async function downloadToTemp(url, filename) {
  const axios = require("axios");
  const tmpDir = path.join(require("os").tmpdir(), "redistribute");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const dest = path.join(tmpDir, filename);
  const writer = fs.createWriteStream(dest);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(dest));
    writer.on("error", reject);
  });
}

/**
 * Clean up temp files
 */
function cleanupTemp(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("Temp cleanup warning:", e.message);
  }
}

/**
 * Clean up a temp directory
 */
function cleanupTempDir(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn("Temp dir cleanup warning:", e.message);
  }
}

module.exports = { uploadFile, deleteFile, downloadToTemp, cleanupTemp, cleanupTempDir, ensureBucket, BUCKET_NAME };
