import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, Film, Sparkles, Settings2, Sliders, ArrowRight,
  Loader2, X, Pause, Play, WifiOff,
} from "lucide-react";
import * as tus from "tus-js-client";
import { api } from "../../lib/api";

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL  || "";
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
  if (b >= 1048576)    return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024)       return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

function fmtSpeed(bps: number): string {
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
  if (bps >= 1024)    return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function fmtETA(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "";
  if (sec < 60) return `${Math.round(sec)}s remaining`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s remaining`;
}

function getVideoMeta(file: File): Promise<{
  duration: number; width: number; height: number;
  orientation: string; aspectRatio: string;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const w = vid.videoWidth, h = vid.videoHeight;
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
      const d = w && h ? gcd(w, h) : 1;
      resolve({
        duration: Math.round(vid.duration) || 0,
        width: w, height: h,
        orientation: w > h ? "landscape" : w < h ? "portrait" : "square",
        aspectRatio: d ? `${w / d}:${h / d}` : "16:9",
      });
    };
    vid.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: 0, width: 0, height: 0, orientation: "landscape", aspectRatio: "16:9" }); };
    vid.src = url;
  });
}

// ── Mode definitions ──────────────────────────────────────────────────────────
const modes = [
  { id: "auto",   icon: <Sparkles size={20} />,  label: "Smart Auto",    desc: "AI decides the best distribution",          color: "#9B7EFF" },
  { id: "manual", icon: <Settings2 size={20} />, label: "Manual",        desc: "Choose platforms yourself",                 color: "#1FCFA0" },
  { id: "custom", icon: <Sliders size={20} />,   label: "Custom Clips",  desc: "Set clip count, duration, platforms",       color: "#F0C94A" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function UploadCenter() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form
  const [file, setFile]               = useState<File | null>(null);
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags]               = useState("");
  const [mode, setMode]               = useState("auto");
  const [dragOver, setDragOver]       = useState(false);

  // Upload state machine: idle | uploading | saving | done
  const [phase, setPhase]             = useState<"idle"|"uploading"|"saving"|"done">("idle");
  const [uploadProgress, setProgress] = useState(0);
  const [uploadStats, setStats]       = useState({ speed: 0, eta: 0, chunk: 0, totalChunks: 0 });
  const [paused, setPaused]           = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<any>(null);
  const [error, setError]             = useState("");

  // Post-upload distribution config
  const [manualPlatforms, setManualPlatforms] = useState<Record<string, string>>({});
  const [customClipCount, setCustomClipCount] = useState(3);
  const [customClipDuration, setCustomClipDuration] = useState(45);

  // Refs (not state — avoid stale closures inside tus callbacks)
  const tusRef      = useRef<tus.Upload | null>(null);
  const progressRef = useRef({ time: Date.now(), bytes: 0, speed: 0 });
  const stuckTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (stuckTimer.current) clearTimeout(stuckTimer.current);
    tusRef.current?.abort().catch(() => {});
  }, []);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) { setError("Please select a video file"); return; }
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ""));
    setError("");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Pause / Resume ─────────────────────────────────────────────────────────
  const togglePause = async () => {
    if (!tusRef.current) return;
    if (paused) {
      setPaused(false);
      tusRef.current.start();
    } else {
      setPaused(true);
      await tusRef.current.abort();
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (tusRef.current) await tusRef.current.abort().catch(() => {});
    tusRef.current = null;
    setPhase("idle");
    setProgress(0);
    setPaused(false);
    setReconnecting(false);
    setError("");
  };

  // ── Main Upload ────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file || !title.trim()) { setError("Please select a file and enter a title"); return; }
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      setError("REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY must be set in your frontend .env");
      return;
    }

    setPhase("uploading");
    setError("");
    setProgress(0);
    setPaused(false);
    setReconnecting(false);

    try {
      // 1. Get video metadata from HTML5 (no server round-trip)
      const meta = await getVideoMeta(file);

      // 2. Reserve a storage path
      const { filePath } = await api.upload.init({ fileName: file.name, fileSize: file.size });

      // 3. TUS upload directly to Supabase (Render never touches the file bytes)
      const chunkSize   = 6 * 1024 * 1024;
      const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
      progressRef.current = { time: Date.now(), bytes: 0, speed: 0 };

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint:   `${SUPABASE_URL}/storage/v1/upload/resumable`,
          chunkSize,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON}`,
            "x-upsert": "true",
          },
          metadata: {
            bucketName:  "videos",
            objectName:  filePath,
            contentType: file.type || "video/mp4",
            cacheControl: "3600",
          },
          onProgress: (uploaded, total) => {
            const now     = Date.now();
            const elapsed = now - progressRef.current.time;
            let { speed } = progressRef.current;

            if (elapsed >= 500) {
              const delta = uploaded - progressRef.current.bytes;
              if (delta > 0) speed = Math.round((delta / elapsed) * 1000);
              progressRef.current = { time: now, bytes: uploaded, speed };
            }

            const pct   = Math.round((uploaded / total) * 100);
            const eta   = speed > 0 ? (total - uploaded) / speed : 0;
            const chunk = Math.min(Math.ceil(uploaded / chunkSize), totalChunks);

            setProgress(pct);
            setStats({ speed, eta, chunk, totalChunks });
            setReconnecting(false);

            // Flag "stuck" if no progress for 6 s (tus may be retrying silently)
            if (stuckTimer.current) clearTimeout(stuckTimer.current);
            stuckTimer.current = setTimeout(() => setReconnecting(true), 6000);
          },
          onSuccess:  () => { if (stuckTimer.current) clearTimeout(stuckTimer.current); resolve(); },
          onError:    (err) => {
            if (stuckTimer.current) clearTimeout(stuckTimer.current);
            const msg = err.message || String(err);
            if (msg.includes("401") || msg.includes("403")) {
              reject(new Error("Storage permission denied — check your Supabase storage policy (see setup notes)."));
            } else if (msg.includes("413")) {
              reject(new Error("File too large for your current plan."));
            } else {
              reject(new Error(`Upload failed: ${msg}`));
            }
          },
        });

        tusRef.current = upload;

        upload.findPreviousUploads().then((prev) => {
          if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]);
          upload.start();
        });
      });

      // 4. Register in DB
      setPhase("saving");
      const video = await api.upload.complete({
        filePath,
        fileName:    file.name,
        fileSize:    file.size,
        mimeType:    file.type,
        duration:    meta.duration,
        width:       meta.width,
        height:      meta.height,
        orientation: meta.orientation,
        aspectRatio: meta.aspectRatio,
        title:       title.trim(),
        description: description.trim() || undefined,
        tags:        tags.trim() || undefined,
        mode,
      });

      setProgress(100);
      setUploadedVideo(video);
      setPhase("done");
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setPhase("idle");
      setProgress(0);
    }
  };

  // ── Process & Distribute ───────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    if (!uploadedVideo) return;
    setProcessing(true); setError("");
    try {
      const config: any = { mode };
      if (mode === "manual") config.platforms = manualPlatforms;
      else if (mode === "custom") {
        config.clip_count = customClipCount;
        config.clip_duration = customClipDuration;
        config.platforms = { tiktok: "generate_clips", youtube: "full_upload" };
      }
      if (uploadedVideo.smart_decision?.generate_clips || mode === "custom") {
        await api.upload.process(uploadedVideo.id, config);
      }
      const distConfig: any = {};
      if (mode === "manual") distConfig.actions = manualPlatforms;
      await api.upload.distribute(uploadedVideo.id, distConfig);
      navigate("/dashboard/queue");
    } catch (err: any) {
      setError(err.message || "Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  // ── Success view ───────────────────────────────────────────────────────────
  if (phase === "done" && uploadedVideo) {
    const decision = uploadedVideo.smart_decision;
    return (
      <div style={{ padding: 40, maxWidth: 700 }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1, marginBottom: 8 }}>
          Upload Complete ✓
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 28, fontWeight: 300 }}>
          Your video is in Supabase Storage. Review the smart decision below.
        </p>

        {/* Video info */}
        <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {uploadedVideo.thumbnail_url && (
              <img src={uploadedVideo.thumbnail_url} alt="" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "white", marginBottom: 6 }}>{uploadedVideo.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                {uploadedVideo.duration_seconds && <span>⏱ {Math.round(uploadedVideo.duration_seconds)}s ({Math.round(uploadedVideo.duration_seconds / 60)} min)</span>}
                {uploadedVideo.orientation && <span>📐 {uploadedVideo.orientation}</span>}
                {uploadedVideo.aspect_ratio && <span>🖥 {uploadedVideo.aspect_ratio}</span>}
                {uploadedVideo.width && <span>📏 {uploadedVideo.width}×{uploadedVideo.height}</span>}
                {uploadedVideo.file_size && <span>💾 {fmtBytes(uploadedVideo.file_size)}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Smart Decision */}
        {decision && (
          <div style={{ background: "#111118", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} color="#9B7EFF" />
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "#9B7EFF" }}>Smart Decision</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 12, fontWeight: 300 }}>{decision.reason}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {decision.youtube && (
                <span style={{ background: "rgba(255,68,68,0.15)", color: "#FF4444", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                  ▶️ YouTube: {decision.youtube === "full_upload" ? "Full Upload" : "Clips"}
                </span>
              )}
              {decision.tiktok && (
                <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                  🎵 TikTok: {decision.tiktok === "full_upload" ? "Full Upload" : `${decision.clip_count} Clips`}
                </span>
              )}
              {decision.youtube_shorts && (
                <span style={{ background: "rgba(31,207,160,0.15)", color: "#1FCFA0", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                  📱 YouTube Shorts
                </span>
              )}
              {decision.ask_user && (
                <span style={{ background: "rgba(240,201,74,0.15)", color: "#F0C94A", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                  ✋ Your choice needed
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Distribution Mode</div>
          <div style={{ display: "flex", gap: 10 }}>
            {modes.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                flex: 1, padding: "14px 12px", background: mode === m.id ? `${m.color}15` : "#111118",
                border: `1px solid ${mode === m.id ? m.color : "rgba(255,255,255,0.07)"}`,
                borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, color: mode === m.id ? m.color : "rgba(255,255,255,0.6)" }}>
                  {m.icon}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 300 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Manual / Custom options */}
        {mode === "manual" && (
          <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14, fontWeight: 300 }}>Select platforms and actions:</div>
            {[
              { key: "youtube",        label: "YouTube",        icon: "▶️", options: ["full_upload"] },
              { key: "tiktok",         label: "TikTok",         icon: "🎵", options: ["full_upload", "generate_clips"] },
              { key: "youtube_shorts", label: "YouTube Shorts", icon: "📱", options: ["full_upload"] },
            ].map(p => (
              <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{p.label}</span>
                <select value={manualPlatforms[p.key] || ""} onChange={e => setManualPlatforms(prev => {
                    const next = { ...prev };
                    if (e.target.value) next[p.key] = e.target.value; else delete next[p.key];
                    return next;
                  })} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 12 }}>
                  <option value="">— Skip —</option>
                  {p.options.map(o => <option key={o} value={o}>{o === "full_upload" ? "Full Upload" : "Generate Clips"}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        {mode === "custom" && (
          <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14, fontWeight: 300 }}>Customize clip generation:</div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6 }}>Number of Clips</label>
                <input type="number" min={1} max={10} value={customClipCount} onChange={e => setCustomClipCount(Number(e.target.value))}
                  style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 14, outline: "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6 }}>Clip Duration (seconds)</label>
                <input type="number" min={15} max={60} step={5} value={customClipDuration} onChange={e => setCustomClipDuration(Number(e.target.value))}
                  style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 14, outline: "none" }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setUploadedVideo(null); setFile(null); setProgress(0); setPhase("idle"); }}
            style={{ padding: "10px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>
            ← New Upload
          </button>
          <button onClick={handleProcess} disabled={processing}
            style={{ padding: "10px 28px", background: "#7C5CFC", color: "white", border: "none", borderRadius: 100, fontSize: 14, cursor: processing ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, opacity: processing ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8 }}>
            {processing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Processing…</> : <>Process & Distribute <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    );
  }

  // ── Upload-in-progress view ────────────────────────────────────────────────
  if (phase === "uploading" || phase === "saving") {
    const { speed, eta, chunk, totalChunks } = uploadStats;
    return (
      <div style={{ padding: 40, maxWidth: 600 }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1, marginBottom: 8 }}>
          {phase === "saving" ? "Saving…" : paused ? "Upload Paused" : reconnecting ? "Reconnecting…" : "Uploading…"}
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 32, fontWeight: 300 }}>
          {file?.name} · {fmtBytes(file?.size || 0)}
        </p>

        {/* Progress bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${uploadProgress}%`,
              background: reconnecting
                ? "linear-gradient(90deg, #F0C94A, #F0943A)"
                : "linear-gradient(90deg, #7C5CFC, #1FCFA0)",
              borderRadius: 100,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "white", fontFamily: "'Syne',sans-serif" }}>
            {uploadProgress}%
          </span>
          <div style={{ textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.8 }}>
            {phase === "uploading" && speed > 0 && <div>{fmtSpeed(speed)}</div>}
            {phase === "uploading" && eta > 0  && <div>{fmtETA(eta)}</div>}
            {phase === "uploading" && totalChunks > 1 && (
              <div>Part {chunk} of {totalChunks}</div>
            )}
          </div>
        </div>

        {/* Reconnecting banner */}
        {reconnecting && phase === "uploading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(240,201,74,0.1)", border: "1px solid rgba(240,201,74,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#F0C94A" }}>
            <WifiOff size={15} />
            Connection interrupted — retrying automatically…
          </div>
        )}

        {/* Pause / Cancel */}
        {phase === "uploading" && (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={togglePause} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 100, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13,
            }}>
              {paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
            </button>
            <button onClick={handleCancel} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 100, color: "#EF4444", cursor: "pointer", fontSize: 13,
            }}>
              <X size={14} /> Cancel
            </button>
          </div>
        )}

        {phase === "saving" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
            Saving to library…
          </div>
        )}
      </div>
    );
  }

  // ── Upload form ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1, marginBottom: 8 }}>
        Upload Center
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 300, marginBottom: 32 }}>
        Upload once. Files go directly to cloud storage — no server bottleneck, no timeout.
      </p>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#7C5CFC" : file ? "#1FCFA0" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 20,
          padding: file ? "24px 28px" : "48px 28px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "rgba(124,92,252,0.05)" : file ? "rgba(31,207,160,0.03)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s",
          marginBottom: 20,
        }}
      >
        <input ref={fileInputRef} type="file" accept="video/*" hidden
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        {file ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Film size={28} color="#1FCFA0" />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{fmtBytes(file.size)}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setTitle(""); }}
              style={{ background: "rgba(239,68,68,0.15)", border: "none", borderRadius: 100, padding: 6, cursor: "pointer", color: "#EF4444", display: "flex" }}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={36} color={dragOver ? "#7C5CFC" : "rgba(255,255,255,0.15)"} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
              Drop your video here
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              or click to browse · MP4, MOV, WebM, MKV · Large files supported
            </div>
          </>
        )}
      </div>

      {/* Metadata fields */}
      {file && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title"
              style={{ width: "100%", background: "#111118", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={3}
              style={{ width: "100%", background: "#111118", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Tags</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Comma-separated tags"
              style={{ width: "100%", background: "#111118", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }} />
          </div>

          {/* Mode selector */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Distribution Mode</div>
            <div style={{ display: "flex", gap: 10 }}>
              {modes.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  flex: 1, padding: "14px 12px", background: mode === m.id ? `${m.color}15` : "#111118",
                  border: `1px solid ${mode === m.id ? m.color : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, color: mode === m.id ? m.color : "rgba(255,255,255,0.6)" }}>
                    {m.icon}
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 300, fontFamily: "'DM Sans',sans-serif" }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>
          {error}
        </div>
      )}

      {file && (
        <button onClick={handleUpload} disabled={!title.trim()}
          style={{
            padding: "12px 32px", background: "#7C5CFC", color: "white", border: "none", borderRadius: 100, fontSize: 15,
            cursor: !title.trim() ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s",
            opacity: !title.trim() ? 0.5 : 1,
          }}>
          <Upload size={16} /> Upload & Analyze
        </button>
      )}
    </div>
  );
}
