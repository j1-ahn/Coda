import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#f7f5f0',
          100: '#edeae3',
          200: '#e4e0d8',
          300: '#d4cfc6',
          400: '#c4bfb5',
          500: '#b4afa4',
        },
        ink: {
          900: '#1a1a16',
          700: '#3a3a34',
          500: '#6b6760',
          300: '#9b9891',
          100: '#ccc9c4',
        },
        accent: {
          DEFAULT: '#c4a882',
          light: '#d4bc9e',
          dark: '#a88c6a',
          50: '#faf6f0',
          100: '#f0e8da',
        },
        tan: '#c4a882',
        // Keep legacy tokens for Canvas/WebGL components
        'coda-bg': '#0a0a0a',
        'coda-surface': '#141414',
        'coda-surface-2': '#1e1e1e',
        'coda-border': '#2a2a2a',
        'coda-gold': '#e5c97e',
        'coda-gold-dim': '#9b8550',
        'coda-fg': '#ededed',
        'coda-fg-dim': '#888888',
      },
      fontFamily: {
        // Body / UI — dense app surfaces. Keep neutral, readable at small sizes.
        sans: ['Inter', 'Pretendard', 'sans-serif'],
        // Display / brand moments — editorial warmth. Instrument Serif is the
        // character carrier (logo, empty states, onboarding). Georgia as
        // fallback keeps the italic cadence if the web font fails.
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        // Explicit display alias for intent clarity at call sites.
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        // Tabular numerics, timecodes, paths.
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      // Modular type scale (rem-based, fixed — this is an app UI, not content).
      // Pair with font-family and color for hierarchy; don't rely on size alone.
      //   caption  10px   → label-caps, meta
      //   tiny     11px   → timestamps, badges
      //   small    12px   → secondary UI body
      //   base     14px   → primary UI body
      //   lg       16px   → section body
      //   xl       20px   → onboarding heading
      //   2xl      24px   → modal titles
      //   3xl      32px   → peak moments
      //   4xl      44px   → empty-state display
      fontSize: {
        'caption': ['0.625rem', { lineHeight: '1.4', letterSpacing: '0.14em' }],
        'tiny':    ['0.6875rem', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
};

export default config;
