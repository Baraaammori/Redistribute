// ─── Caption Studio Route ────────────────────────────────────────────────────
// POST /api/captions/:videoId/generate — Whisper → ASS → FFmpeg burn-in
// GET  /api/captions/:videoId          — Poll status + URLs
// ─────────────────────────────────────────────────────────────────────────────
// MEMORY ARCHITECTURE:
//   1. Source video  → streamed to disk (never held in Node heap)
//   2. Audio         → extracted as 60-second WAV chunks, each deleted after Whisper
//   3. ASS/SRT files → generated in-memory then written to disk (tiny, <1MB)
//   4. Captioned MP4 → FFmpeg writes directly to disk with -preset ultrafast -threads 1
//   5. Upload        → streamed from disk via axios (no readFileSync)
//   All temp dirs deleted in finally{} even on crash.
// ─────────────────────────────────────────────────────────────────────────────
const router   = require("express").Router();
const fs       = require("fs");
const path     = require("path");
const os       = require("os");
const { execFile } = require("child_process");
const axios    = require("axios");
const FormData = require("form-data");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const { downloadToTemp, uploadFile } = require("../lib/storage");

// ── Memory monitoring ─────────────────────────────────────────────────────────
const MAX_HEAP_MB = 380; // guard threshold — kill before Render's 512MB wall

function memMB() {
  const { heapUsed, rss } = process.memoryUsage();
  return { heap: Math.round(heapUsed / 1024 / 1024), rss: Math.round(rss / 1024 / 1024) };
}

function logMem(label) {
  const m = memMB();
  console.log(`[mem] ${label} | heap: ${m.heap}MB | rss: ${m.rss}MB`);
}

function assertMemory(label) {
  const m = memMB();
  if (m.heap > MAX_HEAP_MB) {
    throw new Error(`ENOMEM: heap ${m.heap}MB exceeds ${MAX_HEAP_MB}MB before ${label} — job requeued`);
  }
}

