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
        sans: ['Inter', 'Pretendard', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
