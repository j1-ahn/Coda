'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import type { AudioAnalyserData } from '@/hooks/useAudioAnalyser';
import EQCanvas, { type EQPreset } from './EQCanvas';
import PresetGrid, { DEFAULT_PRESETS } from './PresetGrid';
import { eqAnalyserRef } from '@/lib/eqAnalyserRef';
import PlaylistPanel from '@/components/UI/PlaylistPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_DATA: AudioAnalyserData = {
  frequencyData: new Uint8Array(256),
  bassLevel: 0, midLevel: 0, trebleLevel: 0, overallLevel: 0,
};

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function hzToBin(hz: number, fftSize: number, sampleRate: number) {
  return Math.round((hz / (sampleRate / 2)) * (fftSize / 2));
}
function avgRange(data: Uint8Array, from: number, to: number) {
  const s = Math.max(0, from), e = Math.min(data.length - 1, to);
  if (s > e) return 0;
  let sum = 0;
  for (let i = s; i <= e; i++) sum += data[i];
  return sum / ((e - s + 1) * 255);
}

// ---------------------------------------------------------------------------
// EQAudioPlayer
// AudioContext is created INSIDE togglePlay (user gesture) to avoid
// browser autoplay policy and React StrictMode double-effect issues.
// analyserData is pushed up to parent via onData callback every RAF frame.
// ---------------------------------------------------------------------------

interface EQAudioPlayerProps {
  onData: (data: AudioAnalyserData) => void;
}

