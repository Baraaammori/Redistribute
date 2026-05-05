import React, { useState, useEffect } from "react";
import { Subtitles, Sparkles, Download, CheckCircle, Loader2, RefreshCw, Type, Palette, Move } from "lucide-react";
import { api } from "../../lib/api";
import VideoPlayer from "../../components/VideoPlayer";

const PLATFORMS = [
  { id: "tiktok",    label: "TikTok",         icon: "🎵", desc: "Large bold · 2 words/line · Karaoke" },
  { id: "instagram", label: "Instagram Reels", icon: "📸", desc: "Medium · 4 words/line · Bottom" },
  { id: "youtube",   label: "YouTube Shorts",  icon: "▶️", desc: "Standard · 6 words/line" },
];

const FONTS = [
  "Arial Black", "Arial", "Impact", "Montserrat", "Roboto", "Comic Sans MS", "Courier New", "Georgia", "Verdana",
];

const COLORS = [
  { label: "White", value: "#FFFFFF" }, { label: "Yellow", value: "#FFE500" },
  { label: "Cyan", value: "#00FFFF" },  { label: "Green", value: "#00FF88" },
  { label: "Pink", value: "#FF69B4" },  { label: "Red", value: "#FF4444" },
  { label: "Orange", value: "#FF8C00" },{ label: "Purple", value: "#9B7EFF" },
];

const OUTLINE_COLORS = [
  { label: "Black", value: "#000000" }, { label: "Dark Gray", value: "#333333" },
  { label: "Navy", value: "#001133" },  { label: "Dark Red", value: "#440000" },
  { label: "None", value: "transparent" },
];

const POSITIONS = [
  { id: "top", label: "Top", marginV: 120 },
  { id: "center", label: "Center", marginV: 0 },
  { id: "bottom", label: "Bottom", marginV: 80 },
];

const STATUS_LABELS: Record<string, string> = {
  processing:      "Starting up…",
  downloading:     "Downloading video…",
  extracting_audio:"Extracting audio…",
  transcribing:    "Transcribing with Whisper… 1–3 min.",
  rendering:       "Burning captions into video…",
};

const inputStyle: React.CSSProperties = {
  background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, width: "100%",
  outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
};

const sectionBox: React.CSSProperties = {
  background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8,
  fontWeight: 600, textTransform: "uppercase", letterSpacing: 1,
};

