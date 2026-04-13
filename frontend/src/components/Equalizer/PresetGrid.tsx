'use client';

import type { EQPreset } from './EQCanvas';

// ---------------------------------------------------------------------------
// Default Presets
// ---------------------------------------------------------------------------

export const DEFAULT_PRESETS: EQPreset[] = [
  // ── Basic series ─────────────────────────────────────────────────────────
  { id: 'basic1',      name: 'BASIC 1',     reactMode: 'original',     colorTint: '#444440' },
  { id: 'basic2',      name: 'BASIC 2',     reactMode: 'original',      colorTint: '#9b5cf6' },
  { id: 'basic3',      name: 'BASIC 3',     reactMode: 'original', colorTint: '#00cfff' },
  { id: 'basic4',      name: 'BASIC 4',     reactMode: 'original',     colorTint: '#e87aa0' },
  { id: 'basic5',      name: 'BASIC 5',     reactMode: 'original',    colorTint: '#00c8b4' },
  // ── Canvas visualizer series ─────────────────────────────────────────────
  { id: 'waveform',    name: 'WAVEFORM',    reactMode: 'original',      colorTint: '#00c853' },
  { id: 'lissajous',   name: 'LISSAJOUS',   reactMode: 'original',    colorTint: '#1d6fff' },
  { id: 'magenta',     name: 'MAGENTA',     reactMode: 'original', colorTint: '#ff0090' },
  { id: 'ether',       name: 'ETHER',       reactMode: 'original',    colorTint: '#7dd3fc' },
  { id: 'radial',      name: 'RADIAL',      reactMode: 'original',     colorTint: '#ef4444' },
  { id: 'pixel',       name: 'PIXEL',       reactMode: 'original', colorTint: '#f59e0b' },
  { id: 'bloom',       name: 'BLOOM',       reactMode: 'original', colorTint: '#fb7185' },
  { id: 'horizon',     name: 'HORIZON',     reactMode: 'original', colorTint: '#f97316' },
  { id: 'aurora',      name: 'AURORA',      reactMode: 'original', colorTint: '#ffffff' },
  { id: 'ripple',      name: 'RIPPLE',      reactMode: 'original', colorTint: '#7c3aed' },
  { id: 'flow',        name: 'FLOW',        reactMode: 'original', colorTint: '#3b82f6' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PresetGridProps {
  presets?: EQPreset[];
  selectedId: string;
  onSelect: (preset: EQPreset) => void;
}

// ---------------------------------------------------------------------------
// PresetCard
// ---------------------------------------------------------------------------

interface PresetCardProps {
  preset: EQPreset;
  isSelected: boolean;
  onSelect: (preset: EQPreset) => void;
}

function PresetCard({ preset, isSelected, onSelect }: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(preset)}
      className={[
        'relative h-7 w-full overflow-hidden flex items-center justify-center',
        'transition-none',
        isSelected
          ? 'border-2 border-ink-900'
          : 'border border-cream-300 hover:border-ink-400',
      ].join(' ')}
      aria-pressed={isSelected}
      aria-label={preset.name}
    >
      {/* color swatch background */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: preset.colorTint + '55' }}
      />
      {/* name */}
      <span
        className="relative z-10 text-[8px] font-bold tracking-wider text-ink-900 leading-none text-center px-0.5"
        style={{ textShadow: `0 0 6px ${preset.colorTint}cc, 0 1px 2px rgba(0,0,0,0.6)` }}
      >
        {preset.name}
      </span>
      {/* selected dot */}
      {isSelected && (
        <div
          className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: preset.colorTint }}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PresetGrid
// ---------------------------------------------------------------------------

export default function PresetGrid({
  presets = DEFAULT_PRESETS,
  selectedId,
  onSelect,
}: PresetGridProps) {
  return (
    <div className="px-3 py-2 flex flex-col gap-1.5 bg-cream-100 border-t border-cream-300">
      <span className="label-caps">Preset</span>
      {/* 4열 × 2행 = 8개 표시, 나머지는 내부 스크롤 */}
      <div
        className="grid grid-cols-4 gap-1 overflow-y-auto"
        style={{ maxHeight: '128px' }}   /* 28px × 4rows + 4px × 3gaps + 4px buffer */
      >
        {presets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isSelected={preset.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
