// ─── AI Clipping Route ───────────────────────────────────────────────────────
// POST /api/ai-clip/:videoId/generate   — Whisper transcribe → GPT-4o rank → FFmpeg cut
// ─────────────────────────────────────────────────────────────────────────────
const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const axios = require("axios");
const FormData = require("form-data");
const supabase = require("../lib/supabase");
const { authenticateToken } = require("../middleware/auth");
const { downloadToTemp, uploadFile, cleanupTemp } = require("../lib/storage");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ffprobe(filePath) {
  return new Promise((resolve, reject) => {
    execFile("ffprobe", [
      "-v", "quiet", "-print_format", "json",
      "-show_format", "-show_streams", filePath,
    ], (err, stdout) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
    });
  });
}

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y", "-i", videoPath,
      "-vn", "-ar", "16000", "-ac", "1", "-f", "wav",
      audioPath,
    ], (err) => err ? reject(err) : resolve());
  });
}

async function whisperTranscribe(audioPath) {
  const mode = process.env.WHISPER_MODE || "cloud";

  if (mode === "local") {
    console.log(`[Whisper] Transcribing ${audioPath} locally...`);
    return new Promise((resolve, reject) => {
      execFile("python", ["-m", "whisper", audioPath, "--model", "base.en", "--output_format", "json", "--word_timestamps", "True", "--output_dir", path.dirname(audioPath)], { maxBuffer: 1024 * 1024 * 500, timeout: 600000 }, (error, stdout, stderr) => {
        if (error) return reject(new Error("Local Whisper failed: " + error.message));
        const jsonPath = audioPath.replace(/\.wav$/, ".json");
        try {
          const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
          const words = [];
          if (data.segments) data.segments.forEach(seg => { if (seg.words) words.push(...seg.words); });
          data.words = words;
          resolve(data);
        } catch (e) { reject(new Error("Failed to parse local Whisper JSON output")); }
      });
    });
  } else if (mode === "groq") {
    console.log(`[Whisper] Transcribing ${audioPath} via Groq (Free Cloud)...`);
    const fd = new FormData();
    fd.append("file", fs.createReadStream(audioPath), { filename: "audio.wav", contentType: "audio/wav" });
    fd.append("model", "whisper-large-v3");
    fd.append("response_format", "verbose_json");

    const res = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", fd, {
      headers: { ...fd.getHeaders(), Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      maxBodyLength: Infinity,
      timeout: 300_000,
    });
    const data = res.data;
    const words = [];
    if (data.segments) data.segments.forEach(seg => { if (seg.words) words.push(...seg.words); });
    data.words = words.length > 0 ? words : (data.segments || []);
    return data;
  } else {
    // Cloud mode (OpenAI API)
    console.log(`[Whisper] Transcribing ${audioPath} via OpenAI Cloud API...`);
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
    const fd = new FormData();
    fd.append("file", fs.createReadStream(audioPath), { filename: "audio.wav", contentType: "audio/wav" });
    fd.append("model", "whisper-1");
    fd.append("response_format", "verbose_json");
    fd.append("timestamp_granularities[]", "word");

    const res = await axios.post("https://api.openai.com/v1/audio/transcriptions", fd, {
      headers: { ...fd.getHeaders(), Authorization: `Bearer ${OPENAI_API_KEY}` },
      maxBodyLength: Infinity,
      timeout: 300_000,
    });
    return res.data;
  }
}

async function gptRankClips(transcript, duration, clipCount = 3, clipDuration = 60) {
  const mode = process.env.LLM_MODE || "openai";
  const apiKey = mode === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  const baseUrl = mode === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const model = mode === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o";

  if (!apiKey) throw new Error(`${mode.toUpperCase()}_API_KEY not set`);

  const prompt = `You are a viral short-form content expert. Given a video transcript with word timestamps, identify the ${clipCount} best clips for TikTok/Reels/Shorts.

Video duration: ${Math.round(duration)}s
Each clip should be ~${clipDuration} seconds.

Transcript (word-level timestamps):
${JSON.stringify(transcript.words?.slice(0, 500) || transcript.segments || [])}

Return ONLY valid JSON array:
[
  {
    "start": <float seconds>,
    "end": <float seconds>,
    "title": "<short engaging title>",
    "reason": "<why this segment is viral-worthy>",
    "viral_score": <1-100>
  }
]

Rules:
- start/end must be within [0, ${Math.round(duration)}]
- end - start should be between 20 and ${clipDuration}
- Pick moments with hooks, emotional peaks, key insights, or humor
- No overlap between clips`;

  const res = await axios.post(baseUrl, {
    model: model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    timeout: 60_000,
  });

  const content = res.data.choices[0].message.content;
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : (parsed.clips || parsed.results || []);
}

