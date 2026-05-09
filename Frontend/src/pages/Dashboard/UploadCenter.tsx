import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Film, Sparkles, Settings2, Sliders, ArrowRight, Loader2, X, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { PlatformDot } from '../../components/ui/PlatformDot';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function uploadWithProgress(
  file: File,
  meta: { title: string; description?: string; tags?: string; mode?: string },
  onProgress: (pct: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('title', meta.title);
    if (meta.description) fd.append('description', meta.description);
    if (meta.tags) fd.append('tags', meta.tags);
    if (meta.mode) fd.append('mode', meta.mode);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90)); };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed'));
      } catch { reject(new Error('Upload failed')); }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.open('POST', `${BASE}/api/upload`);
    const token = localStorage.getItem('authToken');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(fd);
  });
}

const MODES = [
  { id: 'auto',   icon: Sparkles,  label: 'Smart Auto',    desc: 'AI decides best distribution',     color: 'rd-purple' },
  { id: 'manual', icon: Settings2, label: 'Manual',         desc: 'Choose platforms yourself',         color: 'rd-teal'   },
  { id: 'custom', icon: Sliders,   label: 'Custom Clips',   desc: 'Set clip count, duration, targets', color: 'rd-amber'  },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans font-semibold uppercase text-rd-text2" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
      {children}
    </span>
  );
}

