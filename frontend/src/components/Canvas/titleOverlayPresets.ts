/**
 * Title overlay preset configs. Data-only module — extracted from
 * TitleHTMLOverlay.tsx so the component file stays focused on rendering.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FontPreset = 'elegant' | 'lofi' | 'pop' | 'retro3d' | 'emboss' | 'glitch'
               | 'neon' | 'graffiti' | 'vapor' | 'chrome' | 'dark' | 'ice'
               | 'mono' | 'brush' | 'stencil' | 'pixel' | 'deco' | 'noir'
               | 'pastel' | 'brutalist' | 'glass' | 'woodcut' | 'comic' | 'minimal';

export interface PresetConfig {
  fontFamily: string;
  fontWeight: number;
  fontStyle?: string;
  letterSpacing: string;
  textTransform?: React.CSSProperties['textTransform'];
  gradient: string;              // CSS gradient for backgroundImage
  glowFilter?: string;           // inline filter on wrapper (undefined = use wrapperClass)
  wrapperClass?: string;         // CSS animation class on wrapper (overrides glowFilter)
  strokeOnly?: boolean;          // outline-only text (WebkitTextStroke, no fill)
  strokeColor?: string;          // stroke color when strokeOnly=true
  mainSize: string;
  cornerSize: string;
  subScale: number;
  subOpacity: number;
  subSpacing: string;
  lineHeight: number;
  showRule: boolean;
  shimmer: boolean;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESETS: Record<FontPreset, PresetConfig> = {
  // ── 1. Elegant — Cormorant Garamond italic, gold shimmer ─────────────────
  elegant: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 300,
    fontStyle: 'italic',
    letterSpacing: '0.14em',
    gradient:
      'linear-gradient(100deg, #a06820 0%, #d4a850 18%, #f5e6a0 45%, #e8cf78 55%, #d4a850 78%, #a06820 100%)',
    glowFilter: 'drop-shadow(0 0 20px rgba(192,130,30,0.7)) drop-shadow(0 0 7px rgba(192,130,30,0.5))',
    mainSize: 'clamp(26px, 5.5vw, 90px)',
    cornerSize: 'clamp(10px, 1.35vw, 20px)',
    subScale: 0.30,
    subOpacity: 0.55,
    subSpacing: '0.28em',
    lineHeight: 1.1,
    showRule: true,
    shimmer: true,
  },

  // ── 2. Lofi — Space Grotesk light, cream, wide tracking ──────────────────
  lofi: {
    fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
    fontWeight: 300,
    letterSpacing: '0.38em',
    textTransform: 'uppercase',
    gradient:
      'linear-gradient(180deg, rgba(240,235,225,0.95) 0%, rgba(195,190,180,0.55) 100%)',
    glowFilter: 'drop-shadow(0 0 28px rgba(230,225,215,0.12))',
    mainSize: 'clamp(16px, 3.6vw, 62px)',
    cornerSize: 'clamp(8px, 1.05vw, 15px)',
    subScale: 0.38,
    subOpacity: 0.4,
    subSpacing: '0.5em',
    lineHeight: 1.25,
    showRule: false,
    shimmer: false,
  },

  // ── 3. Pop — Oswald bold, vivid rainbow gradient ──────────────────────────
  pop: {
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    gradient:
      'linear-gradient(135deg, #00e5ff 0%, #7b2ff7 40%, #ff3cac 75%, #ff8c00 100%)',
    glowFilter: 'drop-shadow(0 0 26px rgba(123,47,247,0.75)) drop-shadow(0 0 8px rgba(0,229,255,0.5))',
    mainSize: 'clamp(30px, 6.5vw, 108px)',
    cornerSize: 'clamp(12px, 1.6vw, 26px)',
    subScale: 0.28,
    subOpacity: 0.85,
    subSpacing: '0.1em',
    lineHeight: 1.0,
    showRule: false,
    shimmer: true,
  },

  // ── 4. Retro 3D — Oswald 700, layered shadow extrude ─────────────────────
  retro3d: {
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    gradient:
      'linear-gradient(170deg, #ffe566 0%, #ffb300 35%, #ff6600 70%, #cc3300 100%)',
    glowFilter: [
      'drop-shadow(1px 1px 0 #4a1800)',
      'drop-shadow(2px 2px 0 #4a1800)',
      'drop-shadow(3px 3px 0 rgba(0,0,0,0.7))',
      'drop-shadow(5px 5px 0 rgba(0,0,0,0.45))',
      'drop-shadow(8px 8px 0 rgba(0,0,0,0.2))',
      'drop-shadow(0 0 18px rgba(255,140,0,0.5))',
    ].join(' '),
    mainSize: 'clamp(30px, 6vw, 100px)',
    cornerSize: 'clamp(12px, 1.5vw, 24px)',
    subScale: 0.30,
    subOpacity: 0.7,
    subSpacing: '0.1em',
    lineHeight: 1.0,
    showRule: false,
    shimmer: false,
  },

  // ── 5. Emboss — Space Grotesk 600, metallic silver relief ────────────────
  emboss: {
    fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    gradient:
      'linear-gradient(170deg, #ffffff 0%, #d0d0d0 20%, #f8f8f8 50%, #888 75%, #e0e0e0 100%)',
    glowFilter: [
      'drop-shadow(-2px -2px 4px rgba(255,255,255,0.9))',
      'drop-shadow(2px 2px 6px rgba(0,0,0,0.85))',
      'drop-shadow(0 0 12px rgba(180,180,180,0.3))',
    ].join(' '),
    mainSize: 'clamp(22px, 4.8vw, 82px)',
    cornerSize: 'clamp(9px, 1.2vw, 18px)',
    subScale: 0.32,
    subOpacity: 0.6,
    subSpacing: '0.2em',
    lineHeight: 1.1,
    showRule: false,
    shimmer: true,
  },

  // ── 6. Glitch — Space Grotesk 700, chroma aberration CSS anim ────────────
  glitch: {
    fontFamily: "'Space Grotesk', monospace",
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    gradient:
      'linear-gradient(90deg, #ffffff 0%, #e0e0e0 40%, #ffffff 60%, #c8c8c8 100%)',
    wrapperClass: 'title-glitch',
    mainSize: 'clamp(24px, 5vw, 88px)',
    cornerSize: 'clamp(10px, 1.3vw, 20px)',
    subScale: 0.32,
    subOpacity: 0.6,
    subSpacing: '0.25em',
    lineHeight: 1.05,
    showRule: false,
    shimmer: false,
  },

  // ── 7. Heat — Space Grotesk semibold, warm amber/fire ───────────────────
  neon: {
    fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(160deg, #fff1a0 0%, #ffb300 30%, #ff5500 65%, #cc1a00 100%)',
    glowFilter: 'drop-shadow(0 0 12px rgba(255,120,0,0.7)) drop-shadow(0 0 4px rgba(255,200,0,0.5))',
    mainSize: 'clamp(22px, 4.8vw, 82px)',
    cornerSize: 'clamp(9px, 1.2vw, 18px)',
    subScale: 0.32,
    subOpacity: 0.65,
    subSpacing: '0.15em',
    lineHeight: 1.05,
    showRule: false,
    shimmer: false,
  },

  // ── 8. Graffiti — Permanent Marker, spray-paint urban style ─────────────
  graffiti: {
    fontFamily: "'Permanent Marker', 'Segoe Print', cursive",
    fontWeight: 400,
    letterSpacing: '0.04em',
    textTransform: 'none',
    gradient: 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 40%, #ff6b35 100%)',
    glowFilter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.8)) drop-shadow(-1px -1px 0px rgba(0,0,0,0.5))',
    mainSize: 'clamp(16px, 3.6vw, 62px)',
    cornerSize: 'clamp(8px, 1.0vw, 15px)',
    subScale: 0.44,
    subOpacity: 0.75,
    subSpacing: '0.06em',
    lineHeight: 1.1,
    showRule: false,
    shimmer: false,
  },

  // ── 9. Vapor — Cormorant, vaporwave pastel pink/purple ───────────────────
  vapor: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 300,
    fontStyle: 'italic',
    letterSpacing: '0.20em',
    gradient: 'linear-gradient(135deg, #ffb3d9 0%, #c084fc 40%, #818cf8 70%, #67e8f9 100%)',
    glowFilter: 'drop-shadow(0 0 18px rgba(192,132,252,0.7)) drop-shadow(0 0 6px rgba(255,179,217,0.5))',
    mainSize: 'clamp(24px, 5.2vw, 88px)',
    cornerSize: 'clamp(10px, 1.3vw, 20px)',
    subScale: 0.32,
    subOpacity: 0.6,
    subSpacing: '0.30em',
    lineHeight: 1.15,
    showRule: true,
    shimmer: true,
  },

  // ── 10. Chrome → Script — Dancing Script, 손글씨 크림 ──────────────────
  chrome: {
    fontFamily: "'Dancing Script', cursive",
    fontWeight: 700,
    letterSpacing: '0.03em',
    gradient: 'linear-gradient(160deg, #fffbe8 0%, #f0ddb0 40%, #d4b870 80%, #b8996a 100%)',
    glowFilter: 'drop-shadow(0 0 14px rgba(220,180,80,0.4)) drop-shadow(0 0 3px rgba(255,240,180,0.3))',
    mainSize: 'clamp(28px, 6vw, 102px)',
    cornerSize: 'clamp(12px, 1.6vw, 26px)',
    subScale: 0.34,
    subOpacity: 0.6,
    subSpacing: '0.08em',
    lineHeight: 1.1,
    showRule: true,
    shimmer: false,
  },

  // ── 11. Dark → Pretendard 3D 한글 ────────────────────────────────────────
  dark: {
    fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    fontWeight: 800,
    letterSpacing: '-0.02em',
    gradient: 'linear-gradient(160deg, #ffffff 0%, #e8e8e8 30%, #f5f5f5 55%, #aaaaaa 80%, #d8d8d8 100%)',
    glowFilter: [
      'drop-shadow(1px 1px 0 #222)',
      'drop-shadow(2px 2px 0 #1a1a1a)',
      'drop-shadow(3px 3px 0 #111)',
      'drop-shadow(5px 5px 0 rgba(0,0,0,0.6))',
      'drop-shadow(8px 8px 0 rgba(0,0,0,0.25))',
    ].join(' '),
    mainSize: 'clamp(28px, 6vw, 104px)',
    cornerSize: 'clamp(11px, 1.5vw, 24px)',
    subScale: 0.30,
    subOpacity: 0.65,
    subSpacing: '0.0em',
    lineHeight: 1.05,
    showRule: false,
    shimmer: false,
  },

  // ── 12. Ice → Wire — Space Grotesk, 테두리선만 (stroke-only) ───────────
  ice: {
    fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    gradient: 'none',
    strokeOnly: true,
    strokeColor: 'rgba(255,255,255,0.82)',
    glowFilter: 'drop-shadow(0 0 8px rgba(255,255,255,0.25))',
    mainSize: 'clamp(20px, 4.6vw, 80px)',
    cornerSize: 'clamp(9px, 1.2vw, 18px)',
    subScale: 0.36,
    subOpacity: 0.5,
    subSpacing: '0.22em',
    lineHeight: 1.1,
    showRule: false,
    shimmer: false,
  },

  // ── 13. Mono — JetBrains Mono, terminal hacker green ─────────────────────
  mono: {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    fontWeight: 500,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(180deg, #a0ffa0 0%, #33cc33 50%, #009900 100%)',
    glowFilter: 'drop-shadow(0 0 12px rgba(0,255,0,0.5)) drop-shadow(0 0 4px rgba(0,200,0,0.4))',
    mainSize: 'clamp(18px, 4vw, 70px)',
    cornerSize: 'clamp(9px, 1.1vw, 16px)',
    subScale: 0.34,
    subOpacity: 0.6,
    subSpacing: '0.06em',
    lineHeight: 1.15,
    showRule: false,
    shimmer: false,
  },

  // ── 14. Brush — Caveat, handwritten ink stroke ───────────────────────────
  brush: {
    fontFamily: "'Caveat', 'Segoe Script', cursive",
    fontWeight: 700,
    letterSpacing: '0.02em',
    gradient: 'linear-gradient(160deg, #ffffff 0%, #e8d5b0 40%, #c9a96e 80%)',
    glowFilter: 'drop-shadow(1px 2px 0 rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(200,170,100,0.3))',
    mainSize: 'clamp(28px, 6.5vw, 110px)',
    cornerSize: 'clamp(12px, 1.6vw, 26px)',
    subScale: 0.32,
    subOpacity: 0.65,
    subSpacing: '0.04em',
    lineHeight: 1.05,
    showRule: false,
    shimmer: false,
  },

  // ── 15. Stencil — Oswald, military/stencil look ─────────────────────────
  stencil: {
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    fontWeight: 700,
    letterSpacing: '0.20em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(180deg, #8b7355 0%, #5c4a32 50%, #3d2e1c 100%)',
    glowFilter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.7)) drop-shadow(0 0 6px rgba(100,80,50,0.3))',
    mainSize: 'clamp(22px, 5vw, 86px)',
    cornerSize: 'clamp(10px, 1.3vw, 20px)',
    subScale: 0.30,
    subOpacity: 0.55,
    subSpacing: '0.30em',
    lineHeight: 1.1,
    showRule: false,
    shimmer: false,
  },

  // ── 16. Pixel — Space Grotesk bold, 8-bit retro ─────────────────────────
  pixel: {
    fontFamily: "'Space Grotesk', 'Courier New', monospace",
    fontWeight: 700,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(180deg, #ff6b9d 0%, #c44dff 50%, #6e5bff 100%)',
    glowFilter: 'drop-shadow(2px 0 0 #ff6b9d) drop-shadow(-2px 0 0 #6e5bff) drop-shadow(0 0 10px rgba(196,77,255,0.5))',
    mainSize: 'clamp(20px, 4.5vw, 78px)',
    cornerSize: 'clamp(9px, 1.2vw, 18px)',
    subScale: 0.32,
    subOpacity: 0.7,
    subSpacing: '0.15em',
    lineHeight: 1.1,
    showRule: false,
    shimmer: false,
  },

  // ── 17. Deco — Cormorant, Art Deco geometric gold ───────────────────────
  deco: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 600,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(135deg, #f5d16c 0%, #c5963a 25%, #f5d16c 50%, #c5963a 75%, #f5d16c 100%)',
    glowFilter: 'drop-shadow(0 0 16px rgba(245,209,108,0.5)) drop-shadow(0 1px 0 rgba(100,70,20,0.5))',
    mainSize: 'clamp(22px, 5vw, 86px)',
    cornerSize: 'clamp(10px, 1.3vw, 20px)',
    subScale: 0.28,
    subOpacity: 0.6,
    subSpacing: '0.35em',
    lineHeight: 1.15,
    showRule: true,
    shimmer: true,
  },

  // ── 18. Noir — Space Grotesk, high-contrast B&W film noir ───────────────
  noir: {
    fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
    fontWeight: 400,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(180deg, #ffffff 0%, #cccccc 40%, #666666 100%)',
    glowFilter: 'drop-shadow(0 0 20px rgba(255,255,255,0.15)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))',
    mainSize: 'clamp(20px, 4.5vw, 78px)',
    cornerSize: 'clamp(9px, 1.2vw, 18px)',
    subScale: 0.34,
    subOpacity: 0.45,
    subSpacing: '0.30em',
    lineHeight: 1.2,
    showRule: true,
    shimmer: false,
  },

  // ── 19. Pastel — Cormorant Garamond, soft pastel gradient ───────────────
  pastel: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 400,
    fontStyle: 'italic',
    letterSpacing: '0.10em',
    gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 50%, #c3cfe2 100%)',
    glowFilter: 'drop-shadow(0 0 14px rgba(166,193,238,0.4)) drop-shadow(0 0 4px rgba(251,194,235,0.3))',
    mainSize: 'clamp(24px, 5.5vw, 92px)',
    cornerSize: 'clamp(10px, 1.35vw, 20px)',
    subScale: 0.32,
    subOpacity: 0.55,
    subSpacing: '0.18em',
    lineHeight: 1.15,
    showRule: true,
    shimmer: true,
  },

  // ── 20. Brutalist — Oswald 900, raw industrial ──────────────────────────
  brutalist: {
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    fontWeight: 900,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(180deg, #ff0000 0%, #cc0000 100%)',
    glowFilter: 'drop-shadow(3px 3px 0 #000) drop-shadow(-1px -1px 0 #000)',
    mainSize: 'clamp(32px, 7vw, 118px)',
    cornerSize: 'clamp(13px, 1.7vw, 28px)',
    subScale: 0.24,
    subOpacity: 0.8,
    subSpacing: '0.08em',
    lineHeight: 0.95,
    showRule: false,
    shimmer: false,
  },

  // ── 21. Glass — Space Grotesk, frosted glass transparent ────────────────
  glass: {
    fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(160deg, rgba(255,255,255,0.9) 0%, rgba(200,220,255,0.5) 50%, rgba(255,255,255,0.7) 100%)',
    glowFilter: 'drop-shadow(0 0 20px rgba(200,220,255,0.3)) drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
    mainSize: 'clamp(22px, 5vw, 84px)',
    cornerSize: 'clamp(10px, 1.3vw, 20px)',
    subScale: 0.34,
    subOpacity: 0.5,
    subSpacing: '0.20em',
    lineHeight: 1.1,
    showRule: false,
    shimmer: true,
  },

  // ── 22. Woodcut — Permanent Marker, rustic engraved ─────────────────────
  woodcut: {
    fontFamily: "'Permanent Marker', 'Segoe Print', cursive",
    fontWeight: 400,
    letterSpacing: '0.06em',
    gradient: 'linear-gradient(170deg, #d4a574 0%, #8b6240 40%, #5c3d20 80%)',
    glowFilter: 'drop-shadow(1px 1px 0 #2a1a08) drop-shadow(2px 2px 0 rgba(0,0,0,0.5)) drop-shadow(0 0 8px rgba(140,100,60,0.3))',
    mainSize: 'clamp(24px, 5.5vw, 92px)',
    cornerSize: 'clamp(10px, 1.4vw, 22px)',
    subScale: 0.36,
    subOpacity: 0.65,
    subSpacing: '0.08em',
    lineHeight: 1.05,
    showRule: false,
    shimmer: false,
  },

  // ── 23. Comic — Caveat bold, comic book pop ─────────────────────────────
  comic: {
    fontFamily: "'Caveat', 'Comic Sans MS', cursive",
    fontWeight: 700,
    letterSpacing: '0.04em',
    gradient: 'linear-gradient(135deg, #ffeb3b 0%, #ff9800 40%, #f44336 80%)',
    glowFilter: 'drop-shadow(2px 2px 0 #000) drop-shadow(-1px -1px 0 #000) drop-shadow(0 0 12px rgba(255,152,0,0.4))',
    mainSize: 'clamp(26px, 5.8vw, 96px)',
    cornerSize: 'clamp(11px, 1.5vw, 24px)',
    subScale: 0.34,
    subOpacity: 0.75,
    subSpacing: '0.06em',
    lineHeight: 1.0,
    showRule: false,
    shimmer: false,
  },

  // ── 24. Minimal — Space Grotesk 200, ultra-thin clean ───────────────────
  minimal: {
    fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
    fontWeight: 200,
    letterSpacing: '0.30em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.5) 100%)',
    glowFilter: 'drop-shadow(0 0 6px rgba(255,255,255,0.1))',
    mainSize: 'clamp(18px, 4vw, 68px)',
    cornerSize: 'clamp(8px, 1.05vw, 15px)',
    subScale: 0.38,
    subOpacity: 0.4,
    subSpacing: '0.40em',
    lineHeight: 1.3,
    showRule: true,
    shimmer: false,
  },
};
