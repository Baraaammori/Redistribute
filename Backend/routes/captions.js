// ─── Caption Studio Route ────────────────────────────────────────────────────
// POST /api/captions/:videoId/generate   — Whisper → styled ASS → burn into video
// GET  /api/captions/:videoId            — Get caption status + SRT file URL
// POST /api/captions/:videoId/style      — Update caption style only (re-render)
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

// Platform caption presets
const CAPTION_STYLES = {
  tiktok: {
    fontname: "Arial Black",
    fontsize: 22,
    primaryColour: "&H00FFFFFF",   // white
    outlineColour: "&H00000000",   // black outline
    shadowColour: "&H80000000",
    bold: 1,
    outline: 3,
    shadow: 1,
    alignment: 2,                  // bottom-center
    marginV: 80,
    wordsPerLine: 2,               // karaoke style: 2 words at a time
  },
  instagram: {
    fontname: "Arial",
    fontsize: 16,
    primaryColour: "&H00FFFFFF",
    outlineColour: "&H00000000",
    bold: 0,
    outline: 2,
    shadow: 0,
    alignment: 2,
    marginV: 60,
    wordsPerLine: 4,
  },
  youtube: {
    fontname: "Arial",
    fontsize: 14,
    primaryColour: "&H00FFFFFF",
    outlineColour: "&H00000000",
    bold: 0,
    outline: 2,
    shadow: 1,
    alignment: 2,
    marginV: 40,
    wordsPerLine: 6,
  },
};

