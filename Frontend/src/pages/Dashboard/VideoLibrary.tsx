import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Film, Clock, Trash2, Play, ExternalLink, Loader2, CheckCircle, XCircle, ArrowRight, Search } from "lucide-react";
import { api } from "../../lib/api";

// ── Status Pill ─────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    uploaded:     { bg: "rgba(124,92,252,0.15)", color: "#9B7EFF", label: "Uploaded" },
    analyzing:    { bg: "rgba(59,130,246,0.15)", color: "#60A5FA", label: "Analyzing" },
    analyzed:     { bg: "rgba(31,207,160,0.15)", color: "#1FCFA0", label: "Analyzed" },
    processing:   { bg: "rgba(240,201,74,0.15)", color: "#F0C94A", label: "Processing" },
    distributing: { bg: "rgba(59,130,246,0.15)", color: "#60A5FA", label: "Distributing" },
    done:         { bg: "rgba(31,207,160,0.15)", color: "#1FCFA0", label: "Done" },
    failed:       { bg: "rgba(239,68,68,0.15)", color: "#EF4444", label: "Failed" },
    generated:    { bg: "rgba(124,92,252,0.15)", color: "#9B7EFF", label: "Generated" },
    approved:     { bg: "rgba(31,207,160,0.15)", color: "#1FCFA0", label: "Approved" },
    queued:       { bg: "rgba(240,201,74,0.15)", color: "#F0C94A", label: "Queued" },
    uploading:    { bg: "rgba(59,130,246,0.15)", color: "#60A5FA", label: "Uploading" },
    success:      { bg: "rgba(31,207,160,0.15)", color: "#1FCFA0", label: "Success" },
  };
  const s = map[status] || { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", label: status };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 100, padding: "3px 12px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{s.label}</span>;
}

