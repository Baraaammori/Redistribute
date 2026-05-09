import React from 'react';
import { LucideIcon } from 'lucide-react';

type BtnKind = 'primary' | 'ghost' | 'soft' | 'danger' | 'dark' | 'light';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps {
  kind?: BtnKind;
  size?: BtnSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: React.ReactNode;
  full?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const KIND_STYLES: Record<BtnKind, { bg: string; fg: string; border: string; shadow?: string }> = {
  primary: { bg: '#6C47FF', fg: '#fff', border: 'transparent', shadow: '0 0 32px rgba(108,71,255,0.35), 0 1px 2px rgba(0,0,0,0.4)' },
  ghost:   { bg: 'transparent', fg: '#F0EFF8', border: 'rgba(255,255,255,0.10)' },
  soft:    { bg: 'rgba(255,255,255,0.04)', fg: '#F0EFF8', border: 'rgba(255,255,255,0.07)' },
  danger:  { bg: 'rgba(240,79,79,0.10)', fg: '#F04F4F', border: 'rgba(240,79,79,0.2)' },
  dark:    { bg: '#0C0B09', fg: '#F5F4F0', border: 'transparent' },
  light:   { bg: '#fff', fg: '#0C0B09', border: '#0C0B09' },
};

const SIZE_STYLES: Record<BtnSize, { padding: string; fontSize: number }> = {
  sm: { padding: '6px 14px',  fontSize: 12 },
  md: { padding: '10px 20px', fontSize: 13 },
  lg: { padding: '14px 28px', fontSize: 14 },
};

export function Btn({ kind = 'primary', size = 'md', icon: Icon, iconRight: IconRight, children, full, disabled, onClick, type = 'button', className = '' }: BtnProps) {
  const k = KIND_STYLES[kind];
  const s = SIZE_STYLES[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium transition-colors whitespace-nowrap ${full ? 'w-full' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
      style={{
        background: k.bg, color: k.fg,
        border: `1px solid ${k.border}`,
        padding: s.padding, fontSize: s.fontSize,
        boxShadow: k.shadow ?? 'none',
      }}
    >
      {Icon && <Icon size={14} />}
      {children}
      {IconRight && <IconRight size={14} />}
    </button>
  );
}
