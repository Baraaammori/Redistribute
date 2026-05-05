import React, { useState, useEffect } from "react";
import { Clock, TrendingUp, BarChart2 } from "lucide-react";
import { api } from "../lib/api";

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
  tiktok:         { icon: "🎵", color: "#E0E0E0",  label: "TikTok" },
  youtube:        { icon: "▶️", color: "#FF4444",  label: "YouTube" },
  youtube_shorts: { icon: "📱", color: "#FF8800",  label: "YT Shorts" },
  instagram:      { icon: "📸", color: "#FF7A3D",  label: "Instagram" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  onSelectTime?: (utcIso: string, platform: string) => void;
}

export function BestTimeWidget({ onSelectTime }: Props) {
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [activePlatform, setActive] = useState("tiktok");
  const [showHeatmap, setShowHeatmap] = useState(false);

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    api.bestTime.get(userTz)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userTz]);

  if (loading) {
    return (
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: 20 }}>Loading best times…</div>
      </div>
    );
  }
  if (!data) return null;

  const platformData = data.platforms?.[activePlatform];
  const recommendations = platformData?.recommendations || [];
  const best = platformData?.best;
  const isPersonal = platformData?.source === "your_data";

  const handleUseTime = (rec: any) => {
    if (!onSelectTime) return;
    // Build next occurrence of this dow + hour in UTC
    const now = new Date();
    const targetDow = rec.dow;
    const targetHour = rec.hour;
    const daysUntil = (targetDow - now.getDay() + 7) % 7 || 7;
    const target = new Date(now);
    target.setDate(target.getDate() + daysUntil);
    target.setHours(targetHour, 0, 0, 0);
    onSelectTime(target.toISOString(), activePlatform);
  };

  return (
    <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={15} color="#9B7EFF" />
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white" }}>Best Time to Post</span>
          {isPersonal
            ? <span style={{ fontSize: 10, background: "rgba(31,207,160,0.15)", color: "#1FCFA0", padding: "2px 8px", borderRadius: 100, fontWeight: 600 }}>Your data · {platformData.data_points} posts</span>
            : <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", padding: "2px 8px", borderRadius: 100 }}>Industry benchmarks</span>
          }
        </div>
        <button onClick={() => setShowHeatmap(h => !h)}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <BarChart2 size={14} /> {showHeatmap ? "Hide" : "Heatmap"}
        </button>
      </div>

      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {Object.entries(PLATFORM_META).map(([id, m]) => (
          <button key={id} onClick={() => setActive(id)} style={{
            padding: "5px 12px", borderRadius: 100, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
            background: activePlatform === id ? "rgba(155,126,255,0.15)" : "rgba(255,255,255,0.05)",
            color: activePlatform === id ? "#9B7EFF" : "rgba(255,255,255,0.4)",
          }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Best time hero */}
      {best && (
        <div style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.15)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Best window</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: "white" }}>{best.label}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{best.reason}</div>
            </div>
            {isPersonal && best.avgViews != null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#1FCFA0" }}>{best.avgViews.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>avg views</div>
              </div>
            )}
          </div>
          {onSelectTime && (
            <button onClick={() => handleUseTime(best)}
              style={{ marginTop: 10, padding: "6px 16px", background: "#7C5CFC", color: "white", border: "none", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Use this time →
            </button>
          )}
        </div>
      )}

      {/* Other recommendations */}
      {recommendations.slice(1, 4).map((rec: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <TrendingUp size={12} color="rgba(255,255,255,0.2)" style={{ marginRight: 10, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{rec.label}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>{rec.reason}</span>
          </div>
          {isPersonal && rec.avgViews != null && (
            <span style={{ fontSize: 12, color: "#9B7EFF", fontWeight: 600 }}>{rec.avgViews.toLocaleString()} avg</span>
          )}
          {onSelectTime && (
            <button onClick={() => handleUseTime(rec)}
              style={{ marginLeft: 10, padding: "4px 10px", background: "rgba(124,92,252,0.1)", border: "none", borderRadius: 100, color: "#9B7EFF", fontSize: 11, cursor: "pointer" }}>
              Use
            </button>
          )}
        </div>
      ))}

      {!isPersonal && platformData?.needed_for_personal != null && (
        <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
          Post {platformData.needed_for_personal} more time{platformData.needed_for_personal !== 1 ? "s" : ""} on {PLATFORM_META[activePlatform]?.label} to unlock your personal data.
        </div>
      )}

      {/* Heatmap */}
      {showHeatmap && platformData?.heatmap && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Engagement heatmap (darker = higher)</div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "28px repeat(24, 1fr)", gap: 1, minWidth: 600 }}>
              {/* Hour labels */}
              <div />
              {HOURS.filter(h => h % 3 === 0).map(h => (
                <div key={h} style={{ gridColumn: `${h + 2} / span 3`, fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
                  {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                </div>
              ))}

              {/* Grid rows */}
              {DAYS.map((day, dow) => (
                <React.Fragment key={dow}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
                    {day}
                  </div>
                  {HOURS.map(hour => {
                    const val = platformData.heatmap[dow]?.[hour] || 0;
                    const opacity = val > 0 ? 0.15 + (val / 100) * 0.85 : 0.04;
                    return (
                      <div key={hour} title={`${DAYS[dow]} ${hour}:00 — score: ${val}`}
                        style={{ height: 10, borderRadius: 2, background: `rgba(124,92,252,${opacity})`, cursor: "pointer" }}
                        onClick={() => onSelectTime && handleUseTime({ dow, hour, label: `${DAYS[dow]} ${hour}:00`, reason: "" })}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