function cutClip(inputPath, start, end, outputPath) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y",
      "-ss", String(start),
      "-to", String(end),
      "-i", inputPath,
      "-c", "copy",        // stream copy — fast, no re-encode
      "-avoid_negative_ts", "make_zero",
      outputPath,
    ], (err) => err ? reject(err) : resolve());
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai-clip/:videoId/generate
 * Body: { clip_count?: number, clip_duration?: number }
 *
 * 1. Download source video
 * 2. Extract audio → Whisper transcription
 * 3. GPT-4o ranks viral segments
 * 4. FFmpeg stream-copy each clip
 * 5. Upload clips to Supabase Storage
 * 6. Insert into `clips` table
 */
router.post("/:videoId/generate", authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.id;
  const clipCount = Math.min(parseInt(req.body.clip_count) || 3, 10);
  const clipDuration = Math.min(parseInt(req.body.clip_duration) || 60, 180);

  // Verify ownership
  const { data: video, error: vidErr } = await supabase
    .from("videos")
    .select("id, storage_path, duration_seconds, title")
    .eq("id", videoId)
    .eq("user_id", userId)
    .single();

  if (vidErr || !video) return res.status(404).json({ error: "Video not found" });

  // Respond immediately — processing is async
  res.json({ status: "processing", message: "AI clipping started. Check /api/upload/:id for new clips." });

  // ── Background processing ──────────────────────────────────────────────────
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiclip-"));
  const videoPath = path.join(tmpDir, "source.mp4");
  const audioPath = path.join(tmpDir, "audio.wav");

  try {
    // 1. Download
    await downloadToTemp(video.storage_path, videoPath);

    // 2. Probe duration if not stored
    let duration = video.duration_seconds;
    if (!duration) {
      const probe = await ffprobe(videoPath);
      duration = parseFloat(probe.format?.duration || 0);
    }

    // 3. Extract audio
    await extractAudio(videoPath, audioPath);

    // 4. Whisper transcribe
    const transcript = await whisperTranscribe(audioPath);

    // 5. GPT-4o rank clips
    const ranked = await gptRankClips(transcript, duration, clipCount, clipDuration);
    if (!ranked || ranked.length === 0) {
      console.warn(`[ai-clip] GPT returned no clips for video ${videoId}`);
      return;
    }

    // 6. Cut + upload each clip
    for (let i = 0; i < ranked.length; i++) {
      const seg = ranked[i];
      const clipFile = path.join(tmpDir, `clip_${i}.mp4`);
      const start = Math.max(0, parseFloat(seg.start) || 0);
      const end = Math.min(duration, parseFloat(seg.end) || (start + clipDuration));
      if (end <= start) continue;

      try {
        await cutClip(videoPath, start, end, clipFile);

        const storagePath = `clips/${userId}/${videoId}/ai_${Date.now()}_${i}.mp4`;
        const fileBuffer = fs.readFileSync(clipFile);
        const publicUrl = await uploadFile(storagePath, fileBuffer, "video/mp4");

        await supabase.from("clips").insert({
          video_id: videoId,
          user_id: userId,
          title: seg.title || `AI Clip ${i + 1}`,
          storage_path: storagePath,
          public_url: publicUrl,
          start_time: start,
          end_time: end,
          duration_seconds: end - start,
          status: "ready",
          ai_reason: seg.reason || null,
          viral_score: seg.viral_score || null,
          source: "ai_clip",
        });
      } catch (clipErr) {
        console.error(`[ai-clip] Failed to cut clip ${i}:`, clipErr.message);
      }
    }

    console.log(`[ai-clip] Generated ${ranked.length} clips for video ${videoId}`);
  } catch (err) {
    console.error("[ai-clip] Processing error:", err.message);
  } finally {
    cleanupTemp(tmpDir);
  }
});

module.exports = router;
