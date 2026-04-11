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
// Convert Hz to FFT bin index given fftSize and sample rate
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
// ---------------------------------------------------------------------------

export function useAudioAnalyser(): AudioAnalyserData {
  const [data, setData] = useState<AudioAnalyserData>(EMPTY_DATA);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const sourceRef       = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef          = useRef<number>(0);
  const connectedElRef  = useRef<HTMLAudioElement | null>(null);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buf = new Uint8Array(analyser.frequencyBinCount); // 256 bins
    analyser.getByteFrequencyData(buf);

    const ctx        = audioContextRef.current!;
    const sampleRate = ctx.sampleRate;
    const fftSize    = analyser.fftSize; // 512

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId = 0;

    const connect = () => {
      const audioEl = document.querySelector('audio') as HTMLAudioElement | null;
      if (!audioEl || audioEl === connectedElRef.current) {
        // Already connected or no audio element yet — keep polling
        rafId = requestAnimationFrame(connect);
        return;
      }

      // Tear down previous context if audio element changed
      if (audioContextRef.current) {
        cancelAnimationFrame(rafRef.current);
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
        connectedElRef.current = null;
      }

      try {
        const ctx     = new AudioContext();
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

        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // MediaElementSource already used or other error — ignore
      }
    };

    // Start polling for audio element
    rafId = requestAnimationFrame(connect);

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
  }, [tick]);

  return data;
}
