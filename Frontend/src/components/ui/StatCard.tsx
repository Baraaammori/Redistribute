import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  color?: string;
  colorBg?: string;
  value: string | number;
  label: string;
  trend?: string;
}

export function StatCard({ icon: Icon, color = '#6C47FF', colorBg = 'rgba(108,71,255,0.12)', value, label, trend }: Props) {
  return (
    <div
      className="flex flex-col gap-3.5 rounded-2xl"
      style={{
        background: '#0F0F17',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 22px',
        minHeight: 120,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 32, height: 32, background: colorBg, color }}
        >
          <Icon size={16} color={color} />
        </div>
        {trend && (
          <span className="font-mono" style={{ fontSize: 10, color: 'rgba(240,239,248,0.50)', letterSpacing: '0.02em' }}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <div className="font-display font-extrabold leading-none" style={{ fontSize: 28, letterSpacing: '-0.04em', color: '#F0EFF8' }}>
          {value}
        </div>
        <div className="font-sans font-semibold uppercase mt-2" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(240,239,248,0.50)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