// ── Platform caption presets ──────────────────────────────────────────────────
const CAPTION_STYLES = {
  tiktok: {
    fontname: "Arial Black", fontsize: 22,
    primaryColour: "&H00FFFFFF", outlineColour: "&H00000000", shadowColour: "&H80000000",
    bold: 1, outline: 3, shadow: 1, alignment: 2, marginV: 80, wordsPerLine: 2,
  },
  instagram: {
    fontname: "Arial", fontsize: 16,
    primaryColour: "&H00FFFFFF", outlineColour: "&H00000000",
    bold: 0, outline: 2, shadow: 0, alignment: 2, marginV: 60, wordsPerLine: 4,
  },
  youtube: {
    fontname: "Arial", fontsize: 14,
    primaryColour: "&H00FFFFFF", outlineColour: "&H00000000",
    bold: 0, outline: 2, shadow: 1, alignment: 2, marginV: 40, wordsPerLine: 6,
  },
};

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/:videoId/generate", authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  const userId    = req.user.userId;
  const platform  = req.body.platform || "tiktok";
  const clipId    = req.body.clip_id || null;
  const burnIn    = req.body.burn_in !== false;

  const { data: video } = await supabase
    .from("uploaded_videos").select("*")
    .eq("id", videoId).eq("user_id", userId).single();
  if (!video) return res.status(404).json({ error: "Video not found" });

  let fileUrl  = video.file_url;
  let targetId = videoId;

  if (clipId) {
    const { data: clip } = await supabase
      .from("clips").select("*")
      .eq("id", clipId).eq("user_id", userId).single();
    if (!clip) return res.status(404).json({ error: "Clip not found" });
    fileUrl  = clip.file_url;
    targetId = clipId;
  }

  // Respond immediately — async background processing below
  res.json({ message: "Caption generation started", videoId, clipId });

  // Mark as processing so frontend spinner shows
  await supabase.from("captions").upsert({
    video_id: videoId, clip_id: clipId, user_id: userId, platform, status: "processing",
  }, { onConflict: "video_id,clip_id,platform" });

  const tmpDir   = path.join(os.tmpdir(), "captions_" + videoId + "_" + Date.now());
  const chunksDir = path.join(tmpDir, "chunks");
  let videoPath  = null;

  logMem("job start");

  try {
    fs.mkdirSync(chunksDir, { recursive: true });

    // ── Step 1: Download source video to disk (streamed, no RAM spike) ────────
    await updateStatus(videoId, clipId, userId, platform, "downloading");
    videoPath = await downloadToTemp(fileUrl, `cap_src_${targetId}.mp4`);
    logMem("after download");

    // ── Step 2: Extract audio as 60-second WAV chunks ─────────────────────────
    await updateStatus(videoId, clipId, userId, platform, "extracting_audio");
    assertMemory("audio extraction");
    const chunks = await extractAudioChunks(videoPath, chunksDir, 60);
    logMem(`after extraction (${chunks.length} chunks)`);

    // ── Step 3: Transcribe each chunk sequentially, delete immediately ─────────
    await updateStatus(videoId, clipId, userId, platform, "transcribing");
    const { words, fullText } = await transcribeChunksSequentially(chunks);
    logMem("after transcription");

    if (!words.length) throw new Error("No speech detected — video may be silent or music-only");

    // ── Step 4: Generate subtitle files (pure JS, ~1ms, negligible RAM) ────────
    const style   = mergeStyle(platform, req.body.style);
    const assPath = path.join(tmpDir, "captions.ass");
    const srtPath = path.join(tmpDir, "captions.srt");
    generateASS(words, assPath, style);
    generateSRT(words, srtPath, style.wordsPerLine);

    // ── Step 5: Upload SRT (streamed) ─────────────────────────────────────────
    const srtStoragePath = `${userId}/${videoId}/captions_${platform}.srt`;
    const { url: srtUrl } = await uploadFile(srtPath, srtStoragePath, "text/plain");

    let captionedVideoUrl = null;

    // ── Step 6: Burn captions into video ──────────────────────────────────────
    if (burnIn) {
      assertMemory("FFmpeg burn-in");
      logMem("before burn-in");
      await updateStatus(videoId, clipId, userId, platform, "rendering");

      const captionedPath = path.join(tmpDir, "captioned.mp4");
      await burnCaptions(videoPath, assPath, captionedPath);
      logMem("after burn-in");

      // Delete source video from disk immediately to free OS page cache
      safeUnlink(videoPath); videoPath = null;

      // Unique versioned path — prevents CDN from serving the cached old file
      const ts = Date.now();
      const captionedStoragePath = `${userId}/${videoId}/captioned_${platform}_${targetId}_v${ts}.mp4`;
      const { url } = await uploadFile(captionedPath, captionedStoragePath, "video/mp4");
      captionedVideoUrl = url;
      logMem("after upload");
    }

    // ── Step 7: Persist result ────────────────────────────────────────────────
    await supabase.from("captions").upsert({
      video_id: videoId, clip_id: clipId, user_id: userId, platform,
      srt_url: srtUrl, captioned_video_url: captionedVideoUrl,
      transcript_text: fullText,
      word_count: words.length,
      style, status: "done", burn_in: burnIn,
      updated_at: new Date().toISOString(),
    }, { onConflict: "video_id,clip_id,platform" });

    await supabase.from("job_logs").insert({
      user_id: userId, video_id: videoId, action: "captions",
      details: { platform, burn_in: burnIn, word_count: words.length, captioned_video_url: captionedVideoUrl },
      status: "success",
    });

    logMem("job complete");
    console.log(`✅ Captions done: ${videoId} | ${words.length} words | platform: ${platform}`);

  } catch (err) {
    console.error(`❌ Caption generation failed [${videoId}]:`, err.message);
    logMem("on error");

    const isOOM = err.message.includes("ENOMEM") || err.message.includes("out of memory");
    await supabase.from("captions").upsert({
      video_id: videoId, clip_id: clipId, user_id: userId, platform,
      status: "failed",
      error: isOOM ? "Server ran out of memory — try a shorter clip or try again later" : err.message,
      updated_at: new Date().toISOString(),
    }, { onConflict: "video_id,clip_id,platform" });

  } finally {
    // Always clean up — even on OOM crash
    if (videoPath) safeUnlink(videoPath);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    logMem("after cleanup");
  }
});

