'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(sec: number): string {
  if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// CanvasBottomBar
// ---------------------------------------------------------------------------

export default function CanvasBottomBar() {
  const audioTracks         = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId  = useCodaStore((s) => s.activeAudioTrackId);
  const setActiveAudioTrack = useCodaStore((s) => s.setActiveAudioTrack);
  const setPlaybackTime     = useCodaStore((s) => s.setPlaybackTime);
  const scenes              = useCodaStore((s) => s.scenes);

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);

  // ── Audio engine ─────────────────────────────────────────────────────────
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevUrlRef    = useRef<string | null>(null);

  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [volume, setVolume]         = useState(0.8);

  // Create audio element once; attach event listeners
  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.volume = volume;

    const onTime  = () => { setCurrentTime(audio.currentTime); setPlaybackTime(audio.currentTime); };
    const onMeta  = () => setDuration(audio.duration);
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener('timeupdate',    onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play',          onPlay);
    audio.addEventListener('pause',         onPause);
    audio.addEventListener('ended',         onEnded);
    return () => {
      audio.removeEventListener('timeupdate',    onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play',          onPlay);
      audio.removeEventListener('pause',         onPause);
      audio.removeEventListener('ended',         onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPlaybackTime]);

  // Swap src when active track URL changes
  useEffect(() => {
    const url = activeTrack?.url ?? null;
    if (url === prevUrlRef.current) return;
    prevUrlRef.current = url;

    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    audio.src = url ?? '';
    if (url) audio.load();
  }, [activeTrack?.url]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Web Audio analyser (created lazily inside first play) ─────────────────
  const ensureAudioCtx = useCallback(() => {
    const audio = audioRef.current;
    if (audioCtxRef.current || !audio) return;
    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  // ── Waveform RAF loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    let animId: number;

    const draw = () => {
      animId = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      ctx2d.clearRect(0, 0, W, H);

      const analyser = analyserRef.current;
      if (!analyser) {
        // flat centre line
        ctx2d.strokeStyle = '#d6d3cc';
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        ctx2d.moveTo(0, H / 2);
        ctx2d.lineTo(W, H / 2);
        ctx2d.stroke();
        return;
      }

      const bufLen = analyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);
      const barW = W / bufLen;

      for (let i = 0; i < bufLen; i++) {
        const t     = i / (bufLen - 1);
        const barH  = (data[i] / 255) * H;
        // gentle gradient from ink-600 to ink-400
        ctx2d.fillStyle = `rgba(80,79,74,${0.5 + t * 0.4})`;
        ctx2d.fillRect(i * barW, H - barH, Math.max(barW - 0.5, 0.5), barH);
      }
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── Transport ─────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    ensureAudioCtx();
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    if (audio.paused) {
      await audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [ensureAudioCtx]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
    setPlaybackTime(t);
  };

  const totalDuration = activeTrack?.durationSec || duration;
  const totalSceneDur = scenes.reduce((acc, s) => acc + s.durationSec, 0) || totalDuration;

  return (
    <div className="shrink-0 flex flex-col border-t border-cream-300 bg-cream-100 select-none">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" />

      {/* Waveform mini */}
      <div className="h-8 bg-cream-200 overflow-hidden">
        <canvas ref={waveCanvasRef} className="w-full h-full" width={800} height={32} />
      </div>

      {/* Transport row */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-cream-300">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!activeTrack}
          className="w-5 h-5 flex items-center justify-center text-ink-700 hover:text-ink-900 disabled:opacity-30 transition-colors shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Time */}
        <span className="font-mono text-[9px] text-ink-500 tabular-nums shrink-0 w-[68px]">
          {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(totalDuration)}
        </span>

        {/* Seek */}
        <input
          type="range" min={0} max={totalDuration || 1} step={0.1} value={currentTime}
          onChange={handleSeek} disabled={!activeTrack}
          className="flex-1 h-0.5 appearance-none cursor-pointer disabled:opacity-30"
          style={{ accentColor: '#1a1a16' }}
        />

        {/* Volume label + slider */}
        <span className="label-caps text-ink-300 shrink-0 text-[8px]">VOL</span>
        <input
          type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-14 h-0.5 appearance-none cursor-pointer"
          style={{ accentColor: '#1a1a16' }}
        />
        <span className="font-mono text-[9px] text-ink-300 tabular-nums shrink-0 w-5 text-right">
          {Math.round(volume * 100)}
        </span>
      </div>

      {/* Track pills */}
      <div className="flex items-center gap-1.5 px-3 py-1 overflow-x-auto min-h-[26px]">
        {audioTracks.length === 0 ? (
          <span className="text-[9px] text-ink-300 italic">트랙 없음 — EQ&amp;PL 탭에서 추가</span>
        ) : (
          audioTracks.map((track, idx) => (
            <button
              key={track.id}
              onClick={() => setActiveAudioTrack(track.id)}
              className={`flex items-center gap-1 px-2 py-0.5 border text-[9px] shrink-0 transition-colors ${
                track.id === activeAudioTrackId
                  ? 'bg-ink-900 text-cream-100 border-ink-900'
                  : 'bg-cream-200 text-ink-500 border-cream-300 hover:border-ink-400 hover:text-ink-900'
              }`}
            >
              <span className="text-[8px] text-current opacity-60 mr-0.5">{idx + 1}</span>
              <span className="max-w-[80px] truncate">{track.fileName.replace(/\.[^.]+$/, '')}</span>
            </button>
          ))
        )}
      </div>

      {/* Playback progress line across full width */}
      <div className="w-full h-px bg-cream-300">
        {totalSceneDur > 0 && (
          <div
            className="h-full bg-ink-400 transition-none"
            style={{ width: `${Math.min((currentTime / totalSceneDur) * 100, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}
