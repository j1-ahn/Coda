/**
 * OverlayPainter.ts
 * Draws title and lyric overlays directly onto a canvas2D context.
 *
 * Replicates the visual styles from TitleHTMLOverlay + LyricHTMLOverlay
 * using canvas2D primitives (gradient, shadow, stroke) so that
 * frame-dumped JPEGs include the text without html2canvas.
 *
 * V2 note: paintTitleOverlay / paintLyricOverlay accept explicit state
 * objects (not store selectors) — pass from RenderJob for testability.
 */

// ---------------------------------------------------------------------------
// Lyric overlay
// ---------------------------------------------------------------------------

export interface LyricRenderState {
  text: string;
  preset: 'clean' | 'mist' | 'slab' | 'glow' | 'outline' | 'kr';
  position: 'bottom' | 'center' | 'right-center';
  sizePx: number;
}

const UPPERCASE_LYRIC_PRESETS = new Set(['mist', 'slab', 'outline']);

export function paintLyricOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: LyricRenderState,
): void {
  const { text, preset, position, sizePx } = state;
  if (!text) return;

  const displayText = UPPERCASE_LYRIC_PRESETS.has(preset)
    ? text.toUpperCase()
    : text;

  ctx.save();

  // Position
  let x: number, y: number, align: CanvasTextAlign;
  if (position === 'center') {
    x = w / 2; y = h / 2; align = 'center';
  } else if (position === 'right-center') {
    x = w * 0.94; y = h / 2; align = 'right';
  } else {
    x = w / 2; y = h * 0.90; align = 'center';
  }

  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  switch (preset) {
    case 'clean':
      ctx.font = `400 ${sizePx}px 'Inter','Helvetica Neue',sans-serif`;
      ctx.fillStyle = '#ffffff';
      break;
    case 'mist':
      ctx.font = `300 ${sizePx}px 'Inter',sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      (ctx as any).letterSpacing = '0.14em';
      break;
    case 'slab':
      ctx.font = `600 ${sizePx}px 'Oswald',sans-serif`;
      ctx.fillStyle = '#f0ebe2';
      break;
    case 'glow':
      ctx.font = `400 ${sizePx}px 'Inter',sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      // second pass for stronger glow
      ctx.fillText(displayText, x, y);
      ctx.shadowBlur = 40;
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      break;
    case 'outline':
      ctx.font = `600 ${sizePx}px 'Inter',sans-serif`;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1, sizePx * 0.04);
      ctx.strokeText(displayText, x, y);
      ctx.restore();
      return;
    case 'kr':
      ctx.font = `500 ${sizePx}px 'Pretendard Variable','Pretendard',sans-serif`;
      ctx.fillStyle = '#e8e3da';
      break;
    default:
      ctx.font = `400 ${sizePx}px sans-serif`;
      ctx.fillStyle = '#ffffff';
  }

  ctx.fillText(displayText, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Title overlay
// ---------------------------------------------------------------------------

export interface TitleRenderState {
  text: string;
  subtext: string;
  preset: string;
  /** currentPlaybackTime in seconds — used for float/breathe animation */
  currentTime: number;
  /** canvas width in px */
  w: number;
  /** canvas height in px */
  h: number;
}

const UPPERCASE_TITLE_PRESETS = new Set([
  'lofi', 'pop', 'retro3d', 'emboss', 'glitch', 'neon', 'mono', 'ice',
]);

export function paintTitleOverlay(
  ctx: CanvasRenderingContext2D,
  state: TitleRenderState,
): void {
  const { text, subtext, preset, currentTime, w, h } = state;
  if (!text) return;

  ctx.save();

  const baseFontSize = Math.round(w * 0.055);
  const cx = w / 2;

  // Float animation offset (7 s cycle, 8 px amplitude)
  const floatY = Math.sin((currentTime * 2 * Math.PI) / 7) * 8;
  // Breathe scale (4 s cycle, ±3 %)
  const breatheScale = 1 + Math.sin((currentTime * 2 * Math.PI) / 4) * 0.03;

  const cy = h / 2 + floatY;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Save transform, apply breathe scale
  ctx.translate(cx, cy);
  ctx.scale(breatheScale, breatheScale);
  ctx.translate(-cx, -cy);

  const displayText = UPPERCASE_TITLE_PRESETS.has(preset)
    ? text.toUpperCase()
    : text;

  // Per-preset setup
  type Setup = () => void;
  const setups: Record<string, Setup> = {
    elegant: () => {
      ctx.font = `italic 300 ${baseFontSize}px 'Cormorant Garamond',Georgia,serif`;
      const g = ctx.createLinearGradient(cx - baseFontSize * 3, cy, cx + baseFontSize * 3, cy);
      g.addColorStop(0, '#a06820');
      g.addColorStop(0.45, '#f5e6a0');
      g.addColorStop(1, '#a06820');
      ctx.fillStyle = g;
      ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(192,130,30,0.7)';
    },
    lofi: () => {
      ctx.font = `300 ${Math.round(baseFontSize * 0.65)}px 'Space Grotesk','Helvetica Neue',sans-serif`;
      ctx.fillStyle = 'rgba(240,235,225,0.95)';
      (ctx as any).letterSpacing = '0.38em';
    },
    pop: () => {
      ctx.font = `700 ${Math.round(baseFontSize * 1.18)}px 'Oswald','Arial Narrow',sans-serif`;
      const g = ctx.createLinearGradient(cx - baseFontSize * 4, cy, cx + baseFontSize * 4, cy);
      g.addColorStop(0, '#00e5ff'); g.addColorStop(0.4, '#7b2ff7');
      g.addColorStop(0.75, '#ff3cac'); g.addColorStop(1, '#ff8c00');
      ctx.fillStyle = g;
      ctx.shadowBlur = 26; ctx.shadowColor = 'rgba(123,47,247,0.75)';
    },
    retro3d: () => {
      ctx.font = `700 ${baseFontSize}px 'Oswald','Arial Narrow',sans-serif`;
      const g = ctx.createLinearGradient(0, cy - baseFontSize / 2, 0, cy + baseFontSize / 2);
      g.addColorStop(0, '#ffe566'); g.addColorStop(0.35, '#ffb300');
      g.addColorStop(0.7, '#ff6600'); g.addColorStop(1, '#cc3300');
      ctx.fillStyle = g;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
    },
    emboss: () => {
      ctx.font = `600 ${Math.round(baseFontSize * 0.87)}px 'Space Grotesk',sans-serif`;
      const g = ctx.createLinearGradient(0, cy - baseFontSize / 2, 0, cy + baseFontSize / 2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#f8f8f8'); g.addColorStop(1, '#888');
      ctx.fillStyle = g;
      ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowOffsetX = -2; ctx.shadowOffsetY = -2;
    },
    glitch: () => {
      ctx.font = `700 ${Math.round(baseFontSize * 0.9)}px 'Space Grotesk',monospace`;
      ctx.fillStyle = '#ffffff';
    },
    neon: () => {
      ctx.font = `600 ${Math.round(baseFontSize * 0.87)}px 'Space Grotesk',sans-serif`;
      const g = ctx.createLinearGradient(0, cy - baseFontSize / 2, 0, cy + baseFontSize / 2);
      g.addColorStop(0, '#fff1a0'); g.addColorStop(0.3, '#ffb300');
      g.addColorStop(0.65, '#ff5500'); g.addColorStop(1, '#cc1a00');
      ctx.fillStyle = g;
      ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(255,120,0,0.7)';
    },
    mono: () => {
      ctx.font = `400 ${Math.round(baseFontSize * 0.58)}px 'Space Grotesk',monospace`;
      const g = ctx.createLinearGradient(0, cy - baseFontSize / 2, 0, cy + baseFontSize / 2);
      g.addColorStop(0, '#00ff88'); g.addColorStop(1, '#008844');
      ctx.fillStyle = g;
      ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,255,136,0.8)';
      (ctx as any).letterSpacing = '0.22em';
    },
    vapor: () => {
      ctx.font = `italic 300 ${Math.round(baseFontSize * 0.94)}px 'Cormorant Garamond',Georgia,serif`;
      const g = ctx.createLinearGradient(cx - baseFontSize * 3, cy, cx + baseFontSize * 3, cy);
      g.addColorStop(0, '#ffb3d9'); g.addColorStop(0.4, '#c084fc');
      g.addColorStop(0.7, '#818cf8'); g.addColorStop(1, '#67e8f9');
      ctx.fillStyle = g;
      ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(192,132,252,0.7)';
    },
    chrome: () => {
      ctx.font = `700 ${Math.round(baseFontSize * 1.09)}px 'Dancing Script',cursive`;
      const g = ctx.createLinearGradient(0, cy - baseFontSize / 2, 0, cy + baseFontSize / 2);
      g.addColorStop(0, '#fffbe8'); g.addColorStop(0.4, '#f0ddb0');
      g.addColorStop(0.8, '#d4b870'); g.addColorStop(1, '#b8996a');
      ctx.fillStyle = g;
      ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(220,180,80,0.4)';
    },
    dark: () => {
      ctx.font = `800 ${baseFontSize}px 'Pretendard Variable','Pretendard',sans-serif`;
      const g = ctx.createLinearGradient(0, cy - baseFontSize / 2, 0, cy + baseFontSize / 2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#e8e8e8'); g.addColorStop(1, '#aaaaaa');
      ctx.fillStyle = g;
      ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
    },
    ice: () => {
      ctx.font = `700 ${Math.round(baseFontSize * 0.83)}px 'Space Grotesk',sans-serif`;
      ctx.strokeStyle = 'rgba(255,255,255,0.82)';
      ctx.lineWidth = Math.max(1, baseFontSize * 0.025);
      ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(255,255,255,0.25)';
    },
  };

  (setups[preset] ?? setups.elegant)();

  if (preset === 'ice') {
    ctx.strokeText(displayText, cx, cy);
  } else {
    ctx.fillText(displayText, cx, cy);
  }

  // Subtext
  if (subtext) {
    const subFontSize = Math.round(baseFontSize * 0.3);
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 0.6;
    ctx.font = ctx.font.replace(/\d+px/, `${subFontSize}px`);
    (ctx as any).letterSpacing = '0.28em';
    ctx.fillStyle = typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#ffffff';
    ctx.fillText(subtext.toUpperCase(), cx, cy + baseFontSize * 0.85);
  }

  ctx.restore();
}
