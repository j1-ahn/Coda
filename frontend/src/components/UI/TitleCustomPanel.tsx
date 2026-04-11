'use client';

import { useCodaStore } from '@/store/useCodaStore';
import type { CodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TitleMode = CodaStore['titleMode'];

const MODES: { value: TitleMode; label: string }[] = [
  { value: 'hero-to-corner', label: 'HERO→CORNER' },
  { value: 'ambient-object', label: 'AMBIENT' },
  { value: 'breathing',      label: 'BREATHING' },
];

// ---------------------------------------------------------------------------
// TitleCustomPanel
// ---------------------------------------------------------------------------

export default function TitleCustomPanel() {
  const titleText    = useCodaStore((s) => s.titleText);
  const titleMode    = useCodaStore((s) => s.titleMode);
  const setTitleText = useCodaStore((s) => s.setTitleText);
  const setTitleMode = useCodaStore((s) => s.setTitleMode);

  return (
    <div className="flex flex-col gap-0 divide-y divide-cream-300">

      {/* ── TITLE TEXT ──────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        <span className="label-caps">Title Text</span>
        <input
          type="text"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          placeholder="Coda Studio"
          className="border-b border-cream-300 bg-transparent text-ink-900 text-sm w-full outline-none py-1
            placeholder:text-ink-300 focus:border-ink-500 transition-colors"
        />
      </div>

      {/* ── PERSIST MODE ────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 flex flex-col gap-2">
        <span className="label-caps">Persist Mode</span>
        <div className="flex gap-0">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setTitleMode(m.value)}
              className={`flex-1 py-2 text-[9px] tracking-wider uppercase border rounded-none
                transition-colors
                ${titleMode === m.value
                  ? 'bg-ink-900 text-cream-100 border-ink-900'
                  : 'bg-transparent text-ink-500 border-cream-300 hover:text-ink-900 hover:border-ink-500'
                }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-300 leading-relaxed">
          {titleMode === 'hero-to-corner' && '중앙 히어로 → 코너 축소'}
          {titleMode === 'ambient-object' && '공간 내 3D 오브젝트로 상주'}
          {titleMode === 'breathing'      && '명멸(페이드 인/아웃) 반복'}
        </p>
      </div>

    </div>
  );
}
