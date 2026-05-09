import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Send, Repeat, Check, AlertTriangle,
  Clock, Zap, RefreshCw, TrendingUp, PlusCircle, ArrowRight,
  Wifi, WifiOff,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Sidebar } from '../../components/ui/Sidebar';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Btn } from '../../components/ui/Btn';
import { Thumb } from '../../components/ui/Thumb';
import { PlatformDot, PlatformId } from '../../components/ui/PlatformDot';
import NewRepost     from './NewRepost';
import AutoRepublish from './AutoRepublish';
import SettingsPage  from './Settings';

/* ── helpers ────────────────────────────────────────────────────────────────── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/* ── Overview page ─────────────────────────────────────────────────────────── */
function Overview() {
  const navigate = useNavigate();
  const [stats, setStats]     = useState({ reposts: 0, completed: 0, failed: 0, pending: 0 });
  const [recentReposts, setRecentReposts] = useState<any[]>([]);
  const [bestTime, setBestTime] = useState<string | null>(null);
  const [autoActive, setAutoActive] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    api.reposts.list().then((rs: any[]) => {
      setRecentReposts(rs.slice(0, 5));
      setStats({
        reposts:   rs.length,
        completed: rs.filter((r: any) => r.status === 'done').length,
        failed:    rs.filter((r: any) => r.status === 'failed').length,
        pending:   rs.filter((r: any) => r.status === 'pending' || r.status === 'processing').length,
      });
    }).catch(() => {});
    api.bestTime.get().then((d: any) => d?.best_hour != null && setBestTime(`${d.best_hour}:00`)).catch(() => {});
    api.accounts.autoRepublishStatus().then((arr: any[]) => setAutoActive(arr.some((a: any) => a.auto_republish_enabled))).catch(() => {});
    api.accounts.list().then((d: any[]) => setAccounts(d ?? [])).catch(() => {});
  }, []);

  const HUE_MAP: Record<string, string> = { done: 'teal', processing: 'blue', failed: 'pink', pending: 'amber' };
  const PLATFORMS: PlatformId[] = ['youtube', 'tiktok', 'instagram'];

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-8">

        {/* Welcome banner */}
        <div
          className="relative rounded-2xl overflow-hidden animate-enter"
          style={{
            background: 'linear-gradient(135deg, rgba(108,71,255,0.12) 0%, rgba(14,210,160,0.06) 100%)',
            border: '1px solid rgba(108,71,255,0.18)',
            padding: '28px 32px',
          }}
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 0% 0%, rgba(108,71,255,0.15), transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(14,210,160,0.08), transparent 60%)',
          }} />
          <div className="relative flex items-center justify-between gap-6">
            <div>
              <div className="font-sans font-medium" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)', marginBottom: 6 }}>
                {formatDate()}
              </div>
              <h1 className="font-display font-extrabold m-0" style={{ fontSize: 30, letterSpacing: '-0.04em', color: '#F0EFF8', lineHeight: 1.1 }}>
                {getGreeting()} <span className="text-gradient-brand">— let's distribute.</span>
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <StatusBadge status="pro" />
                {autoActive && (
                  <span
                    className="inline-flex items-center gap-1.5 font-sans font-medium rounded-full"
                    style={{ fontSize: 12, color: '#0ED2A0', background: 'rgba(14,210,160,0.10)', padding: '3px 10px 3px 8px' }}
                  >
                    <span className="rounded-full animate-pulse2" style={{ width: 5, height: 5, background: '#0ED2A0', flexShrink: 0 }} />
                    Auto-republish active
                  </span>
                )}
              </div>
            </div>
            <Btn kind="primary" icon={PlusCircle} onClick={() => navigate('/dashboard/repost')}>
              New Repost
            </Btn>
          </div>
        </div>

        {/* Platform health row */}
        <div>
          <div className="font-sans font-semibold uppercase mb-3" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(240,239,248,0.30)' }}>
            Platform connections
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {PLATFORMS.map((pid, i) => {
              const acc = accounts.find((a: any) => a.platform === pid);
              const connected = !!acc && acc.status !== 'paused' && !acc.token_expired;
              const expired = acc?.status === 'paused' || acc?.token_expired;
              return (
                <div
                  key={pid}
                  className="flex items-center gap-3 rounded-xl animate-enter card-hover cursor-pointer"
                  style={{
                    background: '#0F0F17',
                    border: `1px solid ${connected ? 'rgba(14,210,160,0.18)' : expired ? 'rgba(245,166,35,0.20)' : 'rgba(255,255,255,0.07)'}`,
                    padding: '14px 16px',
                    animationDelay: `${i * 60}ms`,
                  }}
                  onClick={() => navigate('/dashboard/accounts')}
                >
                  <PlatformDot id={pid} size={38} radius={10} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans font-semibold" style={{ fontSize: 13, color: '#F0EFF8', textTransform: 'capitalize' }}>{pid}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {connected ? (
                        <>
                          <span className="rounded-full animate-pulse2" style={{ width: 5, height: 5, background: '#0ED2A0', flexShrink: 0 }} />
                          <span className="font-mono" style={{ fontSize: 10, color: '#0ED2A0' }}>Connected</span>
                        </>
                      ) : expired ? (
                        <>
                          <span className="rounded-full" style={{ width: 5, height: 5, background: '#F5A623', flexShrink: 0 }} />
                          <span className="font-mono" style={{ fontSize: 10, color: '#F5A623' }}>Token expired</span>
                        </>
                      ) : (
                        <>
                          <span className="rounded-full" style={{ width: 5, height: 5, background: 'rgba(240,239,248,0.20)', flexShrink: 0 }} />
                          <span className="font-mono" style={{ fontSize: 10, color: 'rgba(240,239,248,0.30)' }}>Not connected</span>
                        </>
                      )}
                    </div>
                  </div>
                  {connected ? (
                    <Wifi size={14} style={{ color: '#0ED2A0', flexShrink: 0 }} />
                  ) : (
                    <WifiOff size={14} style={{ color: 'rgba(240,239,248,0.20)', flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-3 stagger" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <StatCard icon={Repeat}        color="#6C47FF" colorBg="rgba(108,71,255,0.12)" value={stats.reposts}   label="Total reposts" delay={0}   />
          <StatCard icon={Clock}         color="#F5A623" colorBg="rgba(245,166,35,0.10)" value={stats.pending}   label="In queue"      delay={60}  />
          <StatCard icon={Check}         color="#0ED2A0" colorBg="rgba(14,210,160,0.10)" value={stats.completed} label="Completed"     delay={120} />
          <StatCard icon={TrendingUp}    color="#4F8EF0" colorBg="rgba(79,142,240,0.10)" value={stats.reposts > 0 ? `${Math.round((stats.completed / Math.max(stats.reposts, 1)) * 100)}%` : '—'} label="Success rate" delay={180} />
        </div>

        {/* Two columns */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.45fr 1fr' }}>

          {/* Recent reposts feed */}
          <Card padding={0} className="flex flex-col animate-enter" style={{ animationDelay: '120ms' }}>
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-2">
                <Repeat size={14} style={{ color: 'rgba(240,239,248,0.40)' }} />
                <span className="font-sans font-semibold" style={{ fontSize: 13, color: '#F0EFF8' }}>Recent reposts</span>
              </div>
              <button
                onClick={() => navigate('/dashboard/queue')}
                className="font-sans flex items-center gap-1 rounded-lg"
                style={{ background: 'none', border: 'none', color: 'rgba(240,239,248,0.40)', fontSize: 12, cursor: 'pointer', padding: '4px 8px', transition: 'color 150ms ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B6AFF'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,239,248,0.40)'; }}
              >
                View queue <ArrowRight size={11} />
              </button>
            </div>
            {recentReposts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div
                  className="flex items-center justify-center rounded-2xl animate-float"
                  style={{ width: 52, height: 52, background: 'rgba(108,71,255,0.10)', border: '1px solid rgba(108,71,255,0.16)' }}
                >
                  <Repeat size={22} style={{ color: 'rgba(108,71,255,0.60)' }} />
                </div>
                <div className="text-center">
                  <div className="font-sans font-medium" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>No reposts yet</div>
                  <div className="font-sans mt-1" style={{ fontSize: 12, color: 'rgba(240,239,248,0.25)' }}>Create your first repost to get started</div>
                </div>
                <Btn kind="soft" size="sm" icon={PlusCircle} onClick={() => navigate('/dashboard/repost')}>New repost</Btn>
              </div>
            ) : (
              <div className="stagger">
                {recentReposts.map((r: any) => {
                  const HUE: Record<string, string> = { done: 'teal', processing: 'blue', failed: 'pink', pending: 'amber', scheduled: 'purple' };
                  const dests: PlatformId[] = (r.destinations || []) as PlatformId[];
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3.5 px-5 py-3 animate-enter"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 150ms ease' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <Thumb w={60} h={36} hue={(HUE[r.status] || 'slate') as any} r={6} />
                      <div className="flex-1 min-w-0">
                        <div className="font-sans font-medium truncate" style={{ fontSize: 13, color: '#F0EFF8' }}>{r.title || r.source_video_url}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {dests.map((p: PlatformId) => <PlatformDot key={p} id={p} size={16} radius={4} />)}
                          <span className="font-mono" style={{ fontSize: 10, color: 'rgba(240,239,248,0.25)' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <StatusBadge status={r.status as any} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Best time to post */}
          <Card padding={0} className="flex flex-col animate-enter" style={{ animationDelay: '180ms' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2">
                <TrendingUp size={14} style={{ color: 'rgba(240,239,248,0.40)' }} />
                <div className="font-sans font-semibold" style={{ fontSize: 13, color: '#F0EFF8' }}>Best time to post</div>
              </div>
              <div className="font-sans mt-1" style={{ fontSize: 12, color: 'rgba(240,239,248,0.40)' }}>
                Peak audience engagement window
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-4 p-5">
              <div>
                <div className="font-display font-extrabold leading-none" style={{ fontSize: 38, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
                  {bestTime ?? '7:00'}{' '}
                  <span className="font-semibold" style={{ fontSize: 20, color: 'rgba(240,239,248,0.40)' }}>PM</span>
                </div>
                <div className="font-sans mt-2" style={{ fontSize: 12, color: 'rgba(240,239,248,0.35)' }}>Based on last 30 days of engagement data</div>
              </div>
              <div className="flex items-end gap-1" style={{ height: 80 }}>
                {[12, 18, 22, 28, 34, 40, 52, 68, 84, 100, 92, 76, 58, 44, 32].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm animate-bar-grow"
                    style={{
                      height: `${h}%`,
                      background: i === 9
                        ? 'linear-gradient(180deg, #8B6AFF, #6C47FF)'
                        : i === 8 || i === 10
                        ? 'rgba(108,71,255,0.40)'
                        : 'rgba(108,71,255,0.14)',
                      animationDelay: `${i * 25}ms`,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between font-mono" style={{ fontSize: 10, color: 'rgba(240,239,248,0.25)' }}>
                <span>9 AM</span><span>1 PM</span><span>5 PM</span><span>9 PM</span><span>1 AM</span>
              </div>
              <div
                className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                style={{ background: 'rgba(108,71,255,0.08)', border: '1px solid rgba(108,71,255,0.14)' }}
              >
                <Zap size={13} style={{ color: '#8B6AFF', flexShrink: 0 }} />
                <span className="font-sans" style={{ fontSize: 12, color: 'rgba(240,239,248,0.55)' }}>
                  Schedule posts at <strong style={{ color: '#F0EFF8' }}>{bestTime ?? '7:00'} PM</strong> for best reach
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

/* ── Queue page ─────────────────────────────────────────────────────────────── */
function QueuePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const HUE: Record<string, string> = { done: 'teal', processing: 'blue', pending: 'amber', failed: 'pink', scheduled: 'purple' };

  const load = () => {
    setLoading(true);
    api.reposts.list().then((d: any[]) => setJobs(d ?? [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pending    = jobs.filter(j => j.status === 'pending').length;
  const processing = jobs.filter(j => j.status === 'processing').length;
  const done       = jobs.filter(j => j.status === 'done').length;
  const failed     = jobs.filter(j => j.status === 'failed').length;

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 animate-enter">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: 38, height: 38, background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.18)' }}
              >
                <Clock size={18} style={{ color: '#F5A623' }} />
              </div>
              <h1 className="font-display font-extrabold m-0" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>Queue</h1>
            </div>
            <p className="font-sans m-0 mt-1" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>
              Live job status across every destination.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono" style={{ fontSize: 11, color: 'rgba(240,239,248,0.50)' }}>
              <span className="rounded-full animate-pulse2" style={{ width: 6, height: 6, background: '#0ED2A0', flexShrink: 0 }} />
              live
            </span>
            <Btn kind="ghost" size="sm" icon={RefreshCw} onClick={load}>Refresh</Btn>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 stagger" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <StatCard icon={Clock}         color="#F5A623" colorBg="rgba(245,166,35,0.10)"  value={pending}    label="Pending"    delay={0}   />
          <StatCard icon={Zap}           color="#4F8EF0" colorBg="rgba(79,142,240,0.10)"  value={processing} label="Processing" delay={60}  />
          <StatCard icon={Check}         color="#0ED2A0" colorBg="rgba(14,210,160,0.10)"  value={done}       label="Done today" delay={120} />
          <StatCard icon={AlertTriangle} color="#F04F4F" colorBg="rgba(240,79,79,0.10)"   value={failed}     label="Failed"     delay={180} />
        </div>

        {/* Job list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="rounded-full animate-spin" style={{ width: 24, height: 24, border: '2px solid rgba(108,71,255,0.20)', borderTopColor: '#6C47FF' }} />
            <span className="font-sans" style={{ fontSize: 13, color: 'rgba(240,239,248,0.25)' }}>Loading jobs…</span>
          </div>
        ) : jobs.length === 0 ? (
          <Card padding={0} animate={true} delay={200}>
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div
                className="flex items-center justify-center rounded-2xl animate-float"
                style={{ width: 56, height: 56, background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.16)' }}
              >
                <Clock size={24} style={{ color: 'rgba(245,166,35,0.50)' }} />
              </div>
              <div className="text-center">
                <div className="font-sans font-semibold" style={{ fontSize: 14, color: 'rgba(240,239,248,0.60)' }}>Queue is empty</div>
                <div className="font-sans mt-1" style={{ fontSize: 12, color: 'rgba(240,239,248,0.25)' }}>Jobs will appear here when you distribute videos</div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5 stagger">
            {jobs.map((j: any) => {
              const borderC = j.status === 'processing'
                ? 'rgba(79,142,240,0.30)'
                : j.status === 'failed'
                ? 'rgba(240,79,79,0.25)'
                : j.status === 'done'
                ? 'rgba(14,210,160,0.15)'
                : 'rgba(255,255,255,0.07)';

              const activePlatforms: PlatformId[] = (['youtube', 'tiktok', 'instagram'] as PlatformId[]).filter(
                p => j[`${p}_status`]
              );

              return (
                <div
                  key={j.id}
                  className="flex items-center gap-4 rounded-xl animate-enter card-hover"
                  style={{
                    background: '#0F0F17',
                    border: `1px solid ${borderC}`,
                    padding: '14px 18px',
                  }}
                >
                  <Thumb w={72} h={44} hue={(HUE[j.status] || 'slate') as any} r={8} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans font-medium truncate" style={{ fontSize: 13, color: '#F0EFF8' }}>
                      {j.title || j.source_video_url}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {activePlatforms.length > 0 && (
                        <div className="flex gap-1.5">
                          {activePlatforms.map(p => (
                            <PlatformDot key={p} id={p} size={18} radius={5} />
                          ))}
                        </div>
                      )}
                      <span className="font-mono" style={{ fontSize: 11, color: j.status === 'failed' ? '#F04F4F' : 'rgba(240,239,248,0.25)' }}>
                        {new Date(j.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <StatusBadge status={j.status as any} />
                    {j.status === 'failed' && (
                      <Btn kind="soft" size="sm" icon={RefreshCw}>Retry</Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Accounts page ──────────────────────────────────────────────────────────── */
function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.accounts.list().then((d: any[]) => setAccounts(d ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const connect = async (platform: string) => {
    try {
      const { url } = await api.accounts.authUrl(platform);
      window.location.href = url;
    } catch {}
  };

  const disconnect = async (id: string) => {
    try {
      await api.accounts.disconnect(id);
      setAccounts(a => a.filter(acc => acc.id !== id));
    } catch {}
  };

  const PLATFORM_LABELS: Record<string, string> = {
    youtube: 'YouTube',
    tiktok: 'TikTok',
    instagram: 'Instagram',
  };

  const PLATFORM_DESCS: Record<string, string> = {
    youtube: 'Upload videos to your YouTube channel automatically',
    tiktok: 'Distribute short clips to TikTok',
    instagram: 'Post Reels and videos to Instagram',
  };

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 animate-enter">
          <div>
            <h1 className="font-display font-extrabold m-0" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
              Connected accounts
            </h1>
            <p className="font-sans m-0 mt-2" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>
              Manage which platforms Redistribute can post to on your behalf.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="rounded-full animate-spin" style={{ width: 24, height: 24, border: '2px solid rgba(108,71,255,0.20)', borderTopColor: '#6C47FF' }} />
            <span className="font-sans" style={{ fontSize: 13, color: 'rgba(240,239,248,0.25)' }}>Loading accounts…</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 stagger">
            {(['youtube', 'tiktok', 'instagram'] as PlatformId[]).map((pid, i) => {
              const acc = accounts.find((a: any) => a.platform === pid);
              // Tokens are auto-refreshed by backend, so we consider it connected if the record exists
              const connected = !!acc;

              return (
                <div
                  key={pid}
                  className="relative rounded-2xl overflow-hidden animate-enter"
                  style={{
                    background: '#0F0F17',
                    border: `1px solid ${connected ? 'rgba(14,210,160,0.16)' : 'rgba(255,255,255,0.07)'}`,
                    animationDelay: `${i * 80}ms`,
                    transition: 'border-color 200ms ease',
                  }}
                >

                  {/* Ambient bg glow for connected */}
                  {connected && (
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: 'radial-gradient(ellipse at 100% 0%, rgba(14,210,160,0.04), transparent 50%)',
                    }} />
                  )}
                  <div className="relative flex items-center gap-5 p-6">
                    {/* Platform logo */}
                    <div className="relative flex-shrink-0">
                      <PlatformDot id={pid} size={52} radius={14} />
                      {connected && (
                        <div
                          className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
                          style={{ width: 16, height: 16, background: '#0ED2A0', border: '2px solid #0F0F17' }}
                        >
                          <Check size={8} color="#000" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-display font-bold" style={{ fontSize: 19, letterSpacing: '-0.02em', color: '#F0EFF8' }}>
                          {PLATFORM_LABELS[pid]}
                        </span>
                        {acc && <StatusBadge status="active" />}
                        {acc?.handle && (
                          <span className="font-mono" style={{ fontSize: 12, color: 'rgba(240,239,248,0.40)' }}>
                            @{acc.handle}
                          </span>
                        )}
                      </div>
                      <div className="font-sans mt-1.5" style={{ fontSize: 13, color: 'rgba(240,239,248,0.45)', lineHeight: 1.5 }}>
                        {acc ? `Connected · auto-publish enabled · ${PLATFORM_DESCS[pid]}` : PLATFORM_DESCS[pid]}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!acc ? (
                        <Btn kind="primary" size="sm" onClick={() => connect(pid)}>Connect</Btn>
                      ) : (
                        <>
                          <Btn kind="ghost" size="sm" onClick={() => navigate('/dashboard/settings')}>Settings</Btn>
                          <Btn kind="soft" size="sm" onClick={() => disconnect(acc.id)}>Disconnect</Btn>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Billing page ───────────────────────────────────────────────────────────── */
function BillingPage() {
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    api.auth.me().then((u: any) => setPlan(u)).catch(() => {});
  }, []);

  const handleUpgrade = async () => {
    try {
      const { url } = await api.stripe.checkout();
      window.location.href = url;
    } catch {}
  };

  const handlePortal = async () => {
    try {
      const { url } = await api.stripe.portal() as any;
      window.location.href = url;
    } catch {}
  };

  const isPro = plan?.plan_type === 'pro';

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 animate-enter">
          <div>
            <h1 className="font-display font-extrabold m-0" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>Billing</h1>
            <p className="font-sans m-0 mt-2" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>Plan, usage, and invoices.</p>
          </div>
          <Btn kind="ghost" size="sm" onClick={handlePortal}>Manage on Stripe ↗</Btn>
        </div>

        {/* Plan banner */}
        <div
          className="relative rounded-2xl overflow-hidden animate-enter"
          style={{ background: '#0F0F17', border: `1px solid ${isPro ? 'rgba(108,71,255,0.25)' : 'rgba(255,255,255,0.07)'}`, animationDelay: '60ms' }}
        >
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isPro
                ? 'radial-gradient(circle at 100% 0%, rgba(108,71,255,0.18), transparent 50%), radial-gradient(circle at 0% 100%, rgba(14,210,160,0.10), transparent 50%)'
                : 'radial-gradient(circle at 100% 0%, rgba(108,71,255,0.08), transparent 50%)',
            }}
          />

          <div className="relative flex items-center gap-6 px-7 py-7">
            <div className="flex-1">
              <div className="font-sans font-bold uppercase" style={{ fontSize: 11, color: 'rgba(240,239,248,0.30)', letterSpacing: '0.08em' }}>
                Current plan
              </div>
              <div className="flex items-center gap-3.5 mt-2.5">
                <span className="font-display font-extrabold" style={{ fontSize: 38, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
                  {isPro ? 'Pro' : 'Free'}
                </span>
                <StatusBadge status={isPro ? 'active' : 'trial'} />
                {isPro && (
                  <span className="font-mono" style={{ fontSize: 13, color: 'rgba(240,239,248,0.40)' }}>$12 / month</span>
                )}
              </div>
              {isPro && (
                <div className="font-sans mt-1.5" style={{ fontSize: 13, color: 'rgba(240,239,248,0.45)' }}>
                  Unlimited uploads · AI clips · Auto-Republish · Priority queue
                </div>
              )}
            </div>
            <div className="flex gap-2.5 flex-shrink-0">
              {!isPro ? (
                <Btn kind="primary" onClick={handleUpgrade}>Upgrade to Pro — $12/mo</Btn>
              ) : (
                <>
                  <Btn kind="ghost">Change plan</Btn>
                  <Btn kind="soft">Cancel</Btn>
                </>
              )}
            </div>
          </div>

          {isPro && (
            <div
              className="relative grid"
              style={{ gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              {[
                { label: 'Uploads this cycle',      used: plan?.uploads_used ?? 0,   total: '∞',     color: '#6C47FF', frac: 0.3 },
                { label: 'Auto-republish events',   used: plan?.reposts_used ?? 0,   total: '∞',     color: '#0ED2A0', frac: 0.2 },
                { label: 'Storage',                 used: `${((plan?.storage_used_bytes ?? 0) / 1e9).toFixed(1)} GB`, total: '50 GB', color: '#4F8EF0', frac: (plan?.storage_used_bytes ?? 0) / 50e9 },
              ].map((u, i) => (
                <div
                  key={i}
                  className="px-6 py-5"
                  style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  <div className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(240,239,248,0.30)' }}>
                    {u.label}
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="font-display font-extrabold" style={{ fontSize: 24, letterSpacing: '-0.03em', color: '#F0EFF8' }}>{u.used}</span>
                    <span className="font-mono" style={{ fontSize: 12, color: 'rgba(240,239,248,0.25)' }}>/ {u.total}</span>
                  </div>
                  <div className="mt-3 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="animate-bar-grow"
                      style={{ width: `${Math.min((u.frac ?? 0) * 100, 100)}%`, height: '100%', background: u.color, borderRadius: 999 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upgrade CTA for free users */}
        {!isPro && (
          <div
            className="rounded-2xl p-7 relative overflow-hidden animate-enter"
            style={{
              background: 'rgba(108,71,255,0.06)',
              border: '1px solid rgba(108,71,255,0.20)',
              animationDelay: '120ms',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(108,71,255,0.12), transparent 60%)' }}
            />
            <div className="relative">
              <div className="font-sans font-semibold uppercase mb-2" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#8B6AFF' }}>
                Upgrade
              </div>
              <h3 className="font-display font-bold m-0 mb-3" style={{ fontSize: 24, letterSpacing: '-0.03em', color: '#F0EFF8' }}>
                Go unlimited with Pro
              </h3>
              <p className="font-sans m-0 mb-5" style={{ fontSize: 14, color: 'rgba(240,239,248,0.55)', lineHeight: 1.65 }}>
                Unlimited uploads, Auto-Republish, AI smart clips, priority queue — everything you need to run your cross-platform workflow on autopilot.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <Btn kind="primary" onClick={handleUpgrade}>Get Pro — $12/mo</Btn>
                {[
                  'Unlimited uploads',
                  'AI clip generation',
                  'Auto-Republish',
                  'Priority processing',
                ].map(f => (
                  <span key={f} className="inline-flex items-center gap-1.5 font-sans" style={{ fontSize: 12, color: 'rgba(240,239,248,0.50)' }}>
                    <Check size={12} style={{ color: '#0ED2A0' }} />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Dashboard shell ────────────────────────────────────────────────────────── */
export default function Dashboard() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#08080E' }}>
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/"               element={<Overview />} />
          <Route path="/repost/*"       element={<NewRepost />} />
          <Route path="/queue"          element={<QueuePage />} />
          <Route path="/auto-republish" element={<AutoRepublish />} />
          <Route path="/accounts"       element={<AccountsPage />} />
          <Route path="/billing"        element={<BillingPage />} />
          <Route path="/settings"       element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}
