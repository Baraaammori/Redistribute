import React from 'react';

interface Props {
  children: React.ReactNode;
  padding?: number | string;
  className?: string;
  style?: React.CSSProperties;
  glow?: string;      // hex color for glow border on hover
  onClick?: () => void;
  animate?: boolean;
  delay?: number;
}

export function Card({ children, padding = 20, className = '', style = {}, glow, onClick, animate = true, delay = 0 }: Props) {
  return (
    <div
      className={`rounded-2xl ${animate ? 'animate-enter' : ''} ${onClick ? 'card-hover cursor-pointer' : ''} ${className}`}
      style={{
        background: '#0F0F17',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: typeof padding === 'number' ? `${padding}px` : padding,
        animationDelay: `${delay}ms`,
        transition: 'border-color 200ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease',
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={glow ? (e => { (e.currentTarget as HTMLElement).style.borderColor = `${glow}50`; }) : undefined}
      onMouseLeave={glow ? (e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }) : undefined}
    >
      {children}
    </div>
  );
}
