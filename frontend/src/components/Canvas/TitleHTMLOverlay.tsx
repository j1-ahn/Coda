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

import { type FontPreset, type PresetConfig, PRESETS } from './titleOverlayPresets';


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
  const titleRender3D   = useCodaStore((s) => s.titleRender3D);
  const titleFontScale  = useCodaStore((s) => s.titleFontScale);

  // When 3D mode is active, TitleLayer handles rendering in WebGL
  if (!titleText || titleRender3D) return null;

  const baseCfg = PRESETS[titleFontPreset ?? 'elegant'];
  const scale = titleFontScale ?? 1.0;
  const cfg: PresetConfig = scale === 1.0 ? baseCfg : {
    ...baseCfg,
    mainSize: `calc(${baseCfg.mainSize} * ${scale})`,
    cornerSize: `calc(${baseCfg.cornerSize} * ${scale})`,
  };
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
