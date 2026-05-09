/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans:    ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'monospace'],
      },
      colors: {
        rd: {
          // Dark dashboard surfaces
          bg:       '#08080E',
          surface:  '#0F0F17',
          raised:   '#16161F',
          sidebar:  '#060609',
          // Text
          text:     '#F0EFF8',
          text2:    'rgba(240,239,248,0.50)',
          text3:    'rgba(240,239,248,0.25)',
          text4:    'rgba(240,239,248,0.12)',
          // Borders
          border:   'rgba(255,255,255,0.07)',
          border2:  'rgba(255,255,255,0.12)',
          divider:  'rgba(255,255,255,0.04)',
          // Accents
          purple:   '#6C47FF',
          purple2:  '#8B6AFF',
          'purple-bg':   'rgba(108,71,255,0.12)',
          'purple-glow': 'rgba(108,71,255,0.25)',
          teal:     '#0ED2A0',
          'teal-bg':'rgba(14,210,160,0.10)',
          amber:    '#F5A623',
          'amber-bg':'rgba(245,166,35,0.10)',
          red:      '#F04F4F',
          'red-bg': 'rgba(240,79,79,0.10)',
          blue:     '#4F8EF0',
          'blue-bg':'rgba(79,142,240,0.10)',
          // Landing (cream)
          cream:    '#F5F4F0',
          ink:      '#0C0B09',
          ink2:     '#706D64',
          'ink-border': 'rgba(0,0,0,0.08)',
        },
      },
      letterSpacing: {
        tightest: '-0.045em',
        tighter2: '-0.04em',
        tight2:   '-0.03em',
        tight3:   '-0.02em',
        wide2:    '0.08em',
        wide3:    '0.10em',
        wide4:    '0.12em',
      },
      keyframes: {
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        fadeup: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        blink: { '0%,49%': { opacity: '1' }, '50%,100%': { opacity: '0' } },
      },
      animation: {
        pulse2:  'pulse2 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
        fadeup:  'fadeup 600ms ease-out both',
        blink:   'blink 1s steps(1) infinite',
      },
    },
  },
  plugins: [],
};