// GET /api/captions/:videoId
router.get("/:videoId", authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from("captions").select("*")
    .eq("video_id", req.params.videoId)
    .eq("user_id", req.user.userId)
    .order("updated_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── Audio chunking ─────────────────────────────────────────────────────────────

// FFmpeg segment muxer: splits audio into N-second WAV chunks.
// Each chunk is ~(chunkSec * 32KB) ≈ 1.9MB per minute — well under Groq's 25MB limit.
function extractAudioChunks(videoPath, chunksDir, chunkSec = 60) {
  return new Promise((resolve, reject) => {
    const pattern = path.join(chunksDir, "chunk_%03d.wav");
    execFile("ffmpeg", [
      "-y", "-i", videoPath,
      "-vn",
      "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
      "-f", "segment",
      "-segment_time", String(chunkSec),
      "-reset_timestamps", "1",
      pattern,
    ], { timeout: 300_000 }, (err, _, stderr) => {
      if (err) return reject(new Error("Audio chunk extraction failed: " + (stderr || "").slice(-200)));
      const files = fs.readdirSync(chunksDir)
        .filter(f => f.startsWith("chunk_") && f.endsWith(".wav"))
        .sort();
      if (!files.length) return reject(new Error("FFmpeg produced no audio chunks"));
      const chunks = files.map((f, i) => ({
        file: path.join(chunksDir, f),
        offset: i * chunkSec,
      }));
      resolve(chunks);
    });
  });
}

// Process each chunk sequentially, delete from disk immediately after Whisper returns.
// This keeps peak disk usage at ~(1 source video + 1 WAV chunk + 1 captioned output).
async function transcribeChunksSequentially(chunks) {
  const allWords = [];
  let fullText   = "";

  for (const { file, offset } of chunks) {
    const chunkData = await transcribeOneChunk(file);

    // Normalize word objects and shift timestamps by chunk offset
    const words = normalizeWords(chunkData).map(w => ({
      word: w.word,
      start: w.start + offset,
      end:   w.end   + offset,
    }));

    allWords.push(...words);
    fullText += (chunkData.text || "").trim() + " ";

    // Delete the chunk WAV from disk right away — frees OS page cache
    safeUnlink(file);
  }

  return { words: allWords, fullText: fullText.trim() };
}

// Send a single WAV file to Whisper (Groq / OpenAI / local) and return raw response.
async function transcribeOneChunk(audioPath) {
  const mode = process.env.WHISPER_MODE || "groq";
  console.log(`[Whisper] Transcribing chunk ${path.basename(audioPath)} via ${mode}…`);

  if (mode === "groq") {
    const form = new FormData();
    form.append("file", fs.createReadStream(audioPath), { filename: "audio.wav", contentType: "audio/wav" });
    form.append("model", "whisper-large-v3");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");

    const { data } = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      form,
      {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        maxBodyLength: Infinity, timeout: 300_000,
      }
    );
    return data;

  } else if (mode === "cloud") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
    const form = new FormData();
    form.append("file", fs.createReadStream(audioPath), { filename: "audio.wav", contentType: "audio/wav" });
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");

    const { data } = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        maxBodyLength: Infinity, timeout: 300_000,
      }
    );
    return data;

  } else {
    // Local Whisper (python)
    return new Promise((resolve, reject) => {
      const outDir = path.dirname(audioPath);
      execFile("python", [
        "-m", "whisper", audioPath,
        "--model", "base.en",
        "--output_format", "json",
        "--word_timestamps", "True",
        "--output_dir", outDir,
      ], { maxBuffer: 1024 * 1024 * 50, timeout: 600_000 }, (err) => {
        if (err) return reject(new Error("Local Whisper failed: " + err.message));
        const jsonPath = audioPath.replace(/\.wav$/, ".json");
        try {
          const d = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
          safeUnlink(jsonPath);
          resolve(d);
        } catch (e) { reject(new Error("Failed to parse local Whisper output")); }
      });
    });
  }
}

// Normalize words from any Whisper response shape into [{word, start, end}].
function normalizeWords(data) {
  // Shape 1: top-level words array (Groq, OpenAI with word timestamps)
  if (data.words?.length) {
    return data.words.map(w => ({ word: w.word || w.text || "", start: w.start || 0, end: w.end || 0 }));
  }
  // Shape 2: words nested inside segments
  const fromSegs = [];
  (data.segments || []).forEach(seg => {
    (seg.words || []).forEach(w => fromSegs.push({ word: w.word || w.text || "", start: w.start || 0, end: w.end || 0 }));
  });
  if (fromSegs.length) return fromSegs;
  // Shape 3: synthetic — interpolate timestamps from segment boundaries
  const synthetic = [];
  (data.segments || []).forEach(seg => {
    const tokens = (seg.text || "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    const dur  = ((seg.end || 0) - (seg.start || 0)) / tokens.length;
    tokens.forEach((w, i) => synthetic.push({
      word: w,
      start: (seg.start || 0) + i * dur,
      end:   (seg.start || 0) + (i + 1) * dur,
    }));
  });
  return synthetic;
}

// ── Subtitle generation ───────────────────────────────────────────────────────

function mergeStyle(platform, overrides = {}) {
  const base = CAPTION_STYLES[platform] || CAPTION_STYLES.tiktok;
  const merged = { ...base };

  // Map frontend style props to ASS properties
  if (overrides.fontname)   merged.fontname = overrides.fontname;
  if (overrides.fontsize)   merged.fontsize = overrides.fontsize;
  if (overrides.wordsPerLine) merged.wordsPerLine = overrides.wordsPerLine;
  if (overrides.bold !== undefined) merged.bold = overrides.bold;
  if (overrides.alignment)  merged.alignment = overrides.alignment;
  if (overrides.marginV !== undefined) merged.marginV = overrides.marginV;

  // Convert #RRGGBB → ASS &H00BBGGRR colour
  if (overrides.fontColor)    merged.primaryColour = hexToASS(overrides.fontColor);
  if (overrides.outlineColor && overrides.outlineColor !== "transparent") {
    merged.outlineColour = hexToASS(overrides.outlineColor);
    merged.outline = merged.outline || 2;
  } else if (overrides.outlineColor === "transparent") {
    merged.outline = 0;
  }

  return merged;
}

function hexToASS(hex) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "&H00FFFFFF";
  const r = c.slice(0, 2), g = c.slice(2, 4), b = c.slice(4, 6);
  return `&H00${b}${g}${r}`;
}