export default function CaptionStudio() {
  const [videos, setVideos]           = useState<any[]>([]);
  const [selectedVideo, setSelected]  = useState<string>("");
  const [selectedClip, setClip]       = useState<string>("");
  const [clips, setClips]             = useState<any[]>([]);
  const [platform, setPlatform]       = useState("tiktok");
  const [burnIn, setBurnIn]           = useState(true);
  const [wordsPerLine, setWPL]        = useState(2);
  const [fontSize, setFontSize]       = useState(22);
  const [fontFamily, setFontFamily]   = useState("Arial Black");
  const [fontColor, setFontColor]     = useState("#FFFFFF");
  const [outlineColor, setOutline]    = useState("#000000");
  const [position, setPosition]       = useState<"top"|"center"|"bottom">("bottom");
  const [bold, setBold]               = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [captions, setCaptions]       = useState<any[]>([]);
  const [error, setError]             = useState("");

  useEffect(() => {
    api.upload.list().then(vs => {
      setVideos(vs || []);
      if (vs?.length) setSelected(vs[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedVideo) return;
    api.upload.clips(selectedVideo).then(setClips).catch(() => setClips([]));
    api.captions.list(selectedVideo).then(setCaptions).catch(() => setCaptions([]));
  }, [selectedVideo]);

  const currentVideoObj = videos.find(v => v.id === selectedVideo);
  const videoSrc = currentVideoObj?.file_url || currentVideoObj?.public_url || "";

  const handleGenerate = async () => {
    if (!selectedVideo) return;
    setGenerating(true); setError("");
    try {
      const posData = POSITIONS.find(p => p.id === position);
      await api.captions.generate(selectedVideo, {
        platform, clip_id: selectedClip || undefined, burn_in: burnIn,
        style: { wordsPerLine, fontsize: fontSize, fontname: fontFamily, bold: bold ? 1 : 0, marginV: posData?.marginV ?? 80, alignment: position === "top" ? 8 : position === "center" ? 5 : 2 },
      });
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const list = await api.captions.list(selectedVideo);
        setCaptions(list || []);
        const done = list?.find((c: any) => c.platform === platform && (c.status === "done" || c.status === "failed"));
        if (done || attempts > 30) clearInterval(poll);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally { setGenerating(false); }
  };

  const currentCaption = captions.find(c => c.platform === platform && c.status === "done");
  const pendingCaption = captions.find(c => c.platform === platform && !["done", "failed"].includes(c.status));
  const previewVideoUrl = currentCaption?.captioned_video_url || "";

  return (
    <div style={{ padding: 40, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Subtitles size={24} color="#9B7EFF" />
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>Caption Studio</h1>
      </div>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, fontWeight: 300 }}>
        Auto-generate animated captions with full style control. Preview live before burning into video.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
        {/* LEFT COLUMN — Controls */}
        <div>
          {/* Video selector */}
          <div style={sectionBox}>
            <label style={labelStyle}>Select Video</label>
            <select value={selectedVideo} onChange={e => setSelected(e.target.value)} style={inputStyle}>
              <option value="">— Pick a video —</option>
              {videos.map(v => <option key={v.id} value={v.id}>{v.title} ({v.duration_seconds ? `${Math.round(v.duration_seconds)}s` : "?"})</option>)}
            </select>
            {clips.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Or caption a specific clip</label>
                <select value={selectedClip} onChange={e => setClip(e.target.value)} style={inputStyle}>
                  <option value="">— Full video —</option>
                  {clips.map(c => <option key={c.id} value={c.id}>{c.title} ({c.duration_seconds ? `${Math.round(c.duration_seconds)}s` : "?"})</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Platform tabs */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Caption Style Preset</label>
            <div style={{ display: "flex", gap: 10 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setPlatform(p.id)} style={{
                  flex: 1, padding: "12px 10px", textAlign: "left",
                  background: platform === p.id ? "rgba(155,126,255,0.1)" : "#111118",
                  border: `1px solid ${platform === p.id ? "#9B7EFF" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12, cursor: "pointer", transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: platform === p.id ? "#9B7EFF" : "rgba(255,255,255,0.6)", marginBottom: 2 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.3 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style Editor Section */}
          <div style={sectionBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Palette size={15} color="#9B7EFF" />
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white" }}>Style Editor</span>
            </div>

            {/* Font Family */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Type size={12} color="rgba(255,255,255,0.35)" />
                <label style={{ ...labelStyle, margin: 0 }}>Font</label>
              </div>
              <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} style={inputStyle}>
                {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>

            {/* Font Size + Words per line */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Font Size</label>
                  <span style={{ fontSize: 12, color: "#9B7EFF", fontWeight: 600 }}>{fontSize}px</span>
                </div>
                <input type="range" min={12} max={42} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#7C5CFC" }} />
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 6 }}>Words/Line</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => setWPL(n)} style={{
                      width: 32, height: 32, borderRadius: 6,
                      border: `1px solid ${wordsPerLine === n ? "#9B7EFF" : "rgba(255,255,255,0.08)"}`,
                      background: wordsPerLine === n ? "rgba(155,126,255,0.15)" : "transparent",
                      color: wordsPerLine === n ? "#9B7EFF" : "rgba(255,255,255,0.4)",
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Font Color */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Text Color</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => setFontColor(c.value)} title={c.label} style={{
                    width: 28, height: 28, borderRadius: 6, border: `2px solid ${fontColor === c.value ? "#9B7EFF" : "rgba(255,255,255,0.1)"}`,
                    background: c.value, cursor: "pointer", transition: "border 0.15s",
                  }} />
                ))}
              </div>
            </div>

            {/* Outline Color */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Outline Color</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {OUTLINE_COLORS.map(c => (
                  <button key={c.value} onClick={() => setOutline(c.value)} title={c.label} style={{
                    width: 28, height: 28, borderRadius: 6, border: `2px solid ${outlineColor === c.value ? "#9B7EFF" : "rgba(255,255,255,0.1)"}`,
                    background: c.value === "transparent" ? "repeating-conic-gradient(#333 0% 25%, #666 0% 50%) 50% / 10px 10px" : c.value,
                    cursor: "pointer",
                  }} />
                ))}
              </div>
            </div>

            {/* Position */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Move size={12} color="rgba(255,255,255,0.35)" />
                <label style={{ ...labelStyle, margin: 0 }}>Caption Position</label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {POSITIONS.map(p => (
                  <button key={p.id} onClick={() => setPosition(p.id as any)} style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: position === p.id ? "rgba(155,126,255,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${position === p.id ? "#9B7EFF" : "rgba(255,255,255,0.08)"}`,
                    color: position === p.id ? "#9B7EFF" : "rgba(255,255,255,0.4)",
                  }}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* Bold + Burn-in toggles */}
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setBold(!bold)} style={{
                  width: 36, height: 20, borderRadius: 100, border: "none", cursor: "pointer",
                  background: bold ? "#7C5CFC" : "rgba(255,255,255,0.1)", position: "relative",
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: bold ? 19 : 3, transition: "left 0.2s" }} />
                </button>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Bold</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setBurnIn(!burnIn)} style={{
                  width: 36, height: 20, borderRadius: 100, border: "none", cursor: "pointer",
                  background: burnIn ? "#7C5CFC" : "rgba(255,255,255,0.1)", position: "relative",
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: burnIn ? 19 : 3, transition: "left 0.2s" }} />
                </button>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Burn into video</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>
              {error}
            </div>
          )}

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={!selectedVideo || generating}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 28px",
              background: generating ? "rgba(124,92,252,0.5)" : "linear-gradient(135deg, #7C5CFC, #9B7EFF)",
              color: "white", border: "none", borderRadius: 100, fontSize: 14,
              cursor: (!selectedVideo || generating) ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans',sans-serif", fontWeight: 600, marginBottom: 16,
              boxShadow: generating ? "none" : "0 4px 20px rgba(124,92,252,0.3)",
            }}>
            {generating
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
              : <><Sparkles size={15} /> Generate Captions</>}
          </button>

          {pendingCaption && (
            <div style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <Loader2 size={16} color="#9B7EFF" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#9B7EFF" }}>
                {STATUS_LABELS[pendingCaption.status] || "Processing… 1–3 min."}
              </span>
              <button onClick={() => api.captions.list(selectedVideo).then(setCaptions)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
                <RefreshCw size={14} />
              </button>
            </div>
          )}

          {/* Download links */}
          {currentCaption && (
            <div style={{ ...sectionBox, border: "1px solid rgba(31,207,160,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <CheckCircle size={16} color="#1FCFA0" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1FCFA0" }}>Captions Ready</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{currentCaption.word_count} words</span>
              </div>
              {currentCaption.transcript_text && (
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 12, maxHeight: 60, overflow: "hidden" }}>
                  {currentCaption.transcript_text.slice(0, 200)}{currentCaption.transcript_text.length > 200 ? "…" : ""}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {currentCaption.srt_url && (
                  <a href={currentCaption.srt_url} download style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", borderRadius: 100, fontSize: 13, textDecoration: "none" }}>
                    <Download size={13} /> Download .SRT
                  </a>
                )}
                <button onClick={handleGenerate} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: 100, fontSize: 13, cursor: "pointer" }}>
                  <RefreshCw size={13} /> Regenerate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Video Preview */}
        <div style={{ position: "sticky", top: 20 }}>
          <label style={labelStyle}>Live Preview</label>
          {videoSrc ? (
            <VideoPlayer
              src={previewVideoUrl || videoSrc}
              title={previewVideoUrl ? "✅ Captioned Video" : "Original Video"}
              processing={!!pendingCaption}
              captionOverlay={!previewVideoUrl && !pendingCaption ? {
                text: "Sample caption text",
                fontFamily, fontSize, color: fontColor,
                outlineColor, position, bold,
              } : undefined}
              maxHeight={600}
            />
          ) : (
            <div style={{ background: "#111118", borderRadius: 14, height: 400, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)" }}>Select a video to preview</span>
            </div>
          )}
          {previewVideoUrl && (
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(31,207,160,0.6)", textAlign: "center" }}>
              ✅ Showing captioned result. Change settings & regenerate to update.
            </div>
          )}
          {!previewVideoUrl && videoSrc && (
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(155,126,255,0.5)", textAlign: "center" }}>
              Caption style preview overlay. Generate to burn into video.
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
