'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { AudioAnalyserData } from '@/hooks/useAudioAnalyser';
import {
  DRAW_FNS,
  applyReactMode,
  drawRadial,
  type DrawState,
} from './eqPresetDraws';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EQPreset {
  id: string;
  name: string;
  reactMode: 'original' | 'pulse' | 'ripple' | 'chromatic' | 'warp';
  colorTint: string;
  imagePath?: string; // kept for compat — not used in rendering
}

interface EQCanvasProps {
  preset: EQPreset;
  analyserData: AudioAnalyserData;
  intensity?: number;    // 0–1 globalAlpha multiplier (default 1)
  sensitivity?: number;  // 0.1–3.0 audio level multiplier (default 1)
  // Optional: if provided, RAF reads from this ref directly (no React re-renders needed)
  externalDataRef?: { current: AudioAnalyserData };
}

// ---------------------------------------------------------------------------
// Canvas host — delegates per-frame rendering to DRAW_FNS[preset.id]
// ---------------------------------------------------------------------------

function EQCanvasInner({ preset, analyserData, intensity = 1, sensitivity = 1, externalDataRef }: EQCanvasProps) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const startRef        = useRef(performance.now());
  const rafRef          = useRef<number>(0);
  const stateRef        = useRef<DrawState>({});
  const dataRef         = useRef(analyserData);
  const presetRef       = useRef(preset);
  // Capture externalDataRef once — it's a stable ref object
  const extRef          = externalDataRef;
  const intensityRef    = useRef(intensity);
  const sensitivityRef  = useRef(sensitivity);

  // Sync refs synchronously during render (safe — only reads, no side effects)
  dataRef.current       = analyserData;
  presetRef.current     = preset;
  intensityRef.current  = intensity;
  sensitivityRef.current = sensitivity;

  // Reset per-preset state when preset changes
  useEffect(() => { stateRef.current = {}; }, [preset.id]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const time   = (performance.now() - startRef.current) / 1000;
    const p      = presetRef.current;
    const rawData = extRef?.current ?? dataRef.current;
    const s = sensitivityRef.current;
    const data: AudioAnalyserData = s === 1 ? rawData : {
      ...rawData,
      bassLevel:    Math.min(1, rawData.bassLevel    * s),
      midLevel:     Math.min(1, rawData.midLevel     * s),
      trebleLevel:  Math.min(1, rawData.trebleLevel  * s),
      overallLevel: Math.min(1, rawData.overallLevel * s),
    };
    ctx.globalAlpha = 1;
    const drawFn = DRAW_FNS[p.id] ?? drawRadial;
    drawFn(ctx, canvas.width, canvas.height, data, time, stateRef.current, p);
    applyReactMode(ctx, canvas.width, canvas.height, data, time, stateRef.current, p);
    rafRef.current = requestAnimationFrame(draw);
    // intensity is captured via ref but currently unused in the composition
    // pipeline — keep the prop plumbed so callers can adjust without an API change
    void intensityRef.current;
  }, [extRef]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Resize observer — keeps canvas resolution matching DOM size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });
    ro.observe(parent);
    canvas.width  = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-full h-full" style={{ background: 'transparent' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

export default EQCanvasInner;
