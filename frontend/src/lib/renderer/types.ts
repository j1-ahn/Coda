/**
 * renderer/types.ts
 * Shared types for the Phase-B render pipeline.
 * Import from here — never duplicate in individual modules.
 */

export type RenderFormat = '16:9' | '9:16' | 'both';
export type RenderQuality = 'high' | 'medium';

export interface RenderOptions {
  fps: 24 | 30;
  format: RenderFormat;
  quality: RenderQuality;
  /** Total duration to render (seconds). Usually from active audio track. */
  durationSec: number;
}

export type RenderPhase =
  | 'idle'
  | 'preparing'
  | 'capturing'
  | 'uploading'
  | 'encoding'
  | 'done'
  | 'error';

export interface RenderProgress {
  phase: RenderPhase;
  /** 0–100 within the current phase */
  phasePct: number;
  /** 0–100 overall */
  totalPct: number;
  message: string;
  /** Present when phase === 'done' */
  downloadUrls?: {
    '16-9'?: string;
    '9-16'?: string;
  };
  error?: string;
}

export type ProgressCallback = (p: RenderProgress) => void;
