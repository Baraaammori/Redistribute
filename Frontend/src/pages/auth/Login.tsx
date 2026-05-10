import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PlatformDot } from '../../components/ui/PlatformDot';
import { BASE } from '../../lib/api';

const ACTIVITY_LINES = [
  { tag: 'ok',    color: '#0ED2A0', when: '14m ago',  text: '"How I edit faster" cross-posted' },
  { tag: 'ok',    color: '#0ED2A0', when: '1h ago',   text: 'reel published · 2 clips' },
  { tag: 'ok',    color: '#0ED2A0', when: '3h ago',   text: 'auto-republished from tiktok' },
  { tag: 'queue', color: '#F5A623', when: '5h ago',   text: '3 clips queued for tonight' },
  { tag: 'ok',    color: '#0ED2A0', when: '8h ago',   text: '"Why I left freelance" → reel' },
];

/* Google G logo */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

/* Apple logo */
function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 389.4 45 266.2 45 256.1c0-70.5 11.3-141.7 34.7-202.3C126 14.5 191 0 235.1 0c64.9 0 108.2 33.8 131.3 33.8 22.4 0 72.1-29.3 138.7-29.3 22.4 0 108.2 1.9 174.5 83.3zm-88-154.2c12.2-22.3 21.8-56.5 21.8-90.7 0-4.5-.3-9-.6-13.5-22.1.9-48.3 14.7-65.4 35.3-14.4 17.4-27.8 47.5-27.8 79.9 0 4.8.6 9.6 1 11.5 1.9.3 5.1.6 8.3.6 19.2 0 43.5-12.8 62.7-23.1z"/>
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Show OAuth error from URL param (e.g. after failed Google/Apple callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get("error");
    if (oauthErr) {
      setError(decodeURIComponent(oauthErr));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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

  const handleGoogle = () => {
    window.location.href = `${BASE}/api/auth/google`;
  };

  const handleApple = () => {
    window.location.href = `${BASE}/api/auth/apple`;
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

          {/* Social login divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1" style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />
            <span className="font-sans" style={{ fontSize: 11, color: '#A09D96' }}>or continue with</span>
            <div className="flex-1" style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full inline-flex items-center justify-center gap-3 rounded-lg font-sans font-medium"
            style={{
              height: 44, background: '#fff', color: '#0C0B09',
              border: '1px solid #272727', fontSize: 14, cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F4F0'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Apple */}
          <button
            type="button"
            onClick={handleApple}
            className="w-full inline-flex items-center justify-center gap-3 rounded-lg font-sans font-medium"
            style={{
              height: 44, background: '#000', color: '#fff',
              border: '1px solid #272727', fontSize: 14, cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#000'; }}
          >
            <AppleIcon />
            Continue with Apple
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
