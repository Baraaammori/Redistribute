import { useState, useEffect, useCallback } from 'react';
import { Repeat2, CheckCircle, Loader2, AlertCircle, Clock, RefreshCw, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { PlatformDot, PlatformId } from '../../components/ui/PlatformDot';

import { Toggle } from '../../components/ui/Toggle';

interface AutoJob {
  id: string;
  source_platform: string;
  video_title: string;
  target_platforms: string[];
  status: 'pending' | 'processing' | 'done' | 'failed';
  error_message?: string;
  triggered_at: string;
  completed_at?: string;
}

interface AccStatus {
  platform: string;
  auto_republish_enabled: boolean;
  auto_republish_targets: string[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:    { label: 'Pending',    color: '#F5A623', bg: 'rgba(245,166,35,0.12)',  icon: <Clock     size={11} /> },
  processing: { label: 'Processing', color: '#4F8EF0', bg: 'rgba(79,142,240,0.12)', icon: <Loader2   size={11} className="animate-spin" /> },
  done:       { label: 'Done',       color: '#0ED2A0', bg: 'rgba(14,210,160,0.12)', icon: <CheckCircle size={11} /> },
  failed:     { label: 'Failed',     color: '#F04F4F', bg: 'rgba(240,79,79,0.12)',  icon: <AlertCircle size={11} /> },
};

const PLATFORM_IDS: Record<string, PlatformId> = {
  youtube: 'youtube', tiktok: 'tiktok', instagram: 'instagram',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram',
};

export default function AutoRepublish() {
  const [jobs, setJobs]       = useState<AutoJob[]>([]);
  const [accounts, setAccounts] = useState<AccStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      api.autoRepublish.activity(),
      api.accounts.autoRepublishStatus()
    ])
      .then(([ { jobs: j }, accs ]) => { setJobs(j); setAccounts(accs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);


  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleToggleAccount = async (platform: string, enabled: boolean) => {
    const acc = accounts.find(a => a.platform === platform);
    if (!acc) return;
    const prev = acc.auto_republish_enabled;
    setAccounts(arr => arr.map(a => a.platform === platform ? { ...a, auto_republish_enabled: enabled } : a));
    try {
      await api.autoRepublish.setSettings(platform, { enabled, targets: acc.auto_republish_targets || [] });
    } catch {
      setAccounts(arr => arr.map(a => a.platform === platform ? { ...a, auto_republish_enabled: prev } : a));
    }
  };

  const handleToggleTarget = async (platform: string, targetPlatform: string) => {
    const acc = accounts.find(a => a.platform === platform);
    if (!acc) return;
    const targets = acc.auto_republish_targets || [];
    const currentlyHas = targets.includes(targetPlatform);
    const newTargets = currentlyHas 
      ? targets.filter(t => t !== targetPlatform)
      : [...targets, targetPlatform];

    const prevTargets = targets;
    setAccounts(arr => arr.map(a => a.platform === platform ? { ...a, auto_republish_targets: newTargets } : a));
    try {
      await api.autoRepublish.setSettings(platform, { enabled: acc.auto_republish_enabled, targets: newTargets });
    } catch {
      setAccounts(arr => arr.map(a => a.platform === platform ? { ...a, auto_republish_targets: prevTargets } : a));
    }
  };

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId);
    try { await api.autoRepublish.retry(jobId); await load(true); }
    catch {} finally { setRetrying(null); }
  };

  const now   = new Date();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const doneThisMonth = jobs.filter(j => j.status === 'done' && new Date(j.triggered_at) >= month).length;
  const lastActivity  = jobs[0]?.triggered_at;

  const stats = [
    { label: 'Auto-republished this month', value: String(doneThisMonth), icon: Zap },
    { label: 'Total auto jobs',             value: String(jobs.length),   icon: Repeat2 },
    { label: 'Last activity',               value: lastActivity ? timeAgo(lastActivity) : '—', icon: Clock },
  ];

  return (
    <div className="p-10" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Repeat2 size={22} className="text-rd-purple" />
        <h1 className="font-display font-extrabold text-rd-text m-0" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>
          Auto-Republish Activity
        </h1>
      </div>
      <p className="font-sans text-rd-text2 mt-1 mb-8" style={{ fontSize: 13 }}>
        Videos automatically detected and redistributed from your connected platforms.
      </p>

      {/* Stats */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px' }}>
            <div className="flex items-center justify-center rounded-xl mb-4" style={{ width: 36, height: 36, background: 'rgba(108,71,255,0.12)' }}>
              <Icon size={16} className="text-rd-purple" />
            </div>
            <div className="font-display font-extrabold text-rd-text mb-1" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>{value}</div>
            <div className="font-sans text-rd-text2" style={{ fontSize: 11 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Settings */}
      {accounts.length > 0 && (
        <div className="rounded-2xl mb-8" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px' }}>
          <div className="flex items-center gap-2 mb-5">
            <Repeat2 size={14} className="text-rd-purple" />
            <span className="font-display font-bold text-rd-text" style={{ fontSize: 15 }}>Auto-Republish Settings</span>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {accounts.map(acc => {
              const pid = PLATFORM_IDS[acc.platform];
              if (!pid) return null;
              return (
                <div key={acc.platform} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <PlatformDot id={pid} size={28} radius={8} />
                      <span className="font-sans font-semibold text-rd-text" style={{ fontSize: 14 }}>{PLATFORM_LABELS[acc.platform] || acc.platform}</span>
                    </div>
                    <Toggle on={acc.auto_republish_enabled} onChange={(v) => handleToggleAccount(acc.platform, v)} />
                  </div>
                  {acc.auto_republish_enabled && (
                    <div>
                      <div className="font-sans text-rd-text2 uppercase mb-2" style={{ fontSize: 10, letterSpacing: '0.08em' }}>Distribute to:</div>
                      <div className="flex gap-2 flex-wrap">
                        {accounts.filter(a => a.platform !== acc.platform).map(target => {
                          const tPid = PLATFORM_IDS[target.platform];
                          const isSelected = (acc.auto_republish_targets || []).includes(target.platform);
                          return (
                            <button
                              key={target.platform}
                              onClick={() => handleToggleTarget(acc.platform, target.platform)}
                              className="flex items-center gap-1.5 rounded-lg transition-all"
                              style={{
                                padding: '6px 10px',
                                background: isSelected ? 'rgba(108,71,255,0.15)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${isSelected ? '#8B6AFF' : 'rgba(255,255,255,0.08)'}`,
                                color: isSelected ? '#F0EFF8' : 'rgba(240,239,248,0.40)',
                                cursor: 'pointer',
                              }}
                            >
                              <PlatformDot id={tPid} size={14} radius={4} />
                              <span className="font-sans" style={{ fontSize: 11, fontWeight: isSelected ? 600 : 400 }}>{PLATFORM_LABELS[target.platform]}</span>
                            </button>
                          );
                        })}
                        {accounts.length <= 1 && (
                          <div className="font-sans text-rd-text2" style={{ fontSize: 12 }}>Connect more accounts to distribute.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="rounded-2xl" style={{ background: '#0F0F17', border: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-rd-purple" />
            <span className="font-display font-bold text-rd-text" style={{ fontSize: 15 }}>Activity feed</span>
          </div>
          <button onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-full font-sans"
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,239,248,0.40)', cursor: 'pointer', fontSize: 12 }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 font-sans text-rd-text2" style={{ fontSize: 14 }}>Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Repeat2 size={32} color="rgba(240,239,248,0.08)" style={{ margin: '0 auto 10px' }} />
            <div className="font-sans text-rd-text2 mb-1.5" style={{ fontSize: 14 }}>No auto-republish activity yet.</div>
            <div className="font-sans" style={{ fontSize: 12, color: 'rgba(240,239,248,0.20)' }}>
              Enable auto-republish on a platform in <strong style={{ color: 'rgba(139,106,255,0.60)' }}>Accounts</strong> to get started.
            </div>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid font-sans font-semibold uppercase text-rd-text2 pb-3 px-1 mb-1"
              style={{ gridTemplateColumns: '36px 1fr 140px 110px 90px 80px', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10, letterSpacing: '0.06em' }}>
              {['', 'Video', 'Distributed to', 'Status', 'Time', ''].map((h, i) => <div key={i}>{h}</div>)}
            </div>

            {jobs.map(j => {
              const sc = STATUS_CONFIG[j.status] || STATUS_CONFIG.pending;
              const srcId = PLATFORM_IDS[j.source_platform];
              return (
                <div key={j.id} className="grid items-center px-1 py-3"
                  style={{ gridTemplateColumns: '36px 1fr 140px 110px 90px 80px', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Source */}
                  <div>{srcId && <PlatformDot id={srcId} size={28} radius={6} />}</div>

                  {/* Title */}
                  <div className="font-sans text-rd-text truncate" style={{ fontSize: 13 }}>{j.video_title || 'Untitled'}</div>

                  {/* Targets */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(j.target_platforms || []).map(t => {
                      const tid = PLATFORM_IDS[t];
                      return tid ? <PlatformDot key={t} id={tid} size={22} radius={5} /> : null;
                    })}
                  </div>

                  {/* Status badge */}
                  <div className="inline-flex items-center gap-1.5 rounded-full font-mono font-bold"
                    style={{ padding: '4px 10px', background: sc.bg, color: sc.color, fontSize: 10, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {sc.icon} {sc.label.toUpperCase()}
                  </div>

                  {/* Time */}
                  <div className="font-mono text-rd-text2" style={{ fontSize: 11 }}>{timeAgo(j.triggered_at)}</div>

                  {/* Retry */}
                  <div>
                    {j.status === 'failed' && (
                      <button disabled={retrying === j.id} onClick={() => handleRetry(j.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg font-sans"
                        style={{ padding: '5px 10px', background: 'rgba(108,71,255,0.12)', border: '1px solid rgba(108,71,255,0.25)', color: '#8B6AFF', cursor: retrying === j.id ? 'not-allowed' : 'pointer', fontSize: 11, opacity: retrying === j.id ? 0.5 : 1 }}>
                        {retrying === j.id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
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
    </div>
  );
}
