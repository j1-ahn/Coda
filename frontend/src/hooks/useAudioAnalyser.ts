import { useEffect, useRef, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioAnalyserData {
  frequencyData: Uint8Array;  // 256 bins
  bassLevel: number;          // 0~1 (20-250Hz 평균)
  midLevel: number;           // 0~1 (250-4000Hz 평균)
  trebleLevel: number;        // 0~1 (4000-20000Hz 평균)
  overallLevel: number;       // 0~1 전체 평균
  currentTime?: number;       // audio element currentTime (seconds)
}

const EMPTY_DATA: AudioAnalyserData = {
  frequencyData: new Uint8Array(256),
  bassLevel: 0,
  midLevel: 0,
  trebleLevel: 0,
  overallLevel: 0,
};

// ---------------------------------------------------------------------------
// Frequency range helpers
// ---------------------------------------------------------------------------

function hzToBin(hz: number, fftSize: number, sampleRate: number): number {
  return Math.round((hz / (sampleRate / 2)) * (fftSize / 2));
}

function avgRange(data: Uint8Array, fromBin: number, toBin: number): number {
  const start = Math.max(0, fromBin);
  const end   = Math.min(data.length - 1, toBin);
  if (start > end) return 0;
  let sum = 0;
  for (let i = start; i <= end; i++) sum += data[i];
  return sum / ((end - start + 1) * 255);
}

// ---------------------------------------------------------------------------
// Hook
// Accepts an optional audioEl ref for direct (stable) connection.
// Falls back to DOM polling when no ref is given (legacy behaviour).
// ---------------------------------------------------------------------------

export function useAudioAnalyser(
  audioElRef?: { readonly current: HTMLAudioElement | null }
): AudioAnalyserData {
  const [data, setData] = useState<AudioAnalyserData>(EMPTY_DATA);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const sourceRef       = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef          = useRef<number>(0);
  const connectedElRef  = useRef<HTMLAudioElement | null>(null);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);

    const ctx        = audioContextRef.current!;
    const sampleRate = ctx.sampleRate;
    const fftSize    = analyser.fftSize;

    const bassBin   = { from: hzToBin(20,    fftSize, sampleRate), to: hzToBin(250,   fftSize, sampleRate) };
    const midBin    = { from: hzToBin(250,   fftSize, sampleRate), to: hzToBin(4000,  fftSize, sampleRate) };
    const trebleBin = { from: hzToBin(4000,  fftSize, sampleRate), to: hzToBin(20000, fftSize, sampleRate) };

    setData({
      frequencyData: buf,
      bassLevel:    avgRange(buf, bassBin.from,   bassBin.to),
      midLevel:     avgRange(buf, midBin.from,    midBin.to),
      trebleLevel:  avgRange(buf, trebleBin.from, trebleBin.to),
      overallLevel: avgRange(buf, 0, buf.length - 1),
    });

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Connect/reconnect when audio element changes ──────────────────────────
  const connectElement = useCallback((audioEl: HTMLAudioElement) => {
    if (audioEl === connectedElRef.current) return; // already connected

    // Tear down previous context
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    connectedElRef.current = null;

    try {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current     = analyser;
      sourceRef.current       = source;
      connectedElRef.current  = audioEl;

      // createMediaElementSource routes ALL audio through the Web Audio graph.
      // If the AudioContext is suspended, the audio element is silenced entirely.
      // We must resume() on every play attempt — 'play' fires within the user
      // gesture chain (click → audio.play() → 'play' event) so resume() succeeds.
      const onPlay = () => {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        // Also kick the RAF loop in case it was paused
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      audioEl.addEventListener('play', onPlay);

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // MediaElementSource already created elsewhere — ignore
    }
  }, [tick]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ── Mode A: direct ref ──────────────────────────────────────────────────
    if (audioElRef) {
      const el = audioElRef.current;
      if (el) connectElement(el);

      // Re-check when ref content changes (e.g., src swap)
      return () => {
        cancelAnimationFrame(rafRef.current);
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
        connectedElRef.current = null;
      };
    }

    // ── Mode B: poll DOM (legacy) ───────────────────────────────────────────
    let rafId = 0;
    const poll = () => {
      const audioEl = document.querySelector('audio') as HTMLAudioElement | null;
      if (audioEl) {
        connectElement(audioEl);
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      connectedElRef.current = null;
    };
  }, [audioElRef, connectElement]);

  // When audioElRef.current changes (new src loaded), reconnect
  useEffect(() => {
    if (!audioElRef) return;
    const el = audioElRef.current;
    if (el && el !== connectedElRef.current) {
      connectElement(el);
    }
  });

  return data;
}
