'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// AudioPlayer
// ---------------------------------------------------------------------------

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const audioTracks        = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId = useCodaStore((s) => s.activeAudioTrackId);
  const setPlaybackTime    = useCodaStore((s) => s.setPlaybackTime);
  const setActiveAudioTrack = useCodaStore((s) => s.setActiveAudioTrack);

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration]   = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Reset player state when active track changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [activeAudioTrackId]);

  // ---------------------------------------------------------------------------
  // Audio event handlers
  // ---------------------------------------------------------------------------

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = audio.currentTime;
    setCurrentTime(t);
    setPlaybackTime(t);
  }, [setPlaybackTime]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackTime(0);
  }, [setPlaybackTime]);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack?.url) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [isPlaying, activeTrack]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
    setPlaybackTime(t);
  }, [setPlaybackTime]);

  const handleTrackSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setActiveAudioTrack(e.target.value);
      setIsPlaying(false);
    },
    [setActiveAudioTrack]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasTrack = !!activeTrack?.url;

  return (
    <div className="px-3 py-2 flex flex-col gap-2 bg-cream-200 select-none">

      {/* Hidden HTML5 audio element */}
      {activeTrack?.url && (
        <audio
          ref={audioRef}
          src={activeTrack.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}

      {/* Track selector */}
      {audioTracks.length > 1 && (
        <select
          value={activeAudioTrackId ?? ''}
          onChange={handleTrackSelect}
          className="w-full bg-cream-100 border border-cream-300 text-[11px] text-ink-900 px-2 py-1 focus:outline-none focus:border-ink-500"
        >
          {audioTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fileName}
            </option>
          ))}
        </select>
      )}

      {/* Track name */}
      <div className="truncate text-xs text-ink-900 leading-none">
        {activeTrack ? activeTrack.fileName : (
          <span className="text-ink-300 italic">No track</span>
        )}
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        disabled={!hasTrack}
        className="w-full h-1 cursor-pointer disabled:opacity-30 disabled:cursor-default"
      />

      {/* Controls row */}
      <div className="flex items-center justify-between gap-2">

        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={!hasTrack}
          className="w-7 h-7 flex items-center justify-center bg-ink-900 text-cream-100 hover:bg-ink-700 transition-colors disabled:opacity-30 disabled:cursor-default shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            /* Pause icon */
            <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
              <rect x="1" y="1" width="3" height="9" rx="0" />
              <rect x="7" y="1" width="3" height="9" rx="0" />
            </svg>
          ) : (
            /* Play icon */
            <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
              <polygon points="2,1 10,5.5 2,10" />
            </svg>
          )}
        </button>

        {/* Timecode */}
        <span className="font-mono text-[11px] text-ink-500 tabular-nums">
          {formatTime(currentTime)}
          <span className="text-ink-300 mx-0.5">/</span>
          {formatTime(duration)}
        </span>

      </div>
    </div>
  );
}