// ── Format duration ─────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Video Library ───────────────────────────────────────────────────────────
export default function VideoLibrary() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [reposting, setReposting] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.upload.list().then(setVideos).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const viewDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await api.upload.get(id);
      setSelectedVideo(detail);
    } catch {}
    finally { setDetailLoading(false); }
  };

  const deleteVideo = async (id: string) => {
    if (!window.confirm("Delete this video and all its clips?")) return;
    await api.upload.delete(id);
    setSelectedVideo(null);
    load();
  };

  const approveClip = async (clipId: string) => {
    await api.upload.approveClip(clipId);
    if (selectedVideo) viewDetail(selectedVideo.id);
  };

  const deleteClip = async (clipId: string) => {
    await api.upload.deleteClip(clipId);
    if (selectedVideo) viewDetail(selectedVideo.id);
  };

  // ── Detail View ─────────────────────────────────────────────────────────
  if (selectedVideo) {
    const v = selectedVideo;
    const decision = v.smart_decision;

    return (
      <div style={{ padding: 40 }}>
        <button onClick={() => setSelectedVideo(null)}
          style={{ padding: "6px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, marginBottom: 20, fontFamily: "'DM Sans',sans-serif" }}>
          ← Back to Library
        </button>

        {/* Video header */}
        <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
          {v.thumbnail_url && <img src={v.thumbnail_url} alt="" style={{ width: 200, height: 112, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} />}
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "white", letterSpacing: -0.5, marginBottom: 6 }}>{v.title}</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <StatusPill status={v.status} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>⏱ {formatDuration(v.duration_seconds)}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>📐 {v.orientation || "–"}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{v.aspect_ratio || ""}</span>
            </div>
            {decision && <div style={{ fontSize: 12, color: "rgba(155,126,255,0.7)", fontWeight: 300 }}>🧠 {decision.reason}</div>}
          </div>
        </div>

        {/* Clips */}
        {v.clips && v.clips.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "white", marginBottom: 14 }}>
              Generated Clips ({v.clips.length})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
              {v.clips.map((clip: any) => (
                <div key={clip.id} style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 400 }}>{clip.title || `Clip`}</span>
                    <StatusPill status={clip.status} />
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                    ⏱ {formatDuration(clip.start_time)} → {formatDuration(clip.end_time)} ({formatDuration(clip.duration_seconds)})
                  </div>
                  {clip.file_url && (
                    <video src={clip.file_url} controls preload="metadata"
                      style={{ width: "100%", borderRadius: 8, marginBottom: 10, maxHeight: 140, background: "#000" }} />
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    {clip.status === "generated" && (
                      <button onClick={() => approveClip(clip.id)}
                        style={{ flex: 1, padding: "6px 10px", background: "rgba(31,207,160,0.15)", border: "1px solid rgba(31,207,160,0.3)", borderRadius: 8, color: "#1FCFA0", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "'DM Sans',sans-serif" }}>
                        <CheckCircle size={11} /> Approve
                      </button>
                    )}
                    <button onClick={() => deleteClip(clip.id)}
                      style={{ padding: "6px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#EF4444", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4, fontFamily: "'DM Sans',sans-serif" }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distributions */}
        {v.distributions && v.distributions.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "white", marginBottom: 14 }}>
              Distribution Status
            </h3>
            {v.distributions.map((d: any) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>
                  {d.platform === "youtube" ? "▶️" : d.platform === "tiktok" ? "🎵" : d.platform === "youtube_shorts" ? "📱" : "📸"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{d.platform.replace("_", " ")}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{d.upload_type} upload</div>
                </div>
                <StatusPill status={d.status} />
                {d.platform_url && (
                  <a href={d.platform_url} target="_blank" rel="noreferrer" style={{ color: "#9B7EFF", display: "flex" }}>
                    <ExternalLink size={14} />
                  </a>
                )}
                {d.error && <div style={{ fontSize: 10, color: "#EF4444", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{d.error}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={async () => {
            setReposting("tiktok");
            try {
              await api.reposts.create({ sourceVideoId: v.id, sourceVideoUrl: v.file_url, sourcePlatform: "library", title: v.title, thumbnailUrl: v.thumbnail_url, destinations: ["tiktok"], scheduledFor: null });
              alert("✅ Queued for TikTok!"); navigate("/dashboard/queue");
            } catch(e:any) { alert(e.message); } finally { setReposting(""); }
          }} disabled={reposting==="tiktok"}
            style={{ padding: "10px 20px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, color: "white", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
            🎵 {reposting==="tiktok" ? "Queuing..." : "Repost to TikTok"}
          </button>
          <button onClick={async () => {
            setReposting("youtube");
            try {
              await api.reposts.create({ sourceVideoId: v.id, sourceVideoUrl: v.file_url, sourcePlatform: "library", title: v.title, thumbnailUrl: v.thumbnail_url, destinations: ["youtube"], scheduledFor: null });
              alert("✅ Queued for YouTube!"); navigate("/dashboard/queue");
            } catch(e:any) { alert(e.message); } finally { setReposting(""); }
          }} disabled={reposting==="youtube"}
            style={{ padding: "10px 20px", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 100, color: "#FF6666", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
            ▶️ {reposting==="youtube" ? "Queuing..." : "Repost to YouTube"}
          </button>
          <button onClick={() => deleteVideo(v.id)}
            style={{ padding: "10px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 100, color: "#EF4444", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans',sans-serif" }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    );
  }

  // ── Library List View ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1, marginBottom: 4 }}>Video Library</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 300 }}>All your uploaded videos and generated clips</p>
        </div>
        <Link to="/dashboard/upload"
          style={{ padding: "10px 22px", background: "#7C5CFC", color: "white", border: "none", borderRadius: 100, fontSize: 14, textDecoration: "none", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          + Upload New
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.25)" }}>Loading…</div>
      ) : videos.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
          No uploads yet. <Link to="/dashboard/upload" style={{ color: "#9B7EFF", textDecoration: "none" }}>Upload your first video →</Link>
        </div>
      ) : (
        <>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={15} style={{ position: "absolute", left: 14, top: 12, color: "rgba(255,255,255,0.2)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search videos..."
            style={{ width: "100%", padding: "10px 14px 10px 38px", background: "#111118", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "white", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {videos.filter(v => !search || v.title?.toLowerCase().includes(search.toLowerCase())).map(v => (
            <div key={v.id} onClick={() => viewDetail(v.id)}
              style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as any).style.borderColor = "rgba(124,92,252,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor = "rgba(255,255,255,0.06)"; }}>
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} alt="" style={{ width: 80, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 80, height: 48, background: "rgba(255,255,255,0.04)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Film size={18} color="rgba(255,255,255,0.15)" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 3, display: "flex", gap: 12 }}>
                  {v.duration_seconds && <span>⏱ {formatDuration(v.duration_seconds)}</span>}
                  {v.orientation && <span>📐 {v.orientation}</span>}
                  <span>{new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <StatusPill status={v.status} />
              <ArrowRight size={16} color="rgba(255,255,255,0.15)" />
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
