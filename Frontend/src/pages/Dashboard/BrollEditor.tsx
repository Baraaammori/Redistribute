import React, { useState, useEffect } from "react";
import { Film, Search, Zap, CheckCircle, Loader2, AlertCircle, X, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import VideoPlayer from "../../components/VideoPlayer";

const inputStyle: React.CSSProperties = {
  background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13,
  outline: "none", fontFamily: "'DM Sans',sans-serif", width: "100%", boxSizing: "border-box",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function BrollEditor() {
  const [videos, setVideos]       = useState<any[]>([]);
  const [selectedId, setSelected] = useState("");
  const [selectedVideo, setVideo] = useState<any>(null);
  const [segments, setSegments]   = useState<any[]>([]);
  const [keywords, setKeywords]   = useState<string[]>([]);
  const [kwInput, setKwInput]     = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying]   = useState(false);
  const [selectedSegs, setSelSegs]= useState<Set<string>>(new Set());
  const [status, setStatus]       = useState<"idle"|"done"|"no_gaps"|"error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");
  const [resultClip, setResult]   = useState<any>(null);

  useEffect(() => {
    api.upload.list().then(vs => {
      setVideos(vs || []);
      if (vs?.length) setSelected(vs[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const v = videos.find(v => v.id === selectedId);
    setVideo(v || null);
    setSegments([]);
    setSelSegs(new Set());
    setStatus("idle");
    setResult(null);
    // Load existing segments if already detected
    api.broll.segments(selectedId).then(segs => {
      if (segs?.length) {
        setSegments(segs);
        setSelSegs(new Set(segs.map((s: any) => s.id)));
        setStatus("done");
      }
    }).catch(() => {});
  }, [selectedId, videos]);

  const handleAnalyze = async () => {
    if (!selectedId) return;
    setAnalyzing(true);
    setErrorMsg("");
    setStatus("idle");
    try {
      const result = await api.broll.analyze(selectedId);
      if (!result.segments?.length) {
        setStatus("no_gaps");
      } else {
        setSegments(result.segments);
        setSelSegs(new Set(result.segments.map((s: any) => s.id || String(s.segment_index))));
        setStatus("done");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Analysis failed");
      setStatus("error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!selectedId || !selectedSegs.size) return;
    setApplying(true);
    setErrorMsg("");
    try {
      await api.broll.apply(selectedId, {
        keywords,
        segment_ids: segments.filter(s => selectedSegs.has(s.id || String(s.segment_index))).map(s => s.id),
      });
      // Poll for new clip
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const clips = await api.upload.clips(selectedId);
        const brollClip = clips?.find((c: any) => c.title?.includes("B-Roll"));
        if (brollClip) {
          setResult(brollClip);
          clearInterval(poll);
        }
        if (attempts > 40) clearInterval(poll);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "B-Roll application failed");
    } finally {
      setApplying(false);
    }
  };

  const addKeyword = () => {
    const kw = kwInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
    setKwInput("");
  };

  return (
    <div style={{ padding: 40, maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Film size={24} color="#1FCFA0" />
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>
          B-Roll Auto-Fill
        </h1>
      </div>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, fontWeight: 300 }}>
        Automatically detect silent gaps in your video and fill them with relevant Pexels B-roll footage.
      </p>

      {/* Video picker */}
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Select Video
        </label>
        <select value={selectedId} onChange={e => setSelected(e.target.value)} style={inputStyle}>
          <option value="">— Pick a video —</option>
          {videos.map(v => (
            <option key={v.id} value={v.id}>
              {v.title} ({v.duration_seconds ? `${Math.round(v.duration_seconds)}s` : "?"})
            </option>
          ))}
        </select>

        {selectedVideo && (
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            {selectedVideo.thumbnail_url && (
              <img src={selectedVideo.thumbnail_url} alt="" style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 6 }} />
            )}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              {selectedVideo.orientation} · {selectedVideo.aspect_ratio} · {selectedVideo.duration_seconds ? `${Math.round(selectedVideo.duration_seconds)}s` : ""} · {selectedVideo.width}×{selectedVideo.height}
            </div>
          </div>
        )}
      </div>

      {/* Source Video Preview */}
      {selectedVideo?.file_url && (
        <div style={{ ...({ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16 }) }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Source Video</label>
          <VideoPlayer src={selectedVideo.file_url} title={selectedVideo.title} maxHeight={350} />
        </div>
      )}

      {/* Step 1 — Detect gaps */}
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white", marginBottom: 8 }}>
          Step 1 — Detect Silent Gaps
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
          FFmpeg scans your video for silence longer than 1.5 seconds where B-roll can be inserted.
        </div>
        <button onClick={handleAnalyze} disabled={!selectedId || analyzing}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px",
            background: analyzing ? "rgba(31,207,160,0.3)" : "rgba(31,207,160,0.15)",
            border: "1px solid rgba(31,207,160,0.3)", color: "#1FCFA0",
            borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: (!selectedId || analyzing) ? "not-allowed" : "pointer",
          }}>
          {analyzing
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning…</>
            : <><Zap size={14} /> Detect Gaps</>}
        </button>
      </div>

      {/* Gap results */}
      {status === "no_gaps" && (
        <div style={{ background: "rgba(240,201,74,0.08)", border: "1px solid rgba(240,201,74,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10 }}>
          <AlertCircle size={16} color="#F0C94A" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#F0C94A" }}>
            No significant gaps found. Your video has continuous speech — no B-roll needed.
          </span>
        </div>
      )}

      {status === "done" && segments.length > 0 && (
        <div style={{ background: "#111118", border: "1px solid rgba(31,207,160,0.15)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={15} color="#1FCFA0" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "white" }}>
                Found {segments.length} gap{segments.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSelSegs(new Set(segments.map(s => s.id || String(s.segment_index))))}
                style={{ padding: "4px 10px", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>
                All
              </button>
              <button onClick={() => setSelSegs(new Set())}
                style={{ padding: "4px 10px", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>
                None
              </button>
            </div>
          </div>

          {segments.map((seg: any, i: number) => {
            const segKey = seg.id || String(seg.segment_index ?? i);
            const checked = selectedSegs.has(segKey);
            return (
              <div key={segKey} onClick={() => setSelSegs(prev => {
                const next = new Set(prev);
                if (next.has(segKey)) next.delete(segKey); else next.add(segKey);
                return next;
              })} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "10px 12px",
                borderRadius: 10, marginBottom: 6, cursor: "pointer",
                background: checked ? "rgba(31,207,160,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${checked ? "rgba(31,207,160,0.2)" : "rgba(255,255,255,0.05)"}`,
                transition: "all 0.15s",
              }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "#1FCFA0" : "rgba(255,255,255,0.2)"}`, background: checked ? "#1FCFA0" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {checked && <span style={{ color: "#0A0A0F", fontSize: 10, fontWeight: 800 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: checked ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)" }}>
                    Gap at {formatTime(seg.start_time)} → {formatTime(seg.end_time)}
                  </span>
                  {seg.pexels_attribution && (
                    <span style={{ fontSize: 10, color: "#1FCFA0", marginLeft: 10 }}>✓ B-roll applied</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                  {seg.duration?.toFixed(1)}s
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Step 2 — Keywords + Apply */}
      {status === "done" && segments.length > 0 && (
        <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white", marginBottom: 8 }}>
            Step 2 — Choose B-Roll Style
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
            Add keywords to guide Pexels search. Leave blank to use your video title automatically.
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={kwInput}
              onChange={e => setKwInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
              placeholder="e.g. nature, city, technology…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addKeyword}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}>
              <Search size={13} /> Add
            </button>
          </div>

          {keywords.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {keywords.map(kw => (
                <span key={kw} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(155,126,255,0.15)", color: "#9B7EFF", padding: "4px 12px", borderRadius: 100, fontSize: 12 }}>
                  {kw}
                  <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                    style={{ background: "none", border: "none", color: "#9B7EFF", cursor: "pointer", padding: 0, display: "flex" }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>
            B-roll sourced from Pexels (free, royalty-free). Attribution added to video description automatically.
          </div>

          <button onClick={handleApply} disabled={applying || !selectedSegs.size}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 26px",
              background: applying ? "rgba(124,92,252,0.5)" : "#7C5CFC",
              color: "white", border: "none", borderRadius: 100, fontSize: 14, fontWeight: 600,
              cursor: (applying || !selectedSegs.size) ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans',sans-serif",
            }}>
            {applying
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Filling {selectedSegs.size} gap{selectedSegs.size !== 1 ? "s" : ""}…</>
              : <><Film size={15} /> Fill {selectedSegs.size} gap{selectedSegs.size !== 1 ? "s" : ""} with B-Roll</>}
          </button>
          {applying && (
            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Downloading Pexels clips + splicing… takes 1–5 minutes. You'll see the result clip in Library when done.
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status === "error" && errorMsg && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>
          {errorMsg}
        </div>
      )}

      {/* Result */}
      {resultClip && (
        <div style={{ background: "#111118", border: "1px solid rgba(31,207,160,0.2)", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <CheckCircle size={16} color="#1FCFA0" />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "#1FCFA0" }}>
              B-Roll Applied Successfully
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
            {resultClip.ai_reason}
          </div>
          {/* B-Roll Result Video Player */}
          {(resultClip.file_url || resultClip.public_url) && (
            <div style={{ marginBottom: 14 }}>
              <VideoPlayer src={resultClip.file_url || resultClip.public_url} title="With B-Roll" maxHeight={400} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleAnalyze}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", borderRadius: 100, fontSize: 13, cursor: "pointer" }}>
              <RefreshCw size={13} /> Redo
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
