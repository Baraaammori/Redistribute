import React, { useState, useEffect } from "react";
import { Clock, Calendar } from "lucide-react";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface Props {
  value?: string; // ISO string (UTC)
  onChange: (isoUtc: string | null) => void;
  label?: string;
}

export function SchedulePicker({ value, onChange, label = "Schedule for later" }: Props) {
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState(userTz || "America/New_York");
  const [enabled, setEnabled] = useState(!!value);
  const [localDatetime, setLocalDatetime] = useState<string>(() => {
    if (value) {
      // Convert UTC ISO to local datetime-local string in the chosen tz
      return toLocalInput(value, timezone);
    }
    // Default: now + 1 hour
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalInput(d.toISOString(), timezone);
  });

  // When timezone changes, re-parse keeping the same "wall clock" time
  useEffect(() => {
    if (!enabled) return;
    const utc = localToUtc(localDatetime, timezone);
    if (utc) onChange(utc);
  }, [timezone]); // eslint-disable-line

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      onChange(null);
    } else {
      const utc = localToUtc(localDatetime, timezone);
      if (utc) onChange(utc);
    }
  }

  function handleDatetimeChange(v: string) {
    setLocalDatetime(v);
    const utc = localToUtc(v, timezone);
    if (utc) onChange(utc);
  }

  const utcPreview = enabled ? localToUtc(localDatetime, timezone) : null;

  return (
    <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
      {/* Toggle header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={15} color="#9B7EFF" />
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "white" }}>
            {label}
          </span>
        </div>
        <button onClick={handleToggle} style={{
          width: 40, height: 22, borderRadius: 100, border: "none", cursor: "pointer",
          background: enabled ? "#7C5CFC" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s",
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%", background: "white",
            position: "absolute", top: 3, left: enabled ? 21 : 3, transition: "left 0.2s",
          }} />
        </button>
      </div>

      {enabled && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Date + time */}
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              <Calendar size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={localDatetime}
              min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
              onChange={e => handleDatetimeChange(e.target.value)}
              style={{
                background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13,
                width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif",
                boxSizing: "border-box", colorScheme: "dark",
              }}
            />
          </div>

          {/* Timezone */}
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              style={{
                background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12,
                width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif",
                boxSizing: "border-box",
              }}
            >
              {/* Always include the user's detected tz first */}
              {!TIMEZONES.includes(userTz) && (
                <option value={userTz}>{userTz} (detected)</option>
              )}
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* UTC preview */}
          {utcPreview && (
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
              Posts at: {new Date(utcPreview).toUTCString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalInput(isoUtc: string, tz: string): string {
  try {
    const d = new Date(isoUtc);
    // Build yyyy-MM-ddTHH:mm in the target timezone
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return new Date(isoUtc).toISOString().slice(0, 16);
  }
}

function localToUtc(localDatetime: string, tz: string): string | null {
  if (!localDatetime) return null;
  try {
    // localDatetime is "yyyy-MM-ddTHH:mm" — interpret it as a wall-clock time in `tz`
    const [datePart, timePart] = localDatetime.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = (timePart || "00:00").split(":").map(Number);

    // Find UTC offset for this wall-clock time in the given tz
    // by formatting a candidate UTC date and comparing
    const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const localStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(candidate);

    const [dPart, tPart] = localStr.split(", ");
    const [ly, lm, ld] = dPart.split("-").map(Number);
    const [lh, lmin] = tPart.split(":").map(Number);

    const diffMs =
      (year - ly) * 365.25 * 86400000 +
      (month - lm) * 30.44 * 86400000 +
      (day - ld) * 86400000 +
      (hour - lh) * 3600000 +
      (minute - lmin) * 60000;

    return new Date(candidate.getTime() + diffMs).toISOString();
  } catch {
    return null;
  }
}
