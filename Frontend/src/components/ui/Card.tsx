import React from 'react';

interface Props {
  children: React.ReactNode;
  padding?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ children, padding = 24, style, className = '' }: Props) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: '#0F0F17',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: typeof padding === 'number' ? `${padding}px` : padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
