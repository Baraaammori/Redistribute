import React, { useState, useEffect } from "react";
import { Subtitles, Sparkles, Download, CheckCircle, Loader2, RefreshCw, Play } from "lucide-react";
import { api } from "../../lib/api";

const PLATFORMS = [
  { id: "tiktok",         label: "TikTok",          color: "#E0E0E0", icon: "🎵", desc: "Large bold text · 2 words/line · Karaoke style" },
  { id: "instagram",      label: "Instagram Reels",  color: "#FF7A3D", icon: "📸", desc: "Medium text · 4 words/line · Bottom third" },
  { id: "youtube",        label: "YouTube Shorts",   color: "#FF4444", icon: "▶️", desc: "Standard subtitles · 6 words/line" },
];

const inputStyle: React.CSSProperties = {
  background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, width: "100%",
  outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
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

  const handleGenerate = async () => {
    if (!selectedVideo) return;
    setGenerating(true);
    setError("");
    try {
      await api.captions.generate(selectedVideo, {
        platform,
        clip_id: selectedClip || undefined,
        burn_in: burnIn,
        style: { wordsPerLine, fontsize: fontSize },
      });
      // Poll for completion (backend is async)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const list = await api.captions.list(selectedVideo);
        setCaptions(list || []);
        const done = list?.find((c: any) => c.platform === platform &&
          (c.status === "done" || c.status === "failed"));
        if (done || attempts > 30) clearInterval(poll);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const activePlatformData = PLATFORMS.find(p => p.id === platform)!;
  const currentCaption = captions.find(c => c.platform === platform && c.status === "done");
  const pendingCaption = captions.find(c => c.platform === platform &&
    !["done", "failed"].includes(c.status));

  return (
    <div style={{ padding: 40, maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Subtitles size={24} color="#9B7EFF" />
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>
          Caption Studio
        </h1>
      </div>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, fontWeight: 300 }}>
        Auto-generate animated captions burned into your video. Increases watch time by up to 40%.
      </p>

      {/* Video selector */}
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Select Video
        </label>
        <select value={selectedVideo} onChange={e => setSelected(e.target.value)} style={inputStyle}>
          <option value="">— Pick a video —</option>
          {videos.map(v => (
            <option key={v.id} value={v.id}>
              {v.title} ({v.duration_seconds ? `${Math.round(v.duration_seconds)}s` : "?"})
            </option>
          ))}
        </select>

        {clips.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              Or caption a specific clip (optional)
            </label>
            <select value={selectedClip} onChange={e => setClip(e.target.value)} style={inputStyle}>
              <option value="">— Full video —</option>
              {clips.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.duration_seconds ? `${Math.round(c.duration_seconds)}s` : "?"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Platform tabs */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Caption Style Preset
        </label>
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

      {/* Style tweaks */}
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              Words per line
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setWPL(n)} style={{
                  width: 34, height: 34, borderRadius: 8, border: `1px solid ${wordsPerLine === n ? "#9B7EFF" : "rgba(255,255,255,0.08)"}`,
                  background: wordsPerLine === n ? "rgba(155,126,255,0.15)" : "transparent",
                  color: wordsPerLine === n ? "#9B7EFF" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Font size</label>
              <span style={{ fontSize: 12, color: "#9B7EFF", fontWeight: 600 }}>{fontSize}px</span>
            </div>
            <input type="range" min={12} max={36} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#7C5CFC" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              Burn into video
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setBurnIn(!burnIn)} style={{
                width: 40, height: 22, borderRadius: 100, border: "none", cursor: "pointer",
                background: burnIn ? "#7C5CFC" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s",
              }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: burnIn ? 21 : 3, transition: "left 0.2s" }} />
              </button>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {burnIn ? "Yes — bakes captions into video" : "No — SRT file only"}
              </span>
            </div>
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
          background: generating ? "rgba(124,92,252,0.5)" : "#7C5CFC",
          color: "white", border: "none", borderRadius: 100, fontSize: 14,
          cursor: (!selectedVideo || generating) ? "not-allowed" : "pointer",
          fontFamily: "'DM Sans',sans-serif", fontWeight: 600, marginBottom: 28,
        }}>
        {generating
          ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
          : <><Sparkles size={15} /> Generate Captions</>}
      </button>

      {/* Processing indicator */}
      {pendingCaption && (
        <div style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <Loader2 size={16} color="#9B7EFF" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#9B7EFF" }}>
            Transcribing audio with Whisper… this takes 1–3 minutes. The page will update automatically.
          </span>
          <button onClick={() => api.captions.list(selectedVideo).then(setCaptions)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      {/* Results */}
      {currentCaption && (
        <div style={{ background: "#111118", border: "1px solid rgba(31,207,160,0.2)", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <CheckCircle size={16} color="#1FCFA0" />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "#1FCFA0" }}>
              Captions Ready — {activePlatformData.label}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
              {currentCaption.word_count} words transcribed
            </span>
          </div>

          {/* Transcript preview */}
          {currentCaption.transcript_text && (
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 16, maxHeight: 80, overflow: "hidden" }}>
              {currentCaption.transcript_text.slice(0, 200)}
              {currentCaption.transcript_text.length > 200 ? "…" : ""}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {currentCaption.captioned_video_url && (
              <a href={currentCaption.captioned_video_url} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: "#7C5CFC", color: "white", borderRadius: 100, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                <Play size={13} /> Preview Captioned Video
              </a>
            )}
            {currentCaption.srt_url && (
              <a href={currentCaption.srt_url} download
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", borderRadius: 100, fontSize: 13, textDecoration: "none" }}>
                <Download size={13} /> Download .SRT
              </a>
            )}
            <button onClick={handleGenerate}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: 100, fontSize: 13, cursor: "pointer" }}>
              <RefreshCw size={13} /> Regenerate
            </button>
          </div>
        </div>
      )}

      {/* Previous captions for other platforms */}
      {captions.filter(c => c.status === "done" && c.platform !== platform).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
            Also generated for
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {captions.filter(c => c.status === "done" && c.platform !== platform).map(c => {
              const p = PLATFORMS.find(pl => pl.id === c.platform);
              return (
                <button key={c.id} onClick={() => setPlatform(c.platform)}
                  style={{ padding: "6px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>
                  {p?.icon} {p?.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
