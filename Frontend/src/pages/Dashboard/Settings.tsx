import { useState, useRef } from 'react';
import { Settings2, Upload, Trash2, CheckCircle, Image } from 'lucide-react';

const POSITIONS = [
  { id: 'top-left',     label: '↖ Top Left' },
  { id: 'top-right',    label: '↗ Top Right' },
  { id: 'bottom-left',  label: '↙ Bottom Left' },
  { id: 'bottom-right', label: '↘ Bottom Right' },
];

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl mb-5" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: 24 }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans font-semibold uppercase text-rd-text2" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
      {children}
    </span>
  );
}

export default function Settings() {
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkPreview, setPreview]    = useState<string | null>(null);
  const [position, setPosition]           = useState('bottom-right');
  const [opacity, setOpacity]             = useState(0.8);
  const [scale, setScale]                 = useState(12);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please upload a PNG or SVG image.'); return; }
    setWatermarkFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  }

  async function handleSave() {
    if (!watermarkFile) return;
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('watermark', watermarkFile);
      fd.append('position', position);
      fd.append('opacity', String(opacity));
      fd.append('scale', String(scale / 100));
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/settings/watermark`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { setError(err.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  function handleClear() {
    setWatermarkFile(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="p-10" style={{ maxWidth: 680 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Settings2 size={22} className="text-rd-purple" />
        <h1 className="font-display font-extrabold text-rd-text m-0" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>Settings</h1>
      </div>
      <p className="font-sans text-rd-text2 mt-1 mb-8" style={{ fontSize: 13 }}>
        Customize your watermark and account preferences.
      </p>

      {/* Watermark */}
      <SectionCard>
        <div className="flex items-center gap-2 mb-4">
          <Image size={15} className="text-rd-purple" />
          <span className="font-display font-bold text-rd-text" style={{ fontSize: 15 }}>Custom Watermark</span>
        </div>
        <p className="font-sans text-rd-text2 mb-5" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Upload a PNG or SVG logo — burned into every clip you distribute. Recommended: transparent background, min 200 px wide.
        </p>

        {/* Drop zone */}
        <div onClick={() => fileRef.current?.click()}
          className="rounded-2xl text-center cursor-pointer transition-all mb-5"
          style={{
            border: `2px dashed ${watermarkPreview ? 'rgba(108,71,255,0.40)' : 'rgba(255,255,255,0.10)'}`,
            padding: 32,
            background: watermarkPreview ? 'rgba(108,71,255,0.04)' : 'transparent',
          }}>
          {watermarkPreview ? (
            <div className="flex flex-col items-center gap-3">
              <img src={watermarkPreview} alt="Watermark preview"
                style={{ maxHeight: 80, maxWidth: 240, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
              <span className="font-mono text-rd-text2" style={{ fontSize: 11 }}>{watermarkFile?.name}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={28} color="rgba(240,239,248,0.20)" />
              <span className="font-sans text-rd-text2" style={{ fontSize: 13 }}>Click to upload PNG or SVG</span>
              <span className="font-mono" style={{ fontSize: 11, color: 'rgba(240,239,248,0.20)' }}>Transparent background recommended</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/svg+xml" onChange={handleFileChange} hidden />

        {/* Position + sliders */}
        <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Position */}
          <div>
            <div className="mb-3"><FieldLabel>Position</FieldLabel></div>
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {POSITIONS.map(p => (
                <button key={p.id} onClick={() => setPosition(p.id)}
                  className="rounded-xl font-sans transition-all"
                  style={{
                    padding: '8px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    border: `1px solid ${position === p.id ? '#8B6AFF' : 'rgba(255,255,255,0.08)'}`,
                    background: position === p.id ? 'rgba(139,106,255,0.15)' : 'transparent',
                    color: position === p.id ? '#8B6AFF' : 'rgba(240,239,248,0.40)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="flex flex-col gap-4">
            {[
              { label: 'Opacity', value: Math.round(opacity * 100), display: `${Math.round(opacity * 100)}%`, min: 10, max: 100, onChange: (v: number) => setOpacity(v / 100) },
              { label: 'Size',    value: scale,                     display: `${scale}% of width`,           min: 5,  max: 30,  onChange: (v: number) => setScale(v) },
            ].map(f => (
              <div key={f.label}>
                <div className="flex justify-between mb-2">
                  <FieldLabel>{f.label}</FieldLabel>
                  <span className="font-mono font-semibold text-rd-purple" style={{ fontSize: 12 }}>{f.display}</span>
                </div>
                <input type="range" min={f.min} max={f.max} value={f.value} onChange={e => f.onChange(Number(e.target.value))}
                  className="w-full" style={{ accentColor: '#6C47FF' }} />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="font-sans rounded-xl mb-4 px-4 py-2.5" style={{ fontSize: 12, color: '#F04F4F', background: 'rgba(240,79,79,0.08)' }}>{error}</div>
        )}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={!watermarkFile || saving}
            className="inline-flex items-center gap-2 rounded-full font-sans font-semibold"
            style={{
              padding: '10px 24px', fontSize: 13, border: 'none', cursor: (!watermarkFile || saving) ? 'not-allowed' : 'pointer',
              background: saved ? '#0ED2A0' : (!watermarkFile || saving) ? 'rgba(108,71,255,0.40)' : '#6C47FF',
              color: '#fff',
            }}>
            {saved ? <><CheckCircle size={14} /> Saved!</> : saving ? 'Saving…' : 'Save watermark'}
          </button>
          {watermarkPreview && (
            <button onClick={handleClear}
              className="inline-flex items-center gap-2 rounded-full font-sans"
              style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,239,248,0.40)', fontSize: 13, cursor: 'pointer' }}>
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
