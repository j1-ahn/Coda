'use client';

import { useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import type { AudioTrack } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(sec: number): string {
  if (!sec || isNaN(sec)) return '--:--';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// DraggableOverlay — wraps any content with drag + wheel-to-scale
// ---------------------------------------------------------------------------

function DraggableOverlay({ children, canvasSelector = '#studio-canvas-container' }: {
  children: React.ReactNode;
  canvasSelector?: string;
}) {
  const overlayX     = useCodaStore((s) => s.playlistOverlayX);
  const overlayY     = useCodaStore((s) => s.playlistOverlayY);
  const scale        = useCodaStore((s) => s.playlistOverlayScale);
  const setPos       = useCodaStore((s) => s.setPlaylistOverlayPos);
  const setScale     = useCodaStore((s) => s.setPlaylistOverlayScale);
  const previewMode  = useCodaStore((s) => s.previewMode);

  const dragging  = useRef(false);
  const resizing  = useRef(false);
  const origin    = useRef({ mx: 0, my: 0, ox: 0, oy: 0, s0: 1 });

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onDragDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, ox: overlayX, oy: overlayY, s0: scale };

    const canvas = document.querySelector(canvasSelector) as HTMLElement | null;

    const onMove = (me: MouseEvent) => {
      if (!dragging.current || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (me.clientX - origin.current.mx) / rect.width  * 100;
      const dy = (me.clientY - origin.current.my) / rect.height * 100;
      setPos(
        clamp(origin.current.ox + dx, 0, 100),
        clamp(origin.current.oy + dy, 0, 100),
      );
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [overlayX, overlayY, scale, setPos, canvasSelector]);

  // ── Resize handle (corner drag — up=bigger) ───────────────────────────────
  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, ox: overlayX, oy: overlayY, s0: scale };

    const onMove = (me: MouseEvent) => {
      if (!resizing.current) return;
      const dy = origin.current.my - me.clientY; // drag up → bigger
      setScale(clamp(origin.current.s0 + dy * 0.012, 0.4, 4));
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [overlayX, overlayY, scale, setScale]);

  // ── Wheel-to-scale ────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(clamp(scale - e.deltaY * 0.001, 0.4, 4));
  }, [scale, setScale]);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${overlayX}%`,
        top:  `${overlayY}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        zIndex: 30,
        userSelect: 'none',
      }}
      onWheel={onWheel}
    >
      {/* Drag handle area (whole content) */}
      <div
        onMouseDown={onDragDown}
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        {children}
      </div>

      {/* Corner resize handle — hidden in preview mode */}
      {!previewMode && (
        <div
          onMouseDown={onResizeDown}
          title="드래그: 크기 조절 | 휠: 확대/축소"
          style={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            width: 12,
            height: 12,
            cursor: 'nwse-resize',
            background: 'rgba(255,255,255,0.25)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
            <path d="M1 5L5 1M3 5L5 3M5 5V5" stroke="white" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaylistOverlay
// ---------------------------------------------------------------------------

function ThumbClickZone({ track }: { track: AudioTrack }) {
  const setTrackThumbnail = useCodaStore((s) => s.setTrackThumbnail);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTrackThumbnail(track.id, URL.createObjectURL(file));
    e.target.value = '';
  };

  return (
    <>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        title="앨범아트 변경"
        className="w-full h-full"
      >
        {track.thumbnailUrl
          ? <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          : <MusicNoteIcon />}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </>
  );
}

export default function PlaylistOverlay() {
  const audioTracks         = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId  = useCodaStore((s) => s.activeAudioTrackId);
  const setActiveAudioTrack = useCodaStore((s) => s.setActiveAudioTrack);
  const playlistMode        = useCodaStore((s) => s.playlistMode);
  const playlistVisible     = useCodaStore((s) => s.playlistVisible);

  if (!playlistVisible || audioTracks.length === 0) return null;

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);
  const activeIdx   = activeTrack ? audioTracks.indexOf(activeTrack) : -1;
  const nextTrack   = activeIdx >= 0
    ? audioTracks[(activeIdx + 1) % audioTracks.length]
    : null;

  // ── SIMPLE ─────────────────────────────────────────────────────────────────
  if (playlistMode === 'simple') {
    return (
      <DraggableOverlay>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm whitespace-nowrap">
          <span className="text-white/50 text-[10px]">▶</span>
          <span className="text-white text-[11px] font-medium tracking-wide max-w-[200px] truncate">
            {activeTrack?.fileName.replace(/\.[^.]+$/, '') ?? '—'}
          </span>
          <span className="text-white/40 text-[9px] tabular-nums ml-1">
            {fmt(activeTrack?.durationSec ?? 0)}
          </span>
        </div>
      </DraggableOverlay>
    );
  }

  // ── BOX ────────────────────────────────────────────────────────────────────
  if (playlistMode === 'box') {
    return (
      <DraggableOverlay>
        <div className="flex flex-col gap-0 w-[96px]">
          <div className="w-full aspect-square bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden">
            {activeTrack && <ThumbClickZone track={activeTrack} />}
          </div>
          <div className="bg-black/75 backdrop-blur-sm px-2 py-1.5 flex flex-col gap-0.5">
            <span className="text-white text-[10px] font-medium leading-tight truncate">
              {activeTrack?.fileName.replace(/\.[^.]+$/, '') ?? '—'}
            </span>
            <span className="text-white/50 text-[8px] tabular-nums">
              {fmt(activeTrack?.durationSec ?? 0)}
            </span>
            {nextTrack && nextTrack.id !== activeTrack?.id && (
              <span className="text-white/30 text-[8px] truncate mt-0.5 border-t border-white/10 pt-0.5">
                → {nextTrack.fileName.replace(/\.[^.]+$/, '')}
              </span>
            )}
          </div>
        </div>
      </DraggableOverlay>
    );
  }

  // ── LIST — 최대 5개 슬라이딩 윈도우 ──────────────────────────────────────────
  if (playlistMode === 'list') {
    // 현재 곡 인덱스 기준으로 이후 5개만 보여줌 (재생 지나간 곡은 자동 소멸)
    const startIdx = Math.max(0, activeIdx);
    const visible  = audioTracks.slice(startIdx, startIdx + 5);

    return (
      <DraggableOverlay>
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: 200, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 shrink-0">
            <span className="text-white/40 text-[9px] tracking-[0.15em] uppercase">Playlist</span>
            <span className="text-white/25 text-[9px] tabular-nums ml-auto">
              {startIdx + 1}–{Math.min(startIdx + 5, audioTracks.length)} / {audioTracks.length}
            </span>
          </div>
          {/* 최대 5개 트랙 */}
          {visible.map((track, i) => {
            const isActive = track.id === activeAudioTrackId;
            const globalIdx = startIdx + i;
            return (
              <div
                key={track.id}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setActiveAudioTrack(track.id)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer border-b border-white/5 last:border-b-0 transition-all ${
                  isActive ? 'bg-white/12' : 'hover:bg-white/6'
                }`}
              >
                {/* 썸네일 */}
                <div className="w-5 h-5 shrink-0 overflow-hidden">
                  {track.thumbnailUrl
                    ? <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <span className="text-white/20 text-[8px]">♪</span>
                      </div>
                  }
                </div>
                <span className={`flex-1 text-[10px] truncate ${isActive ? 'text-white font-medium' : 'text-white/60'}`}>
                  {track.fileName.replace(/\.[^.]+$/, '')}
                </span>
                <span className="text-[8px] text-white/25 tabular-nums shrink-0">
                  {fmt(track.durationSec)}
                </span>
              </div>
            );
          })}
        </div>
      </DraggableOverlay>
    );
  }

  return null;
}

function MusicNoteIcon() {
  return (
    <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}
