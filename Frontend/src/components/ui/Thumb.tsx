import React from 'react';
import { Play } from 'lucide-react';

type Hue = 'purple' | 'teal' | 'amber' | 'blue' | 'pink' | 'slate';

const GRADS: Record<Hue, string> = {
  purple: 'linear-gradient(135deg, #2A1F4A, #432D7E)',
  teal:   'linear-gradient(135deg, #0F3A35, #144D43)',
  amber:  'linear-gradient(135deg, #3D2E0F, #5A4216)',
  blue:   'linear-gradient(135deg, #142B47, #1F3F66)',
  pink:   'linear-gradient(135deg, #3D1230, #5C1B4A)',
  slate:  'linear-gradient(135deg, #1A1A22, #25252F)',
};

interface Props {
  w?: number | string;
  h?: number | string;
  hue?: Hue;
  r?: number;
  className?: string;
}

export function Thumb({ w = 80, h = 48, hue = 'slate', r = 6, className = '' }: Props) {
  const iconSize = Math.min(typeof w === 'number' ? w : 80, typeof h === 'number' ? h : 48) * 0.32;
  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 ${className}`}
      style={{
        width: w, height: h, borderRadius: r,
        background: GRADS[hue],
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <Play size={iconSize} fill="currentColor" strokeWidth={0} />
      </div>
    </div>
  );
}
