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
  { id: 'singularity', name: 'SINGULARITY', reactMode: 'original', colorTint: '#6366f1' },
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
  const tintStyle = {
    backgroundColor: preset.colorTint + '33',
    borderColor: preset.colorTint + '66',
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(preset)}
      className={[
        'relative aspect-square w-full overflow-hidden flex flex-col items-center justify-center gap-1',
        'transition-none',
        isSelected
          ? 'border-2 border-ink-900'
          : 'border border-cream-300 hover:border-ink-300',
      ].join(' ')}
      aria-pressed={isSelected}
      aria-label={preset.name}
    >
      <div className="absolute inset-0" style={tintStyle} />
      <div className="absolute inset-0 bg-ink-900/20" />
      <span
        className="relative z-10 label-caps text-cream-100 text-center leading-tight px-1"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {preset.name}
      </span>
      {isSelected && (
        <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-cream-100 rounded-full" />
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
    <div className="px-3 py-2 flex flex-col gap-2 bg-cream-100 border-t border-cream-300">
      <span className="label-caps">Preset</span>
      <div
        className="grid grid-cols-4 gap-1.5 overflow-y-auto"
        style={{ maxHeight: '180px' }}
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
