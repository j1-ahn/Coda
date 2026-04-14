'use client';

import { useCodaStore } from '@/store/useCodaStore';
import type { CodaStore } from '@/store/useCodaStore';

type PlayMode = CodaStore['titlePlayMode'];

type TitleMode  = CodaStore['titleMode'];
type FontPreset = CodaStore['titleFontPreset'];

const MODES: { value: TitleMode; label: string }[] = [
  { value: 'hero-to-corner', label: 'HERO'    },
  { value: 'ambient-object', label: 'FLOAT'   },
  { value: 'breathing',      label: 'PULSE'   },
  { value: 'type',           label: 'TYPE'    },
  { value: 'fade',           label: 'FADE'    },
  { value: 'rise',           label: 'RISE'    },
  { value: 'zoom',           label: 'ZOOM'    },
  { value: 'blur',           label: 'BLUR'    },
  { value: 'glide',          label: 'GLIDE'   },
  { value: 'split',          label: 'SPLIT'   },
  { value: 'flicker',        label: 'FLICKER' },
  { value: 'skate',          label: 'SKATE'   },
];

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
  const titleText          = useCodaStore((s) => s.titleText);
  const titleMode          = useCodaStore((s) => s.titleMode);
  const titleFontPreset    = useCodaStore((s) => s.titleFontPreset);
  const titleSubtext       = useCodaStore((s) => s.titleSubtext);
  const titlePlayMode      = useCodaStore((s) => s.titlePlayMode);
  const setTitleText       = useCodaStore((s) => s.setTitleText);
  const setTitleMode       = useCodaStore((s) => s.setTitleMode);
  const setTitlePlayMode   = useCodaStore((s) => s.setTitlePlayMode);
  const setTitleFontPreset = useCodaStore((s) => s.setTitleFontPreset);
  const setTitleSubtext    = useCodaStore((s) => s.setTitleSubtext);

  return (
    <div className="px-3 py-2 flex flex-col gap-2">

      {/* Row 1: 6 EQ font preset buttons */}
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

      {/* Row 2: Title + Subtitle + Anim */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-0.5 w-[220px] shrink-0">
          <span className="label-caps">Title</span>
          <input
            type="text"
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            placeholder="Coda Studio"
            className="border-b border-cream-300 bg-transparent text-ink-900 text-xs w-full outline-none py-0.5
              placeholder:text-ink-300 focus:border-ink-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-0.5 w-[186px] shrink-0">
          <span className="label-caps">Subtitle</span>
          <input
            type="text"
            value={titleSubtext}
            onChange={(e) => setTitleSubtext(e.target.value)}
            placeholder="Artist · Track"
            className="border-b border-cream-300 bg-transparent text-ink-900 text-xs w-full outline-none py-0.5
              placeholder:text-ink-300 focus:border-ink-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          <span className="label-caps">Anim</span>
          <div className="flex items-center gap-1">
            <div className="flex gap-0">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setTitleMode(m.value)}
                  className={`px-1.5 py-0.5 text-[9.5px] tracking-tight uppercase border transition-colors whitespace-nowrap ${
                    titleMode === m.value
                      ? 'bg-ink-900 text-cream-100 border-ink-900'
                      : 'text-ink-500 border-cream-300 hover:text-ink-900 hover:border-ink-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-0 border-l border-cream-300 pl-1">
              {(['loop', 'once'] as PlayMode[]).map((pm, i) => (
                <button
                  key={pm}
                  onClick={() => setTitlePlayMode(pm)}
                  title={pm === 'loop' ? '무한 반복' : '1회 후 사라짐'}
                  className={`w-5 h-5 text-[9px] font-bold border transition-colors ${
                    titlePlayMode === pm
                      ? 'bg-ink-900 text-cream-100 border-ink-900'
                      : 'text-ink-500 border-cream-300 hover:text-ink-900 hover:border-ink-500'
                  }`}
                >
                  {i === 0 ? 'L' : '1'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
