import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Film, Trash2, ExternalLink, Search, ArrowRight, CheckCircle, Plus, ChevronLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { PlatformDot, PlatformId } from '../../components/ui/PlatformDot';
import { StatusBadge } from '../../components/ui/StatusBadge';

function formatDuration(seconds: number): string {
  if (!seconds) return '–';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const PLATFORM_IDS: Record<string, PlatformId> = {
  youtube: 'youtube', youtube_shorts: 'youtube', tiktok: 'tiktok', instagram: 'instagram',
};

// ── Detail view ───────────────────────────────────────────────────────────────
function DetailView({ v, onBack, onRefresh }: { v: any; onBack: () => void; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [reposting, setReposting] = useState('');

  const deleteVideo = async () => {
    if (!window.confirm('Delete this video and all its clips?')) return;
    await api.upload.delete(v.id);
    onBack();
    onRefresh();
  };

  const approveClip = async (clipId: string) => { await api.upload.approveClip(clipId); onRefresh(); };
  const deleteClip  = async (clipId: string) => { await api.upload.deleteClip(clipId); onRefresh(); };

  const repost = async (platform: string) => {
    setReposting(platform);
    try {
      await api.reposts.create({ sourceVideoId: v.id, sourceVideoUrl: v.file_url, sourcePlatform: 'library', title: v.title, thumbnailUrl: v.thumbnail_url, destinations: [platform], scheduledFor: null });
      navigate('/dashboard/queue');
    } catch (e: any) { alert(e.message); }
    finally { setReposting(''); }
  };

  return (
    <div className="p-10">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 font-sans rounded-full mb-7"
        style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 12 }}>
        <ChevronLeft size={12} /> Library
      </button>

      {/* Header */}
      <div className="flex gap-5 mb-8">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" className="rounded-xl object-cover flex-shrink-0" style={{ width: 200, height: 112 }} />
        ) : (
          <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 200, height: 112, background: '#0F0F17' }}>
            <Film size={28} color="rgba(240,239,248,0.10)" />
          </div>
        )}
        <div>
          <h2 className="font-display font-extrabold text-rd-text m-0 mb-3" style={{ fontSize: 22, letterSpacing: '-0.03em' }}>{v.title}</h2>
          <div className="flex gap-3 flex-wrap items-center mb-2">
            <StatusBadge status={v.status} />
            <span className="font-mono text-rd-text2" style={{ fontSize: 11 }}>{formatDuration(v.duration_seconds)}</span>
            {v.orientation && <span className="font-mono text-rd-text2" style={{ fontSize: 11 }}>{v.orientation}</span>}
          </div>
          {v.smart_decision?.reason && (
            <div className="font-sans text-rd-purple/70" style={{ fontSize: 12, lineHeight: 1.5 }}>{v.smart_decision.reason}</div>
          )}
        </div>
      </div>

      {/* Clips */}
      {v.clips?.length > 0 && (
        <div className="mb-8">
          <h3 className="font-display font-bold text-rd-text mb-4" style={{ fontSize: 15 }}>Generated clips ({v.clips.length})</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {v.clips.map((clip: any) => (
              <div key={clip.id} className="rounded-2xl" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: 16 }}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-sans text-rd-text" style={{ fontSize: 13 }}>{clip.title || 'Clip'}</span>
                  <StatusBadge status={clip.status} />
                </div>
                <div className="font-mono text-rd-text2 mb-3" style={{ fontSize: 10 }}>
                  {formatDuration(clip.start_time)} → {formatDuration(clip.end_time)} &nbsp;·&nbsp; {formatDuration(clip.duration_seconds)}
                </div>
                {clip.file_url && (
                  <video src={clip.file_url} controls preload="metadata"
                    className="w-full rounded-xl mb-3" style={{ maxHeight: 130, background: '#000' }} />
                )}
                <div className="flex gap-2">
                  {clip.status === 'generated' && (
                    <button onClick={() => approveClip(clip.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg font-sans"
                      style={{ padding: '6px 10px', background: 'rgba(14,210,160,0.12)', border: '1px solid rgba(14,210,160,0.25)', color: '#0ED2A0', cursor: 'pointer', fontSize: 11 }}>
                      <CheckCircle size={11} /> Approve
                    </button>
                  )}
                  <button onClick={() => deleteClip(clip.id)}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 30, height: 30, background: 'rgba(240,79,79,0.10)', border: '1px solid rgba(240,79,79,0.20)', color: '#F04F4F', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distributions */}
      {v.distributions?.length > 0 && (
        <div className="mb-8">
          <h3 className="font-display font-bold text-rd-text mb-4" style={{ fontSize: 15 }}>Distribution status</h3>
          <div className="flex flex-col gap-2">
            {v.distributions.map((d: any) => (
              <div key={d.id} className="flex items-center gap-4 rounded-2xl"
                style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px' }}>
                <PlatformDot id={PLATFORM_IDS[d.platform] || 'youtube'} size={28} radius={6} />
                <div className="flex-1">
                  <div className="font-sans text-rd-text capitalize" style={{ fontSize: 13 }}>{d.platform.replace('_', ' ')}</div>
                  <div className="font-mono text-rd-text2" style={{ fontSize: 11 }}>{d.upload_type} upload</div>
                </div>
                <StatusBadge status={d.status} />
                {d.platform_url && (
                  <a href={d.platform_url} target="_blank" rel="noreferrer" className="text-rd-purple">
                    <ExternalLink size={14} />
                  </a>
                )}
                {d.error && <div className="font-mono text-rd-red" style={{ fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {(['tiktok', 'youtube'] as const).map(p => (
          <button key={p} onClick={() => repost(p)} disabled={reposting === p}
            className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
            style={{
              padding: '9px 18px', background: '#0F0F17', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(240,239,248,0.70)', cursor: reposting === p ? 'not-allowed' : 'pointer', fontSize: 13,
            }}>
            <PlatformDot id={p} size={20} radius={4} />
            {reposting === p ? 'Queuing…' : `Repost to ${p === 'youtube' ? 'YouTube' : 'TikTok'}`}
          </button>
        ))}
        <button onClick={deleteVideo}
          className="inline-flex items-center gap-2 rounded-full font-sans"
          style={{ padding: '9px 18px', background: 'rgba(240,79,79,0.08)', border: '1px solid rgba(240,79,79,0.20)', color: '#F04F4F', cursor: 'pointer', fontSize: 13 }}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VideoLibrary() {
  const [videos, setVideos]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<any>(null);
  const [search, setSearch]         = useState('');

  const load = () => {
    setLoading(true);
    api.upload.list().then(setVideos).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const viewDetail = async (id: string) => {
    try { setSelected(await api.upload.get(id)); } catch {}
  };

  const refresh = async () => {
    if (selected) { try { setSelected(await api.upload.get(selected.id)); } catch {} }
  };

  if (selected) return <DetailView v={selected} onBack={() => setSelected(null)} onRefresh={refresh} />;

  const filtered = videos.filter(v => !search || v.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-rd-text m-0 mb-1" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>Video library</h1>
          <p className="font-sans text-rd-text2 m-0" style={{ fontSize: 13 }}>All your uploads and generated clips</p>
        </div>
        <Link to="/dashboard/upload"
          className="inline-flex items-center gap-2 rounded-full font-sans font-medium"
          style={{ padding: '10px 20px', background: '#6C47FF', color: '#fff', textDecoration: 'none', fontSize: 14, boxShadow: '0 0 20px rgba(108,71,255,0.30)' }}>
          <Plus size={14} /> Upload new
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 font-sans text-rd-text2" style={{ fontSize: 14 }}>Loading…</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16">
          <Film size={36} color="rgba(240,239,248,0.10)" style={{ margin: '0 auto 12px' }} />
          <div className="font-sans text-rd-text2 mb-3" style={{ fontSize: 14 }}>No uploads yet</div>
          <Link to="/dashboard/upload" className="font-sans text-rd-purple" style={{ fontSize: 13, textDecoration: 'none' }}>Upload your first video →</Link>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-5">
            <Search size={14} className="absolute text-rd-text2" style={{ left: 14, top: 12 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search videos…"
              className="w-full rounded-xl font-sans"
              style={{ paddingLeft: 38, paddingRight: 14, paddingTop: 10, paddingBottom: 10, background: '#0F0F17', border: '1px solid rgba(255,255,255,0.07)', color: '#F0EFF8', fontSize: 13, outline: 'none' }} />
          </div>

          <div className="flex flex-col gap-2">
            {filtered.map(v => (
              <div key={v.id} onClick={() => viewDetail(v.id)}
                className="flex items-center gap-4 rounded-2xl cursor-pointer transition-all"
                style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(108,71,255,0.30)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}>
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" className="rounded-lg object-cover flex-shrink-0" style={{ width: 80, height: 46 }} />
                ) : (
                  <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 80, height: 46, background: 'rgba(255,255,255,0.03)' }}>
                    <Film size={16} color="rgba(240,239,248,0.15)" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-sans text-rd-text truncate" style={{ fontSize: 14 }}>{v.title}</div>
                  <div className="font-mono text-rd-text2 mt-0.5 flex gap-3" style={{ fontSize: 11 }}>
                    {v.duration_seconds && <span>{formatDuration(v.duration_seconds)}</span>}
                    <span>{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <StatusBadge status={v.status} />
                <ArrowRight size={14} color="rgba(240,239,248,0.15)" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
