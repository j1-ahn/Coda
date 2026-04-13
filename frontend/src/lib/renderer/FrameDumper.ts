/**
 * FrameDumper.ts
 * Scrubs the store playback time frame-by-frame and captures
 * JPEG frames from the composite of all canvases + text overlays.
 *
 * Capture strategy (Method B):
 *   1. Set store.currentPlaybackTime = t
 *   2. Wait 1 requestAnimationFrame (Three.js re-renders with new state)
 *   3. drawImage all <canvas> elements into a composite canvas
 *   4. paintTitleOverlay + paintLyricOverlay on top
 *   5. Export composite as JPEG 0.92
 *
 * V2 note: the OverlayPainter functions accept explicit state so
 * unit-tests can inject mock data without a store.
 */

import { useCodaStore } from '@/store/useCodaStore';
import {
  paintLyricOverlay,
  paintTitleOverlay,
  LyricRenderState,
  TitleRenderState,
} from './OverlayPainter';

const LYRIC_SIZE_PX: Record<string, number> = { S: 18, M: 26, L: 36 };
const BATCH_SIZE = 30;

function raf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export interface FrameBatch {
  frames: { index: number; blob: Blob }[];
}

export class FrameDumper {
  private container: HTMLElement;
  private composite: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  constructor(container: HTMLElement, width: number, height: number) {
    this.container = container;
    this.width = width;
    this.height = height;
    this.composite = document.createElement('canvas');
    this.composite.width = width;
    this.composite.height = height;
    this.ctx = this.composite.getContext('2d')!;
  }

  /** Capture a single frame at the given playback time (seconds). */
  async captureFrame(t: number): Promise<Blob> {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    // Draw every <canvas> inside the container (WebGL + EQ layer)
    const canvases = Array.from(
      this.container.querySelectorAll('canvas'),
    ) as HTMLCanvasElement[];
    for (const c of canvases) {
      try {
        ctx.drawImage(c, 0, 0, width, height);
      } catch {
        // Ignore if canvas not ready (cross-origin, zero size, etc.)
      }
    }

    // Text overlays
    const s = useCodaStore.getState();

    // Lyric
    const track = s.audioTracks.find((tr) => tr.id === s.activeAudioTrackId);
    const seg = (track?.whisperSegments ?? []).find(
      (sg) => t >= sg.start && t < sg.end,
    );
    if (seg?.text) {
      const lyricState: LyricRenderState = {
        text: seg.text,
        preset: s.lyricFontPreset,
        position: s.lyricPosition,
        sizePx: LYRIC_SIZE_PX[s.lyricSize] ?? 26,
      };
      paintLyricOverlay(ctx, width, height, lyricState);
    }

    // Title
    if (s.titleText) {
      const titleState: TitleRenderState = {
        text: s.titleText,
        subtext: s.titleSubtext,
        preset: s.titleFontPreset,
        currentTime: t,
        w: width,
        h: height,
      };
      paintTitleOverlay(ctx, titleState);
    }

    return new Promise<Blob>((resolve, reject) =>
      this.composite.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
        'image/jpeg',
        0.92,
      ),
    );
  }

  /**
   * Capture all frames for the given duration/fps.
   * Calls onBatch every BATCH_SIZE frames (or at end).
   * Calls onProgress with fraction 0–1.
   *
   * @param durationSec  Total video duration
   * @param fps          Target frame rate (24 or 30)
   * @param onBatch      Called with each completed batch
   * @param onProgress   Called with capture progress 0–1
   * @param abortSignal  Set .aborted = true to stop early
   */
  async captureAll(
    durationSec: number,
    fps: number,
    onBatch: (batch: FrameBatch) => Promise<void>,
    onProgress: (frac: number) => void,
    abortSignal?: { aborted: boolean },
  ): Promise<void> {
    const totalFrames = Math.ceil(durationSec * fps);
    let batch: FrameBatch['frames'] = [];

    for (let i = 0; i < totalFrames; i++) {
      if (abortSignal?.aborted) break;

      const t = i / fps;
      useCodaStore.getState().setPlaybackTime(t);

      // Let Three.js re-render
      await raf();

      const blob = await this.captureFrame(t);
      batch.push({ index: i, blob });

      if (batch.length >= BATCH_SIZE || i === totalFrames - 1) {
        await onBatch({ frames: batch });
        batch = [];
      }

      onProgress((i + 1) / totalFrames);
    }
  }
}
