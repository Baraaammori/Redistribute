import React from 'react';

type Status = 'pending' | 'processing' | 'done' | 'success' | 'failed' | 'scheduled' | 'uploading' | 'paused' | 'active' | 'trial' | 'pro';

const STATUS_MAP: Record<Status, { bg: string; fg: string; label: string }> = {
  pending:    { bg: 'rgba(245,166,35,0.10)',  fg: '#F5A623', label: 'pending' },
  processing: { bg: 'rgba(79,142,240,0.10)',  fg: '#4F8EF0', label: 'processing' },
  done:       { bg: 'rgba(14,210,160,0.10)',  fg: '#0ED2A0', label: 'done' },
  success:    { bg: 'rgba(14,210,160,0.10)',  fg: '#0ED2A0', label: 'success' },
  failed:     { bg: 'rgba(240,79,79,0.10)',   fg: '#F04F4F', label: 'failed' },
  scheduled:  { bg: 'rgba(108,71,255,0.12)',  fg: '#8B6AFF', label: 'scheduled' },
  uploading:  { bg: 'rgba(79,142,240,0.10)',  fg: '#4F8EF0', label: 'uploading' },
  paused:     { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(240,239,248,0.50)', label: 'paused' },
  active:     { bg: 'rgba(14,210,160,0.10)',  fg: '#0ED2A0', label: 'active' },
  trial:      { bg: 'rgba(108,71,255,0.12)',  fg: '#8B6AFF', label: 'trial' },
  pro:        { bg: 'rgba(108,71,255,0.12)',  fg: '#8B6AFF', label: 'pro' },
};

interface Props {
  status: Status;
  children?: React.ReactNode;
}

export function StatusBadge({ status, children }: Props) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span
      className="inline-flex items-center font-sans font-bold tracking-widest uppercase"
      style={{
        gap: 5, background: s.bg, color: s.fg,
        padding: '3px 9px', borderRadius: 999,
        fontSize: 10, letterSpacing: '0.06em', lineHeight: 1.4,
      }}
    >
      {(status === 'processing' || status === 'active') && (
        <span className="animate-pulse2 rounded-full" style={{ width: 5, height: 5, background: s.fg, flexShrink: 0 }} />
      )}
      {children ?? s.label}
    </span>
  );
}
