export type PlatformId = 'youtube' | 'tiktok' | 'instagram';

export const PLATFORMS: Record<PlatformId, { name: string; short: string; color: string; bg: string }> = {
  youtube:   { name: 'YouTube',   short: 'YT', color: '#FF0000', bg: 'rgba(255,0,0,0.12)' },
  tiktok:    { name: 'TikTok',    short: 'TT', color: '#F0EFF8', bg: 'rgba(255,255,255,0.08)' },
  instagram: { name: 'Instagram', short: 'IG', color: '#E1306C', bg: 'rgba(225,48,108,0.12)' },
};

/* Real platform logo SVGs */
function YouTubeLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#FF0000"/>
      <path d="M21.8 7.2s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.8 4.1 12 4.1 12 4.1s-4.8 0-7 .2c-.4.1-1.3.1-2 .9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.2.8C6.7 18.1 12 18.1 12 18.1s4.8 0 7-.2c.4-.1 1.3-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 8.8 21.8 7.2 21.8 7.2z" fill="#FF0000"/>
      <path d="M9.75 15.02l5.5-3.02-5.5-3.02v6.04z" fill="white"/>
    </svg>
  );
}

function TikTokLogo({ size }: { size: number }) {
  const s = size * 0.56;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="white">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.15a8.28 8.28 0 004.84 1.55V7.24a4.84 4.84 0 01-1.07-.55z"/>
    </svg>
  );
}

function InstagramLogo({ size }: { size: number }) {
  const s = size * 0.58;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
    </svg>
  );
}

interface PlatformDotProps {
  id: PlatformId;
  size?: number;
  radius?: number;
  className?: string;
}

export function PlatformDot({ id, size = 22, radius = 6, className }: PlatformDotProps) {
  const bg =
    id === 'instagram'
      ? 'linear-gradient(135deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)'
      : id === 'tiktok'
      ? '#010101'
      : '#FF0000';

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center overflow-hidden ${className ?? ''}`}
      style={{
        width: size, height: size, borderRadius: radius,
        background: bg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }}
    >
      {id === 'youtube'   && <YouTubeLogo   size={size} />}
      {id === 'tiktok'    && <TikTokLogo    size={size} />}
      {id === 'instagram' && <InstagramLogo size={size} />}
    </div>
  );
}

interface PlatformBadgeProps {
  id: PlatformId;
  compact?: boolean;
}

export function PlatformBadge({ id, compact = false }: PlatformBadgeProps) {
  const p = PLATFORMS[id];
  return (
    <span
      className="inline-flex items-center font-sans font-semibold tracking-wide uppercase"
      style={{
        gap: 6,
        background: p.bg,
        color: p.color,
        padding: compact ? '3px 8px 3px 4px' : '4px 10px 4px 4px',
        borderRadius: 999,
        fontSize: 11,
        lineHeight: 1,
        letterSpacing: '0.01em',
      }}
    >
      <PlatformDot id={id} size={compact ? 16 : 18} radius={5} />
      {!compact && p.name}
      {compact && p.short}
    </span>
  );
}
