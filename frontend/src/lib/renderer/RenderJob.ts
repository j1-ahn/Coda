/**
 * RenderJob.ts
 * Orchestrates the full Method-B render pipeline:
 *
 *   prepare → capture frames → upload batches (concurrent)
 *          → upload audio → trigger NVENC → SSE progress → done
 *
 * Usage:
 *   const job = new RenderJob();
 *   await job.start(opts, (p) => setProgress(p));
 *   job.abort(); // cancel at any point
 */

import { FrameDumper } from './FrameDumper';
import { exportActiveAudio } from './AudioExporter';
import { RenderOptions, RenderProgress, ProgressCallback } from './types';
import { useCodaStore } from '@/store/useCodaStore';
import { useSettingsStore } from '@/store/useSettingsStore';

const PHASE_WEIGHT = {
  preparing:  [0,   5],
  capturing:  [5,  50],
  uploading:  [50, 58],
  encoding:   [58, 98],
  done:       [98, 100],
} as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

export class RenderJob {
  private _aborted = false;
  private _eventSource: EventSource | null = null;
  private _sessionId: string | null = null;

  abort() {
    this._aborted = true;
    this._eventSource?.close();
  }

  /** Return the backend session ID after start() has been called. */
  get sessionId() { return this._sessionId; }

  async start(opts: RenderOptions, onProgress: ProgressCallback): Promise<void> {
    const { fps, format, quality, durationSec } = opts;
    const totalFrames = Math.ceil(durationSec * fps);

    const emit = (
      phase: RenderProgress['phase'],
      phasePct: number,
      message: string,
      extra?: Partial<RenderProgress>,
    ) => {
      const [lo, hi] = PHASE_WEIGHT[phase as keyof typeof PHASE_WEIGHT] ?? [0, 100];
      onProgress({
        phase,
        phasePct: Math.round(phasePct),
        totalPct: Math.round(lerp(lo, hi, phasePct / 100)),
        message,
        ...extra,
      });
    };

    // ── 1. Create backend session ────────────────────────────────────────────
    emit('preparing', 0, 'Creating render session…');

    const sessionRes = await fetch('/api/render/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_frames: totalFrames }),
    });
    if (!sessionRes.ok) throw new Error('Session creation failed');
    const { session_id } = await sessionRes.json();
    this._sessionId = session_id;

    if (this._aborted) return;

    // ── 2. Find canvas container ─────────────────────────────────────────────
    const container = document.getElementById('studio-canvas-container');
    if (!container) throw new Error('Canvas container not found');

    // Use offsetWidth/Height to get layout dimensions (unaffected by CSS transform/zoom)
    const width  = Math.max(container.offsetWidth,  1);
    const height = Math.max(container.offsetHeight, 1);

    const dumper = new FrameDumper(container, width, height);

    emit('preparing', 80, 'Extracting audio…');

    // Export audio concurrently while we start capturing
    const audioPromise = exportActiveAudio().catch(() => null);

    // ── 3. Capture + upload frames (concurrent) ──────────────────────────────
    emit('capturing', 0, 'Starting frame capture…');

    const abortSignal = { aborted: false };
    const unsubAbort = () => { abortSignal.aborted = true; };
    if (this._aborted) return;

    await dumper.captureAll(
      durationSec,
      fps,
      // onBatch: upload each batch immediately
      async (batch) => {
        if (this._aborted || abortSignal.aborted) return;
        const form = new FormData();
        for (const { index, blob } of batch.frames) {
          form.append(
            'files',
            blob,
            `frame_${String(index).padStart(5, '0')}.jpg`,
          );
        }
        await fetch(`/api/render/frames/${session_id}`, {
          method: 'POST',
          body: form,
        });
      },
      (frac) => {
        if (this._aborted) return;
        emit(
          'capturing',
          frac * 100,
          `Capturing frames… ${Math.round(frac * totalFrames)}/${totalFrames}`,
        );
      },
      abortSignal,
    );

    if (this._aborted) return;

    // ── 4. Upload audio ──────────────────────────────────────────────────────
    emit('uploading', 0, 'Uploading audio…');

    const audio = await audioPromise;
    if (audio) {
      const audioForm = new FormData();
      audioForm.append('file', audio.blob, audio.fileName);
      await fetch(`/api/render/audio/${session_id}`, {
        method: 'POST',
        body: audioForm,
      });
    }

    if (this._aborted) return;

    emit('uploading', 100, 'Starting NVENC encoding…');

    // ── 5. Trigger encode ────────────────────────────────────────────────────
    const { nvencMode, ffmpegPath, renderOutputPath } = useSettingsStore.getState();
    const encRes = await fetch(`/api/render/encode/${session_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fps, width, height, quality, format, nvenc_mode: nvencMode, ffmpeg_path: ffmpegPath || null, output_path: renderOutputPath || null }),
    });
    if (!encRes.ok) throw new Error('Encoding start failed');

    if (this._aborted) return;

    // ── 6. SSE progress ──────────────────────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      const es = new EventSource(`/api/render/progress/${session_id}`);
      this._eventSource = es;

      es.onmessage = (e) => {
        const data = JSON.parse(e.data) as {
          status: string;
          progress?: number;
          message?: string;
          outputs?: Record<string, string>;
        };

        if (data.status === 'encoding') {
          const pct = Math.round((data.progress ?? 0) * 100);
          emit('encoding', pct, `Encoding… ${pct}%`);
        } else if (data.status === 'done') {
          const urls: RenderProgress['downloadUrls'] = {};
          if (data.outputs?.['16-9']) urls['16-9'] = `/api/render/download/${session_id}/16-9`;
          if (data.outputs?.['9-16']) urls['9-16'] = `/api/render/download/${session_id}/9-16`;
          emit('done', 100, 'Render complete! Ready to download', { downloadUrls: urls });
          es.close();
          this._eventSource = null;
          resolve();
        } else if (data.status === 'error') {
          es.close();
          this._eventSource = null;
          reject(new Error(data.message ?? 'Encoding failed'));
        }
      };

      es.onerror = () => {
        es.close();
        this._eventSource = null;
        reject(new Error('SSE connection error'));
      };
    });
  }
}
