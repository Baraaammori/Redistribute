import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, FolderOpen, ArrowRight, Check, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { SchedulePicker } from '../../components/SchedulePicker';
import { PlatformDot, PlatformId } from '../../components/ui/PlatformDot';

// ── Wizard step indicator ─────────────────────────────────────────────────────
function WizardSteps({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div className="flex items-center gap-0 mb-9">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: i === active ? 'rgba(108,71,255,0.15)' : 'transparent' }}>
            <div className="flex items-center justify-center rounded-full font-mono font-bold text-white"
              style={{
                width: 20, height: 20, fontSize: 10,
                background: i < active ? '#0ED2A0' : i === active ? '#6C47FF' : 'rgba(255,255,255,0.10)',
              }}>
              {i < active ? <Check size={10} /> : i + 1}
            </div>
            <span className="font-sans" style={{
              fontSize: 12,
              color: i === active ? '#8B6AFF' : i < active ? 'rgba(240,239,248,0.60)' : 'rgba(240,239,248,0.25)',
            }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

const PLATFORMS: PlatformId[] = ['youtube', 'tiktok', 'instagram'];
const PLATFORM_LABELS: Record<string, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };

function detectPlatform(url: string): PlatformId | '' {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/instagram\.com/.test(url)) return 'instagram';
  return '';
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewRepost() {
  const navigate  = useNavigate();
  const [mode, setMode]                 = useState<'url' | 'select' | null>(null);
  const [step, setStep]                 = useState(0);
  const [source, setSource]             = useState<PlatformId | ''>('');
  const [videos, setVideos]             = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [schedule, setSchedule]         = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [done, setDone]                 = useState(false);
  const [pastedUrl, setPastedUrl]       = useState('');
  const [urlTitle, setUrlTitle]         = useState('');

  const loadVideos = async (platform: string) => {
    setLoadingVideos(true);
    try { const v = await api.videos.list(platform); setVideos(v); }
    catch { setVideos([]); }
    finally { setLoadingVideos(false); }
  };

  const handleUrlSubmit = () => {
    const detected = detectPlatform(pastedUrl);
    if (!detected) { alert('Please paste a valid YouTube, TikTok, or Instagram URL.'); return; }
    setSource(detected);
    setSelectedVideo({ id: `url_${Date.now()}`, url: pastedUrl, title: urlTitle || `${detected} video`, thumbnail: null });
    setStep(2);
  };

  const toggleDest = (p: string) =>
    setDestinations(prev => prev.includes(p) ? prev.filter(d => d !== p) : [...prev, p]);

  const submit = async () => {
    if (!selectedVideo || !destinations.length) return;
    setSubmitting(true);
    try {
      await api.reposts.create({
        sourceVideoId: selectedVideo.id, sourceVideoUrl: selectedVideo.url,
        sourcePlatform: source, title: selectedVideo.title,
        thumbnailUrl: selectedVideo.thumbnail, destinations,
        scheduledFor: schedule || null,
      });
      setDone(true);
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const reset = () => {
    setDone(false); setMode(null); setStep(0); setSource(''); setSelectedVideo(null);
    setDestinations([]); setSchedule(''); setPastedUrl(''); setUrlTitle('');
  };

  const stepsUrl    = ['Paste URL', 'Destinations', 'Schedule'];
  const stepsSelect = ['Source', 'Pick video', 'Destinations', 'Schedule'];
  const steps       = mode === 'url' ? stepsUrl : stepsSelect;
  const activeStep  = mode === 'url' ? step - 1 : step;

  // ── Done ─────────────────────────────────────────────────────────────────
  if (done) return (
    <div className="p-10 flex flex-col items-center text-center" style={{ maxWidth: 480, margin: '60px auto' }}>
      <div className="flex items-center justify-center rounded-full mb-5" style={{ width: 56, height: 56, background: 'rgba(14,210,160,0.15)' }}>
        <Check size={24} className="text-rd-teal" />
      </div>
      <h2 className="font-display font-extrabold text-rd-text m-0 mb-2" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>Repost queued!</h2>
      <p className="font-sans text-rd-text2 mb-7" style={{ fontSize: 13 }}>Your video is being distributed. Check the queue to track progress.</p>
      <div className="flex gap-3">
        <button onClick={() => navigate('/dashboard/queue')}
          className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
          style={{ padding: '10px 22px', background: '#6C47FF', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer', boxShadow: '0 0 20px rgba(108,71,255,0.30)' }}>
          View queue <ArrowRight size={14} />
        </button>
        <button onClick={reset}
          className="rounded-full font-sans"
          style={{ padding: '10px 22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,239,248,0.60)', fontSize: 14, cursor: 'pointer' }}>
          New repost
        </button>
      </div>
    </div>
  );

  // ── Mode selection ────────────────────────────────────────────────────────
  if (!mode) return (
    <div className="p-10" style={{ maxWidth: 680 }}>
      <h1 className="font-display font-extrabold text-rd-text m-0 mb-2" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>New repost</h1>
      <p className="font-sans text-rd-text2 mb-8" style={{ fontSize: 13 }}>How would you like to add the video?</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {[
          { id: 'url' as const, Icon: Link2, title: 'Paste a URL', desc: 'Paste a YouTube, TikTok, or Instagram link. TikTok videos are downloaded watermark-free.', accent: true },
          { id: 'select' as const, Icon: FolderOpen, title: 'Select from account', desc: 'Browse your connected YouTube account and pick a video to redistribute.', accent: false },
        ].map(({ id, Icon, title, desc, accent }) => (
          <button key={id} onClick={() => { setMode(id); setStep(id === 'url' ? 1 : 0); }}
            className="rounded-2xl text-left transition-all"
            style={{
              padding: '28px 24px',
              background: accent ? 'linear-gradient(145deg, rgba(108,71,255,0.12), rgba(14,210,160,0.06))' : '#0F0F17',
              border: `1px solid ${accent ? 'rgba(108,71,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accent ? 'rgba(108,71,255,0.55)' : 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = accent ? 'rgba(108,71,255,0.25)' : 'rgba(255,255,255,0.07)'; }}>
            <div className="flex items-center justify-center rounded-xl mb-4" style={{ width: 40, height: 40, background: accent ? 'rgba(108,71,255,0.18)' : 'rgba(255,255,255,0.06)' }}>
              <Icon size={18} color={accent ? '#8B6AFF' : 'rgba(240,239,248,0.50)'} />
            </div>
            <div className="font-display font-bold text-rd-text mb-2" style={{ fontSize: 17 }}>{title}</div>
            <div className="font-sans text-rd-text2" style={{ fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-10" style={{ maxWidth: 680 }}>
      <h1 className="font-display font-extrabold text-rd-text m-0 mb-2" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>New repost</h1>
      <p className="font-sans text-rd-text2 mb-7" style={{ fontSize: 13 }}>
        {mode === 'url' ? 'Paste a video URL to redistribute.' : 'Pick a video from your connected account.'}
      </p>

      <WizardSteps steps={steps} active={activeStep} />

      {/* ── URL: paste ──────────────────────────────────────────────────────── */}
      {mode === 'url' && step === 1 && (
        <div>
          <div className="flex flex-col gap-4 mb-6">
            <label className="flex flex-col gap-1.5">
              <span className="font-sans font-semibold uppercase text-rd-text2" style={{ fontSize: 11, letterSpacing: '0.08em' }}>Video URL</span>
              <input value={pastedUrl} onChange={e => setPastedUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@user/video/…" className="rounded-xl font-mono"
                style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.10)', padding: '12px 14px', color: '#F0EFF8', fontSize: 13, outline: 'none' }} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-sans font-semibold uppercase text-rd-text2" style={{ fontSize: 11, letterSpacing: '0.08em' }}>Title (optional)</span>
              <input value={urlTitle} onChange={e => setUrlTitle(e.target.value)} placeholder="Video title"
                className="rounded-xl font-sans"
                style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', color: '#F0EFF8', fontSize: 14, outline: 'none' }} />
            </label>
          </div>
          {pastedUrl && detectPlatform(pastedUrl) && (
            <div className="inline-flex items-center gap-2 rounded-full mb-6 font-mono"
              style={{ padding: '5px 12px', background: 'rgba(14,210,160,0.10)', border: '1px solid rgba(14,210,160,0.20)', color: '#0ED2A0', fontSize: 12 }}>
              <PlatformDot id={detectPlatform(pastedUrl) as PlatformId} size={18} radius={4} />
              Detected: <strong className="capitalize">{detectPlatform(pastedUrl)}</strong>
              {detectPlatform(pastedUrl) === 'tiktok' && <span className="text-rd-text2"> · Watermark-free</span>}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setMode(null); setStep(0); }} className="rounded-full font-sans"
              style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
            <button onClick={handleUrlSubmit} disabled={!pastedUrl.trim()}
              className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
              style={{ padding: '10px 24px', background: pastedUrl.trim() ? '#6C47FF' : 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', cursor: pastedUrl.trim() ? 'pointer' : 'not-allowed', fontSize: 14 }}>
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Select: source platform ──────────────────────────────────────────── */}
      {mode === 'select' && step === 0 && (
        <div>
          <div className="font-sans text-rd-text2 mb-5" style={{ fontSize: 13 }}>Which platform has the video?</div>
          <div className="flex gap-3 mb-6">
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => { setSource(p); loadVideos(p); setStep(1); }}
                className="flex-1 flex flex-col items-center gap-2.5 rounded-2xl font-sans font-medium transition-all"
                style={{ padding: '20px 16px', background: '#0F0F17', border: `1px solid ${source === p ? '#6C47FF' : 'rgba(255,255,255,0.07)'}`, color: '#F0EFF8', cursor: 'pointer', fontSize: 14 }}>
                <PlatformDot id={p} size={32} radius={8} />
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <button onClick={() => setMode(null)} className="rounded-full font-sans"
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        </div>
      )}

      {/* ── Select: pick video ───────────────────────────────────────────────── */}
      {mode === 'select' && step === 1 && (
        <div>
          <div className="font-sans text-rd-text2 mb-5" style={{ fontSize: 13 }}>Select a video from your <strong className="text-rd-text capitalize">{source}</strong> account.</div>
          {loadingVideos ? (
            <div className="text-center py-10 font-sans text-rd-text2">Loading…</div>
          ) : videos.length === 0 ? (
            <div className="text-center py-10">
              <div className="font-sans text-rd-text2 mb-2" style={{ fontSize: 14 }}>No videos found.</div>
              {source === 'tiktok' && (
                <button onClick={() => { setMode('url'); setStep(1); }} className="font-sans text-rd-purple" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                  Paste a TikTok URL instead →
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(2,1fr)', maxHeight: 380, overflowY: 'auto' }}>
              {videos.map(v => (
                <div key={v.id} onClick={() => { setSelectedVideo(v); setStep(2); }}
                  className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                  style={{ background: '#0F0F17', border: `1px solid ${selectedVideo?.id === v.id ? '#6C47FF' : 'rgba(255,255,255,0.07)'}` }}>
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full object-cover" style={{ aspectRatio: '16/9' }} />}
                  <div style={{ padding: '10px 12px' }}>
                    <div className="font-sans text-rd-text" style={{ fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{v.title}</div>
                    <div className="font-mono text-rd-text2 mt-1" style={{ fontSize: 10 }}>{new Date(v.publishedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setStep(0)} className="rounded-full font-sans"
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        </div>
      )}

      {/* ── Destinations ─────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <div className="font-sans text-rd-text mb-1" style={{ fontSize: 14 }}>
            Where should <strong>"{selectedVideo?.title?.slice(0, 50)}"</strong> be posted?
          </div>
          <div className="font-sans text-rd-text2 mb-6" style={{ fontSize: 12 }}>Select one or more destinations — cannot repeat the source.</div>
          <div className="flex gap-3 mb-7">
            {PLATFORMS.filter(p => p !== source).map(p => {
              const active = destinations.includes(p);
              return (
                <button key={p} onClick={() => toggleDest(p)}
                  className="flex-1 flex flex-col items-center gap-2.5 rounded-2xl font-sans font-medium transition-all"
                  style={{ padding: '20px 16px', background: active ? 'rgba(108,71,255,0.12)' : '#0F0F17', border: `1px solid ${active ? '#6C47FF' : 'rgba(255,255,255,0.07)'}`, color: active ? '#8B6AFF' : 'rgba(240,239,248,0.60)', cursor: 'pointer', fontSize: 14 }}>
                  <PlatformDot id={p} size={32} radius={8} />
                  {PLATFORM_LABELS[p]}
                  {active && <span className="font-mono" style={{ fontSize: 9 }}>✓ selected</span>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(mode === 'url' ? 1 : 1)} className="rounded-full font-sans"
              style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
            <button onClick={() => setStep(3)} disabled={!destinations.length}
              className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
              style={{ padding: '10px 24px', background: destinations.length ? '#6C47FF' : 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', cursor: destinations.length ? 'pointer' : 'not-allowed', fontSize: 14 }}>
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Schedule ─────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <div className="font-sans text-rd-text2 mb-6" style={{ fontSize: 13 }}>When should this repost go out?</div>
          <div className="mb-7">
            <SchedulePicker value={schedule || undefined} onChange={iso => setSchedule(iso || '')} label="Schedule for later" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="rounded-full font-sans"
              style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
            <button onClick={submit} disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
              style={{ padding: '10px 28px', background: '#6C47FF', color: '#fff', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, opacity: submitting ? 0.6 : 1, boxShadow: '0 0 20px rgba(108,71,255,0.30)' }}>
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Queuing…</> : schedule ? 'Schedule repost →' : 'Post now →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