export default function UploadCenter() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile]           = useState<File | null>(null);
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [tags, setTags]           = useState('');
  const [mode, setMode]           = useState('auto');
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState<any>(null);
  const [error, setError]         = useState('');
  const [manualPlatforms, setManualPlatforms] = useState<Record<string, string>>({});
  const [clipCount, setClipCount] = useState(3);
  const [clipDuration, setClipDuration] = useState(45);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('video/')) { setError('Please select a video file'); return; }
    if (f.size > 500 * 1024 * 1024) { setError('File too large — max 500 MB'); return; }
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ''));
    setError('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file || !title.trim()) { setError('Select a file and enter a title'); return; }
    setUploading(true); setError(''); setProgress(0);
    try {
      const r = await uploadWithProgress(file, { title: title.trim(), description: description.trim(), tags: tags.trim(), mode }, setProgress);
      setProgress(100); setResult(r);
    } catch (err: any) { setError(err.message || 'Upload failed'); setProgress(0); }
    finally { setUploading(false); }
  };

  const handleProcess = async () => {
    if (!result) return;
    setUploading(true); setError('');
    try {
      const config: any = { mode };
      if (mode === 'manual') config.platforms = manualPlatforms;
      else if (mode === 'custom') { config.clip_count = clipCount; config.clip_duration = clipDuration; config.platforms = { tiktok: 'generate_clips', youtube: 'full_upload' }; }
      if (result.smart_decision?.generate_clips || mode === 'custom') await api.upload.process(result.id, config);
      const distConfig: any = {};
      if (mode === 'manual') distConfig.actions = manualPlatforms;
      await api.upload.distribute(result.id, distConfig);
      navigate('/dashboard/queue');
    } catch (err: any) { setError(err.message || 'Processing failed'); }
    finally { setUploading(false); }
  };

  // ── Success view ────────────────────────────────────────────────────────────
  if (result) {
    const decision = result.smart_decision;
    return (
      <div className="p-10 max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center rounded-full bg-rd-teal/20" style={{ width: 32, height: 32 }}>
            <Check size={16} className="text-rd-teal" />
          </div>
          <h1 className="font-display font-extrabold text-rd-text m-0" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>
            Upload complete
          </h1>
        </div>
        <p className="font-sans text-rd-text2 mt-1 mb-8" style={{ fontSize: 13 }}>
          Your video has been uploaded and analyzed — choose how to distribute it.
        </p>

        {/* Video info */}
        <div className="rounded-2xl mb-5" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
          <div className="flex gap-4">
            {result.thumbnail_url && (
              <img src={result.thumbnail_url} alt="" className="rounded-xl flex-shrink-0 object-cover" style={{ width: 160, height: 90 }} />
            )}
            <div>
              <div className="font-display font-bold text-rd-text mb-2" style={{ fontSize: 16 }}>{result.title}</div>
              <div className="flex gap-4 font-mono text-rd-text2" style={{ fontSize: 11 }}>
                {result.duration_seconds && <span>{Math.round(result.duration_seconds / 60)}m {Math.round(result.duration_seconds % 60)}s</span>}
                {result.orientation && <span>{result.orientation}</span>}
                {result.width && <span>{result.width}×{result.height}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Smart decision */}
        {decision && (
          <div className="rounded-2xl mb-5" style={{ background: '#0F0F17', border: '1px solid rgba(108,71,255,0.25)', padding: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-rd-purple" />
              <span className="font-sans font-semibold text-rd-purple" style={{ fontSize: 12, letterSpacing: '0.04em' }}>SMART DECISION</span>
            </div>
            <div className="font-sans text-rd-text mb-4" style={{ fontSize: 13, lineHeight: 1.6 }}>{decision.reason}</div>
            <div className="flex gap-2 flex-wrap">
              {decision.youtube && <span className="font-mono rounded-full" style={{ background: 'rgba(255,61,61,0.12)', color: '#FF3D3D', padding: '3px 10px', fontSize: 11 }}>YT: {decision.youtube === 'full_upload' ? 'Full upload' : 'Clips'}</span>}
              {decision.tiktok  && <span className="font-mono rounded-full" style={{ background: 'rgba(232,232,238,0.08)', color: '#E8E8EE', padding: '3px 10px', fontSize: 11 }}>TT: {decision.tiktok  === 'full_upload' ? 'Full upload' : `${decision.clip_count} clips`}</span>}
              {decision.youtube_shorts && <span className="font-mono rounded-full" style={{ background: 'rgba(14,210,160,0.12)', color: '#0ED2A0', padding: '3px 10px', fontSize: 11 }}>YT Shorts</span>}
            </div>
          </div>
        )}

        {/* Mode selector */}
        <div className="mb-5">
          <div className="font-sans font-semibold uppercase text-rd-text2 mb-3" style={{ fontSize: 11, letterSpacing: '0.08em' }}>Distribution mode</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {MODES.map(({ id, icon: Icon, label, desc }) => {
              const active = mode === id;
              return (
                <button key={id} onClick={() => setMode(id)}
                  className="rounded-2xl text-left transition-all"
                  style={{
                    padding: 16,
                    background: active ? 'rgba(108,71,255,0.10)' : '#0F0F17',
                    border: `1px solid ${active ? '#6C47FF' : 'rgba(255,255,255,0.07)'}`,
                    cursor: 'pointer',
                  }}>
                  <Icon size={16} className={active ? 'text-rd-purple' : 'text-rd-text2'} style={{ marginBottom: 8 }} />
                  <div className="font-sans font-semibold text-rd-text" style={{ fontSize: 13 }}>{label}</div>
                  <div className="font-sans text-rd-text2 mt-1" style={{ fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual options */}
        {mode === 'manual' && (
          <div className="rounded-2xl mb-5" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
            {[
              { key: 'youtube', label: 'YouTube', id: 'youtube' as const, options: ['full_upload'] },
              { key: 'tiktok',  label: 'TikTok',  id: 'tiktok'  as const, options: ['full_upload', 'generate_clips'] },
              { key: 'youtube_shorts', label: 'YouTube Shorts', id: 'youtube' as const, options: ['full_upload'] },
            ].map(p => (
              <div key={p.key} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <PlatformDot id={p.id} size={28} radius={6} />
                <span className="font-sans text-rd-text flex-1" style={{ fontSize: 13 }}>{p.label}</span>
                <select value={manualPlatforms[p.key] || ''} onChange={e => {
                  const next = { ...manualPlatforms };
                  if (e.target.value) next[p.key] = e.target.value; else delete next[p.key];
                  setManualPlatforms(next);
                }} className="font-mono rounded-lg" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.10)', padding: '6px 10px', color: '#F0EFF8', fontSize: 12, outline: 'none' }}>
                  <option value="">— Skip —</option>
                  {p.options.map(o => <option key={o} value={o}>{o === 'full_upload' ? 'Full upload' : 'Generate clips'}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Custom clip options */}
        {mode === 'custom' && (
          <div className="rounded-2xl mb-5" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[
                { label: 'Number of clips', value: clipCount, set: setClipCount, min: 1, max: 10, step: 1 },
                { label: 'Clip duration (s)', value: clipDuration, set: setClipDuration, min: 15, max: 60, step: 5 },
              ].map(f => (
                <label key={f.label} className="flex flex-col gap-1.5">
                  <FieldLabel>{f.label}</FieldLabel>
                  <input type="number" min={f.min} max={f.max} step={f.step} value={f.value} onChange={e => f.set(Number(e.target.value))}
                    className="rounded-xl font-mono"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '9px 13px', color: '#F0EFF8', fontSize: 14, outline: 'none' }} />
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className="font-sans rounded-xl mb-4 px-4 py-2.5" style={{ fontSize: 12, color: '#F04F4F', background: 'rgba(240,79,79,0.08)' }}>{error}</div>}

        <div className="flex gap-3">
          <button onClick={() => { setResult(null); setFile(null); setProgress(0); }}
            className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
            style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 13 }}>
            ← New upload
          </button>
          <button onClick={handleProcess} disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
            style={{ padding: '10px 28px', background: '#6C47FF', color: '#fff', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: uploading ? 0.6 : 1, boxShadow: '0 0 24px rgba(108,71,255,0.3)' }}>
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : <>Process & distribute <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    );
  }

  // ── Upload form ─────────────────────────────────────────────────────────────
  return (
    <div className="p-10 max-w-2xl">
      <h1 className="font-display font-extrabold text-rd-text m-0" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>
        Upload center
      </h1>
      <p className="font-sans text-rd-text2 mt-2 mb-8" style={{ fontSize: 13 }}>
        Upload once — optimized for every platform automatically.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-2xl transition-all cursor-pointer mb-5"
        style={{
          border: `2px dashed ${dragOver ? '#6C47FF' : file ? '#0ED2A0' : 'rgba(255,255,255,0.10)'}`,
          padding: file ? '20px 24px' : '48px 24px',
          textAlign: 'center',
          background: dragOver ? 'rgba(108,71,255,0.05)' : file ? 'rgba(14,210,160,0.03)' : 'rgba(255,255,255,0.02)',
        }}
      >
        <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        {file ? (
          <div className="flex items-center gap-4">
            <Film size={24} className="text-rd-teal flex-shrink-0" />
            <div className="flex-1 text-left">
              <div className="font-sans font-medium text-rd-text" style={{ fontSize: 14 }}>{file.name}</div>
              <div className="font-mono text-rd-text2 mt-0.5" style={{ fontSize: 11 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setTitle(''); }}
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: 'rgba(240,79,79,0.12)', border: 'none', cursor: 'pointer', color: '#F04F4F' }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={32} color={dragOver ? '#6C47FF' : 'rgba(240,239,248,0.15)'} style={{ marginBottom: 12 }} />
            <div className="font-display font-semibold text-rd-text mb-1.5" style={{ fontSize: 15 }}>Drop your video here</div>
            <div className="font-mono text-rd-text2" style={{ fontSize: 11 }}>or click to browse · MP4, MOV, WebM · Max 500 MB</div>
          </>
        )}
      </div>

      {/* Progress */}
      {uploading && (
        <div className="mb-5">
          <div className="flex justify-between mb-2">
            <span className="font-sans text-rd-text2" style={{ fontSize: 12 }}>Uploading & analyzing…</span>
            <span className="font-mono font-semibold text-rd-purple" style={{ fontSize: 12 }}>{progress}%</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6C47FF, #0ED2A0)' }} />
          </div>
        </div>
      )}

      {/* Fields + mode selector — show once file picked */}
      {file && (
        <>
          <div className="flex flex-col gap-4 mb-6">
            {[
              { label: 'Title', value: title, set: setTitle, type: 'text', required: true },
              { label: 'Description', value: description, set: setDesc, type: 'text', required: false },
              { label: 'Tags', value: tags, set: setTags, type: 'text', required: false },
            ].map(f => (
              <label key={f.label} className="flex flex-col gap-1.5">
                <FieldLabel>{f.label}{f.required && ' *'}</FieldLabel>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                  className="rounded-xl font-sans"
                  style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', color: '#F0EFF8', fontSize: 14, outline: 'none' }} />
              </label>
            ))}
          </div>

          <div className="mb-7">
            <div className="font-sans font-semibold uppercase text-rd-text2 mb-3" style={{ fontSize: 11, letterSpacing: '0.08em' }}>Distribution mode</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {MODES.map(({ id, icon: Icon, label, desc }) => {
                const active = mode === id;
                return (
                  <button key={id} onClick={() => setMode(id)}
                    className="rounded-2xl text-left transition-all"
                    style={{
                      padding: 16,
                      background: active ? 'rgba(108,71,255,0.10)' : '#0F0F17',
                      border: `1px solid ${active ? '#6C47FF' : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer',
                    }}>
                    <Icon size={16} color={active ? '#6C47FF' : 'rgba(240,239,248,0.40)'} style={{ marginBottom: 8 }} />
                    <div className="font-sans font-semibold text-rd-text" style={{ fontSize: 13 }}>{label}</div>
                    <div className="font-sans text-rd-text2 mt-1" style={{ fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {error && <div className="font-sans rounded-xl mb-4 px-4 py-2.5" style={{ fontSize: 12, color: '#F04F4F', background: 'rgba(240,79,79,0.08)' }}>{error}</div>}

      {file && (
        <button onClick={handleUpload} disabled={uploading || !title.trim()}
          className="inline-flex items-center gap-2 rounded-full font-sans font-semibold"
          style={{
            padding: '12px 32px',
            background: uploading || !title.trim() ? 'rgba(108,71,255,0.40)' : '#6C47FF',
            color: '#fff', border: 'none', fontSize: 14,
            cursor: uploading || !title.trim() ? 'not-allowed' : 'pointer',
            boxShadow: '0 0 24px rgba(108,71,255,0.3)',
          }}>
          {uploading ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><Upload size={15} /> Upload & analyze</>}
        </button>
      )}
    </div>
  );
}
