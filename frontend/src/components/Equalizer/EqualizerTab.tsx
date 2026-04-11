'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import EQCanvas, { type EQPreset } from './EQCanvas';
import PresetGrid, { DEFAULT_PRESETS } from './PresetGrid';
import EQReactModeSelector from './EQReactModeSelector';

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
// EQAudioPlayer — self-contained drag-drop + transport inside Equalizer tab
// ---------------------------------------------------------------------------

interface EQAudioPlayerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  onAudioReady: () => void;
}

function EQAudioPlayer({ audioRef, onAudioReady }: EQAudioPlayerProps) {
  const [fileName, setFileName]     = useState<string | null>(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [volume, setVolume]         = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // ----------------------------------------------------------
  // File load
  // ----------------------------------------------------------

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|aac)$/i)) return;

    // Revoke previous blob URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setFileName(file.name);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.src = url;
    audio.load();
    onAudioReady();
  }, [audioRef, onAudioReady]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  // ----------------------------------------------------------
  // Drag & Drop
  // ----------------------------------------------------------

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  // ----------------------------------------------------------
  // Audio element event listeners
  // ----------------------------------------------------------

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime     = () => setCurrentTime(audio.currentTime);
    const onMeta     = () => setDuration(audio.duration);
    const onEnded    = () => { setIsPlaying(false); setCurrentTime(0); };
    const onPlay     = () => setIsPlaying(true);
    const onPause    = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audioRef]);

  // ----------------------------------------------------------
  // Controls
  // ----------------------------------------------------------

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  const hasFile = !!fileName;

  return (
    <div className="px-3 pt-2 pb-1 flex flex-col gap-1.5 bg-cream-200 border-b border-cream-300 shrink-0">

      {/* Hidden audio element — this is what analyser connects to */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" />

      {/* Drop zone / track name row */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !hasFile && fileInputRef.current?.click()}
        className={[
          'flex items-center gap-2 px-2 py-1.5 border transition-colors cursor-pointer select-none',
          isDragging
            ? 'border-ink-900 bg-ink-900/5'
            : hasFile
            ? 'border-cream-300 bg-cream-100 cursor-default'
            : 'border-dashed border-cream-400 hover:border-ink-400 hover:bg-cream-100',
        ].join(' ')}
      >
        {/* Icon */}
        <div className="shrink-0 text-ink-400">
          {hasFile ? (
            /* waveform icon */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <polyline points="0,7 2,3 4,11 6,5 8,9 10,2 12,7 14,7" />
            </svg>
          ) : (
            /* upload icon */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M7 9V3M4 6l3-3 3 3" />
              <path d="M2 11h10" />
            </svg>
          )}
        </div>

        {/* Label */}
        <span className="flex-1 truncate text-[11px] text-ink-600 leading-none">
          {hasFile
            ? fileName
            : isDragging
            ? 'Drop to load…'
            : 'Drop MP3 / WAV here'}
        </span>

        {/* File button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="shrink-0 px-1.5 py-0.5 border border-cream-300 text-[9px] label-caps text-ink-500 hover:border-ink-400 hover:text-ink-900 transition-colors"
        >
          {hasFile ? 'CHANGE' : 'BROWSE'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac"
          className="sr-only"
          onChange={handleFileInput}
        />
      </div>

      {/* Transport row */}
      <div className="flex items-center gap-2">

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!hasFile}
          className="w-6 h-6 flex items-center justify-center bg-ink-900 text-cream-100 hover:bg-ink-700 transition-colors disabled:opacity-25 disabled:cursor-default shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <rect x="0" y="0" width="3" height="9" />
              <rect x="6" y="0" width="3" height="9" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <polygon points="1,0 9,4.5 1,9" />
            </svg>
          )}
        </button>

        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          disabled={!hasFile}
          className="flex-1 h-0.5 cursor-pointer disabled:opacity-20"
          style={{ accentColor: '#1a1a16' }}
        />

        {/* Timecode */}
        <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 w-16 text-right">
          {formatTime(currentTime)}<span className="text-ink-200 mx-0.5">/</span>{formatTime(duration)}
        </span>
      </div>

      {/* Volume row */}
      <div className="flex items-center gap-2">
        <span className="label-caps text-ink-300 shrink-0">VOL</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolume}
          className="flex-1 h-0.5 cursor-pointer"
          style={{ accentColor: '#1a1a16' }}
        />
        <span className="font-mono text-[10px] text-ink-300 tabular-nums shrink-0 w-6 text-right">
          {Math.round(volume * 100)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EqualizerTab
// ---------------------------------------------------------------------------

export default function EqualizerTab() {
  // Zustand EQ state
  const eqPresetId       = useCodaStore((s) => s.eqPresetId);
  const eqReactMode      = useCodaStore((s) => s.eqReactMode);
  const eqCustomImageUrl = useCodaStore((s) => s.eqCustomImageUrl);
  const setEQPreset      = useCodaStore((s) => s.setEQPreset);
  const setEQReactMode   = useCodaStore((s) => s.setEQReactMode);
  const setEQCustomImage = useCodaStore((s) => s.setEQCustomImage);

  // Shared audio element ref — passed to both EQAudioPlayer and useAudioAnalyser
  const audioRef = useRef<HTMLAudioElement>(null);

  // analyserReady flag forces re-render after audio element is connected
  const [analyserKey, setAnalyserKey] = useState(0);

  // Notify analyser that the audio element is ready / src changed
  const handleAudioReady = useCallback(() => {
    setAnalyserKey((k) => k + 1);
  }, []);

  // Local preset list (may be patched with custom image URL)
  const [presets, setPresets] = useState<EQPreset[]>(DEFAULT_PRESETS);

  // Sync custom image from store into preset list on mount
  useEffect(() => {
    if (eqCustomImageUrl) {
      setPresets((prev) =>
        prev.map((p) =>
          p.id === 'custom' ? { ...p, imagePath: eqCustomImageUrl } : p
        )
      );
    }
  }, [eqCustomImageUrl]);

  // Derived selected preset (always reflect eqReactMode from store)
  const selectedPreset: EQPreset = (() => {
    const found = presets.find((p) => p.id === eqPresetId);
    if (!found) return { ...DEFAULT_PRESETS[0], reactMode: eqReactMode };
    return { ...found, reactMode: eqReactMode };
  })();

  // Web Audio analyser — directly connected to our audio element ref
  const analyserData = useAudioAnalyser(audioRef);

  // Suppress analyserKey lint warning — used to force re-trigger analyser
  void analyserKey;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePresetSelect = (preset: EQPreset) => {
    setEQPreset(preset.id);
    setEQReactMode(preset.reactMode);
    setPresets((prev) =>
      prev.map((p) => (p.id === preset.id ? { ...p, imagePath: preset.imagePath } : p))
    );
  };

  const handleCustomImage = (url: string, _preset: EQPreset) => {
    setEQCustomImage(url);
    setEQPreset('custom');
  };

  const handleReactModeChange = (mode: EQPreset['reactMode']) => {
    setEQReactMode(mode);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5 shrink-0 flex items-center justify-between border-b border-cream-300">
        <span className="label-caps">Equalizer</span>
        <span className="text-[9px] text-ink-300 label-caps">Web Audio API</span>
      </div>

      {/* ── Audio Player (drag-drop + transport) ── */}
      <EQAudioPlayer audioRef={audioRef} onAudioReady={handleAudioReady} />

      {/* ── EQ Canvas — flex-1 fills remaining space ── */}
      <div className="flex-1 min-h-0 relative">
        <EQCanvas preset={selectedPreset} analyserData={analyserData} />
      </div>

      {/* ── Preset Grid ── */}
      <div className="shrink-0">
        <PresetGrid
          presets={presets}
          selectedId={eqPresetId}
          onSelect={handlePresetSelect}
          onCustomImage={handleCustomImage}
        />
      </div>

      {/* ── React Mode Selector ── */}
      <div className="shrink-0">
        <EQReactModeSelector
          value={eqReactMode}
          onChange={handleReactModeChange}
        />
      </div>

    </div>
  );
}
