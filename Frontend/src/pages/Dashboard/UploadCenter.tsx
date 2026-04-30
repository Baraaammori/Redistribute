import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Film, Sparkles, Settings2, Sliders, ArrowRight, Loader2, CheckCircle, X } from "lucide-react";
import { api } from "../../lib/api";

// ── Mode descriptions ─────────────────────────────────────────────────────────
const modes = [
  {
    id: "auto",
    icon: <Sparkles size={20} />,
    label: "Smart Auto",
    desc: "AI decides the best distribution",
    color: "#9B7EFF",
  },
  {
    id: "manual",
    icon: <Settings2 size={20} />,
    label: "Manual",
    desc: "Choose platforms yourself",
    color: "#1FCFA0",
  },
  {
    id: "custom",
    icon: <Sliders size={20} />,
    label: "Custom Clips",
    desc: "Set clip count, duration, platforms",
    color: "#F0C94A",
  },
];

export default function UploadCenter() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [mode, setMode] = useState("auto");
  const [dragOver, setDragOver] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideo, setUploadedVideo] = useState<any>(null);
  const [error, setError] = useState("");

  // Manual mode config
  const [manualPlatforms, setManualPlatforms] = useState<Record<string, string>>({});

  // Custom mode config
  const [customClipCount, setCustomClipCount] = useState(3);
  const [customClipDuration, setCustomClipDuration] = useState(45);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setError("File too large. Maximum size is 500MB");
      return;
    }
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ""));
    setError("");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError("Please select a file and enter a title");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(10);

    try {
      // Simulate progress since fetch doesn't support progress natively
      const progressTimer = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 85));
      }, 500);

      const result = await api.upload.create(file, {
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.trim() || undefined,
        mode,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadedVideo(result);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // ── Process & Distribute ──────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!uploadedVideo) return;
    setUploading(true);
    setError("");

    try {
      const config: any = { mode };

      if (mode === "manual") {
        config.platforms = manualPlatforms;
      } else if (mode === "custom") {
        config.clip_count = customClipCount;
        config.clip_duration = customClipDuration;
        config.platforms = { tiktok: "generate_clips", youtube: "full_upload" };
      }

      // Process (generate clips if needed)
      if (uploadedVideo.smart_decision?.generate_clips || mode === "custom") {
        await api.upload.process(uploadedVideo.id, config);
      }

      // Distribute
      const distConfig: any = {};
      if (mode === "manual") {
        distConfig.actions = manualPlatforms;
      }
      await api.upload.distribute(uploadedVideo.id, distConfig);

      navigate("/dashboard/queue");
    } catch (err: any) {
      setError(err.message || "Processing failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Success View ──────────────────────────────────────────────────────────
  if (uploadedVideo) {
    const decision = uploadedVideo.smart_decision;

    return (
      <div style={{ padding: 40, maxWidth: 700 }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1, marginBottom: 8 }}>
          Upload Complete ✓
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 28, fontWeight: 300 }}>
          Your video has been uploaded and analyzed. Review the smart decision below.
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

        {/* Manual Mode Options */}
        {mode === "manual" && (
          <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14, fontWeight: 300 }}>Select platforms and actions:</div>
            {[
              { key: "youtube", label: "YouTube", icon: "▶️", options: ["full_upload"] },
              { key: "tiktok", label: "TikTok", icon: "🎵", options: ["full_upload", "generate_clips"] },
              { key: "youtube_shorts", label: "YouTube Shorts", icon: "📱", options: ["full_upload"] },
            ].map(p => (
              <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{p.label}</span>
                <select
                  value={manualPlatforms[p.key] || ""}
                  onChange={e => setManualPlatforms(prev => {
                    const next = { ...prev };
                    if (e.target.value) next[p.key] = e.target.value;
                    else delete next[p.key];
                    return next;
                  })}
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 12 }}
                >
                  <option value="">— Skip —</option>
                  {p.options.map(o => <option key={o} value={o}>{o === "full_upload" ? "Full Upload" : "Generate Clips"}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Custom Mode Options */}
        {mode === "custom" && (
          <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14, fontWeight: 300 }}>Customize clip generation:</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
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

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setUploadedVideo(null); setFile(null); setUploadProgress(0); }}
            style={{ padding: "10px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>
            ← New Upload
          </button>
          <button onClick={handleProcess} disabled={uploading}
            style={{ padding: "10px 28px", background: "#7C5CFC", color: "white", border: "none", borderRadius: 100, fontSize: 14, cursor: uploading ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, opacity: uploading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8 }}>
            {uploading ? <><Loader2 size={14} className="spin" /> Processing…</> : <>Process & Distribute <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    );
  }

  // ── Upload Form View ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1, marginBottom: 8 }}>
        Upload Center
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 300, marginBottom: 32 }}>
        Upload once. We optimize for every platform automatically.
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
        <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        {file ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Film size={28} color="#1FCFA0" />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setTitle(""); }} style={{ background: "rgba(239,68,68,0.15)", border: "none", borderRadius: 100, padding: 6, cursor: "pointer", color: "#EF4444", display: "flex" }}>
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
              or click to browse · MP4, MOV, WebM, MKV · Max 500MB
            </div>
          </>
        )}
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Uploading & analyzing…</span>
            <span style={{ fontSize: 12, color: "#9B7EFF", fontWeight: 600 }}>{uploadProgress}%</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #7C5CFC, #1FCFA0)", borderRadius: 100, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* Title & Description */}
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

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>
          {error}
        </div>
      )}

      {/* Upload Button */}
      {file && (
        <button onClick={handleUpload} disabled={uploading || !title.trim()}
          style={{
            padding: "12px 32px", background: uploading ? "rgba(124,92,252,0.5)" : "#7C5CFC",
            color: "white", border: "none", borderRadius: 100, fontSize: 15,
            cursor: uploading || !title.trim() ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 10,
            transition: "all 0.15s",
          }}>
          {uploading ? (
            <><Loader2 size={16} /> Uploading…</>
          ) : (
            <><Upload size={16} /> Upload & Analyze</>
          )}
        </button>
      )}
    </div>
  );
}
