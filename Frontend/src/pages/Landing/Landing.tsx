import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PlatformDot } from '../../components/ui/PlatformDot';
import Footer from '../../components/Footer';

const TERMINAL_LINES: [string, 'detect' | 'queue' | 'ok' | 'fail', string][] = [
  ['14:32:01', 'detect', 'new video on youtube · "How I edit faster" · 4:21'],
  ['14:32:03', 'queue',  'cut vertical clip 0:00–0:60 · for tiktok'],
  ['14:32:05', 'queue',  'cut vertical clip 0:00–0:90 · for instagram'],
  ['14:32:18', 'ok',     'uploaded → tiktok @studiomira'],
  ['14:32:24', 'ok',     'uploaded → instagram @studiomira'],
  ['14:33:12', 'detect', 'new video on tiktok · "studio sound check" · 0:42'],
  ['14:33:14', 'queue',  'reformat 9:16 → 16:9 · for youtube'],
  ['14:33:31', 'ok',     'uploaded → youtube @StudioMira'],
  ['14:33:45', 'fail',   'rate limit · retry in 02:00'],
  ['14:35:46', 'ok',     'uploaded → instagram @studiomira'],
  ['14:36:08', 'detect', 'new video on instagram · "color tutorial pt 2" · 1:20'],
  ['14:36:10', 'queue',  'reformat 9:16 → 16:9 · for youtube'],
  ['14:36:11', 'queue',  'crop center · for tiktok'],
];

const TAG_COLORS = {
  detect: { fg: '#4F8EF0', bg: 'rgba(79,142,240,0.14)', label: 'DETECT' },
  queue:  { fg: '#F5A623', bg: 'rgba(245,166,35,0.14)', label: 'QUEUE' },
  ok:     { fg: '#0ED2A0', bg: 'rgba(14,210,160,0.14)', label: 'OK' },
  fail:   { fg: '#F04F4F', bg: 'rgba(240,79,79,0.14)',  label: 'FAIL' },
};

