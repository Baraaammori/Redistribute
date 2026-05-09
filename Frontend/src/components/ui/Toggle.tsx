import React from 'react';

interface Props {
  on: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ on, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!on)}
      disabled={disabled}
      className={`relative flex-shrink-0 rounded-full border-0 p-0 transition-colors duration-200 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ width: 36, height: 20, background: on ? '#6C47FF' : 'rgba(255,255,255,0.12)' }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-all duration-200"
        style={{ left: on ? 18 : 2, width: 16, height: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
      />
    </button>
  );
}
