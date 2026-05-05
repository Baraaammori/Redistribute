import * as tus from "tus-js-client";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
const BUCKET = "videos";

export interface UploadOptions {
  file: File;
  userId: string;
  onProgress?: (percent: number) => void;
  onSuccess?: (storagePath: string) => void;
  onError?: (err: Error) => void;
}

/**
 * Resumable chunked upload via Supabase TUS endpoint.
 * Falls back gracefully if SUPABASE_URL is not set.
 */
export function tusUpload({ file, userId, onProgress, onSuccess, onError }: UploadOptions): tus.Upload {
  const filename = `${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storagePath = `${BUCKET}/${filename}`;

  const upload = new tus.Upload(file, {
    endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
    retryDelays: [0, 3000, 5000, 10000, 20000],
    headers: {
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-upsert": "true",
    },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    metadata: {
      bucketName: BUCKET,
      objectName: filename,
      contentType: file.type || "video/mp4",
      cacheControl: "3600",
    },
    chunkSize: 10 * 1024 * 1024, // 10 MB chunks
    onError(err: Error) {
      console.error("[tus] Upload error:", err);
      onError?.(err);
    },
    onProgress(bytesUploaded: number, bytesTotal: number) {
      const percent = Math.round((bytesUploaded / bytesTotal) * 100);
      onProgress?.(percent);
    },
    onSuccess() {
      onSuccess?.(storagePath);
    },
  });

  // Resume from previous upload if fingerprint matches
  upload.findPreviousUploads().then((previous) => {
    if (previous.length) {
      upload.resumeFromPreviousUpload(previous[0]);
    }
    upload.start();
  });

  return upload;
}
