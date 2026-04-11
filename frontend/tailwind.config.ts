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
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
