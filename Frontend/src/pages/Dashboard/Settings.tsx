import { useState, useRef } from "react";
import { Settings2, Upload, Trash2, CheckCircle, Image } from "lucide-react";
import { api } from "../../lib/api";

const inputStyle: React.CSSProperties = {
  background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13,
  width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif",
  boxSizing: "border-box",
};

const POSITIONS = [
  { id: "top-left",     label: "↖ Top Left" },
  { id: "top-right",    label: "↗ Top Right" },
  { id: "bottom-left",  label: "↙ Bottom Left" },
  { id: "bottom-right", label: "↘ Bottom Right" },
];

export default function Settings() {
  const [watermarkFile, setWatermarkFile]   = useState<File | null>(null);
  const [watermarkPreview, setPreview]      = useState<string | null>(null);
  const [position, setPosition]            = useState("bottom-right");
  const [opacity, setOpacity]              = useState(0.8);
  const [scale, setScale]                  = useState(12);
  const [saving, setSaving]                = useState(false);
  const [saved, setSaved]                  = useState(false);
  const [error, setError]                  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please upload a PNG or SVG image.");
      return;
    }
    setWatermarkFile(f);
    setPreview(URL.createObjectURL(f));
    setError("");
  }

  async function handleSave() {
    if (!watermarkFile) return;
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("watermark", watermarkFile);
      fd.append("position", position);
      fd.append("opacity", String(opacity));
      fd.append("scale", String(scale / 100));

      const token = localStorage.getItem("authToken");
      const res = await fetch(`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/settings/watermark`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setWatermarkFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Settings2 size={24} color="#9B7EFF" />
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -1 }}>
          Settings
        </h1>
      </div>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, fontWeight: 300 }}>
        Customize your watermark and account preferences.
      </p>

      {/* Watermark section */}
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Image size={16} color="#9B7EFF" />
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: "white" }}>
            Custom Watermark
          </span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20, lineHeight: 1.5 }}>
          Upload a PNG or SVG logo. It will be burned into every clip you distribute. Recommended: transparent background, min 200px wide.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${watermarkPreview ? "rgba(124,92,252,0.4)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer",
            background: watermarkPreview ? "rgba(124,92,252,0.04)" : "transparent",
            marginBottom: 20, transition: "all 0.2s",
          }}
        >
          {watermarkPreview ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <img src={watermarkPreview} alt="Watermark preview"
                style={{ maxHeight: 80, maxWidth: 240, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{watermarkFile?.name}</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Upload size={28} color="rgba(255,255,255,0.2)" />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Click to upload PNG or SVG</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Transparent background recommended</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/svg+xml"
          onChange={handleFileChange} style={{ display: "none" }} />

        {/* Options */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Position */}
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              Position
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {POSITIONS.map(p => (
                <button key={p.id} onClick={() => setPosition(p.id)} style={{
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 500,
                  border: `1px solid ${position === p.id ? "#9B7EFF" : "rgba(255,255,255,0.08)"}`,
                  background: position === p.id ? "rgba(155,126,255,0.15)" : "transparent",
                  color: position === p.id ? "#9B7EFF" : "rgba(255,255,255,0.4)",
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity + Scale */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Opacity</label>
                <span style={{ fontSize: 12, color: "#9B7EFF", fontWeight: 600 }}>{Math.round(opacity * 100)}%</span>
              </div>
              <input type="range" min={10} max={100} value={Math.round(opacity * 100)}
                onChange={e => setOpacity(Number(e.target.value) / 100)}
                style={{ width: "100%", accentColor: "#7C5CFC" }} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Size</label>
                <span style={{ fontSize: 12, color: "#9B7EFF", fontWeight: 600 }}>{scale}% of width</span>
              </div>
              <input type="range" min={5} max={30} value={scale}
                onChange={e => setScale(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#7C5CFC" }} />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#EF4444", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={!watermarkFile || saving}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 24px",
              background: saved ? "#1FCFA0" : ((!watermarkFile || saving) ? "rgba(124,92,252,0.4)" : "#7C5CFC"),
              color: "white", border: "none", borderRadius: 100, fontSize: 13,
              cursor: (!watermarkFile || saving) ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
            }}
          >
            {saved
              ? <><CheckCircle size={14} /> Saved!</>
              : saving
              ? "Saving…"
              : "Save Watermark"}
          </button>

          {watermarkPreview && (
            <button onClick={handleClear} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)", borderRadius: 100, fontSize: 13, cursor: "pointer",
            }}>
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
