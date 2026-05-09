import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, User, Link2, Sparkles, Rocket, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const STEPS = [
  { n: '01', title: 'Create account',    desc: 'Email + password. 30 seconds.',                   icon: User,     active: true  },
  { n: '02', title: 'Connect platforms', desc: 'Link YouTube, TikTok, Instagram (any combo).',    icon: Link2,    active: false },
  { n: '03', title: 'Set smart rules',   desc: 'Cross-post YouTube → shorts? Auto-clip?',         icon: Sparkles, active: false },
  { n: '04', title: 'Ship your first',   desc: 'Upload, distribute, watch the queue do the rest.',icon: Rocket,   active: false },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F4F0' }}>
      {/* Left — roadmap (dark) */}
      <div
        className="flex flex-col relative overflow-hidden"
        style={{ width: 520, flexShrink: 0, padding: '40px 48px', background: '#06060B', color: '#F0EFF8' }}
      >
        <div className="absolute pointer-events-none" style={{ top: -100, left: -100, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,71,255,0.4), transparent 70%)', filter: 'blur(12px)' }} />
        <div className="absolute inset-0 opacity-25 bg-dot-grid pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 mb-7">
          <div
            className="font-display font-extrabold"
            style={{
              fontSize: 18, letterSpacing: '-0.03em',
              background: `linear-gradient(135deg, #8B6AFF, #0ED2A0)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}
          >
            Redistribute
          </div>
        </div>

        <div className="relative">
          <div className="font-sans font-bold uppercase mb-4" style={{ fontSize: 11, color: 'rgba(240,239,248,0.25)', letterSpacing: '0.12em' }}>
            Your first 4 minutes
          </div>
          <h1 className="font-display font-extrabold m-0" style={{ fontSize: 38, letterSpacing: '-0.04em', lineHeight: 1, color: '#F0EFF8' }}>
            From zero to<br />
            <span style={{ fontStyle: 'italic', color: '#8B6AFF', fontWeight: 600 }}>auto-distributed.</span>
          </h1>
        </div>

        {/* Vertical stepper */}
        <div className="relative flex-1 flex flex-col gap-5 mt-9">
          {/* Vertical line */}
          <div className="absolute" style={{ left: 19, top: 18, bottom: 18, width: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div className="absolute" style={{ left: 19, top: 18, height: '12%', width: 1, background: 'linear-gradient(#6C47FF, transparent)' }} />

          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="relative flex gap-4 items-start"
                style={{ opacity: s.active ? 1 : 0.5 }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 40, height: 40,
                    background: s.active ? '#6C47FF' : 'rgba(255,255,255,0.05)',
                    border: s.active ? 'none' : '1px solid rgba(255,255,255,0.10)',
                    boxShadow: s.active ? '0 0 24px rgba(108,71,255,0.5)' : 'none',
                    color: s.active ? '#fff' : 'rgba(240,239,248,0.50)',
                  }}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono font-semibold" style={{ fontSize: 10, color: 'rgba(240,239,248,0.25)', letterSpacing: '0.08em' }}>{s.n}</span>
                    <span className="font-sans font-semibold" style={{ fontSize: 14, color: '#F0EFF8' }}>{s.title}</span>
                    {s.active && (
                      <span
                        className="font-mono font-bold uppercase rounded"
                        style={{ fontSize: 9, color: '#8B6AFF', background: 'rgba(108,71,255,0.18)', padding: '2px 7px', letterSpacing: '0.06em' }}
                      >
                        NOW
                      </span>
                    )}
                  </div>
                  <div className="font-sans mt-1" style={{ fontSize: 12, color: 'rgba(240,239,248,0.50)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <div
          className="relative flex items-center gap-2.5 font-sans mt-7 pt-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(240,239,248,0.25)' }}
        >
          <Shield size={13} />
          <span>14-day Pro trial · No card · Cancel any time</span>
        </div>
      </div>

      {/* Right — form (cream) */}
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '64px 64px' }}>
        <h2 className="font-display font-extrabold m-0" style={{ fontSize: 36, letterSpacing: '-0.04em', color: '#0C0B09', lineHeight: 1 }}>
          Step 01.<br />
          <span style={{ fontStyle: 'italic', fontWeight: 500, color: '#706D64' }}>The easy one.</span>
        </h2>
        <p className="font-sans mt-3 max-w-sm" style={{ fontSize: 13, color: '#706D64' }}>
          Just an email and a password. Platform connections come next, on your terms.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-7 max-w-md">
          {[
            { label: 'Full name', field: 'name', type: 'text', value: name, set: setName },
            { label: 'Email',     field: 'email', type: 'email', value: email, set: setEmail },
            { label: 'Password',  field: 'password', type: 'password', value: password, set: setPassword },
          ].map(({ label, field, type, value, set }) => (
            <label key={field} className="flex flex-col gap-1.5">
              <span className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#706D64' }}>
                {label}
              </span>
              <input
                type={type}
                value={value}
                onChange={e => set(e.target.value)}
                required
                className="rounded-xl"
                style={{
                  background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                  padding: '12px 16px', color: '#0C0B09',
                  fontFamily: type === 'password' ? '"JetBrains Mono", monospace' : 'Inter, sans-serif',
                  fontSize: 14, outline: 'none',
                  letterSpacing: type === 'password' ? '0.18em' : undefined,
                }}
              />
            </label>
          ))}

          {error && (
            <div className="font-sans rounded-lg px-3 py-2" style={{ fontSize: 12, color: '#F04F4F', background: 'rgba(240,79,79,0.08)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium mt-1"
            style={{
              background: '#6C47FF', color: '#fff', border: 'none', padding: '14px 24px', fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              boxShadow: '0 0 32px rgba(108,71,255,0.35)',
            }}
          >
            {loading ? 'Creating account…' : <>Continue to Step 02 <ArrowRight size={14} /></>}
          </button>

          <div className="font-sans" style={{ fontSize: 13, color: '#706D64' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#6C47FF', textDecoration: 'none', fontWeight: 500 }}>Sign in →</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
