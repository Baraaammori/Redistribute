// ─── Smart Engine ─────────────────────────────────────────────────────────────
// Analyzes video metadata and decides distribution strategy
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Determine orientation from dimensions
 */
function getOrientation(width, height) {
  if (height > width) return "vertical";
  if (width > height) return "horizontal";
  return "square";
}

/**
 * Smart decision engine — heart of UploadOnce AI
 * Takes video metadata and returns distribution plan
 *
 * @param {object} videoInfo
 * @param {number} videoInfo.duration_seconds
 * @param {number} videoInfo.width
 * @param {number} videoInfo.height
 * @param {string} videoInfo.orientation  - 'vertical' | 'horizontal' | 'square'
 * @returns {object} decision
 */
function decide(videoInfo) {
  const { duration_seconds: duration, orientation } = videoInfo;

  const decision = {
    youtube: null,        // 'full_upload' or null
    tiktok: null,         // 'full_upload' or 'generate_clips' or null
    youtube_shorts: null, // 'full_upload' or null
    generate_clips: false,
    clip_count: 0,
    clip_duration: 0,     // seconds per clip
    ask_user: false,
    convert_vertical: false,
    suggestions: null,
    reason: "",
  };

  // ── Rule 1: Long video (> 3 minutes) ───────────────────────────────────
  if (duration > 180) {
    decision.youtube = "full_upload";
    decision.tiktok = "generate_clips";
    decision.generate_clips = true;
    // Generate 1 clip per minute, max 5, min 2
    decision.clip_count = Math.min(Math.max(Math.floor(duration / 60), 2), 5);
    decision.clip_duration = 45; // 45 seconds per clip
    decision.reason = `Long video (${Math.round(duration / 60)} min) → Full YouTube + ${decision.clip_count} TikTok clips`;
    return decision;
  }

  // ── Rule 2: Short vertical video (≤ 60 seconds) ────────────────────────
  if (duration <= 60 && orientation === "vertical") {
    decision.tiktok = "full_upload";
    decision.youtube_shorts = "full_upload";
    decision.reason = `Short vertical (${Math.round(duration)}s) → TikTok + YouTube Shorts`;
    return decision;
  }

  // ── Rule 3: Short horizontal video (≤ 60 seconds) ──────────────────────
  if (duration <= 60 && orientation === "horizontal") {
    decision.ask_user = true;
    decision.convert_vertical = true;
    decision.suggestions = {
      option1: { label: "Upload as-is to YouTube Shorts", youtube_shorts: "full_upload" },
      option2: { label: "Convert to vertical for TikTok", tiktok: "full_upload", convert: true },
      option3: { label: "Upload to YouTube (full)", youtube: "full_upload" },
    };
    decision.reason = `Short horizontal (${Math.round(duration)}s) → User choice: convert to vertical or upload as-is`;
    return decision;
  }

  // ── Rule 4: Short square video (≤ 60 seconds) ──────────────────────────
  if (duration <= 60 && orientation === "square") {
    decision.tiktok = "full_upload";
    decision.youtube_shorts = "full_upload";
    decision.reason = `Short square (${Math.round(duration)}s) → TikTok + YouTube Shorts`;
    return decision;
  }

  // ── Rule 5: Medium video (1–3 minutes) ─────────────────────────────────
  if (duration > 60 && duration <= 180) {
    decision.ask_user = true;
    decision.suggestions = {
      option1: {
        label: "Full upload to YouTube",
        youtube: "full_upload",
      },
      option2: {
        label: orientation === "vertical"
          ? "Upload to TikTok + YouTube Shorts"
          : "Upload to YouTube + generate TikTok clips",
        youtube: orientation === "horizontal" ? "full_upload" : null,
        tiktok: orientation === "vertical" ? "full_upload" : "generate_clips",
        youtube_shorts: orientation === "vertical" ? "full_upload" : null,
      },
      option3: {
        label: "Upload everywhere + generate clips",
        youtube: "full_upload",
        tiktok: "generate_clips",
        generate_clips: true,
        clip_count: 2,
        clip_duration: 30,
      },
    };
    decision.reason = `Medium video (${Math.round(duration)}s, ${orientation}) → User picks distribution`;
    return decision;
  }

  // Fallback
  decision.youtube = "full_upload";
  decision.reason = "Fallback → YouTube full upload";
  return decision;
}

/**
 * Calculate smart clip timestamps from video duration
 * Spreads clips evenly across the video, avoiding first/last 10 seconds
 */
function calculateClipTimestamps(duration, clipCount, clipDuration) {
  const clips = [];
  const safePadding = 10; // skip first/last 10 seconds
  const usableDuration = duration - (safePadding * 2) - clipDuration;

  if (usableDuration <= 0 || clipCount <= 0) return clips;

  const spacing = usableDuration / clipCount;

  for (let i = 0; i < clipCount; i++) {
    const startTime = safePadding + (spacing * i);
    const endTime = startTime + clipDuration;
    clips.push({
      index: i + 1,
      start_time: Math.round(startTime * 100) / 100,
      end_time: Math.round(endTime * 100) / 100,
      duration: clipDuration,
    });
  }

  return clips;
}

module.exports = { decide, getOrientation, calculateClipTimestamps };
