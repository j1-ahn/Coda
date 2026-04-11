'use client';

import type { EQPreset } from './EQCanvas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReactMode = EQPreset['reactMode'];

interface ModeOption {
  value: ReactMode;
  label: string;
  icon: string; // unicode symbol
}

const MODES: ModeOption[] = [
  { value: 'pulse',     label: 'PULSE',     icon: '●'  },
  { value: 'ripple',    label: 'RIPPLE',    icon: '≈'  },
  { value: 'chromatic', label: 'CHROMATIC', icon: '◈'  },
  { value: 'warp',      label: 'WARP',      icon: '∿'  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EQReactModeSelectorProps {
  value: ReactMode;
  onChange: (mode: ReactMode) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EQReactModeSelector({ value, onChange }: EQReactModeSelectorProps) {
  return (
    <div className="px-3 py-2 flex flex-col gap-2 bg-cream-100 border-t border-cream-300">
      <span className="label-caps">React Mode</span>
      <div className="flex gap-1.5 flex-wrap">
        {MODES.map((mode) => {
          const isActive = value === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={[
                'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium tracking-widest uppercase',
                'rounded-none transition-none border',
                isActive
                  ? 'bg-ink-900 text-cream-100 border-ink-900'
                  : 'bg-transparent text-ink-500 border-cream-300 hover:border-ink-300 hover:text-ink-700',
              ].join(' ')}
              aria-pressed={isActive}
            >
              <span className="text-[13px] leading-none" aria-hidden="true">
                {mode.icon}
              </span>
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
