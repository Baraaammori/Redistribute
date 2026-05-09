import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS: [string, string][] = [
  ['/about',   'About'],
  ['/pricing', 'Pricing'],
  ['/contact', 'Contact'],
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (location.pathname.startsWith('/dashboard')) return null;
  if (location.pathname === '/login' || location.pathname === '/register') return null;

  const isHome = location.pathname === '/';

  return (
    <nav
      className="flex items-center gap-8 sticky top-0 z-50"
      style={{
        padding: '20px 56px',
        background: 'rgba(245,244,240,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Link
        to="/"
        className="font-display font-extrabold flex-shrink-0"
        style={{ fontSize: 17, letterSpacing: '-0.03em', color: '#0C0B09', textDecoration: 'none' }}
      >
        Redistribute
      </Link>

      <div className="flex-1 flex justify-center gap-1">
        <NavItem to="/" label="Home" active={isHome} />
        {NAV_ITEMS.map(([to, label]) => (
          <NavItem key={to} to={to} label={label} active={location.pathname === to} />
        ))}
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        {user ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 rounded-full font-sans font-medium"
            style={{ background: '#0C0B09', color: '#fff', border: 'none', padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
          >
            Dashboard <ArrowRight size={13} />
          </button>
        ) : (
          <>
            <Link
              to="/login"
              style={{ color: '#706D64', fontSize: 13, textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-1.5 rounded-full font-sans font-medium"
              style={{ background: '#0C0B09', color: '#fff', padding: '8px 18px', fontSize: 13, textDecoration: 'none' }}
            >
              Get started <ArrowRight size={13} />
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

function NavItem({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className="rounded-full font-sans font-medium transition-colors"
      style={{
        padding: '6px 14px',
        background: active ? '#0C0B09' : 'transparent',
        color: active ? '#F5F4F0' : '#706D64',
        fontSize: 13,
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  );
}