function EQAudioPlayer({ onData }: EQAudioPlayerProps) {
  const audioRef       = useRef<HTMLAudioElement>(null);
  const ctxRef         = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const rafRef         = useRef<number>(0);
  const objectUrlRef   = useRef<string | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const [fileName, setFileName]       = useState<string | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [volume, setVolume]           = useState(1);
  const [isDragging, setIsDragging]   = useState(false);

  // ----------------------------------------------------------
  // RAF: read analyser and push data up
  // ----------------------------------------------------------
  const startRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const analyser = analyserRef.current;
      const ctx      = ctxRef.current;
      if (!analyser || !ctx) { rafRef.current = requestAnimationFrame(tick); return; }

      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);

      const sr      = ctx.sampleRate;
      const fftSize = analyser.fftSize;
      onData({
        frequencyData: buf,
        bassLevel:    avgRange(buf, hzToBin(20,   fftSize, sr), hzToBin(250,   fftSize, sr)),
        midLevel:     avgRange(buf, hzToBin(250,  fftSize, sr), hzToBin(4000,  fftSize, sr)),
        trebleLevel:  avgRange(buf, hzToBin(4000, fftSize, sr), hzToBin(20000, fftSize, sr)),
        overallLevel: avgRange(buf, 0, buf.length - 1),
        currentTime:  audioRef.current?.currentTime,
      });
      eqAnalyserRef.current = {
        frequencyData: buf,
        bassLevel:    avgRange(buf, hzToBin(20,   fftSize, sr), hzToBin(250,   fftSize, sr)),
        midLevel:     avgRange(buf, hzToBin(250,  fftSize, sr), hzToBin(4000,  fftSize, sr)),
        trebleLevel:  avgRange(buf, hzToBin(4000, fftSize, sr), hzToBin(20000, fftSize, sr)),
        overallLevel: avgRange(buf, 0, buf.length - 1),
        currentTime:  audioRef.current?.currentTime,
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onData]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ----------------------------------------------------------
  // File load
  // ----------------------------------------------------------
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|aac)$/i)) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

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
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  // ----------------------------------------------------------
  // Drag & Drop
  // ----------------------------------------------------------
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  // ----------------------------------------------------------
  // Audio element events
  // ----------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onMeta  = () => setDuration(audio.duration);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('timeupdate',    onTime);
    audio.addEventListener('loadedmetadata',onMeta);
    audio.addEventListener('ended',         onEnded);
    audio.addEventListener('play',          onPlay);
    audio.addEventListener('pause',         onPause);
    return () => {
      audio.removeEventListener('timeupdate',    onTime);
      audio.removeEventListener('loadedmetadata',onMeta);
      audio.removeEventListener('ended',         onEnded);
      audio.removeEventListener('play',          onPlay);
      audio.removeEventListener('pause',         onPause);
    };
  }, []);

  // ----------------------------------------------------------
  // togglePlay — AudioContext created HERE (user gesture)
  // ----------------------------------------------------------
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    // First play: create AudioContext + AnalyserNode inside user gesture
    if (!ctxRef.current) {
      try {
        const ctx      = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current   = ctx;
        analyserRef.current = analyser;
        startRaf();
      } catch (e) {
        console.error('[EQAudioPlayer] AudioContext setup failed:', e);
      }
    }

    // Subsequent plays: just resume if suspended
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn('[EQAudioPlayer] play() rejected:', err);
        setIsPlaying(false);
      });
    }
  }, [isPlaying, startRaf]);

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

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" />

      {/* Drop zone */}
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
        <div className="shrink-0 text-ink-400">
          {hasFile ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <polyline points="0,7 2,3 4,11 6,5 8,9 10,2 12,7 14,7" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M7 9V3M4 6l3-3 3 3" /><path d="M2 11h10" />
            </svg>
          )}
        </div>
        <span className="flex-1 truncate text-[11px] text-ink-600 leading-none">
          {hasFile ? fileName : isDragging ? 'Drop to load…' : 'Drop MP3 / WAV here'}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="shrink-0 px-1.5 py-0.5 border border-cream-300 text-[9px] label-caps text-ink-500 hover:border-ink-400 hover:text-ink-900 transition-colors"
        >
          {hasFile ? 'CHANGE' : 'BROWSE'}
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac" className="sr-only" onChange={handleFileInput} />
      </div>

      {/* Transport */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={!hasFile}
          className="w-6 h-6 flex items-center justify-center bg-ink-900 text-cream-100 hover:bg-ink-700 transition-colors disabled:opacity-25 disabled:cursor-default shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <rect x="0" y="0" width="3" height="9" /><rect x="6" y="0" width="3" height="9" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <polygon points="1,0 9,4.5 1,9" />
            </svg>
          )}
        </button>
        <input type="range" min={0} max={duration || 1} step={0.05} value={currentTime}
          onChange={handleSeek} disabled={!hasFile}
          className="flex-1 h-0.5 cursor-pointer disabled:opacity-20"
          style={{ accentColor: '#1a1a16' }}
        />
        <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 w-16 text-right">
          {formatTime(currentTime)}<span className="text-ink-200 mx-0.5">/</span>{formatTime(duration)}
        </span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2">
        <span className="label-caps text-ink-300 shrink-0">VOL</span>
        <input type="range" min={0} max={1} step={0.01} value={volume}
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
  const eqPresetId          = useCodaStore((s) => s.eqPresetId);
  const eqIntensity         = useCodaStore((s) => s.eqIntensity);
  const eqSensitivity       = useCodaStore((s) => s.eqSensitivity);
  const eqTintColor         = useCodaStore((s) => s.eqTintColor);
  const setEQPreset         = useCodaStore((s) => s.setEQPreset);
  const setEqIntensity      = useCodaStore((s) => s.setEqIntensity);
  const setEqSensitivity    = useCodaStore((s) => s.setEqSensitivity);
  const eqOpacity           = useCodaStore((s) => s.eqOpacity);
  const eqMirror            = useCodaStore((s) => s.eqMirror);
  const setEqTintColor      = useCodaStore((s) => s.setEqTintColor);
  const setEqOpacity        = useCodaStore((s) => s.setEqOpacity);
  const setEqMirror         = useCodaStore((s) => s.setEqMirror);
  const setEqOverlayGeometry = useCodaStore((s) => s.setEqOverlayGeometry);
  const setEqOverlayVisible  = useCodaStore((s) => s.setEqOverlayVisible);

  // analyserData received from EQAudioPlayer via callback
  const [analyserData, setAnalyserData] = useState<AudioAnalyserData>(EMPTY_DATA);
  const [presets, setPresets]           = useState<EQPreset[]>(DEFAULT_PRESETS);
  const [pendingColor, setPendingColor] = useState<string | null>(null);


  const selectedPreset: EQPreset = (() => {
    const found = presets.find((p) => p.id === eqPresetId);
    const base = found ?? DEFAULT_PRESETS[0];
    return {
      ...base,
      reactMode: 'original',
      colorTint: eqTintColor ?? base.colorTint,
    };
  })();

  const handlePresetSelect = (preset: EQPreset) => {
    setEQPreset(preset.id);
    setPresets((prev) => prev.map((p) => p.id === preset.id ? { ...p, imagePath: preset.imagePath } : p));
  };


  // ----------------------------------------------------------
  // Drag EQ canvas to main studio canvas
  // ----------------------------------------------------------
  const handleEQDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    // Create ghost
    const ghost = document.createElement('div');
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:280px;height:140px;border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.5);transform:translate(-50%,-50%);left:${startX}px;top:${startY}px;display:flex;align-items:center;justify-content:center;`;
    ghost.innerHTML = '<span style="color:rgba(255,255,255,0.5);font-size:10px;font-family:monospace">EQ</span>';
    document.body.appendChild(ghost);

    const onMove = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top  = ev.clientY + 'px';
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.removeChild(ghost);

      // Check if dropped on main canvas → always center in container
      const container = document.getElementById('studio-canvas-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right &&
            ev.clientY >= rect.top  && ev.clientY <= rect.bottom) {
          const w = 280, h = 140;
          const x = Math.max(0, (rect.width  - w) / 2);
          const y = Math.max(0, (rect.height - h) / 2);
          setEqOverlayGeometry(x, y, w, h);
          setEqOverlayVisible(true);
        }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setEqOverlayGeometry, setEqOverlayVisible]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="px-3 pt-2.5 pb-1.5 shrink-0 flex items-center justify-between border-b border-cream-300">
        <span className="label-caps">Equalizer</span>
        <span className="text-[9px] text-ink-300 label-caps">Web Audio API</span>
      </div>

      {/* Audio player — pushes analyser data up via onData */}
      <EQAudioPlayer onData={setAnalyserData} />

      {/* EQ Canvas — draggable to studio canvas */}
      <div
        className="relative shrink-0 cursor-grab active:cursor-grabbing"
        style={{ height: '140px' }}
        onMouseDown={handleEQDragStart}
      >
        <EQCanvas preset={selectedPreset} analyserData={analyserData} intensity={1} sensitivity={eqIntensity * 2} />
        <div className="absolute inset-0 flex items-end justify-center pb-1.5 pointer-events-none">
          <span className="text-[8px] label-caps text-white/30">drag to canvas</span>
        </div>
      </div>


      {/* Preset Grid */}
      <div className="shrink-0">
        <PresetGrid
          presets={presets}
          selectedId={eqPresetId}
          onSelect={handlePresetSelect}
        />
      </div>


      {/* Intensity = audio reactivity (0–100, stored 0–1, default 0.5) */}
      <div className="shrink-0 px-3 py-2 border-t border-cream-300">
        <div className="flex items-center gap-2">
          <span className="label-caps text-ink-300 shrink-0">INTENSITY</span>
          <input
            type="range" min={0} max={1} step={0.01} value={eqIntensity}
            onChange={(e) => setEqIntensity(parseFloat(e.target.value))}
            className="flex-1 h-0.5 cursor-pointer"
            style={{ accentColor: '#1a1a16' }}
          />
          <span className="font-mono text-[10px] text-ink-300 w-8 text-right tabular-nums">
            {Math.round(eqIntensity * 100)}
          </span>
        </div>
      </div>

      {/* Opacity slider */}
      <div className="shrink-0 px-3 py-2 border-t border-cream-300">
        <div className="flex items-center gap-2">
          <span className="label-caps text-ink-300 shrink-0">OPACITY</span>
          <input
            type="range" min={0} max={1} step={0.01} value={eqOpacity}
            onChange={(e) => setEqOpacity(parseFloat(e.target.value))}
            className="flex-1 h-0.5 cursor-pointer"
            style={{ accentColor: '#1a1a16' }}
          />
          <span className="font-mono text-[10px] text-ink-300 w-8 text-right tabular-nums">
            {Math.round(eqOpacity * 100)}
          </span>
        </div>
      </div>

      {/* Mirror toggle */}
      <div className="shrink-0 px-3 py-2 border-t border-cream-300 flex items-center justify-between">
        <span className="label-caps text-ink-300">MIRROR</span>
        <button
          onClick={() => setEqMirror(!eqMirror)}
          className={`px-3 py-1 text-[10px] label-caps border transition-colors ${
            eqMirror
              ? 'bg-ink-900 text-cream-100 border-ink-900'
              : 'text-ink-400 border-cream-300 hover:text-ink-900 hover:border-ink-500'
          }`}
        >
          {eqMirror ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Playlist — Color 바로 위 */}
      <PlaylistPanel />

      {/* Color tint — pick then APPLY */}
      {(() => {
        const presetDefault = presets.find((p) => p.id === eqPresetId)?.colorTint ?? '#ffffff';
        const displayColor  = pendingColor ?? eqTintColor ?? presetDefault;
        const isDirty       = pendingColor !== null && pendingColor !== (eqTintColor ?? presetDefault);
        return (
          <div className="shrink-0 px-3 py-2 border-t border-cream-300 flex items-center gap-2">
            <span className="label-caps text-ink-300 shrink-0">COLOR</span>
            <label className="relative cursor-pointer shrink-0" title="Pick EQ color">
              <span
                className="block w-5 h-5 border border-cream-300 hover:border-ink-500 transition-colors"
                style={{ background: displayColor }}
              />
              <input
                type="color"
                value={displayColor}
                onChange={(e) => setPendingColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </label>
            <span className="font-mono text-[9px] text-ink-400 flex-1">{displayColor}</span>
            <button
              onClick={() => { setEqTintColor(pendingColor); setPendingColor(null); }}
              disabled={!isDirty}
              className={`text-[9px] label-caps px-2 py-0.5 border transition-colors shrink-0 ${
                isDirty
                  ? 'border-ink-900 bg-ink-900 text-cream-100 hover:bg-ink-700'
                  : 'border-cream-300 text-ink-200 cursor-default'
              }`}
            >
              APPLY
            </button>
            <button
              onClick={() => { setEqTintColor(null); setPendingColor(null); }}
              className="text-[9px] label-caps text-ink-300 hover:text-ink-900 transition-colors shrink-0"
              title="Reset to preset default"
            >
              RESET
            </button>
          </div>
        );
      })()}

    </div>
  );
}