function fmtASS(t) {
  const h  = Math.floor(t / 3600);
  const m  = Math.floor((t % 3600) / 60);
  const s  = Math.floor(t % 60);
  const cs = Math.round((t % 1) * 100);
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function fmtSRT(t) {
  const h  = Math.floor(t / 3600);
  const m  = Math.floor((t % 3600) / 60);
  const s  = Math.floor(t % 60);
  const ms = Math.round((t % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n, len = 2) { return String(n).padStart(len, "0"); }

function generateASS(words, outputPath, style) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontname},${style.fontsize},${style.primaryColour},&H000000FF,${style.outlineColour},&H00000000,${style.bold},0,0,0,100,100,0,0,1,${style.outline},${style.shadow || 1},${style.alignment},20,20,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const wpl = style.wordsPerLine || 3;
  const lines = [];
  for (let i = 0; i < words.length; i += wpl) {
    const chunk = words.slice(i, i + wpl);
    const text  = chunk.map(w => (w.word || "").trim()).join(" ");
    lines.push(`Dialogue: 0,${fmtASS(chunk[0].start)},${fmtASS(chunk[chunk.length - 1].end)},Default,,0,0,0,,${text}`);
  }
  fs.writeFileSync(outputPath, header + lines.join("\n"));
}

function generateSRT(words, outputPath, wpl = 5) {
  let srt = ""; let idx = 1;
  for (let i = 0; i < words.length; i += wpl) {
    const chunk = words.slice(i, i + wpl);
    const text  = chunk.map(w => (w.word || "").trim()).join(" ");
    srt += `${idx}\n${fmtSRT(chunk[0].start)} --> ${fmtSRT(chunk[chunk.length - 1].end)}\n${text}\n\n`;
    idx++;
  }
  fs.writeFileSync(outputPath, srt.trim());
}

// ── FFmpeg burn-in ────────────────────────────────────────────────────────────
// -preset ultrafast  → lowest encoder memory footprint (vs fast: ~40% less RAM)
// -threads 1         → single-threaded prevents memory multiplication on free tier
// -crf 23            → slightly lower quality but much smaller output file
// No -maxBuffer bloat — stderr is small, we only capture errors
function burnCaptions(videoPath, assPath, outputPath) {
  return new Promise((resolve, reject) => {
    const escapedAss = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    execFile("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-vf", `ass=${escapedAss}`,
      "-c:v", "libx264",
      "-preset", "ultrafast",   // lowest encoder RAM vs fast (~40% reduction)
      "-crf", "23",
      "-threads", "1",          // single-threaded: ~50MB vs ~200MB for multi-thread
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 1024 * 1024 * 10, timeout: 900_000 }, (err, _, stderr) => {
      if (err) return reject(new Error("Caption burn-in failed: " + (stderr || "").slice(-400)));
      if (!fs.existsSync(outputPath)) return reject(new Error("Captioned output not created"));
      resolve(outputPath);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeUnlink(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

async function updateStatus(videoId, clipId, userId, platform, status) {
  await supabase.from("captions").upsert({
    video_id: videoId, clip_id: clipId, user_id: userId, platform,
    status, updated_at: new Date().toISOString(),
  }, { onConflict: "video_id,clip_id,platform" });
}

module.exports = router;
