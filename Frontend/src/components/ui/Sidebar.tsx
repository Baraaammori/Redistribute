import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Upload, Film, Plus, Clock, Repeat,
  Link2, CreditCard, Settings, LogOut, ChevronRight,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Content',
    items: [
      { id: 'overview', label: 'Overview',      icon: LayoutDashboard, path: '/dashboard' },
      { id: 'upload',   label: 'Upload',         icon: Upload,          path: '/dashboard/upload' },
      { id: 'library',  label: 'Library',        icon: Film,            path: '/dashboard/library' },
      { id: 'repost',   label: 'New Repost',     icon: Plus,            path: '/dashboard/repost' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { id: 'queue',    label: 'Queue',          icon: Clock,           path: '/dashboard/queue' },
      { id: 'auto',     label: 'Auto-Republish', icon: Repeat,          path: '/dashboard/auto-republish' },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'accounts', label: 'Accounts',       icon: Link2,           path: '/dashboard/accounts' },
      { id: 'billing',  label: 'Billing',        icon: CreditCard,      path: '/dashboard/billing' },
      { id: 'settings', label: 'Settings',       icon: Settings,        path: '/dashboard/settings' },
    ],
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'RD';

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full animate-slide-l"
      style={{
        width: 240,
        background: 'linear-gradient(180deg, #07070D 0%, #060609 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-7 pb-5">
        <div
          className="inline-flex items-center gap-2.5"
          style={{ cursor: 'default' }}
        >
          {/* Logo mark */}
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #6C47FF 0%, #0ED2A0 100%)',
              boxShadow: '0 0 16px rgba(108,71,255,0.40)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M3 8h7M3 12h4" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M14 8l-4 3.5V4.5L14 8z" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-gradient-brand font-display font-extrabold" style={{ fontSize: 16, letterSpacing: '-0.03em' }}>
              Redistribute
            </div>
            <div className="font-mono" style={{ fontSize: 9, color: 'rgba(240,239,248,0.25)', letterSpacing: '0.08em' }}>
              AI DISTRIBUTION
            </div>
          </div>
        </div>
      </div>

      <div className="mx-5" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Nav groups */}
      <nav className="flex-1 flex flex-col px-3 py-4 gap-5 overflow-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div
              className="font-sans font-semibold uppercase px-3 mb-1.5"
              style={{ fontSize: 10, letterSpacing: '0.10em', color: 'rgba(240,239,248,0.20)' }}
            >
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(n => {
                const active = isActive(n.path);
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => navigate(n.path)}
                    className="relative flex items-center gap-2.5 w-full text-left rounded-xl font-sans"
                    style={{
                      height: 38,
                      padding: '0 10px',
                      background: active ? 'rgba(108,71,255,0.14)' : 'transparent',
                      color: active ? '#F0EFF8' : 'rgba(240,239,248,0.45)',
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      border: active ? '1px solid rgba(108,71,255,0.22)' : '1px solid transparent',
                      transition: 'all 180ms ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                        (e.currentTarget as HTMLElement).style.color = 'rgba(240,239,248,0.75)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'rgba(240,239,248,0.45)';
                      }
                    }}
                  >
                    {/* Active accent bar */}
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 rounded-full"
                        style={{
                          width: 3, height: 18,
                          background: 'linear-gradient(180deg, #8B6AFF, #6C47FF)',
                          transform: 'translateY(-50%)',
                          boxShadow: '0 0 8px rgba(108,71,255,0.60)',
                        }}
                      />
                    )}
                    <Icon
                      size={15}
                      style={{
                        color: active ? '#8B6AFF' : 'inherit',
                        flexShrink: 0,
                        marginLeft: active ? 6 : 0,
                        transition: 'color 180ms ease, margin 180ms ease',
                      }}
                    />
                    <span className="flex-1">{n.label}</span>
                    {active && (
                      <ChevronRight size={12} style={{ color: 'rgba(139,106,255,0.50)', flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-5" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* User footer */}
      <div className="p-3 m-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl font-display font-extrabold text-white"
            style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #6C47FF, #8B6AFF)',
              fontSize: 12, letterSpacing: '-0.02em',
              boxShadow: '0 0 12px rgba(108,71,255,0.40)',
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-sans font-semibold truncate" style={{ fontSize: 12, color: '#F0EFF8' }}>
              {user?.email ?? ''}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="rounded-full" style={{ width: 5, height: 5, background: '#0ED2A0', flexShrink: 0 }} />
              <span className="font-mono" style={{ fontSize: 10, color: '#0ED2A0' }}>Pro · Active</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: 28, height: 28,
              background: 'none', border: 'none',
              color: 'rgba(240,239,248,0.25)',
              transition: 'color 150ms ease, background 150ms ease',
            }}
            title="Sign out"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F04F4F'; (e.currentTarget as HTMLElement).style.background = 'rgba(240,79,79,0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,239,248,0.25)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