function TerminalHero() {
  const [count, setCount] = useState(7);
  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => (c >= TERMINAL_LINES.length ? 5 : c + 1));
    }, 1200);
    return () => clearInterval(t);
  }, []);
  const visible = TERMINAL_LINES.slice(0, count);

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col p-10" style={{ background: '#06060B' }}>
      {/* Radial glows */}
      <div className="absolute pointer-events-none" style={{ top: -120, left: -120, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,71,255,0.35), transparent 70%)', filter: 'blur(20px)' }} />
      <div className="absolute pointer-events-none" style={{ bottom: -160, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,210,160,0.22), transparent 70%)', filter: 'blur(20px)' }} />
      <div className="absolute inset-0 opacity-35 bg-dot-grid pointer-events-none" />

      <div className="relative flex flex-col gap-4 flex-1">
        {/* Terminal chrome */}
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="rounded-full" style={{ width: 10, height: 10, background: '#FF5F57' }} />
            <div className="rounded-full" style={{ width: 10, height: 10, background: '#FEBC2E' }} />
            <div className="rounded-full" style={{ width: 10, height: 10, background: '#28C840' }} />
          </div>
          <span className="font-mono ml-1" style={{ fontSize: 11, color: 'rgba(240,239,248,0.25)' }}>
            redistribute · live activity
          </span>
          <div className="flex-1" />
          <span
            className="inline-flex items-center gap-1.5 font-mono font-semibold uppercase"
            style={{ background: 'rgba(14,210,160,0.10)', color: '#0ED2A0', padding: '4px 10px', borderRadius: 999, fontSize: 10, letterSpacing: '0.06em' }}
          >
            <span className="rounded-full animate-pulse2" style={{ width: 5, height: 5, background: '#0ED2A0', flexShrink: 0 }} />
            STREAMING
          </span>
        </div>

        {/* Terminal body */}
        <div
          className="flex-1 flex flex-col gap-1 font-mono"
          style={{
            background: 'rgba(15,15,23,0.72)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14,
            backdropFilter: 'blur(8px)', padding: '20px 22px', overflow: 'hidden',
            fontSize: 12.5, lineHeight: 1.85,
          }}
        >
          {visible.map((line, i) => {
            const tag = TAG_COLORS[line[1]];
            return (
              <div
                key={`${i}-${count}`}
                className="grid gap-2.5 items-center"
                style={{
                  gridTemplateColumns: '74px 70px 1fr',
                  animation: i === visible.length - 1 ? 'fadeup 280ms ease-out' : 'none',
                }}
              >
                <span style={{ color: 'rgba(240,239,248,0.25)', fontVariantNumeric: 'tabular-nums' }}>{line[0]}</span>
                <span
                  className="font-semibold text-center rounded"
                  style={{ color: tag.fg, background: tag.bg, padding: '2px 7px', fontSize: 10, letterSpacing: '0.06em' }}
                >
                  {tag.label}
                </span>
                <span style={{ color: '#F0EFF8' }}>{line[2]}</span>
              </div>
            );
          })}
          <span style={{ color: 'rgba(240,239,248,0.50)' }}>
            <span style={{ color: '#8B6AFF' }}>$</span> watching…{' '}
            <span className="inline-block animate-blink" style={{ width: 8, height: 14, background: '#8B6AFF', verticalAlign: -2 }} />
          </span>
        </div>

        {/* Flow chips */}
        <div className="flex gap-2.5 flex-wrap">
          {(['youtube','tiktok'] as const).map(from =>
            (['tiktok','instagram','youtube'] as const).filter(t => t !== from).slice(0,1).map(to => (
              <div
                key={`${from}${to}`}
                className="flex items-center gap-2 font-sans font-medium"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 12px 6px 6px', borderRadius: 999, fontSize: 11, color: 'rgba(240,239,248,0.50)' }}
              >
                <PlatformDot id={from} size={18} radius={4} />
                <span>{from === 'youtube' ? 'YouTube' : 'TikTok'}</span>
                <ArrowRight size={12} style={{ color: 'rgba(240,239,248,0.25)' }} />
                <PlatformDot id={to} size={18} radius={4} />
                <span>{to === 'tiktok' ? 'TikTok' : to === 'instagram' ? 'Instagram' : 'YouTube'}</span>
              </div>
            ))
          )}
          {[['instagram','youtube'] as const, ['tiktok','instagram'] as const].map(([from, to]) => (
            <div
              key={`${from}${to}`}
              className="flex items-center gap-2 font-sans font-medium"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 12px 6px 6px', borderRadius: 999, fontSize: 11, color: 'rgba(240,239,248,0.50)' }}
            >
              <PlatformDot id={from} size={18} radius={4} />
              <span>{from === 'instagram' ? 'Instagram' : 'TikTok'}</span>
              <ArrowRight size={12} style={{ color: 'rgba(240,239,248,0.25)' }} />
              <PlatformDot id={to} size={18} radius={4} />
              <span>{to === 'youtube' ? 'YouTube' : 'Instagram'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F5F4F0', color: '#0C0B09' }}>
      {/* Hero — split screen */}
      <div className="flex flex-1" style={{ minHeight: 'calc(100vh - 62px)' }}>
        {/* Left */}
        <div
          className="flex flex-col justify-center"
          style={{ width: 460, flexShrink: 0, padding: '48px 48px', background: '#F5F4F0' }}
        >
          <div
            className="inline-flex items-center gap-2 font-sans font-semibold uppercase mb-7"
            style={{ fontSize: 11, color: '#706D64', letterSpacing: '0.08em' }}
          >
            <span className="rounded-full animate-pulse2" style={{ width: 6, height: 6, background: '#0ED2A0', flexShrink: 0 }} />
            Cross-platform video distribution
          </div>

          <h1
            className="font-display font-extrabold m-0"
            style={{ fontSize: 68, letterSpacing: '-0.045em', lineHeight: 0.95, color: '#0C0B09' }}
          >
            <div className="animate-fadeup">Post Once.</div>
            <div
              className="animate-fadeup"
              style={{ fontStyle: 'italic', fontWeight: 500, color: '#3D2A8C', animationDelay: '120ms' }}
            >
              Everywhere.
            </div>
          </h1>

          <p className="font-sans mt-6 max-w-sm" style={{ fontSize: 15, lineHeight: 1.65, color: '#706D64', fontWeight: 400 }}>
            Upload a video once. Redistribute auto-formats it for YouTube, TikTok and
            Instagram — and reposts new uploads across platforms while you sleep.
          </p>

          <div className="mt-9 flex items-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 font-sans font-medium rounded-xl"
              style={{ background: '#0C0B09', color: '#fff', padding: '14px 22px', fontSize: 14, textDecoration: 'none' }}
            >
              Connect your accounts <ArrowRight size={14} />
            </Link>
          </div>
          <div className="font-sans mt-3.5" style={{ fontSize: 12, color: '#706D64' }}>
            Free to start · No credit card
          </div>

          <div
            className="mt-14 flex items-center gap-3.5 font-sans font-semibold uppercase"
            style={{ fontSize: 11, color: '#706D64', letterSpacing: '0.08em' }}
          >
            Works with
            <div className="flex gap-2">
              <PlatformDot id="youtube" size={22} radius={5} />
              <PlatformDot id="tiktok" size={22} radius={5} />
              <PlatformDot id="instagram" size={22} radius={5} />
            </div>
          </div>
        </div>

        {/* Right — terminal */}
        <TerminalHero />
      </div>

      {/* How it works */}
      <section className="py-24 px-14" style={{ background: '#F5F4F0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-sans font-bold uppercase mb-4" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6C47FF' }}>
              How it works
            </div>
            <h2 className="font-display font-extrabold m-0" style={{ fontSize: 52, letterSpacing: '-0.04em', color: '#0C0B09', lineHeight: 1 }}>
              Three steps to{' '}
              <span style={{ fontStyle: 'italic', fontWeight: 500 }}>everywhere.</span>
            </h2>
          </div>

          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { n: '01', title: 'Connect', desc: 'Link your YouTube, TikTok, and Instagram accounts in under a minute.' },
              { n: '02', title: 'Upload once', desc: 'Drop your video. Smart AI decides the best formats for each platform.' },
              { n: '03', title: 'Relax', desc: 'Auto-Republish monitors your channels and cross-posts new content automatically.' },
            ].map(step => (
              <div key={step.n} className="rounded-2xl p-7" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="font-mono font-semibold mb-4" style={{ fontSize: 11, color: '#6C47FF', letterSpacing: '0.08em' }}>
                  {step.n}
                </div>
                <div className="font-display font-bold mb-3" style={{ fontSize: 22, letterSpacing: '-0.02em', color: '#0C0B09' }}>
                  {step.title}
                </div>
                <p className="font-sans m-0" style={{ fontSize: 14, color: '#706D64', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform pairs */}
      <section className="py-16 px-14" style={{ background: '#0C0B09' }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="font-sans font-semibold uppercase mb-4" style={{ fontSize: 11, color: 'rgba(240,239,248,0.50)', letterSpacing: '0.08em' }}>
            Every direction, automatically
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {[
              ['youtube','tiktok'], ['youtube','instagram'],
              ['tiktok','youtube'], ['tiktok','instagram'],
              ['instagram','youtube'], ['instagram','tiktok'],
            ].map(([a, b]) => (
              <div
                key={`${a}${b}`}
                className="flex items-center gap-2.5 font-sans font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 16px 8px 8px', borderRadius: 999, fontSize: 12, color: 'rgba(240,239,248,0.70)' }}
              >
                <PlatformDot id={a as any} size={20} radius={4} />
                <span>{a.charAt(0).toUpperCase() + a.slice(1)}</span>
                <ArrowRight size={12} style={{ color: 'rgba(240,239,248,0.30)' }} />
                <PlatformDot id={b as any} size={20} radius={4} />
                <span>{b.charAt(0).toUpperCase() + b.slice(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-14" style={{ background: '#F5F4F0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-extrabold m-0" style={{ fontSize: 56, letterSpacing: '-0.04em', color: '#0C0B09', lineHeight: 1 }}>
            Start for free.<br />
            <span style={{ fontStyle: 'italic', fontWeight: 500 }}>No card needed.</span>
          </h2>
          <p className="font-sans mt-5 mx-auto" style={{ fontSize: 15, color: '#706D64', lineHeight: 1.65, maxWidth: 420 }}>
            Free plan includes 3 uploads per month. Upgrade to Pro ($12/mo) for unlimited uploads and Auto-Republish.
          </p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 font-sans font-medium rounded-full"
              style={{ background: '#0C0B09', color: '#fff', padding: '14px 28px', fontSize: 14, textDecoration: 'none' }}
            >
              Get started free <ArrowRight size={14} />
            </Link>
            <Link
              to="/pricing"
              className="font-sans font-medium"
              style={{ color: '#706D64', fontSize: 14, textDecoration: 'none' }}
            >
              See pricing →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
