'use client';

import { useMemo } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ── Preset styles (sync with LyricFontPanel.tsx) ──────────────────────────────
const PRESET_STYLES: Record<string, React.CSSProperties> = {
  clean: {
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontWeight: 400,
    letterSpacing: '0.02em',
    color: '#ffffff',
  },
  mist: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 300,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  slab: {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    letterSpacing: '-0.01em',
    textTransform: 'uppercase' as const,
    color: '#f0ebe2',
  },
  glow: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 400,
    letterSpacing: '0.04em',
    color: '#ffffff',
    textShadow: '0 0 18px rgba(255,255,255,0.9), 0 0 40px rgba(255,255,255,0.5)',
  },
  outline: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    WebkitTextStroke: '1px rgba(255,255,255,0.9)',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  },
  kr: {
    fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
    fontWeight: 500,
    letterSpacing: '-0.02em',
    color: '#e8e3da',
  },
};

const SIZE_PX: Record<string, number> = { S: 18, M: 26, L: 36 };

const POSITION_CSS: Record<string, React.CSSProperties> = {
  bottom: {
    position: 'absolute',
    bottom: '10%',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    width: '80%',
  },
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    width: '80%',
  },
  'right-center': {
    position: 'absolute',
    right: '6%',
    top: '50%',
    transform: 'translateY(-50%)',
    textAlign: 'right',
    width: '38%',
  },
};

// 색상 스타일 매핑
const COLOR_STYLE_CSS: Record<string, { wrapper?: React.CSSProperties; text: React.CSSProperties }> = {
  white: {
    text: { color: '#ffffff', textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  },
  black: {
    text: { color: '#000000', textShadow: '0 1px 4px rgba(255,255,255,0.5)' },
  },
  'outline-black': {
    text: {
      color: '#ffffff',
      // text-shadow 다중 그림자로 외곽선 — 흰 텍스트 영역 침범 없이 검은 테두리만 얇게
      textShadow: [
        '-1px -1px 0 #000',
        ' 1px -1px 0 #000',
        '-1px  1px 0 #000',
        ' 1px  1px 0 #000',
      ].join(','),
    },
  },
  box: {
    wrapper: {
      background: 'rgba(0,0,0,0.65)',
      padding: '0.25em 0.7em',
      display: 'inline-block',
    },
    text: { color: '#ffffff' },
  },
};

export default function LyricHTMLOverlay() {
  const audioTracks         = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId  = useCodaStore((s) => s.activeAudioTrackId);
  const currentPlaybackTime = useCodaStore((s) => s.currentPlaybackTime);
  const lyricFontPreset     = useCodaStore((s) => s.lyricFontPreset);
  const lyricPosition       = useCodaStore((s) => s.lyricPosition);
  const lyricSize           = useCodaStore((s) => s.lyricSize);
  const lyricColorStyle     = useCodaStore((s) => s.lyricColorStyle ?? 'white');

  const segments = useMemo(() => {
    const track = audioTracks.find((t) => t.id === activeAudioTrackId);
    return track?.whisperSegments ?? [];
  }, [audioTracks, activeAudioTrackId]);

  const activeSegment = segments.find(
    (seg) => currentPlaybackTime >= seg.start && currentPlaybackTime < seg.end
  );

  const text        = activeSegment?.text ?? '';
  const presetStyle = PRESET_STYLES[lyricFontPreset] ?? PRESET_STYLES.clean;
  const posStyle    = POSITION_CSS[lyricPosition]    ?? POSITION_CSS.bottom;
  const fontSize    = SIZE_PX[lyricSize]             ?? 26;
  const colorCSS    = COLOR_STYLE_CSS[lyricColorStyle] ?? COLOR_STYLE_CSS.white;

  const inner = (
    <span
      style={{
        ...presetStyle,
        ...colorCSS.text,
        fontSize:   `${fontSize}px`,
        lineHeight: 1.35,
        whiteSpace: 'pre-wrap',
      }}
    >
      {text}
    </span>
  );

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 51 }}>
      <div
        style={{
          ...posStyle,
          opacity:    text ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
        }}
      >
        {colorCSS.wrapper ? (
          <div style={colorCSS.wrapper}>{inner}</div>
        ) : inner}
      </div>
    </div>
  );
}
