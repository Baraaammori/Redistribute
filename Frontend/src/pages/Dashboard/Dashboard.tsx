import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Upload, Scissors, Send, Repeat, Check, AlertTriangle,
  Clock, Zap, RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Sidebar } from '../../components/ui/Sidebar';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Btn } from '../../components/ui/Btn';
import { Thumb } from '../../components/ui/Thumb';
import { PlatformDot } from '../../components/ui/PlatformDot';
import UploadCenter  from './UploadCenter';
import VideoLibrary  from './VideoLibrary';
import NewRepost     from './NewRepost';
import AutoRepublish from './AutoRepublish';
import SettingsPage  from './Settings';

// ── Overview page ─────────────────────────────────────────────────────────────
function Overview() {
  const navigate = useNavigate();
  const [stats, setStats]   = useState({ uploads: 0, clips: 0, distributions: 0, reposts: 0, completed: 0, failed: 0 });
  const [videos, setVideos] = useState<any[]>([]);
  const [bestTime, setBestTime] = useState<string | null>(null);
  const [autoActive, setAutoActive] = useState(false);

  useEffect(() => {
    api.upload.list().then((vs: any[]) => {
      setVideos(vs.slice(0, 4));
      setStats(s => ({ ...s, uploads: vs.length, distributions: vs.length * 2 }));
    }).catch(() => {});
    api.bestTime.get().then((d: any) => d?.best_hour != null && setBestTime(`${d.best_hour}:00`)).catch(() => {});
    api.accounts.autoRepublishStatus().then((arr: any[]) => setAutoActive(arr.some((a: any) => a.enabled))).catch(() => {});
  }, []);

  const HUE_MAP: Record<string, string> = { done: 'teal', processing: 'blue', failed: 'pink', pending: 'amber' };

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-9">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display font-extrabold m-0" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
              Overview
            </h1>
            <div className="flex items-center gap-2.5 mt-2 font-sans" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>
              <span>Welcome back.</span>
              <StatusBadge status="pro" />
            </div>
          </div>
          <Btn kind="primary" icon={Upload} onClick={() => navigate('/dashboard/upload')}>Upload video</Btn>
        </div>

        {/* Stats */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          <StatCard icon={Upload}        color="#6C47FF" colorBg="rgba(108,71,255,0.12)" value={stats.uploads}       label="Uploads"       trend="+8 wk" />
          <StatCard icon={Scissors}      color="#0ED2A0" colorBg="rgba(14,210,160,0.10)" value={stats.clips}         label="Clips"         trend="+24 wk" />
          <StatCard icon={Send}          color="#4F8EF0" colorBg="rgba(79,142,240,0.10)" value={stats.distributions} label="Distributions" trend="+18 wk" />
          <StatCard icon={Repeat}        color="#F5A623" colorBg="rgba(245,166,35,0.10)" value={stats.reposts}       label="Reposts"       trend="+12 wk" />
          <StatCard icon={Check}         color="#0ED2A0" colorBg="rgba(14,210,160,0.10)" value={stats.completed}     label="Completed"     trend="98.4%" />
          <StatCard icon={AlertTriangle} color="#F04F4F" colorBg="rgba(240,79,79,0.10)"  value={stats.failed}        label="Failed"        trend="-3 wk" />
        </div>

        {/* Auto-republish banner */}
        {autoActive && (
          <div
            className="flex items-center gap-4 rounded-xl px-5 py-4"
            style={{ background: 'rgba(108,71,255,0.06)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid #6C47FF' }}
          >
            <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 34, height: 34, background: 'rgba(108,71,255,0.12)', color: '#6C47FF' }}>
              <Repeat size={16} />
            </div>
            <div className="flex-1">
              <div className="font-sans font-semibold" style={{ fontSize: 13, color: '#F0EFF8' }}>Auto-republish is active</div>
              <div className="font-sans mt-0.5" style={{ fontSize: 12, color: 'rgba(240,239,248,0.50)' }}>Cross-posting new uploads automatically</div>
            </div>
            <button
              onClick={() => navigate('/dashboard/auto-republish')}
              className="font-sans font-medium flex items-center gap-1"
              style={{ background: 'none', border: 'none', color: '#8B6AFF', fontSize: 12, cursor: 'pointer' }}
            >
              View activity →
            </button>
          </div>
        )}

        {/* Two columns */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          {/* Recent uploads */}
          <Card padding={0} className="flex flex-col">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="font-sans font-semibold" style={{ fontSize: 13, color: '#F0EFF8' }}>Recent uploads</span>
              <button
                onClick={() => navigate('/dashboard/library')}
                className="font-sans flex items-center gap-1"
                style={{ background: 'none', border: 'none', color: 'rgba(240,239,248,0.50)', fontSize: 12, cursor: 'pointer' }}
              >
                Library →
              </button>
            </div>
            {videos.length === 0 ? (
              <div className="flex items-center justify-center py-10 font-sans" style={{ fontSize: 13, color: 'rgba(240,239,248,0.25)' }}>
                No uploads yet
              </div>
            ) : (
              videos.map((v: any) => (
                <div key={v.id} className="flex items-center gap-3.5 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <Thumb w={56} h={32} hue={HUE_MAP[v.status] as any || 'slate'} r={5} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans font-medium truncate" style={{ fontSize: 13, color: '#F0EFF8' }}>{v.title || v.original_filename}</div>
                    <div className="font-mono mt-0.5" style={{ fontSize: 11, color: 'rgba(240,239,248,0.25)' }}>
                      {v.duration_seconds ? `${Math.floor(v.duration_seconds / 60)}:${String(Math.round(v.duration_seconds % 60)).padStart(2,'0')}` : '—'} · {new Date(v.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <StatusBadge status={v.status as any} />
                </div>
              ))
            )}
          </Card>

          {/* Best time */}
          <Card padding={0} className="flex flex-col">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="font-sans font-semibold" style={{ fontSize: 13, color: '#F0EFF8' }}>Best time to post</div>
              <div className="font-sans mt-0.5" style={{ fontSize: 12, color: 'rgba(240,239,248,0.50)' }}>Across last 30 days, your audience is most active at:</div>
            </div>
            <div className="flex-1 flex flex-col gap-3.5 p-5">
              <div className="font-display font-extrabold leading-none" style={{ fontSize: 36, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
                {bestTime ?? '7:00'} <span className="font-semibold" style={{ fontSize: 18, color: 'rgba(240,239,248,0.50)' }}>PM</span>
              </div>
              <div className="flex items-end gap-1" style={{ height: 90 }}>
                {[12,18,22,28,34,40,52,68,84,100,92,76,58,44,32].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      background: i === 9 ? '#6C47FF' : i === 8 || i === 10 ? '#8B6AFF' : 'rgba(108,71,255,0.18)',
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between font-mono" style={{ fontSize: 10, color: 'rgba(240,239,248,0.25)' }}>
                <span>9 AM</span><span>1 PM</span><span>5 PM</span><span>9 PM</span><span>1 AM</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

// ── Queue page (inline) ────────────────────────────────────────────────────────
function QueuePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const HUE: Record<string, string> = { done: 'teal', processing: 'blue', pending: 'amber', failed: 'pink', scheduled: 'purple' };

  const load = () => {
    setLoading(true);
    api.reposts.list().then((d: any[]) => setJobs(d ?? [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-9">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'rgba(245,166,35,0.10)', color: '#F5A623' }}>
                <Clock size={18} />
              </div>
              <h1 className="font-display font-extrabold m-0" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>Queue</h1>
            </div>
            <p className="font-sans m-0" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>Live job status across every destination.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-mono" style={{ fontSize: 11, color: 'rgba(240,239,248,0.50)' }}>
              <span className="rounded-full animate-pulse2" style={{ width: 6, height: 6, background: '#0ED2A0', flexShrink: 0 }} />
              live
            </span>
            <Btn kind="ghost" size="sm" icon={RefreshCw} onClick={load}>Refresh</Btn>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <StatCard icon={Clock}         color="#F5A623" colorBg="rgba(245,166,35,0.10)"  value={jobs.filter(j => j.status === 'pending').length}    label="Pending" />
          <StatCard icon={Zap}           color="#4F8EF0" colorBg="rgba(79,142,240,0.10)"  value={jobs.filter(j => j.status === 'processing').length}  label="Processing" />
          <StatCard icon={Check}         color="#0ED2A0" colorBg="rgba(14,210,160,0.10)"  value={jobs.filter(j => j.status === 'done').length}        label="Done today" />
          <StatCard icon={AlertTriangle} color="#F04F4F" colorBg="rgba(240,79,79,0.10)"   value={jobs.filter(j => j.status === 'failed').length}      label="Failed" />
        </div>

        {loading ? (
          <div className="font-sans text-center py-12" style={{ color: 'rgba(240,239,248,0.25)', fontSize: 13 }}>Loading…</div>
        ) : jobs.length === 0 ? (
          <Card>
            <div className="text-center py-10 font-sans" style={{ color: 'rgba(240,239,248,0.25)', fontSize: 13 }}>Queue is empty</div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {jobs.map((j: any) => {
              const borderC = j.status === 'processing' ? 'rgba(79,142,240,0.35)' : j.status === 'failed' ? 'rgba(240,79,79,0.30)' : 'rgba(255,255,255,0.07)';
              return (
                <div
                  key={j.id}
                  className="flex items-center gap-4 rounded-xl px-4 py-3.5"
                  style={{ background: '#0F0F17', border: `1px solid ${borderC}` }}
                >
                  <Thumb w={72} h={44} hue={(HUE[j.status] || 'slate') as any} r={6} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans font-medium truncate" style={{ fontSize: 13, color: '#F0EFF8' }}>
                      {j.title || j.source_video_url}
                    </div>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <div className="flex gap-1">
                        {(['youtube','tiktok','instagram'] as const).filter(p => j[`${p}_status`]).map(p => (
                          <PlatformDot key={p} id={p} size={16} radius={3} />
                        ))}
                      </div>
                      <span className="font-mono" style={{ fontSize: 11, color: j.status === 'failed' ? '#F04F4F' : 'rgba(240,239,248,0.25)' }}>
                        {new Date(j.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={j.status as any} />
                  {j.status === 'failed' && <Btn kind="soft" size="sm" icon={RefreshCw}>Retry</Btn>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Accounts page (inline) ─────────────────────────────────────────────────────
function AccountsPage() {
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

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-9">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display font-extrabold m-0" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>Connected accounts</h1>
            <p className="font-sans m-0 mt-2" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>Manage which platforms Redistribute can post to on your behalf.</p>
          </div>
        </div>

        {loading ? (
          <div className="font-sans py-10 text-center" style={{ color: 'rgba(240,239,248,0.25)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {(['youtube','tiktok','instagram'] as const).map(pid => {
              const acc = accounts.find(a => a.platform === pid);
              const expired = acc?.status === 'paused' || acc?.token_expired;
              return (
                <Card key={pid} padding={20} style={{ borderColor: expired ? 'rgba(245,166,35,0.30)' : 'rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-4">
                    <PlatformDot id={pid} size={48} radius={12} />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold" style={{ fontSize: 18, letterSpacing: '-0.02em', color: '#F0EFF8' }}>
                          {pid.charAt(0).toUpperCase() + pid.slice(1)}
                        </span>
                        {acc && <StatusBadge status={expired ? 'paused' : 'active'} />}
                        {acc?.handle && <span className="font-mono" style={{ fontSize: 12, color: 'rgba(240,239,248,0.50)' }}>@{acc.handle}</span>}
                      </div>
                      <div className="font-sans mt-1.5" style={{ fontSize: 12, color: 'rgba(240,239,248,0.50)' }}>
                        {acc ? (expired ? 'Token expired · reconnect to resume' : 'Connected · auto-publish on') : 'Not connected'}
                      </div>
                    </div>
                    {!acc ? (
                      <Btn kind="primary" size="sm" onClick={() => connect(pid)}>Connect</Btn>
                    ) : expired ? (
                      <Btn kind="primary" size="sm" icon={RefreshCw} onClick={() => connect(pid)}>Reconnect</Btn>
                    ) : (
                      <div className="flex gap-2">
                        <Btn kind="ghost" size="sm">Settings</Btn>
                        <Btn kind="soft" size="sm" onClick={() => disconnect(acc.id)}>Disconnect</Btn>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Billing page (inline) ──────────────────────────────────────────────────────
function BillingPage() {
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    // Plan type inferred from user profile; if no stripe endpoint exists just leave null
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

  return (
    <main className="flex-1 overflow-auto" style={{ background: '#08080E' }}>
      <div className="flex flex-col gap-6 p-9">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display font-extrabold m-0" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>Billing</h1>
            <p className="font-sans m-0 mt-2" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)' }}>Plan, usage, and invoices.</p>
          </div>
          <Btn kind="ghost" size="sm" onClick={handlePortal}>Manage on Stripe ↗</Btn>
        </div>

        {/* Plan banner */}
        <Card padding={0} style={{ overflow: 'hidden', position: 'relative' }}>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 100% 0%, rgba(108,71,255,0.18), transparent 50%), radial-gradient(circle at 0% 100%, rgba(14,210,160,0.10), transparent 50%)' }}
          />
          <div className="relative flex items-center gap-6 px-7 py-6">
            <div>
              <div className="font-sans font-bold uppercase" style={{ fontSize: 11, color: 'rgba(240,239,248,0.25)', letterSpacing: '0.08em' }}>Current plan</div>
              <div className="flex items-center gap-3.5 mt-2">
                <span className="font-display font-extrabold" style={{ fontSize: 36, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
                  {plan?.plan_type === 'pro' ? 'Pro' : 'Free'}
                </span>
                <StatusBadge status={plan?.plan_type === 'pro' ? 'active' : 'trial'} />
                {plan?.plan_type === 'pro' && (
                  <span className="font-mono" style={{ fontSize: 12, color: 'rgba(240,239,248,0.50)' }}>$12 / month</span>
                )}
              </div>
            </div>
            <div className="flex-1" />
            {plan?.plan_type !== 'pro' ? (
              <Btn kind="primary" onClick={handleUpgrade}>Upgrade to Pro — $12/mo</Btn>
            ) : (
              <div className="flex gap-2">
                <Btn kind="ghost">Change plan</Btn>
                <Btn kind="soft">Cancel</Btn>
              </div>
            )}
          </div>

          {plan?.plan_type === 'pro' && (
            <div className="relative grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {[
                { label: 'Uploads this cycle', used: plan?.uploads_used ?? 0, total: '∞', color: '#6C47FF', frac: 0.3 },
                { label: 'Auto-republish events', used: plan?.reposts_used ?? 0, total: '∞', color: '#0ED2A0', frac: 0.2 },
                { label: 'Storage', used: `${((plan?.storage_used_bytes ?? 0) / 1e9).toFixed(1)} GB`, total: '50 GB', color: '#4F8EF0', frac: (plan?.storage_used_bytes ?? 0) / 50e9 },
              ].map((u, i) => (
                <div key={i} className="px-6 py-5" style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(240,239,248,0.25)' }}>{u.label}</div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="font-display font-extrabold" style={{ fontSize: 22, letterSpacing: '-0.03em', color: '#F0EFF8' }}>{u.used}</span>
                    <span className="font-mono" style={{ fontSize: 12, color: 'rgba(240,239,248,0.25)' }}>/ {u.total}</span>
                  </div>
                  <div className="mt-3 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ width: `${Math.min(u.frac * 100, 100)}%`, height: '100%', background: u.color, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {plan?.plan_type !== 'pro' && (
          <div
            className="rounded-2xl p-7 relative overflow-hidden"
            style={{ background: 'rgba(108,71,255,0.06)', border: '1px solid rgba(108,71,255,0.20)' }}
          >
            <h3 className="font-display font-bold m-0 mb-3" style={{ fontSize: 22, letterSpacing: '-0.02em', color: '#F0EFF8' }}>
              Upgrade to Pro
            </h3>
            <p className="font-sans m-0 mb-5" style={{ fontSize: 14, color: 'rgba(240,239,248,0.50)', lineHeight: 1.65 }}>
              Unlimited uploads, Auto-Republish, AI smart clips, priority queue — everything you need to run your cross-platform workflow on autopilot.
            </p>
            <Btn kind="primary" onClick={handleUpgrade}>Get Pro — $12/mo</Btn>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Dashboard shell ────────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#08080E' }}>
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/"               element={<Overview />} />
          <Route path="/upload/*"       element={<UploadCenter />} />
          <Route path="/library/*"      element={<VideoLibrary />} />
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
