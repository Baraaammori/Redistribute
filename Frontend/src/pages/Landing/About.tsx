import React from 'react';
import Footer from '../../components/Footer';

const STATS = [['12.4K', 'Creators'], ['340K', 'Videos distributed'], ['2.1M', 'Reposts'], ['99.7%', 'Uptime']];
const TEAM = [
  { initials: 'MS', name: 'Mira Solé',    role: 'Co-founder · Design',         c1: '#FF4D8B', c2: '#6C47FF' },
  { initials: 'JK', name: 'Jonas Kim',    role: 'Co-founder · Engineering',    c1: '#4F8EF0', c2: '#0ED2A0' },
  { initials: 'AR', name: 'Ada Reuven',   role: 'Head of Creator Relations',   c1: '#F5A623', c2: '#FF4D8B' },
];

export default function About() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F5F4F0', color: '#0C0B09' }}>
      <div className="flex-1 px-14 py-16">
        {/* Hero headline */}
        <div className="text-center mb-14">
          <h1 className="font-display font-extrabold m-0" style={{ fontSize: 60, letterSpacing: '-0.04em', color: '#0C0B09', lineHeight: 0.95 }}>
            Built by creators,<br />
            <span style={{ fontStyle: 'italic', fontWeight: 500 }}>for creators.</span>
          </h1>
        </div>

        {/* Mission + stats */}
        <div className="grid gap-16 max-w-5xl mx-auto mb-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="font-sans font-bold uppercase mb-4" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6C47FF' }}>
              Our mission
            </div>
            <p className="font-display font-semibold m-0 mb-6" style={{ fontSize: 26, letterSpacing: '-0.02em', color: '#0C0B09', lineHeight: 1.3 }}>
              Cut the busywork between platforms so creators can ship more of what they care about.
            </p>
            <p className="font-sans m-0" style={{ fontSize: 14, color: '#706D64', lineHeight: 1.65 }}>
              We've watched too many friends burn out on the cross-posting treadmill. Redistribute is the tool we wished we had — opinionated, fast, and quiet.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid gap-px" style={{ gridTemplateColumns: '1fr 1fr', background: 'rgba(0,0,0,0.08)' }}>
            {STATS.map(([n, l]) => (
              <div key={l} className="p-7" style={{ background: '#F5F4F0' }}>
                <div className="font-display font-extrabold mb-1.5" style={{ fontSize: 36, letterSpacing: '-0.04em', color: '#0C0B09' }}>{n}</div>
                <div className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#706D64' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="max-w-5xl mx-auto">
          <div className="font-sans font-bold uppercase mb-5" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6C47FF' }}>
            The team
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {TEAM.map(t => (
              <div
                key={t.initials}
                className="rounded-2xl flex items-center gap-3.5"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', padding: 20 }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-lg font-display font-extrabold text-white"
                  style={{
                    width: 48, height: 48,
                    background: `linear-gradient(135deg, ${t.c1}, ${t.c2})`,
                    fontSize: 19, letterSpacing: '-0.02em',
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="font-sans font-semibold" style={{ fontSize: 14, color: '#0C0B09' }}>{t.name}</div>
                  <div className="font-sans mt-0.5" style={{ fontSize: 12, color: '#706D64' }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
