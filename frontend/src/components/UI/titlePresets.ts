/**
 * Title preset catalog — fonts, animations, 3D materials.
 *
 * Extracted from TitleCustomPanel.tsx. This file is pure data (+ types);
 * no React/store imports. Panel imports what it needs and renders buttons.
 *
 * Grouping:
 *   PR    — Professional/typographic: mono, brush, stencil, pixel, deco, noir
 *   GFX   — Graphic: elegant, lofi, pop, retro3d, emboss, glitch
 *   VFX   — Effect-heavy: neon, graffiti, vapor, chrome, dark(한글), ice
 *   EQPL  — EQ/Playlist-context: pastel, brutalist, glass, woodcut, comic, minimal
 */

import type { CodaStore } from '@/store/useCodaStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TitleMode   = CodaStore['titleMode'];
export type FontPreset  = CodaStore['titleFontPreset'];
export type PlayMode    = CodaStore['titlePlayMode'];
export type PresetGroup = 'pr' | 'gfx' | 'vfx' | 'eqpl';

export interface PresetDef {
  value: FontPreset;
  label: string;
  preview: React.CSSProperties;
}

// -----------------------------------------------------------------------------
// Animation modes (shared across all groups)
// -----------------------------------------------------------------------------

export const TITLE_MODES: { value: TitleMode; label: string }[] = [
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

// -----------------------------------------------------------------------------
// Font preset groups
// -----------------------------------------------------------------------------

const PR_PRESETS: PresetDef[] = [
  {
    value: 'mono',
    label: 'MONO',
    preview: {
      fontFamily: "'JetBrains Mono', 'Space Grotesk', monospace",
      fontWeight: 500,
      letterSpacing: '0.06em',
      color: '#33ff88',
    },
  },
  {
    value: 'brush',
    label: 'BRUSH',
    preview: {
      fontFamily: "'Caveat', cursive",
      fontWeight: 700,
      letterSpacing: '0.01em',
      color: '#e8d5c0',
    },
  },
  {
    value: 'stencil',
    label: 'STNCL',
    preview: {
      fontFamily: "'Oswald', sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      color: '#8b7355',
    },
  },
  {
    value: 'pixel',
    label: 'PIXEL',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      backgroundImage: 'linear-gradient(135deg, #ff6bcb, #a855f7)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'deco',
    label: 'DECO',
    preview: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 600,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      backgroundImage: 'linear-gradient(160deg, #d4a850, #f5e6a0)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'noir',
    label: 'NOIR',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      backgroundImage: 'linear-gradient(180deg, #ffffff, #555555)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
];

const GFX_PRESETS: PresetDef[] = [
  {
    value: 'elegant',
    label: 'Elegant',
    preview: {
      fontFamily: "'Cormorant Garamond', serif",
      fontStyle: 'italic',
      fontWeight: 300,
      backgroundImage: 'linear-gradient(90deg, #a06820, #f5e6a0, #a06820)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
      letterSpacing: '0.05em',
    },
  },
  {
    value: 'lofi',
    label: 'LOFI',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 300,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: '#9b9588',
    },
  },
  {
    value: 'pop',
    label: 'POP',
    preview: {
      fontFamily: "'Oswald', sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      backgroundImage: 'linear-gradient(135deg, #00e5ff, #7b2ff7, #ff3cac)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'retro3d',
    label: 'RETRO',
    preview: {
      fontFamily: "'Oswald', sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      backgroundImage: 'linear-gradient(170deg, #ffe566, #ff6600)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'emboss',
    label: 'METAL',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 600,
      textTransform: 'uppercase',
      backgroundImage: 'linear-gradient(170deg, #fff 0%, #aaa 50%, #e0e0e0 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'glitch',
    label: 'GLITCH',
    preview: {
      fontFamily: "'Space Grotesk', monospace",
      fontWeight: 700,
      textTransform: 'uppercase',
      color: '#c8c8c8',
      textShadow: '1.5px 0 #ff0050, -1.5px 0 #00e5ff',
    },
  },
];

const VFX_PRESETS: PresetDef[] = [
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

const EQPL_PRESETS: PresetDef[] = [
  {
    value: 'pastel',
    label: 'PSTL',
    preview: {
      fontFamily: "'Cormorant Garamond', serif",
      fontStyle: 'italic',
      fontWeight: 300,
      letterSpacing: '0.08em',
      backgroundImage: 'linear-gradient(135deg, #fbc2eb, #a6c1ee)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'brutalist',
    label: 'BRUT',
    preview: {
      fontFamily: "'Oswald', sans-serif",
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.02em',
      color: '#e63946',
    },
  },
  {
    value: 'glass',
    label: 'GLASS',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 400,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.45)',
    },
  },
  {
    value: 'woodcut',
    label: 'WOOD',
    preview: {
      fontFamily: "'Permanent Marker', cursive",
      fontWeight: 400,
      letterSpacing: '0.02em',
      color: '#8b5e3c',
    },
  },
  {
    value: 'comic',
    label: 'COMIC',
    preview: {
      fontFamily: "'Caveat', cursive",
      fontWeight: 700,
      backgroundImage: 'linear-gradient(135deg, #ffe066, #ff6b35)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  {
    value: 'minimal',
    label: 'THIN',
    preview: {
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 200,
      letterSpacing: '0.20em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.7)',
    },
  },
];

export const GROUP_PRESETS: Record<PresetGroup, PresetDef[]> = {
  pr:   PR_PRESETS,
  gfx:  GFX_PRESETS,
  vfx:  VFX_PRESETS,
  eqpl: EQPL_PRESETS,
};

// -----------------------------------------------------------------------------
// 3D presets (material + animation mode)
// -----------------------------------------------------------------------------

export const PRESETS_3D: { value: CodaStore['title3DPreset']; label: string; color: string }[] = [
  { value: 'gold',   label: 'GOLD',   color: '#d4a850' },
  { value: 'silver', label: 'SILVER', color: '#c0c0c0' },
  { value: 'chrome', label: 'CHROME', color: '#e8e8e8' },
  { value: 'neon',   label: 'NEON',   color: '#00e5ff' },
  { value: 'fire',   label: 'FIRE',   color: '#ff5500' },
  { value: 'ice',    label: 'ICE',    color: '#67e8f9' },
  { value: 'dark',   label: 'DARK',   color: '#444444' },
];

export const ANIM_3D: { value: CodaStore['title3DAnimate']; label: string }[] = [
  { value: 'breathing', label: 'PULSE' },
  { value: 'float',     label: 'FLOAT' },
  { value: 'static',    label: 'STATIC' },
];
