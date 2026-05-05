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
 * Upload a file to Supabase Storage.
 *
 * @param {string|Buffer} localPathOrBuffer
 *   - string → file path; streamed via REST API (no full file loaded into RAM)
 *   - Buffer → in-memory bytes (use for small files: thumbnails, watermarks, SRTs)
 * @param {string} storagePath - path within bucket
 * @param {string} contentType - MIME type
 * @returns {{ url: string, path: string }}
 */
async function uploadFile(localPathOrBuffer, storagePath, contentType = "video/mp4") {
  await ensureBucket();

  if (typeof localPathOrBuffer === "string") {
    // Stream directly from disk — avoids loading the full video into RAM
    const axios = require("axios");
    const { size } = fs.statSync(localPathOrBuffer);
    const stream = fs.createReadStream(localPathOrBuffer);

    try {
      await axios({
        method: "post",
        url: `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storagePath}`,
        data: stream,
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": contentType,
          "Content-Length": size,
          "x-upsert": "true",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      throw new Error(`Storage upload failed: ${msg}`);
    }
  } else {
    // Buffer upload for small in-memory files (thumbnails, watermarks, SRTs)
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, localPathOrBuffer, { contentType, upsert: true });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }

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
