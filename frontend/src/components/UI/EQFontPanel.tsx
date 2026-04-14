'use client';

import { useCodaStore } from '@/store/useCodaStore';
import type { CodaStore } from '@/store/useCodaStore';

type FontPreset = CodaStore['titleFontPreset'];

interface PresetDef {
  value: FontPreset;
  label: string;
  preview: React.CSSProperties;
}

const EQ_FONT_PRESETS: PresetDef[] = [
  {
    value: 'neon',
    label: 'HEAT',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      backgroundImage: 'linear-gradient(160deg, #fff1a0, #ff5500)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'graffiti',
    label: 'GRAFT',
    preview: {
      fontFamily: "'Permanent Marker', cursive",
      fontWeight: 400,
      letterSpacing: '0.03em',
      backgroundImage: 'linear-gradient(135deg, #ff6b35, #f7c59f)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'vapor',
    label: 'VAPOR',
    preview: {
      fontFamily: "'Cormorant Garamond', serif",
      fontStyle: 'italic',
      fontWeight: 300,
      letterSpacing: '0.12em',
      backgroundImage: 'linear-gradient(135deg, #ffb3d9, #c084fc, #818cf8)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'chrome',
    label: 'SCRIPT',
    preview: {
      fontFamily: "'Dancing Script', cursive",
      fontWeight: 700,
      letterSpacing: '0.02em',
      backgroundImage: 'linear-gradient(160deg, #fffbe8, #d4b870)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'dark',
    label: '한글',
    preview: {
      fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
      fontWeight: 800,
      letterSpacing: '-0.02em',
      backgroundImage: 'linear-gradient(160deg, #ffffff, #aaaaaa)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'ice',
    label: 'WIRE',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.10em',
      WebkitTextStroke: '1px rgba(255,255,255,0.82)',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    },
  },
];

export default function EQFontPanel() {
  const titleFontPreset    = useCodaStore((s) => s.titleFontPreset);
  const setTitleFontPreset = useCodaStore((s) => s.setTitleFontPreset);

  return (
    <div className="px-3 py-2 flex flex-col gap-2">

      {/* EQ-specific font preset buttons (HEAT, GRAFT, VAPOR, SCRIPT, 한글, WIRE) */}
      <div className="flex gap-1">
        {EQ_FONT_PRESETS.map((fp) => {
          const active = titleFontPreset === fp.value;
          return (
            <button
              key={fp.value}
              onClick={() => setTitleFontPreset(fp.value)}
              title={fp.label}
              className={`flex-1 py-1.5 border transition-colors ${
                active ? 'border-ink-900 bg-ink-900' : 'border-cream-300 hover:border-ink-400'
              }`}
            >
              <span
                style={{
                  ...fp.preview,
                  fontSize: '11px',
                  lineHeight: 1,
                  display: 'block',
                  ...(active && fp.preview.WebkitTextFillColor
                    ? { WebkitTextFillColor: '#d4cfc6', backgroundImage: 'none', color: '#d4cfc6' }
                    : {}),
                  ...(active && fp.preview.color && !fp.preview.WebkitTextFillColor
                    ? { color: '#d4cfc6' }
                    : {}),
                }}
              >
                {fp.label}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
