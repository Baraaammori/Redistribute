import React from 'react';

export type PlatformId = 'youtube' | 'tiktok' | 'instagram';

export const PLATFORMS: Record<PlatformId, { name: string; short: string; color: string; bg: string }> = {
  youtube:  { name: 'YouTube',   short: 'YT', color: '#FF3D3D', bg: 'rgba(255,61,61,0.12)' },
  tiktok:   { name: 'TikTok',    short: 'TT', color: '#E8E8EE', bg: 'rgba(255,255,255,0.08)' },
  instagram:{ name: 'Instagram', short: 'IG', color: '#E8458C', bg: 'rgba(232,69,140,0.12)' },
};

function PlatformGlyph({ id, color = '#fff', size = 12 }: { id: PlatformId; color?: string; size?: number }) {
  if (id === 'youtube') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M9 6.5v11l9-5.5z" />
      </svg>
    );
  }
  if (id === 'tiktok') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M9 4v11.5a2.5 2.5 0 1 1-2.5-2.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 4c.4 2.6 2.4 4.5 5 4.8" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'instagram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="17" cy="7" r="0.9" fill={color} stroke="none" />
      </svg>
    );
  }
  return null;
}

interface PlatformDotProps {
  id: PlatformId;
  size?: number;
  radius?: number;
  className?: string;
}

export function PlatformDot({ id, size = 22, radius = 6, className }: PlatformDotProps) {
  const bg = id === 'instagram'
    ? 'linear-gradient(135deg, #F08A3C 0%, #E8458C 50%, #8C3DD6 100%)'
    : id === 'tiktok' ? '#0E0E14' : PLATFORMS[id].color;

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center ${className ?? ''}`}
      style={{
        width: size, height: size, borderRadius: radius,
        background: bg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      <PlatformGlyph id={id} color="#fff" size={size * 0.58} />
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
        color: id === 'tiktok' ? '#E8E8EE' : p.color,
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
