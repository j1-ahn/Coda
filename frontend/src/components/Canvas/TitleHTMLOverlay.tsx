'use client';

/**
 * TitleHTMLOverlay.tsx
 * HTML/CSS 기반 고품질 타이틀 오버레이 — 6가지 폰트 프리셋
 *
 * [박스 방지] background-clip:text 는 반드시 inline-block <span> 에 적용.
 *            backgroundImage 사용 (background 단축형 금지).
 * [Glow]     filter:drop-shadow 는 외부 wrapper div 에 분리 적용.
 * [Glitch]   CSS keyframe animation (.title-glitch) 을 wrapper 에 적용.
 */

import { useEffect, useState } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FontPreset = 'elegant' | 'lofi' | 'pop' | 'retro3d' | 'emboss' | 'glitch'
               | 'neon' | 'mono' | 'vapor' | 'chrome' | 'dark' | 'ice';

interface PresetConfig {
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

const PRESETS: Record<FontPreset, PresetConfig> = {
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

  // ── 8. Mono — Space Grotesk, terminal green phosphor ─────────────────────
  mono: {
    fontFamily: "'Space Grotesk', monospace",
    fontWeight: 400,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    gradient: 'linear-gradient(180deg, #00ff88 0%, #00cc66 60%, #008844 100%)',
    glowFilter: 'drop-shadow(0 0 10px rgba(0,255,136,0.8)) drop-shadow(0 0 3px rgba(0,255,136,1))',
    mainSize: 'clamp(14px, 3.2vw, 56px)',
    cornerSize: 'clamp(7px, 0.9vw, 13px)',
    subScale: 0.42,
    subOpacity: 0.55,
    subSpacing: '0.35em',
    lineHeight: 1.3,
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
};

// ---------------------------------------------------------------------------
// Play-mode animation helper
// ---------------------------------------------------------------------------

type PlayMode = 'loop' | 'once' | 'stay';

/**
 * Returns the CSS animation string for a given keyframe + playMode.
 * - loop  : infinite loop (default behaviour)
 * - once  : play once, stay at final keyframe (forwards)
 * - stay  : fade-in entrance only, then hold; motionKf loops forever after entry
 */
function animStyle(
  kf: string,
  dur: string,
  easing: string,
  playMode: PlayMode,
  motionKf?: string,
  motionDur?: string,
): React.CSSProperties {
  if (playMode === 'loop') return { animation: `${kf} ${dur} ${easing} infinite` };
  if (playMode === 'once') return { animation: `${kf} ${dur} ${easing} 1 forwards` };
  // stay — fade in, then loop motion if provided
  if (motionKf)
    return { animation: `titleMountFade 1.4s ease forwards, ${motionKf} ${motionDur} ${easing} 1.4s infinite` };
  return { animation: 'titleMountFade 1.4s ease forwards' };
}

// ---------------------------------------------------------------------------
// GradientText
// ---------------------------------------------------------------------------

interface GradientTextProps {
  children: React.ReactNode;
  cfg: PresetConfig;
  size: string;
  letterSpacing?: string;
  opacity?: number;
  shimmer?: boolean;
}

function GradientText({
  children, cfg, size, letterSpacing, opacity = 1, shimmer,
}: GradientTextProps) {
  const useShimmer = shimmer ?? cfg.shimmer;

  return (
    <div
      className={cfg.wrapperClass}
      style={{
        display: 'inline-block',
        // If wrapperClass handles filter via CSS anim, skip inline filter
        filter: cfg.wrapperClass ? undefined : cfg.glowFilter,
        opacity,
      }}
    >
      <span
        className={useShimmer ? 'title-shimmer' : undefined}
        style={{
          display: 'inline-block',
          fontFamily: cfg.fontFamily,
          fontWeight: cfg.fontWeight,
          fontStyle: cfg.fontStyle,
          letterSpacing: letterSpacing ?? cfg.letterSpacing,
          textTransform: cfg.textTransform,
          fontSize: size,
          lineHeight: cfg.lineHeight,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          // stroke-only mode
          ...(cfg.strokeOnly
            ? {
                WebkitTextStroke: `clamp(1px, 0.04em, 3px) ${cfg.strokeColor ?? 'rgba(255,255,255,0.85)'}`,
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }
            : {
                backgroundImage: cfg.gradient,
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
              }),
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TitleBlock
// ---------------------------------------------------------------------------

interface TitleBlockProps {
  text: string;
  subtext: string;
  cfg: PresetConfig;
  mainSize: string;
}

function TitleBlock({ text, subtext, cfg, mainSize }: TitleBlockProps) {
  const subSize = `calc(${mainSize} * ${cfg.subScale})`;

  return (
    <div style={{ textAlign: 'center' }}>
      <GradientText cfg={cfg} size={mainSize}>
        {text}
      </GradientText>

      {subtext && cfg.showRule && (
        <div
          style={{
            margin: '0.3em auto 0.25em',
            width: '28%',
            height: '1px',
            backgroundImage: 'linear-gradient(90deg, transparent, rgba(212,168,80,0.5), transparent)',
          }}
        />
      )}

      {subtext && (
        <div style={{ marginTop: cfg.showRule ? '0' : '0.28em' }}>
          <GradientText
            cfg={cfg}
            size={subSize}
            letterSpacing={cfg.subSpacing}
            opacity={cfg.subOpacity}
            shimmer={false}
          >
            {subtext}
          </GradientText>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero → Corner
// ---------------------------------------------------------------------------

function HeroToCorner({
  text, subtext, cfg,
}: { text: string; subtext: string; cfg: PresetConfig }) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
    const id = setTimeout(() => setSettled(true), 400);
    return () => clearTimeout(id);
  }, [text]);

  const easing = 'cubic-bezier(0.16,1,0.3,1)';
  const dur = '2.8s';

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    transition: `top ${dur} ${easing}, left ${dur} ${easing}, transform ${dur} ${easing}`,
  };

  const posStyle: React.CSSProperties = settled
    ? { top: '4.5%', left: '97%', transform: 'translate(-100%, 0)' }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 50 }}>
      <div style={{ ...baseStyle, ...posStyle }}>
        <TitleBlock
          text={text}
          subtext={settled ? '' : subtext}
          cfg={cfg}
          mainSize={settled ? cfg.cornerSize : cfg.mainSize}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ambient (floating)
// ---------------------------------------------------------------------------

function AmbientTitle({ text, subtext, cfg, playMode }: { text: string; subtext: string; cfg: PresetConfig; playMode: PlayMode }) {
  const motionAnim = playMode === 'once'
    ? 'titleFloat 7s ease-in-out 1 forwards'
    : 'titleFloat 7s ease-in-out infinite';
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: 50, animation: 'titleMountFade 1.4s ease forwards' }}>
      <div style={{ animation: motionAnim }}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.75)`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breathing
// ---------------------------------------------------------------------------

function BreathingTitle({ text, subtext, cfg, playMode }: { text: string; subtext: string; cfg: PresetConfig; playMode: PlayMode }) {
  const motionAnim = playMode === 'once'
    ? 'titleBreathe 4s ease-in-out 1 forwards'
    : 'titleBreathe 4s ease-in-out infinite';
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: 50, animation: 'titleMountFade 1.8s ease forwards' }}>
      <div style={{ animation: motionAnim }}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={cfg.mainSize} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type (타자기 reveal → fadeout)
// ---------------------------------------------------------------------------

type TitleProps = { text: string; subtext: string; cfg: PresetConfig; playMode: PlayMode };

function TypeTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={{ whiteSpace: 'nowrap', ...animStyle('titleTypeReveal', '7s', 'linear', playMode) }}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.78)`} />
      </div>
    </div>
  );
}

function FadeTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={animStyle('titleFadeInOut', '6s', 'ease-in-out', playMode)}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={cfg.mainSize} />
      </div>
    </div>
  );
}

function RiseTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={animStyle('titleRise', '7s', 'ease-out', playMode)}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.82)`} />
      </div>
    </div>
  );
}

function ZoomTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={animStyle('titleZoom', '7s', 'ease-out', playMode)}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={cfg.mainSize} />
      </div>
    </div>
  );
}

function BlurTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={animStyle('titleBlur', '7s', 'ease-in-out', playMode)}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.85)`} />
      </div>
    </div>
  );
}

function GlideTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={animStyle('titleGlide', '7s', 'ease-in-out', playMode)}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.8)`} />
      </div>
    </div>
  );
}

function SplitTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={{ overflow: 'hidden', ...animStyle('titleSplit', '7s', 'ease-in-out', playMode) }}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.82)`} />
      </div>
    </div>
  );
}

function FlickerTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      <div style={animStyle('titleFlicker', '8s', 'steps(1,end)', playMode)}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.78)`} />
      </div>
    </div>
  );
}

function SkateTitle({ text, subtext, cfg, playMode }: TitleProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden" style={{ zIndex: 50 }}>
      <div style={animStyle('titleSkate', '6s', 'linear', playMode)}>
        <TitleBlock text={text} subtext={subtext} cfg={cfg} mainSize={`calc(${cfg.mainSize} * 0.82)`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export default function TitleHTMLOverlay() {
  const titleText       = useCodaStore((s) => s.titleText);
  const titleMode       = useCodaStore((s) => s.titleMode);
  const titleFontPreset = useCodaStore((s) => s.titleFontPreset);
  const titleSubtext    = useCodaStore((s) => s.titleSubtext);
  const titlePlayMode   = useCodaStore((s) => s.titlePlayMode);

  if (!titleText) return null;

  const cfg = PRESETS[titleFontPreset ?? 'elegant'];
  const pm  = titlePlayMode ?? 'loop';

  if (titleMode === 'hero-to-corner') return <HeroToCorner text={titleText} subtext={titleSubtext} cfg={cfg} />;
  if (titleMode === 'ambient-object') return <AmbientTitle text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'type')           return <TypeTitle    text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'fade')           return <FadeTitle    text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'rise')           return <RiseTitle    text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'zoom')           return <ZoomTitle    text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'blur')           return <BlurTitle    text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'glide')          return <GlideTitle   text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'split')          return <SplitTitle   text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'flicker')        return <FlickerTitle text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  if (titleMode === 'skate')          return <SkateTitle   text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
  return <BreathingTitle text={titleText} subtext={titleSubtext} cfg={cfg} playMode={pm} />;
}
