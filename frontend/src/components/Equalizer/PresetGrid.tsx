'use client';

import { useRef } from 'react';
import type { EQPreset } from './EQCanvas';

// ---------------------------------------------------------------------------
// Default Presets
// ---------------------------------------------------------------------------

export const DEFAULT_PRESETS: EQPreset[] = [
  // ── 이퀄 series ─────────────────────────────────────────────────────────
  {
    id: 'eclipse',
    name: 'ECLIPSE',
    imagePath: '/presets/이퀄2.png',
    reactMode: 'pulse',
    colorTint: '#00e5c8',
    // Black-hole corona — bass pulse swells the teal glow
  },
  {
    id: 'waveform',
    name: 'WAVEFORM',
    imagePath: '/presets/이퀄3.png',
    reactMode: 'warp',
    colorTint: '#00c853',
    // Aphex Twin oscilloscope — warp distorts the green sine lines
  },
  {
    id: 'lissajous',
    name: 'LISSAJOUS',
    imagePath: '/presets/이퀄4.png',
    reactMode: 'ripple',
    colorTint: '#1d6fff',
    // Blue geometric Lissajous figure — ripple pulses the loops
  },
  {
    id: 'sparks',
    name: 'SPARKS',
    imagePath: '/presets/이퀄5.png',
    reactMode: 'pulse',
    colorTint: '#ff6b2b',
    // Fireworks explosion — pulse scales the ember burst
  },
  {
    id: 'magenta',
    name: 'MAGENTA',
    imagePath: '/presets/이퀄6.png',
    reactMode: 'chromatic',
    colorTint: '#ff0090',
    // Hot-pink blob — chromatic splits the neon edges on treble
  },
  {
    id: 'ether',
    name: 'ETHER',
    imagePath: '/presets/이퀄7.png',
    reactMode: 'ripple',
    colorTint: '#7dd3fc',
    // Soft blue cloud shape — ripple breathes the diffused edges
  },
  {
    id: 'radial',
    name: 'RADIAL',
    imagePath: '/presets/이퀄8.png',
    reactMode: 'pulse',
    colorTint: '#ef4444',
    // Circular waveform dial — pulse expands the radial bars
  },

  // ── 이미지이퀄 series ────────────────────────────────────────────────────
  {
    id: 'terrain',
    name: 'TERRAIN',
    imagePath: '/presets/이미지이퀄3.png',
    reactMode: 'warp',
    colorTint: '#a16207',
    // Dark mesh landscape — warp rolls the topology
  },
  {
    id: 'orbit',
    name: 'ORBIT',
    imagePath: '/presets/이미지이퀄4.png',
    reactMode: 'pulse',
    colorTint: '#60a5fa',
    // Planet glow auth screen — pulse swells the celestial corona
  },
  {
    id: 'pixel',
    name: 'PIXEL',
    imagePath: '/presets/이미지이퀄5.png',
    reactMode: 'chromatic',
    colorTint: '#f59e0b',
    // Pixel-art figure — chromatic aberration splits the dot matrix
  },
  {
    id: 'bloom',
    name: 'BLOOM',
    imagePath: '/presets/이미지이퀄6.png',
    reactMode: 'ripple',
    colorTint: '#fb7185',
    // Watercolor flower vase — ripple shimmers the petals
  },
  {
    id: 'horizon',
    name: 'HORIZON',
    imagePath: '/presets/이미지이퀄7.png',
    reactMode: 'warp',
    colorTint: '#f97316',
    // Sky-to-sunset gradient — warp undulates the colour bands
  },
  {
    id: 'singularity',
    name: 'SINGULARITY',
    imagePath: '/presets/이미지이퀄8.png',
    reactMode: 'ripple',
    colorTint: '#6366f1',
    // Jon Hopkins player — ripple traces the waveform spine
  },

  // ── Custom ──────────────────────────────────────────────────────────────
  {
    id: 'custom',
    name: 'CUSTOM',
    imagePath: '',
    reactMode: 'pulse',
    colorTint: '#c4a882',
  },
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
      {/* Background — image or placeholder */}
      {preset.imagePath !== '' && preset.id !== 'custom' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preset.imagePath}
          alt={preset.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : isCustom ? (
        /* Custom placeholder */
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
