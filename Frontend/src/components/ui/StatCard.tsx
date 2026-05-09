import { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  color?: string;
  colorBg?: string;
  value: string | number;
  label: string;
  trend?: string;
  trendUp?: boolean;
  delay?: number;
}

export function StatCard({ icon: Icon, color = '#6C47FF', colorBg = 'rgba(108,71,255,0.12)', value, label, trend, trendUp = true, delay = 0 }: Props) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl animate-enter card-hover"
      style={{
        background: '#0F0F17',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 22px',
        minHeight: 118,
        animationDelay: `${delay}ms`,
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}30`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      {/* Top glow spot */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -30, right: -20, width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}20, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />
      <div className="relative flex items-center justify-between">
        <div
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 34, height: 34, background: colorBg }}
        >
          <Icon size={16} color={color} />
        </div>
        {trend && (
          <span
            className="inline-flex items-center gap-1 font-mono rounded-full"
            style={{
              fontSize: 10,
              color: trendUp ? '#0ED2A0' : '#F04F4F',
              background: trendUp ? 'rgba(14,210,160,0.10)' : 'rgba(240,79,79,0.10)',
              padding: '2px 7px',
              letterSpacing: '0.02em',
            }}
          >
            <ArrowUpRight size={9} />
            {trend}
          </span>
        )}
      </div>
      <div className="relative">
        <div className="font-display font-extrabold leading-none" style={{ fontSize: 30, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
          {value}
        </div>
        <div className="font-sans font-semibold uppercase mt-1.5" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(240,239,248,0.45)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
