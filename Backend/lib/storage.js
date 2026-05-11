// ─── Storage Service (Cloudflare R2) ─────────────────────────────────────────
// All file I/O goes to R2 via S3-compatible API.
// Multipart upload helpers are used for large browser-initiated uploads.
// ──────────────────────────────────────────────────────────────────────────────
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs   = require("fs");
const path = require("path");

const r2 = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET || "videos";
const PART_SIZE   = 10 * 1024 * 1024; // 10 MB — well above S3's 5 MB minimum

function getPublicUrl(key) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

// ── Backend-initiated upload (thumbnails, clips, SRTs) ────────────────────────
async function uploadFile(localPathOrBuffer, storagePath, contentType = "video/mp4") {
  const body = typeof localPathOrBuffer === "string"
    ? fs.createReadStream(localPathOrBuffer)
    : localPathOrBuffer;

  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         storagePath,
    Body:        body,
    ContentType: contentType,
  }));

  return { url: getPublicUrl(storagePath), path: storagePath };
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteFile(storagePath) {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: storagePath }));
  } catch (e) {
    console.warn("R2 delete warning:", e.message);
  }
}

// ── Check existence ───────────────────────────────────────────────────────────
async function fileExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── Multipart upload (browser → R2 directly via presigned URLs) ───────────────

async function createMultipartUpload(key, contentType) {
  const { UploadId } = await r2.send(new CreateMultipartUploadCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    ContentType: contentType || "video/mp4",
  }));
  return UploadId;
}

async function getPresignedPartUrls(key, uploadId, totalParts) {
  const urls = [];
  for (let i = 1; i <= totalParts; i++) {
    const url = await getSignedUrl(r2, new UploadPartCommand({
      Bucket:     BUCKET_NAME,
      Key:        key,
      UploadId:   uploadId,
      PartNumber: i,
    }), { expiresIn: 7200 }); // 2-hour window
    urls.push({ partNumber: i, signedUrl: url });
  }
  return urls;
}

// Backend fetches ETags via ListParts so the frontend never needs to expose them
async function completeMultipartUpload(key, uploadId) {
  const listed = await r2.send(new ListPartsCommand({
    Bucket:   BUCKET_NAME,
    Key:      key,
    UploadId: uploadId,
  }));

  const parts = (listed.Parts || []).map(p => ({
    PartNumber: p.PartNumber,
    ETag:       p.ETag,
  }));

  if (!parts.length) throw new Error("No parts found for this upload — did any chunks complete?");

  await r2.send(new CompleteMultipartUploadCommand({
    Bucket:          BUCKET_NAME,
    Key:             key,
    UploadId:        uploadId,
    MultipartUpload: { Parts: parts },
  }));

  return getPublicUrl(key);
}

async function abortMultipartUpload(key, uploadId) {
  try {
    await r2.send(new AbortMultipartUploadCommand({ Bucket: BUCKET_NAME, Key: key, UploadId: uploadId }));
  } catch (e) {
    console.warn("Abort multipart warning:", e.message);
  }
}

// ── Temp file helpers (used by clip processing / ffprobe download) ─────────────
async function downloadToTemp(url, filename) {
  const axios  = require("axios");
  const os     = require("os");
  const tmpDir = path.join(os.tmpdir(), "redistribute");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const dest   = path.join(tmpDir, filename);
  const writer = fs.createWriteStream(dest);
  const res    = await axios({ url, method: "GET", responseType: "stream" });
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(dest));
    writer.on("error", reject);
  });
}

function cleanupTemp(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  catch (e) { console.warn("Temp cleanup warning:", e.message); }
}

function cleanupTempDir(dirPath) {
  try { if (dirPath && fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true }); }
  catch (e) { console.warn("Temp dir cleanup warning:", e.message); }
}

module.exports = {
  uploadFile, deleteFile, fileExists,
  createMultipartUpload, getPresignedPartUrls, completeMultipartUpload, abortMultipartUpload,
  downloadToTemp, cleanupTemp, cleanupTempDir,
  BUCKET_NAME, PART_SIZE,
};
