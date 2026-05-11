import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import {
  LayoutDashboard, PlusCircle, ListOrdered, RefreshCw,
  Link2, CreditCard, Settings, LogOut,
  Upload, Film, FileText, Scissors,
} from 'lucide-react';

// ── nav definition ────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Content',
    items: [
      { id: 'overview', label: 'Overview',       icon: LayoutDashboard, path: '/dashboard' },
      { id: 'repost',   label: 'New Repost',     icon: PlusCircle,      path: '/dashboard/repost' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { id: 'queue',    label: 'Queue',           icon: ListOrdered,     path: '/dashboard/queue' },
      { id: 'auto',     label: 'Auto-Republish',  icon: RefreshCw,       path: '/dashboard/auto-republish', autoRepublish: true },
    ],
  },
  {
    label: 'Video Tools',
    items: [
      { id: 'upload',   label: 'Upload Center',   icon: Upload,          path: '/dashboard/upload' },
      { id: 'library',  label: 'Video Library',   icon: Film,            path: '/dashboard/library' },
      { id: 'captions', label: 'Captions',        icon: FileText,        path: '/dashboard/captions' },
      { id: 'clips',    label: 'AI Clips',        icon: Scissors,        path: '/dashboard/clips' },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'accounts', label: 'Accounts',        icon: Link2,           path: '/dashboard/accounts' },
      { id: 'billing',  label: 'Billing',         icon: CreditCard,      path: '/dashboard/billing' },
      { id: 'settings', label: 'Settings',        icon: Settings,        path: '/dashboard/settings' },
    ],
  },
];

// ── route → page title map ────────────────────────────────────────────────────
export const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':                'Overview',
  '/dashboard/repost':         'New Repost',
  '/dashboard/queue':          'Queue',
  '/dashboard/auto-republish': 'Auto-Republish',
  '/dashboard/upload':         'Upload Center',
  '/dashboard/library':        'Video Library',
  '/dashboard/captions':       'Captions Studio',
  '/dashboard/clips':          'AI Clips',
  '/dashboard/accounts':       'Accounts',
  '/dashboard/billing':        'Billing',
  '/dashboard/settings':       'Settings',
};

