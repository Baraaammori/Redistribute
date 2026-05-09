import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PlatformDot } from '../../components/ui/PlatformDot';

const ACTIVITY_LINES = [
  { tag: 'ok',    color: '#0ED2A0', when: '14m ago',  text: '"How I edit faster" cross-posted' },
  { tag: 'ok',    color: '#0ED2A0', when: '1h ago',   text: 'reel published · 2 clips' },
  { tag: 'ok',    color: '#0ED2A0', when: '3h ago',   text: 'auto-republished from tiktok' },
  { tag: 'queue', color: '#F5A623', when: '5h ago',   text: '3 clips queued for tonight' },
  { tag: 'ok',    color: '#0ED2A0', when: '8h ago',   text: '"Why I left freelance" → reel' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F4F0' }}>
      {/* Left — form */}
      <div
        className="flex flex-col justify-center relative"
        style={{ width: 480, flexShrink: 0, padding: '0 56px' }}
      >
        {/* Logo */}
        <div
          className="absolute top-8 left-14 font-display font-extrabold text-gradient-brand"
          style={{ fontSize: 18, letterSpacing: '-0.03em' }}
        >
          Redistribute
        </div>

        <div
          className="inline-flex items-center gap-2 font-sans font-semibold uppercase mb-4"
          style={{ fontSize: 11, color: '#706D64', letterSpacing: '0.08em' }}
        >
          <span className="rounded-full animate-pulse2" style={{ width: 6, height: 6, background: '#0ED2A0', flexShrink: 0 }} />
          Welcome back
        </div>

        <h1 className="font-display font-extrabold m-0" style={{ fontSize: 52, letterSpacing: '-0.045em', color: '#0C0B09', lineHeight: 0.95 }}>
          Sign back<br />
          <span style={{ fontStyle: 'italic', fontWeight: 500, color: '#6C47FF' }}>into the loop.</span>
        </h1>
        <p className="font-sans mt-3.5" style={{ fontSize: 13, color: '#706D64' }}>
          Activity ran while you were away — log in to see the full board.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-7">
          {/* Email row */}
          <div
            className="flex items-center gap-3 rounded-xl"
            style={{ padding: '10px 14px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-lg font-display font-extrabold text-white"
              style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6C47FF, #8B6AFF)', fontSize: 12 }}
            >
              {email ? email.slice(0, 2).toUpperCase() : '?'}
            </div>
            <div className="flex-1">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-transparent border-none outline-none font-sans font-semibold"
                style={{ fontSize: 13, color: '#0C0B09' }}
              />
              <div className="font-mono" style={{ fontSize: 10, color: '#706D64', marginTop: 2 }}>
                {email ? 'Recognized account' : 'Enter your email'}
              </div>
            </div>
            {email && <Check size={14} color="#0ED2A0" strokeWidth={3} />}
          </div>

          {/* Password */}
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="rounded-xl font-mono"
            style={{
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              padding: '12px 16px', fontSize: 14, color: '#0C0B09', outline: 'none',
              letterSpacing: '0.18em',
            }}
          />

          {error && (
            <div className="font-sans rounded-lg px-3 py-2" style={{ fontSize: 12, color: '#F04F4F', background: 'rgba(240,79,79,0.08)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium"
            style={{
              background: '#6C47FF', color: '#fff', border: 'none', padding: '14px',
              fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              boxShadow: '0 0 32px rgba(108,71,255,0.35)',
            }}
          >
            {loading ? 'Signing in…' : <>Resume work <ArrowRight size={14} /></>}
          </button>

          <div className="flex justify-between font-sans" style={{ fontSize: 12, color: '#706D64' }}>
            <span>Forgot password?</span>
            <Link to="/register" style={{ color: '#6C47FF', textDecoration: 'none', fontWeight: 500 }}>
              Create an account →
            </Link>
          </div>
        </form>
      </div>

      {/* Right — live activity */}
      <div className="flex-1 relative overflow-hidden flex flex-col p-9" style={{ background: '#06060B' }}>
        <div className="absolute pointer-events-none" style={{ top: -120, left: -120, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,71,255,0.35), transparent 70%)', filter: 'blur(20px)' }} />
        <div className="absolute pointer-events-none" style={{ bottom: -160, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,210,160,0.18), transparent 70%)', filter: 'blur(20px)' }} />
        <div className="absolute inset-0 opacity-30 bg-dot-grid pointer-events-none" />

        <div className="relative flex-1 flex flex-col gap-5">
          <div className="font-sans font-bold uppercase" style={{ fontSize: 11, color: 'rgba(240,239,248,0.25)', letterSpacing: '0.12em' }}>
            While you were away
          </div>
          <div className="font-display font-extrabold" style={{ fontSize: 60, letterSpacing: '-0.04em', color: '#F0EFF8', lineHeight: 0.95 }}>
            5 ships<br />
            <span style={{ color: '#0ED2A0', fontStyle: 'italic', fontWeight: 600 }}>0 failures.</span>
          </div>
          <div className="flex items-center gap-2.5 font-mono" style={{ fontSize: 11, color: 'rgba(240,239,248,0.50)' }}>
            <PlatformDot id="youtube" size={20} radius={5} />
            <PlatformDot id="tiktok"  size={20} radius={5} />
            <PlatformDot id="instagram" size={20} radius={5} />
            <span>· 3 platforms healthy</span>
          </div>

          <div className="flex flex-col gap-2 mt-3 flex-1">
            {ACTIVITY_LINES.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl animate-fadeup"
                style={{
                  background: 'rgba(15,15,23,0.60)', border: '1px solid rgba(255,255,255,0.06)',
                  padding: '10px 14px', backdropFilter: 'blur(8px)',
                  animationDelay: `${i * 80}ms`,
                }}
              >
                <span
                  className="font-mono font-bold uppercase rounded flex-shrink-0"
                  style={{ color: l.color, background: l.color + '22', padding: '3px 7px', fontSize: 9, letterSpacing: '0.06em' }}
                >
                  {l.tag.toUpperCase()}
                </span>
                <span className="font-mono flex-shrink-0" style={{ fontSize: 11, color: 'rgba(240,239,248,0.25)', width: 60 }}>{l.when}</span>
                <span className="font-sans flex-1" style={{ fontSize: 12, color: '#F0EFF8' }}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
