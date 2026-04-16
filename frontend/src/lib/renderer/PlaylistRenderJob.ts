/**
 * PlaylistRenderJob.ts
 * Renders each audio track in the playlist sequentially as individual
 * videos, then triggers a backend concat to stitch them into one.
 *
 * Flow per track:
 *   1. Set active audio track
 *   2. Run a standard RenderJob (capture + encode)
 *   3. Collect session_id
 * After all tracks:
 *   4. POST /api/render/concat with all session_ids
 *   5. SSE progress for concat → done
 */

import { RenderJob } from './RenderJob';
import { RenderOptions, RenderProgress, ProgressCallback } from './types';
import { useCodaStore } from '@/store/useCodaStore';

export class PlaylistRenderJob {
  private _aborted = false;
  private _currentJob: RenderJob | null = null;
  private _eventSource: EventSource | null = null;
  private _concatSessionId: string | null = null;

  abort() {
    this._aborted = true;
    this._currentJob?.abort();
    this._eventSource?.close();
  }

  get concatSessionId() { return this._concatSessionId; }

  async start(
    baseOpts: Omit<RenderOptions, 'durationSec'>,
    onProgress: ProgressCallback,
  ): Promise<void> {
    const state = useCodaStore.getState();
    const tracks = state.audioTracks.filter((t) => t.url);

    if (tracks.length === 0) {
      throw new Error('No tracks in playlist.');
    }

    const totalTracks = tracks.length;
    const sessionIds: string[] = [];

    // Weight: 90% for individual renders, 10% for concat
    const renderWeight = 90;
    const concatWeight = 10;

    for (let i = 0; i < totalTracks; i++) {
      if (this._aborted) return;

      const track = tracks[i];
      const trackPctBase = (i / totalTracks) * renderWeight;
      const trackPctRange = renderWeight / totalTracks;

      // Switch to this track
      useCodaStore.getState().setActiveAudioTrack(track.id);

      // Small delay for store to settle
      await new Promise((r) => setTimeout(r, 100));

      const opts: RenderOptions = {
        ...baseOpts,
        durationSec: track.durationSec,
      };

      const job = new RenderJob();
      this._currentJob = job;

      await job.start(opts, (p) => {
        if (this._aborted) return;
        const overallPct = Math.round(trackPctBase + (p.totalPct / 100) * trackPctRange);
        onProgress({
          ...p,
          totalPct: overallPct,
          message: `[${i + 1}/${totalTracks}] ${track.fileName}: ${p.message}`,
        });
      });

      if (job.sessionId) {
        sessionIds.push(job.sessionId);
      }
    }

    this._currentJob = null;

    if (this._aborted || sessionIds.length === 0) return;

    // ── Concat phase ──────────────────────────────────────────────────────
    onProgress({
      phase: 'encoding',
      phasePct: 0,
      totalPct: renderWeight,
      message: 'Concatenating playlist…',
    });

    const concatRes = await fetch('/api/render/concat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_ids: sessionIds,
        format: baseOpts.format,
      }),
    });
    if (!concatRes.ok) throw new Error('Concat session creation failed');
    const { session_id } = await concatRes.json();
    this._concatSessionId = session_id;

    if (this._aborted) return;

    // SSE progress for concat
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
          onProgress({
            phase: 'encoding',
            phasePct: pct,
            totalPct: Math.round(renderWeight + (pct / 100) * concatWeight),
            message: `Concatenating playlist… ${pct}%`,
          });
        } else if (data.status === 'done') {
          const urls: RenderProgress['downloadUrls'] = {};
          if (data.outputs?.['16-9']) urls['16-9'] = `/api/render/download/${session_id}/16-9`;
          if (data.outputs?.['9-16']) urls['9-16'] = `/api/render/download/${session_id}/9-16`;
          onProgress({
            phase: 'done',
            phasePct: 100,
            totalPct: 100,
            message: 'Playlist render complete! Ready to download',
            downloadUrls: urls,
          });
          es.close();
          this._eventSource = null;
          resolve();
        } else if (data.status === 'error') {
          es.close();
          this._eventSource = null;
          reject(new Error(data.message ?? 'Concat render failed'));
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
