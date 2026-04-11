'use client';

import { useRef } from 'react';
import type { EQPreset } from './EQCanvas';

// ---------------------------------------------------------------------------
// Default Presets
// ---------------------------------------------------------------------------

export const DEFAULT_PRESETS: EQPreset[] = [
  // ── 이퀄 series — each is a unique Canvas 2D visualizer ──────────────────
  { id: 'eclipse',     name: 'ECLIPSE',     reactMode: 'pulse',     colorTint: '#00e5c8' },
  { id: 'waveform',    name: 'WAVEFORM',    reactMode: 'warp',      colorTint: '#00c853' },
  { id: 'lissajous',   name: 'LISSAJOUS',   reactMode: 'ripple',    colorTint: '#1d6fff' },
  { id: 'sparks',      name: 'SPARKS',      reactMode: 'pulse',     colorTint: '#ff6b2b' },
  { id: 'magenta',     name: 'MAGENTA',     reactMode: 'chromatic', colorTint: '#ff0090' },
  { id: 'ether',       name: 'ETHER',       reactMode: 'ripple',    colorTint: '#7dd3fc' },
  { id: 'radial',      name: 'RADIAL',      reactMode: 'pulse',     colorTint: '#ef4444' },
  // ── 이미지이퀄 series ────────────────────────────────────────────────────
  { id: 'terrain',     name: 'TERRAIN',     reactMode: 'warp',      colorTint: '#a16207' },
  { id: 'orbit',       name: 'ORBIT',       reactMode: 'pulse',     colorTint: '#60a5fa' },
  { id: 'pixel',       name: 'PIXEL',       reactMode: 'chromatic', colorTint: '#f59e0b' },
  { id: 'bloom',       name: 'BLOOM',       reactMode: 'ripple',    colorTint: '#fb7185' },
  { id: 'horizon',     name: 'HORIZON',     reactMode: 'warp',      colorTint: '#f97316' },
  { id: 'singularity', name: 'SINGULARITY', reactMode: 'ripple',    colorTint: '#6366f1' },
  // ── Custom ──────────────────────────────────────────────────────────────
  { id: 'custom',      name: 'CUSTOM',      reactMode: 'pulse',     colorTint: '#c4a882' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PresetGridProps {
  presets?: EQPreset[];
  selectedId: string;
  onSelect: (preset: EQPreset) => void;
  onCustomImage: (url: string, preset: EQPreset) => void;
}

// ---------------------------------------------------------------------------
// PresetCard
// ---------------------------------------------------------------------------

interface PresetCardProps {
  preset: EQPreset;
  isSelected: boolean;
  onSelect: (preset: EQPreset) => void;
  onCustomImage?: (url: string, preset: EQPreset) => void;
}

function PresetCard({ preset, isSelected, onSelect, onCustomImage }: PresetCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isCustom = preset.id === 'custom';

  const handleClick = () => {
    if (isCustom) {
      fileRef.current?.click();
    } else {
      onSelect(preset);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onSelect({ ...preset, imagePath: url });
    onCustomImage?.(url, preset);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const tintStyle = {
    backgroundColor: preset.colorTint + '33', // 20% opacity
    borderColor: preset.colorTint + '66',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'relative aspect-square w-full overflow-hidden flex flex-col items-center justify-center gap-1',
        'transition-none',
        isSelected
          ? 'border-2 border-ink-900'
          : 'border border-cream-300 hover:border-ink-300',
      ].join(' ')}
      style={!isSelected ? {} : undefined}
      aria-pressed={isSelected}
      aria-label={preset.name}
    >
      {/* Background — color tint swatch for all presets */}
      {isCustom ? (
        /* Custom: + icon placeholder */
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: '#d4cfc6' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6b6760" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8" />
            <line x1="10" y1="6" x2="10" y2="14" />
            <line x1="6" y1="10" x2="14" y2="10" />
          </svg>
        </div>
      ) : (
        /* Color-tinted placeholder for presets without loaded image */
        <div className="absolute inset-0" style={tintStyle} />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-ink-900/20" />

      {/* Label */}
      <span
        className="relative z-10 label-caps text-cream-100 text-center leading-tight px-1"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {preset.name}
      </span>

      {/* Selected indicator dot */}
      {isSelected && (
        <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-cream-100 rounded-full" />
      )}

      {/* Hidden file input for custom */}
      {isCustom && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
          tabIndex={-1}
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
  onCustomImage,
}: PresetGridProps) {
  return (
    <div className="px-3 py-2 flex flex-col gap-2 bg-cream-100 border-t border-cream-300">
      <span className="label-caps">Preset</span>
      {/* 4 columns, max-height scroll so EQ canvas keeps its space */}
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
            onCustomImage={onCustomImage}
          />
        ))}
      </div>
    </div>
  );
}
