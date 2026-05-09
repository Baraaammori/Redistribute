import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Upload, Film, Plus, Clock, Repeat,
  Link2, CreditCard, Settings, LogOut,
} from 'lucide-react';

const NAV = [
  { id: 'overview',  label: 'Overview',       icon: LayoutDashboard, path: '/dashboard' },
  { id: 'upload',    label: 'Upload',          icon: Upload,          path: '/dashboard/upload' },
  { id: 'library',   label: 'Library',         icon: Film,            path: '/dashboard/library' },
  { id: 'repost',    label: 'New Repost',      icon: Plus,            path: '/dashboard/repost' },
  { id: 'queue',     label: 'Queue',           icon: Clock,           path: '/dashboard/queue' },
  { id: 'auto',      label: 'Auto-Republish',  icon: Repeat,          path: '/dashboard/auto-republish' },
  { id: 'accounts',  label: 'Accounts',        icon: Link2,           path: '/dashboard/accounts' },
  { id: 'billing',   label: 'Billing',         icon: CreditCard,      path: '/dashboard/billing' },
  { id: 'settings',  label: 'Settings',        icon: Settings,        path: '/dashboard/settings' },
];

interface Props {
  dense?: boolean;
}

export function Sidebar({ dense }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full"
      style={{
        width: 224,
        background: '#060609',
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="text-gradient-brand font-display font-extrabold" style={{ fontSize: 17, letterSpacing: '-0.03em' }}>
          Redistribute
        </div>
        <div className="font-sans mt-1" style={{ fontSize: 11, color: 'rgba(240,239,248,0.25)' }}>
          {user?.email ?? ''}
        </div>
      </div>

      <div className="mx-3 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-3.5">
        {NAV.map(n => {
          const active = isActive(n.path);
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              onClick={() => navigate(n.path)}
              className={`flex items-center gap-2.5 w-full text-left rounded-lg font-sans transition-colors duration-100 ${dense ? 'h-8' : 'h-9'}`}
              style={{
                padding: '0 10px',
                background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: active ? '#F0EFF8' : 'rgba(255,255,255,0.45)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                border: 'none',
              }}
            >
              <Icon size={15} />
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mx-3 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

      {/* User footer */}
      <div className="flex items-center gap-2.5 p-4">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full font-display font-extrabold text-white"
          style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #6C47FF, #8B6AFF)',
            fontSize: 12, letterSpacing: '-0.02em',
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: '#F0EFF8' }}>
            {user?.email ?? ''}
          </div>
          <div className="font-mono" style={{ fontSize: 10, color: 'rgba(240,239,248,0.25)' }}>Pro</div>
        </div>
        <button
          onClick={logout}
          className="flex-shrink-0 p-1 rounded"
          style={{ background: 'none', border: 'none', color: 'rgba(240,239,248,0.25)' }}
          title="Sign out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