// ── single nav button ─────────────────────────────────────────────────────────
function NavBtn({
  item,
  active,
  autoActive,
  onNavigate,
}: {
  item: (typeof NAV_GROUPS)[0]['items'][0] & { autoRepublish?: boolean };
  active: boolean;
  autoActive: boolean;
  onNavigate: (path: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      key={item.id}
      onClick={() => onNavigate(item.path)}
      className="relative flex items-center gap-2.5 w-full text-left rounded-xl font-sans"
      style={{
        height: 38,
        padding: '0 10px',
        background: active ? 'rgba(108,71,255,0.14)' : 'transparent',
        color: active ? '#F0EFF8' : 'rgba(240,239,248,0.45)',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        border: active ? '1px solid rgba(108,71,255,0.22)' : '1px solid transparent',
        borderLeft: active ? '3px solid #6C47FF' : '3px solid transparent',
        transition: 'all 180ms ease',
        cursor: 'pointer',
        boxSizing: 'border-box',
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
      <Icon
        size={15}
        style={{
          color: active ? '#8B6AFF' : 'inherit',
          flexShrink: 0,
          transition: 'color 180ms ease',
        }}
      />
      <span className="flex-1">{item.label}</span>
      {/* Animated activity dot for Auto-Republish */}
      {item.autoRepublish && autoActive && (
        <span
          className="rounded-full animate-pulse2"
          style={{
            width: 6, height: 6,
            background: '#6C47FF',
            boxShadow: '0 0 6px rgba(108,71,255,0.8)',
            flexShrink: 0,
          }}
        />
      )}
    </button>
  );
}

// ── plan badge ────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan?: string }) {
  const isPro = plan === 'pro' || plan === 'team';
  return (
    <span
      className="rounded-full font-mono font-bold"
      style={{
        fontSize: 9, padding: '2px 7px',
        background: isPro ? 'rgba(108,71,255,0.20)' : 'rgba(255,255,255,0.08)',
        color: isPro ? '#8B6AFF' : 'rgba(240,239,248,0.40)',
        border: `1px solid ${isPro ? 'rgba(108,71,255,0.30)' : 'rgba(255,255,255,0.10)'}`,
        letterSpacing: '0.06em',
      }}
    >
      {isPro ? 'PRO' : 'FREE'}
    </span>
  );
}

// ── main sidebar ──────────────────────────────────────────────────────────────
export function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();
  const [autoActive, setAutoActive] = useState(false);

  useEffect(() => {
    api.accounts.autoRepublishStatus()
      .then((arr: any[]) => setAutoActive(arr.some((a: any) => a.auto_republish_enabled)))
      .catch(() => {});
  }, []);

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'RD';
  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  // ── Shared nav items (for both desktop sidebar and mobile bottom bar) ────────
  const flatItems = NAV_GROUPS.flatMap(g => g.items);

  return (
    <>
      {/* ── DESKTOP SIDEBAR (hidden below md) ──────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full animate-slide-l"
        style={{
          width: 240,
          background: 'linear-gradient(180deg, #0F0F0F 0%, #0A0A12 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-7 pb-5">
          <div className="inline-flex items-center gap-2.5" style={{ cursor: 'default' }}>
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
                {group.items.map(n => (
                  <NavBtn
                    key={n.id}
                    item={n as any}
                    active={isActive(n.path)}
                    autoActive={autoActive}
                    onNavigate={navigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mx-5" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* User footer */}
        <div
          className="p-3 m-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2.5">
            {/* Avatar initials */}
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
            {/* Name + plan */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="font-sans font-semibold truncate" style={{ fontSize: 12, color: '#F0EFF8' }}>
                  {user?.name || user?.email || ''}
                </div>
                <PlanBadge plan={user?.plan} />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="rounded-full" style={{ width: 5, height: 5, background: '#0ED2A0', flexShrink: 0 }} />
                <span className="font-mono" style={{ fontSize: 10, color: '#0ED2A0' }}>Active</span>
              </div>
            </div>
            {/* Sign-out */}
            <button
              onClick={logout}
              className="flex-shrink-0 flex items-center justify-center rounded-lg"
              style={{
                width: 28, height: 28,
                background: 'none', border: 'none',
                color: 'rgba(240,239,248,0.25)',
                transition: 'color 150ms ease, background 150ms ease',
                cursor: 'pointer',
              }}
              title="Sign out"
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = '#F04F4F';
                (e.currentTarget as HTMLElement).style.background = 'rgba(240,79,79,0.10)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'rgba(240,239,248,0.25)';
                (e.currentTarget as HTMLElement).style.background = 'none';
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM TAB BAR (visible below md) ───────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2"
        style={{
          height: 64,
          background: 'rgba(7,7,13,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {flatItems.map(n => {
          const active = isActive(n.path);
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              onClick={() => navigate(n.path)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 relative"
              style={{
                height: '100%',
                background: 'none', border: 'none',
                color: active ? '#8B6AFF' : 'rgba(240,239,248,0.35)',
                transition: 'color 180ms ease',
                cursor: 'pointer',
              }}
            >
              {/* Activity dot for Auto-Republish on mobile */}
              {(n as any).autoRepublish && autoActive && (
                <span
                  className="absolute rounded-full animate-pulse2"
                  style={{
                    width: 5, height: 5,
                    background: '#6C47FF',
                    top: 8, right: 'calc(50% - 14px)',
                  }}
                />
              )}
              {active && (
                <span
                  className="absolute top-0 left-1/2 rounded-full"
                  style={{
                    width: 24, height: 2,
                    background: '#6C47FF',
                    transform: 'translateX(-50%)',
                    boxShadow: '0 0 8px rgba(108,71,255,0.8)',
                  }}
                />
              )}
              <Icon size={20} />
              <span className="font-sans" style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>
                {n.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
        {/* Sign-out tab */}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center gap-0.5 flex-1"
          style={{
            height: '100%',
            background: 'none', border: 'none',
            color: 'rgba(240,239,248,0.35)',
            transition: 'color 180ms ease',
            cursor: 'pointer',
          }}
        >
          <LogOut size={20} />
          <span className="font-sans" style={{ fontSize: 10 }}>Out</span>
        </button>
      </nav>
    </>
  );
}
