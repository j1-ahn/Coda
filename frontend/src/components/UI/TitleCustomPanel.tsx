'use client';

import { useCodaStore } from '@/store/useCodaStore';
import {
  TITLE_MODES,
  GROUP_PRESETS,
  PRESETS_3D,
  ANIM_3D,
  type PresetGroup,
  type PlayMode,
} from './titlePresets';

export default function TitleCustomPanel({ group = 'gfx' }: { group?: PresetGroup }) {
  const titleText          = useCodaStore((s) => s.titleText);
  const titleMode          = useCodaStore((s) => s.titleMode);
  const titleFontPreset    = useCodaStore((s) => s.titleFontPreset);
  const titleSubtext       = useCodaStore((s) => s.titleSubtext);
  const titlePlayMode      = useCodaStore((s) => s.titlePlayMode);
  const titleRender3D      = useCodaStore((s) => s.titleRender3D);
  const title3DPreset      = useCodaStore((s) => s.title3DPreset);
  const title3DAnimate     = useCodaStore((s) => s.title3DAnimate);
  const setTitleText       = useCodaStore((s) => s.setTitleText);
  const setTitleMode       = useCodaStore((s) => s.setTitleMode);
  const setTitlePlayMode   = useCodaStore((s) => s.setTitlePlayMode);
  const setTitleFontPreset = useCodaStore((s) => s.setTitleFontPreset);
  const titleFontScale     = useCodaStore((s) => s.titleFontScale);
  const setTitleSubtext    = useCodaStore((s) => s.setTitleSubtext);
  const setTitleFontScale  = useCodaStore((s) => s.setTitleFontScale);
  const setTitleRender3D   = useCodaStore((s) => s.setTitleRender3D);
  const setTitle3DPreset   = useCodaStore((s) => s.setTitle3DPreset);
  const setTitle3DAnimate  = useCodaStore((s) => s.setTitle3DAnimate);

  return (
    <div className="px-3 py-2 flex flex-col gap-2">

      {/* Row 1: 6 font preset buttons */}
      <div className="flex gap-1">
        {GROUP_PRESETS[group].map((fp) => {
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
                  ...(active && fp.preview.textShadow
                    ? { textShadow: 'none', color: '#d4cfc6' }
                    : {}),
                }}
              >
                {fp.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Row 2: Title + Subtitle + Anim all in one line */}
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
              {TITLE_MODES.map((m) => (
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
            <div className="flex items-center gap-1 border-l border-cream-300 pl-1.5">
              <span className="text-[8px] text-ink-400 label-caps">SIZE</span>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.05}
                value={titleFontScale}
                onChange={(e) => setTitleFontScale(Number(e.target.value))}
                className="w-14 h-3"
              />
              <span className="text-[8px] text-ink-500 tabular-nums w-6 text-right">
                {Math.round(titleFontScale * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: 3D render toggle + 3D presets */}
      <div className="flex items-center gap-2 mt-1 border-t border-cream-300 pt-2">
        <button
          onClick={() => setTitleRender3D(!titleRender3D)}
          className={`px-2 py-1 text-[9px] label-caps border transition-colors ${
            titleRender3D
              ? 'bg-ink-900 text-cream-100 border-ink-900'
              : 'text-ink-500 border-cream-300 hover:border-ink-500'
          }`}
        >
          3D
        </button>

        {titleRender3D && (
          <>
            <div className="flex gap-0.5">
              {PRESETS_3D.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setTitle3DPreset(p.value)}
                  title={p.label}
                  className={`w-5 h-5 border transition-colors ${
                    title3DPreset === p.value
                      ? 'border-ink-900 ring-1 ring-ink-900'
                      : 'border-cream-300 hover:border-ink-400'
                  }`}
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </div>
            <div className="flex gap-0 border-l border-cream-300 pl-1.5">
              {ANIM_3D.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setTitle3DAnimate(a.value)}
                  className={`px-1.5 py-0.5 text-[8px] label-caps border transition-colors ${
                    title3DAnimate === a.value
                      ? 'bg-ink-900 text-cream-100 border-ink-900'
                      : 'text-ink-500 border-cream-300 hover:text-ink-900 hover:border-ink-500'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
