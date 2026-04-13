'use client';

import { useCodaStore } from '@/store/useCodaStore';
import type { CodaStore } from '@/store/useCodaStore';

type LyricPreset = CodaStore['lyricFontPreset'];
type LyricColorStyle = CodaStore['lyricColorStyle'];

interface PresetDef {
  value: LyricPreset;
  label: string;
  preview: React.CSSProperties;
}

const LYRIC_PRESETS: PresetDef[] = [
  {
    value: 'clean',
    label: 'CLEAN',
    preview: {
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      fontWeight: 400,
      letterSpacing: '0.02em',
      color: '#ffffff',
    },
  },
  {
    value: 'mist',
    label: 'MIST',
    preview: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 300,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.55)',
    },
  },
  {
    value: 'slab',
    label: 'SLAB',
    preview: {
      fontFamily: "'Oswald', sans-serif",
      fontWeight: 600,
      letterSpacing: '-0.01em',
      textTransform: 'uppercase',
      color: '#f0ebe2',
    },
  },
  {
    value: 'glow',
    label: 'GLOW',
    preview: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      letterSpacing: '0.04em',
      color: '#ffffff',
      textShadow: '0 0 12px rgba(255,255,255,0.7)',
    },
  },
  {
    value: 'outline',
    label: 'LINE',
    preview: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      WebkitTextStroke: '0.8px rgba(255,255,255,0.75)',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    },
  },
  {
    value: 'kr',
    label: '한글',
    preview: {
      fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: '#e8e3da',
    },
  },
];

const COLOR_STYLES: { value: LyricColorStyle; label: string; style: React.CSSProperties; bgStyle?: React.CSSProperties }[] = [
  {
    value: 'white',
    label: '흰글',
    style: { color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' },
  },
  {
    value: 'black',
    label: '검글',
    style: { color: '#000000', textShadow: '0 1px 3px rgba(255,255,255,0.4)' },
  },
  {
    value: 'outline-black',
    label: '테두리',
    style: {
      color: '#ffffff',
      textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
    },
  },
  {
    value: 'box',
    label: '박스',
    style: { color: '#ffffff' },
    bgStyle: {
      background: 'rgba(0,0,0,0.65)',
      padding: '0.2em 0.6em',
      borderRadius: '2px',
    },
  },
];

export default function LyricFontPanel() {
  const lyricFontPreset    = useCodaStore((s) => s.lyricFontPreset);
  const setLyricFontPreset = useCodaStore((s) => s.setLyricFontPreset);
  const lyricColorStyle    = useCodaStore((s) => s.lyricColorStyle);
  const setLyricColorStyle = useCodaStore((s) => s.setLyricColorStyle);

  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      {/* 폰트 프리셋 */}
      <div className="grid grid-cols-6 gap-0.5">
        {LYRIC_PRESETS.map((fp) => {
          const active = lyricFontPreset === fp.value;
          return (
            <button
              key={fp.value}
              onClick={() => setLyricFontPreset(fp.value)}
              title={fp.label}
              className={`py-1.5 border transition-colors ${
                active ? 'border-ink-900 bg-ink-900' : 'border-cream-300 hover:border-ink-400'
              }`}
            >
              <span
                style={{
                  ...fp.preview,
                  fontSize: '11px',
                  lineHeight: 1,
                  display: 'block',
                  ...(active
                    ? {
                        color: '#d4cfc6',
                        WebkitTextFillColor: '#d4cfc6',
                        backgroundImage: 'none',
                        WebkitTextStroke: 'unset',
                        textShadow: 'none',
                      }
                    : {}),
                }}
              >
                {fp.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 색상 스타일 */}
      <div className="grid grid-cols-4 gap-0.5">
        {COLOR_STYLES.map((cs) => {
          const active = lyricColorStyle === cs.value;
          return (
            <button
              key={cs.value}
              onClick={() => setLyricColorStyle(cs.value)}
              title={cs.label}
              className={`py-1 border transition-colors ${
                active ? 'border-ink-900 bg-ink-900' : 'border-cream-300 hover:border-ink-400'
              }`}
            >
              <span
                className="block text-[10px] leading-tight"
                style={active ? { color: '#d4cfc6' } : { color: '#666' }}
              >
                {cs.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
