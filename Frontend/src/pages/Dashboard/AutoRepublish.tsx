import React, { useState, useEffect, useCallback } from "react";
import { Repeat2, CheckCircle, Loader2, AlertCircle, Clock, RefreshCw, Zap } from "lucide-react";
import { api } from "../../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AutoJob {
  id: string;
  source_platform: string;
  video_title: string;
  target_platforms: string[];
  status: "pending" | "processing" | "done" | "failed";
  error_message?: string;
  triggered_at: string;
  completed_at?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, string> = {
  youtube:   "▶️",
  tiktok:    "🎵",
  instagram: "📸",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_CONFIG = {
  pending:    { label: "Pending",    color: "#F0C94A", bg: "rgba(240,201,74,0.12)",   icon: <Clock size={11} />  },
  processing: { label: "Processing", color: "#60A5FA", bg: "rgba(96,165,250,0.12)",   icon: <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> },
  done:       { label: "Done",       color: "#1FCFA0", bg: "rgba(31,207,160,0.12)",   icon: <CheckCircle size={11} /> },
  failed:     { label: "Failed",     color: "#EF4444", bg: "rgba(239,68,68,0.12)",    icon: <AlertCircle size={11} /> },
};

const sectionBox: React.CSSProperties = {
  background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 24px",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AutoRepublish() {
  const [jobs, setJobs]       = useState<AutoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.autoRepublish.activity()
      .then(({ jobs: j }) => setJobs(j))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId);
    try {
      await api.autoRepublish.retry(jobId);
      await load(true);
    } catch {
      /* handled silently */
    } finally {
      setRetrying(null);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now   = new Date();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const doneThisMonth = jobs.filter(
    j => j.status === "done" && new Date(j.triggered_at) >= month
  ).length;
  const lastActivity = jobs[0]?.triggered_at;

  const stats = [
    { label: "Auto-republished this month", value: doneThisMonth,                icon: "🚀" },
    { label: "Total auto jobs",             value: jobs.length,                  icon: "🔄" },
    { label: "Last activity",               value: lastActivity ? timeAgo(lastActivity) : "—", icon: "🕐" },
  ];

  return (
    <div style={{ padding: 40, maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Repeat2 size={24} color="#9B7EFF" />
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>
          Auto-Republish Activity
        </h1>
      </div>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 300, marginBottom: 32 }}>
        Videos automatically detected and redistributed from your connected platforms.
      </p>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} style={sectionBox}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div style={sectionBox}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={15} color="#9B7EFF" />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: "white" }}>
              Activity Feed
            </span>
          </div>
          <button onClick={() => load()} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, padding: "6px 14px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
            Loading…
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Repeat2 size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>No auto-republish activity yet.</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
              Enable auto-republish on a platform in <strong style={{ color: "rgba(155,126,255,0.6)" }}>Accounts</strong> to get started.
            </div>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 160px 110px 100px 80px", gap: 12, padding: "0 4px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
              {["", "Video", "Distributed to", "Status", "Time", ""].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{h}</div>
              ))}
            </div>

            {jobs.map(j => {
              const sc = STATUS_CONFIG[j.status] || STATUS_CONFIG.pending;
              return (
                <div key={j.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 160px 110px 100px 80px", gap: 12, alignItems: "center", padding: "12px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {/* Source icon */}
                  <div style={{ fontSize: 20, lineHeight: 1 }}>{PLATFORM_ICONS[j.source_platform] || "📹"}</div>

                  {/* Title */}
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {j.video_title || "Untitled"}
                  </div>

                  {/* Targets */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(j.target_platforms || []).map(t => (
                      <span key={t} title={t} style={{ fontSize: 16 }}>{PLATFORM_ICONS[t] || t}</span>
                    ))}
                  </div>

                  {/* Status badge */}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: sc.bg, color: sc.color, borderRadius: 100, padding: "4px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {sc.icon} {sc.label}
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{timeAgo(j.triggered_at)}</div>

                  {/* Retry button */}
                  <div>
                    {j.status === "failed" && (
                      <button
                        disabled={retrying === j.id}
                        onClick={() => handleRetry(j.id)}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(124,92,252,0.15)", border: "1px solid rgba(124,92,252,0.3)", borderRadius: 8, color: "#9B7EFF", cursor: retrying === j.id ? "not-allowed" : "pointer", fontSize: 11, opacity: retrying === j.id ? 0.5 : 1 }}
                      >
                        {retrying === j.id ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={10} />}
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
