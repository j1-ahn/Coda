'use client';

import { useRef, useState, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.addEventListener('loadedmetadata', () => resolve(a.duration));
    a.addEventListener('error', () => resolve(0));
  });
}

async function extractThumbnail(file: File): Promise<string | null> {
  try {
    const { parseBlob } = await import('music-metadata-browser');
    const meta = await parseBlob(file, { skipPostHeaders: true });
    const pic = meta.common.picture?.[0];
    if (!pic) return null;
    const blob = new Blob([pic.data], { type: pic.format });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Mode meta
// ---------------------------------------------------------------------------

const MODES = [
  { id: 'simple' as const, label: 'SIMPLE', desc: '현재 곡 이름 · 우하단' },
  { id: 'box'    as const, label: 'BOX',    desc: '앨범아트 박스 · 곡명 · 시간 · 다음곡' },
  { id: 'list'   as const, label: 'LIST',   desc: '전체 트랙 리스트 오버레이' },
];

// ---------------------------------------------------------------------------
// PlaylistPanel
// ---------------------------------------------------------------------------

export default function PlaylistPanel() {
  const audioTracks         = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId  = useCodaStore((s) => s.activeAudioTrackId);
  const setActiveAudioTrack = useCodaStore((s) => s.setActiveAudioTrack);
  const removeAudioTrack    = useCodaStore((s) => s.removeAudioTrack);
  const addAudioTrack       = useCodaStore((s) => s.addAudioTrack);
  const setTrackThumbnail   = useCodaStore((s) => s.setTrackThumbnail);
  const playlistMode        = useCodaStore((s) => s.playlistMode);
  const playlistVisible     = useCodaStore((s) => s.playlistVisible);
  const setPlaylistMode     = useCodaStore((s) => s.setPlaylistMode);
  const setPlaylistVisible  = useCodaStore((s) => s.setPlaylistVisible);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const thumbInputRef   = useRef<HTMLInputElement>(null);
  const thumbTargetId   = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── 오디오 파일 추가 + ID3 자동 추출 ───────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList) => {
    const remaining = 50 - audioTracks.length;
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|aac)$/i)) continue;
      const url = URL.createObjectURL(file);
      const id = addAudioTrack(file.name, url);

      // ID3 썸네일 자동 추출 (비동기, 실패해도 무시)
      extractThumbnail(file).then((thumbUrl) => {
        if (thumbUrl) useCodaStore.getState().setTrackThumbnail(id, thumbUrl);
      });

      const dur = await loadAudioDuration(url);
      useCodaStore.getState().setWhisperSegments(id, [], dur);
      useCodaStore.getState().setAudioTrackProcessing(id, 'idle');
    }
  }, [audioTracks.length, addAudioTrack]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) await handleFiles(e.dataTransfer.files);
  };

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) await handleFiles(e.target.files);
    e.target.value = '';
  };

  // ── 수동 썸네일 업로드 ──────────────────────────────────────────────────────
  const openThumbPicker = (trackId: string) => {
    thumbTargetId.current = trackId;
    thumbInputRef.current?.click();
  };

  const handleThumbInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !thumbTargetId.current) return;
    const url = URL.createObjectURL(file);
    setTrackThumbnail(thumbTargetId.current, url);
    e.target.value = '';
  };

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);
  const nextTrack   = activeTrack
    ? audioTracks[(audioTracks.indexOf(activeTrack) + 1) % audioTracks.length]
    : null;

  return (
    <div className="shrink-0 flex flex-col border-t border-cream-300">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-cream-200 border-b border-cream-300">
        <span className="label-caps">Playlist</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-ink-300 tabular-nums">{audioTracks.length}/50</span>
          <button
            onClick={() => setPlaylistVisible(!playlistVisible)}
            className={`px-2 py-0.5 text-[9px] label-caps border transition-colors ${
              playlistVisible
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : 'text-ink-400 border-cream-300 hover:text-ink-900 hover:border-ink-500'
            }`}
          >
            {playlistVisible ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ── Mode selector ──────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-cream-300 flex flex-col gap-1.5">
        <div className="flex gap-1">
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPlaylistMode(id)}
              className={`flex-1 py-1 text-[9px] label-caps border transition-colors ${
                playlistMode === id
                  ? 'bg-ink-900 text-cream-100 border-ink-900'
                  : 'text-ink-400 border-cream-300 hover:text-ink-900 hover:border-ink-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-ink-300">
          {MODES.find((m) => m.id === playlistMode)?.desc}
        </p>
      </div>

      {/* ── Upload zone ────────────────────────────────────────────────────── */}
      {audioTracks.length < 50 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mx-3 my-2 flex items-center justify-center gap-1.5 h-7 border border-dashed cursor-pointer transition-colors shrink-0 ${
            dragOver
              ? 'border-ink-500 bg-cream-200'
              : 'border-cream-300 hover:border-ink-400 hover:bg-cream-200'
          }`}
        >
          <PlusIcon />
          <span className="text-[9px] label-caps text-ink-400">트랙 추가 (MP3 · WAV · M4A)</span>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac" multiple className="hidden" onChange={handleInput} />
      <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbInput} />

      {/* ── Track list ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '160px' }}>
        {audioTracks.length === 0 ? (
          <p className="text-[9px] text-ink-300 text-center py-3 italic">트랙이 없습니다</p>
        ) : (
          audioTracks.map((track, idx) => {
            const isActive = track.id === activeAudioTrackId;
            return (
              <div
                key={track.id}
                onClick={() => setActiveAudioTrack(track.id)}
                className={`flex items-center gap-2 px-3 py-1 cursor-pointer border-b border-cream-300 last:border-b-0 transition-colors ${
                  isActive ? 'bg-cream-200' : 'hover:bg-cream-200'
                }`}
              >
                {/* Thumbnail — click to replace */}
                <button
                  onClick={(e) => { e.stopPropagation(); openThumbPicker(track.id); }}
                  title="썸네일 변경"
                  className="w-6 h-6 shrink-0 overflow-hidden border border-cream-300 hover:border-ink-400 transition-colors bg-cream-200 flex items-center justify-center"
                >
                  {track.thumbnailUrl ? (
                    <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <MusicDotIcon />
                  )}
                </button>

                {/* Index / play indicator */}
                <span className={`text-[9px] tabular-nums shrink-0 w-3 ${isActive ? 'text-ink-900 font-bold' : 'text-ink-300'}`}>
                  {isActive ? '▶' : idx + 1}
                </span>

                {/* File name */}
                <span className={`flex-1 text-[10px] truncate ${track.url === null ? 'text-ink-300 line-through' : isActive ? 'text-ink-900 font-medium' : 'text-ink-600'}`}>
                  {track.fileName.replace(/\.[^.]+$/, '')}
                </span>

                {/* Duration / dead indicator */}
                {track.url === null ? (
                  <span className="text-[9px] text-red-400 tabular-nums shrink-0">만료</span>
                ) : (
                  <span className="text-[9px] text-ink-300 tabular-nums shrink-0">
                    {formatDuration(track.durationSec)}
                  </span>
                )}

                {/* Remove */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeAudioTrack(track.id); }}
                  className="w-4 h-4 flex items-center justify-center text-ink-300 hover:text-ink-900 transition-colors shrink-0 text-xs leading-none"
                  aria-label="remove"
                >×</button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Box-mode preview ───────────────────────────────────────────────── */}
      {playlistMode === 'box' && activeTrack && (
        <div className="mx-3 mb-2 mt-1 p-2 border border-cream-300 bg-cream-200 flex items-center gap-2">
          <button
            onClick={() => openThumbPicker(activeTrack.id)}
            title="앨범아트 변경"
            className="w-10 h-10 shrink-0 overflow-hidden border border-cream-300 hover:border-ink-400 transition-colors bg-cream-100 flex items-center justify-center"
          >
            {activeTrack.thumbnailUrl ? (
              <img src={activeTrack.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <MusicDotIcon size={16} />
            )}
          </button>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[8px] label-caps text-ink-300">PREVIEW</span>
            <span className="text-[11px] text-ink-900 font-medium truncate">
              {activeTrack.fileName.replace(/\.[^.]+$/, '')}
            </span>
            <div className="flex items-center gap-2 text-[9px] text-ink-400">
              <span>{formatDuration(activeTrack.durationSec)}</span>
              {nextTrack && nextTrack.id !== activeTrack.id && (
                <>
                  <span className="text-cream-400">→</span>
                  <span className="truncate max-w-[80px]">{nextTrack.fileName.replace(/\.[^.]+$/, '')}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg className="w-3 h-3 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function MusicDotIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-ink-300">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}
