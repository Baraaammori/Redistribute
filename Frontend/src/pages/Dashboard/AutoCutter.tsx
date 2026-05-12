import React, { useState, useEffect, useRef } from "react";
import { Scissors, CheckCircle, Loader2, ChevronRight, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const CLIP_PRESETS = [
  { label: "30s",    seconds: 30  },
  { label: "1 min",  seconds: 60  },
  { label: "2 min",  seconds: 120 },
  { label: "Custom", seconds: 0   },
];

const PLATFORM_LIST = [
  { id: "youtube",   label: "YouTube"   },
  { id: "tiktok",    label: "TikTok"    },
  { id: "instagram", label: "Instagram" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13,
  outline: "none", fontFamily: "'DM Sans',sans-serif", width: "100%", boxSizing: "border-box",
};

const sectionBox: React.CSSProperties = {
  background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16, padding: 20, marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8,
  fontWeight: 600, textTransform: "uppercase", letterSpacing: 1,
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AutoCutter() {
  const navigate = useNavigate();

  // config state
  const [videos, setVideos]       = useState<any[]>([]);
  const [accounts, setAccounts]   = useState<any[]>([]);
  const [selectedVideo, setSelected] = useState("");
  const [presetIdx, setPresetIdx] = useState(1);        // default: 1 min
  const [customSecs, setCustom]   = useState(60);
  const [platforms, setPlatforms] = useState<string[]>([]);

  // job state
  const [phase, setPhase]       = useState<"config" | "running" | "done">("config");
  const [jobId, setJobId]       = useState("");
  const [progress, setProgress] = useState<any>({});
  const [error, setError]       = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.upload.list().then(vs => {
      setVideos(vs || []);
      if (vs?.length) setSelected(vs[0].id);
    }).catch(() => {});

    api.accounts.list().then((accs: any[]) => {
      setAccounts(accs || []);
      const connected = (accs || []).map((a: any) => a.platform);
      if (connected.length) setPlatforms(connected);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────
  const selectedVideoObj  = videos.find(v => v.id === selectedVideo);
  const effectiveSecs     = CLIP_PRESETS[presetIdx].seconds || customSecs;
  const estimatedClips    = selectedVideoObj?.duration_seconds
    ? Math.ceil(selectedVideoObj.duration_seconds / effectiveSecs)
    : null;
  const connectedPlatforms = accounts.map((a: any) => a.platform);

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // ── Start job ────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!selectedVideo || !platforms.length) return;
    setError("");
    try {
      const { jobId: id } = await (api as any).autoCut.start({
        videoId:          selectedVideo,
        clipLengthSeconds: effectiveSecs,
        targetPlatforms:  platforms,
      });
      setJobId(id);
      setPhase("running");

      pollRef.current = setInterval(async () => {
        try {
          const status = await (api as any).autoCut.status(id);
          if (status.progress) setProgress(status.progress);
          if (status.state === "completed" || status.progress?.phase === "done") {
            clearInterval(pollRef.current!);
            setPhase("done");
          } else if (status.state === "failed") {
            clearInterval(pollRef.current!);
            setError(status.progress?.error || "Job failed — check logs for details.");
            setPhase("config");
          } else if (status.state === "waiting") {
            setProgress((p: any) => ({ ...p, _state: "waiting" }));
          }
        } catch (err: any) {
          setError("Lost connection to server — retrying...");
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to start auto-cut");
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase("config");
    setJobId("");
    setProgress({});
    setError("");
  };

  // ── Progress / Done view ─────────────────────────────────────────────────────
  if (phase === "running" || phase === "done") {
    const { current = 0, total = 0, clips = [] } = progress;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
      <div style={{ padding: 40, maxWidth: 800 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Scissors size={24} color="#9B7EFF" />
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>
            Auto-Cutter
          </h1>
        </div>

        {/* Progress bar */}
        {phase === "running" ? (
          <div style={{ ...sectionBox, borderColor: "rgba(124,92,252,0.25)", marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Loader2 size={16} color="#9B7EFF" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#9B7EFF" }}>
                {progress._state === "waiting"
                  ? "In queue, waiting to start…"
                  : progress.phase === "cutting" && total > 0
                    ? `Cutting clip ${current} of ${total}…`
                    : progress.phase === "done"
                      ? "Finalising…"
                      : "Preparing…"}
              </span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 100, height: 6, marginBottom: 6 }}>
              <div style={{
                width: `${pct}%`, height: "100%",
                background: "linear-gradient(90deg, #7C5CFC, #9B7EFF)",
                borderRadius: 100, transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "right" }}>{pct}%</div>
          </div>
        ) : (
          <div style={{ ...sectionBox, borderColor: "rgba(31,207,160,0.25)", marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <CheckCircle size={16} color="#1FCFA0" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1FCFA0" }}>
                {clips.length} clip{clips.length !== 1 ? "s" : ""} created and added to your queue
              </span>
            </div>
            <button
              onClick={() => navigate("/dashboard/queue")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "none", border: "1px solid rgba(31,207,160,0.3)",
                color: "#1FCFA0", borderRadius: 8, padding: "6px 14px",
                fontSize: 12, cursor: "pointer",
              }}
            >
              View Queue <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* Clip cards */}
        {clips.length > 0 && (
          <div style={sectionBox}>
            <label style={labelStyle}>Clips{phase === "running" ? " (so far)" : ""}</label>
            {clips.map((clip: any, i: number) => (
              <div key={clip.clipId || i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "10px 12px", borderRadius: 10, marginBottom: 6,
                background: "rgba(31,207,160,0.04)", border: "1px solid rgba(31,207,160,0.12)",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: "rgba(155,126,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Play size={12} color="#9B7EFF" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{clip.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    {fmtDuration(clip.duration)}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: "#1FCFA0",
                  background: "rgba(31,207,160,0.10)", padding: "3px 10px", borderRadius: 100,
                }}>
                  Queued
                </span>
              </div>
            ))}
          </div>
        )}

        {phase === "done" && (
          <button onClick={reset} style={{
            padding: "10px 22px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.6)", borderRadius: 100, fontSize: 13, cursor: "pointer",
          }}>
            Cut Another Video
          </button>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Config view ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Scissors size={24} color="#9B7EFF" />
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>
          Auto-Cutter
        </h1>
      </div>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, fontWeight: 300 }}>
        Split a long video into equal clips and distribute each one automatically — no re-encoding, near-zero RAM.
      </p>

      {/* Step 1 — Pick a video */}
      <div style={sectionBox}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white", marginBottom: 12 }}>
          Step 1 — Select Video
        </div>
        <select value={selectedVideo} onChange={e => setSelected(e.target.value)} style={inputStyle}>
          <option value="">— Pick a video —</option>
          {videos.map(v => (
            <option key={v.id} value={v.id}>
              {v.title} ({v.duration_seconds ? `${Math.round(v.duration_seconds)}s` : "?"})
            </option>
          ))}
        </select>
        {selectedVideoObj && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
            {selectedVideoObj.duration_seconds
              ? `Duration: ${fmtDuration(Math.round(selectedVideoObj.duration_seconds))}`
              : ""}
            {selectedVideoObj.orientation ? ` · ${selectedVideoObj.orientation}` : ""}
          </div>
        )}
        {videos.length === 0 && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
            No videos yet — upload one in Upload Center first.
          </div>
        )}
      </div>

      {/* Step 2 — Clip length */}
      <div style={sectionBox}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white", marginBottom: 12 }}>
          Step 2 — Clip Length
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {CLIP_PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => setPresetIdx(i)} style={{
              flex: 1, padding: "12px 8px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: presetIdx === i ? "rgba(155,126,255,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${presetIdx === i ? "#9B7EFF" : "rgba(255,255,255,0.08)"}`,
              color: presetIdx === i ? "#9B7EFF" : "rgba(255,255,255,0.5)",
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {presetIdx === 3 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <input
              type="number" min={15} max={600} value={customSecs}
              onChange={e => setCustom(Math.max(15, Math.min(600, Number(e.target.value))))}
              style={{ ...inputStyle, width: 100 }}
            />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>seconds (15 – 600)</span>
          </div>
        )}

        {estimatedClips !== null && (
          <div style={{ fontSize: 12, color: "rgba(155,126,255,0.7)", marginTop: 4 }}>
            ≈ {estimatedClips} clip{estimatedClips !== 1 ? "s" : ""} will be created
          </div>
        )}
      </div>

      {/* Step 3 — Destinations */}
      <div style={sectionBox}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white", marginBottom: 12 }}>
          Step 3 — Distribute To
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PLATFORM_LIST.map(p => {
            const connected = connectedPlatforms.includes(p.id);
            const selected  = platforms.includes(p.id);
            return (
              <div
                key={p.id}
                onClick={() => connected && togglePlatform(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 16px", borderRadius: 12,
                  cursor: connected ? "pointer" : "default",
                  background: selected && connected ? "rgba(155,126,255,0.07)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selected && connected ? "rgba(155,126,255,0.25)" : "rgba(255,255,255,0.07)"}`,
                  opacity: connected ? 1 : 0.4,
                  transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${selected && connected ? "#9B7EFF" : "rgba(255,255,255,0.2)"}`,
                  background: selected && connected ? "#9B7EFF" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selected && connected && (
                    <span style={{ color: "white", fontSize: 10, fontWeight: 800 }}>✓</span>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)", flex: 1 }}>
                  {p.label}
                </span>
                {!connected && (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Not connected</span>
                )}
              </div>
            );
          })}
        </div>
        {platforms.length === 0 && (
          <div style={{ fontSize: 12, color: "#EF4444", marginTop: 8 }}>
            Select at least one platform
          </div>
        )}
      </div>

      {/* Step 4 — Confirm */}
      <div style={sectionBox}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white", marginBottom: 10 }}>
          Step 4 — Confirm &amp; Start
        </div>

        {selectedVideoObj && platforms.length > 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14, lineHeight: 1.7 }}>
            Cutting <strong style={{ color: "white" }}>{selectedVideoObj.title}</strong> into{" "}
            <strong style={{ color: "#9B7EFF" }}>
              {estimatedClips ?? "?"} clip{estimatedClips !== 1 ? "s" : ""}
            </strong>{" "}
            of <strong style={{ color: "#9B7EFF" }}>{fmtDuration(effectiveSecs)}</strong> each.
            {" "}Each clip will be distributed to:{" "}
            <strong style={{ color: "white" }}>{platforms.join(", ")}</strong>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 14,
            fontSize: 13, color: "#EF4444",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!selectedVideo || platforms.length === 0}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 100,
            fontSize: 14, fontWeight: 700,
            background: (!selectedVideo || platforms.length === 0)
              ? "rgba(124,92,252,0.35)"
              : "linear-gradient(135deg, #7C5CFC, #9B7EFF)",
            color: "white", border: "none",
            cursor: (!selectedVideo || platforms.length === 0) ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans',sans-serif",
            boxShadow: (!selectedVideo || platforms.length === 0)
              ? "none"
              : "0 4px 20px rgba(124,92,252,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <Scissors size={15} /> Start Auto-Cut
        </button>
      </div>
    </div>
  );
}