// POST /api/captions/:videoId/generate
router.post("/:videoId/generate", authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.userId;
  const platform = req.body.platform || "tiktok";
  const clipId = req.body.clip_id || null;        // if captioning a specific clip
  const burnIn = req.body.burn_in !== false;       // default true

  const { data: video } = await supabase.from("uploaded_videos").select("*")
    .eq("id", videoId).eq("user_id", userId).single();
  if (!video) return res.status(404).json({ error: "Video not found" });

  // If clip_id provided, work on the clip's file_url instead
  let fileUrl = video.file_url;
  let targetTable = "uploaded_videos";
  let targetId = videoId;

  if (clipId) {
    const { data: clip } = await supabase.from("clips").select("*")
      .eq("id", clipId).eq("user_id", userId).single();
    if (!clip) return res.status(404).json({ error: "Clip not found" });
    fileUrl = clip.file_url;
    targetTable = "clips";
    targetId = clipId;
  }

  // Respond immediately — process is async
  res.json({ message: "Caption generation started", videoId, clipId });

  const tmpDir = path.join(os.tmpdir(), "redistribute_captions", videoId);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. Download video/clip
    const videoPath = await downloadToTemp(fileUrl, `caption_src_${targetId}.mp4`);

    // 2. Extract audio
    const audioPath = path.join(tmpDir, "audio.wav");
    await extractAudio(videoPath, audioPath);

    // 3. Whisper transcription with word timestamps
    const transcript = await transcribeWhisper(audioPath);
    if (!transcript.words?.length) throw new Error("No words in transcript — video may have no speech");

    // 4. Generate ASS subtitle file
    const style = { ...(CAPTION_STYLES[platform] || CAPTION_STYLES.tiktok), ...req.body.style };
    const assPath = path.join(tmpDir, "captions.ass");
    const srtPath = path.join(tmpDir, "captions.srt");
    generateASS(transcript.words, assPath, style);
    generateSRT(transcript.words, srtPath, style.wordsPerLine);

    // 5. Upload SRT to storage (always — user can download it)
    const srtStoragePath = `${userId}/${videoId}/captions_${platform}.srt`;
    const { url: srtUrl } = await uploadFile(srtPath, srtStoragePath, "text/plain");

    let captionedVideoUrl = null;

    // 6. Burn captions into video (optional)
    if (burnIn) {
      const captionedPath = path.join(tmpDir, "captioned.mp4");
      await burnCaptions(videoPath, assPath, captionedPath);

      const captionedStoragePath = `${userId}/${videoId}/captioned_${platform}_${targetId}.mp4`;
      const { url } = await uploadFile(captionedPath, captionedStoragePath, "video/mp4");
      captionedVideoUrl = url;
    }

    // 7. Save caption record
    const { data: captionRecord } = await supabase.from("captions").upsert({
      video_id: videoId,
      clip_id: clipId,
      user_id: userId,
      platform,
      srt_url: srtUrl,
      captioned_video_url: captionedVideoUrl,
      transcript_text: transcript.text,
      word_count: transcript.words.length,
      style: style,
      status: "done",
      burn_in: burnIn,
    }, { onConflict: "video_id,clip_id,platform" }).select().single();

    await supabase.from("job_logs").insert({
      user_id: userId, video_id: videoId,
      action: "captions",
      details: { platform, burn_in: burnIn, word_count: transcript.words.length, captioned_video_url: captionedVideoUrl },
      status: "success",
    });

    // Cleanup
    cleanupTemp(videoPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    console.log(`✅ Captions done: ${videoId} | ${transcript.words.length} words | platform: ${platform}`);
  } catch (err) {
    console.error("Caption generation failed:", err.message);
    await supabase.from("captions").upsert({
      video_id: videoId, clip_id: clipId, user_id: userId, platform,
      status: "failed", error: err.message,
    }, { onConflict: "video_id,clip_id,platform" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// GET /api/captions/:videoId
router.get("/:videoId", authenticateToken, async (req, res) => {
  const { data, error } = await supabase.from("captions").select("*")
    .eq("video_id", req.params.videoId).eq("user_id", req.user.userId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y", "-i", videoPath,
      "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
      audioPath,
    ], { timeout: 120000 }, (err) => {
      if (err) return reject(new Error("Audio extraction failed: " + err.message));
      resolve(audioPath);
    });
  });
}

async function transcribeWhisper(audioPath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(audioPath), { filename: "audio.wav", contentType: "audio/wav" });
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  const { data } = await axios.post(
    "https://api.openai.com/v1/audio/transcriptions",
    form,
    { headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      maxBodyLength: Infinity, timeout: 180000 }
  );
  return data;
}

/**
 * Build an ASS subtitle file from word-level timestamps.
 * Uses short groups (wordsPerLine) for karaoke/viral style.
 */
function generateASS(words, outputPath, style) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontname},${style.fontsize},${style.primaryColour},&H000000FF,${style.outlineColour},&H00000000,${style.bold},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},20,20,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = [];
  const wpl = style.wordsPerLine || 3;

  for (let i = 0; i < words.length; i += wpl) {
    const chunk = words.slice(i, i + wpl);
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text = chunk.map(w => w.word.trim()).join(" ");

    // ASS time format: H:MM:SS.cc
    const fmt = (t) => {
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = Math.floor(t % 60);
      const cs = Math.round((t % 1) * 100);
      return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
    };

    lines.push(`Dialogue: 0,${fmt(start)},${fmt(end)},Default,,0,0,0,,${text}`);
  }

  fs.writeFileSync(outputPath, header + lines.join("\n"));
}

function generateSRT(words, outputPath, wordsPerLine = 5) {
  let srt = "";
  let index = 1;

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const chunk = words.slice(i, i + wordsPerLine);
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text = chunk.map(w => w.word.trim()).join(" ");

    const fmt = (t) => {
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = Math.floor(t % 60);
      const ms = Math.round((t % 1) * 1000);
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
    };

    srt += `${index}\n${fmt(start)} --> ${fmt(end)}\n${text}\n\n`;
    index++;
  }

  fs.writeFileSync(outputPath, srt.trim());
}

function burnCaptions(videoPath, assPath, outputPath) {
  return new Promise((resolve, reject) => {
    // ASS path must use forward slashes and escape colons on Windows
    const escapedAssPath = assPath.replace(/\\/g, "/").replace(":", "\\:");

    execFile("ffmpeg", [
      "-y", "-i", videoPath,
      "-vf", `ass=${escapedAssPath}`,
      "-c:v", "libx264", "-preset", "fast", "-crf", "22",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 1024 * 1024 * 100, timeout: 600000 }, (err, _, stderr) => {
      if (err) return reject(new Error("Caption burn-in failed: " + stderr?.slice(-300)));
      if (!fs.existsSync(outputPath)) return reject(new Error("Captioned output not created"));
      resolve(outputPath);
    });
  });
}

module.exports = router;
