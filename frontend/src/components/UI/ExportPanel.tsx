'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import {
  startCompositeRender,
  downloadBlob,
  type CompositeRenderHandle,
  type PlaylistTrack,
} from '@/lib/compositeRenderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobStatus =
  | { phase: 'idle' }
  | { phase: 'rendering'; progress: number; message: string }
  | { phase: 'done'; blob: Blob; filename: string }
  | { phase: 'error'; message: string };

// ---------------------------------------------------------------------------
// Title Mode Button
// ---------------------------------------------------------------------------

const TITLE_MODES = [
  { value: 'hero-to-corner' as const, label: 'Hero→Corner' },
  { value: 'ambient-object' as const, label: 'Ambient' },
  { value: 'breathing' as const, label: 'Breathing' },
] as const;

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-cream-300 h-1 overflow-hidden">
      <div
        className="h-full bg-ink-900 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ExportPanel() {
  const { exportFormat, setExportFormat, titleMode, setTitleMode, audioTracks, activeAudioTrackId } =
    useCodaStore();

  const [jobStatus, setJobStatus] = useState<JobStatus>({ phase: 'idle' });
  const renderHandleRef = useRef<CompositeRenderHandle | null>(null);

  // ── Render start (단일 트랙) ──────────────────────────────────────────────

  const handleRender = useCallback(async () => {
    const container = document.getElementById('studio-canvas-container');
    if (!container) {
      setJobStatus({ phase: 'error', message: 'canvas container를 찾을 수 없습니다.' });
      return;
    }

    const rect = container.getBoundingClientRect();
    const w = Math.round(rect.width)  || 1920;
    const h = Math.round(rect.height) || 1080;

    // 활성 오디오 트랙 URL
    const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);
    const audioSrc = activeTrack?.url ?? null;
    const durationSec = activeTrack?.durationSec ?? 10;

    setJobStatus({ phase: 'rendering', progress: 0, message: '렌더 준비 중...' });

    const [handle, renderPromise] = startCompositeRender(container, {
      width: w,
      height: h,
      fps: 30,
      durationSec,
      audioSrc,
      onProgress: (p) =>
        setJobStatus({
          phase: 'rendering',
          progress: p,
          message: `렌더 중... ${Math.round(p * 100)}%`,
        }),
    });
    renderHandleRef.current = handle;

    try {
      const blob = await renderPromise;
      if (!blob) {
        setJobStatus({ phase: 'error', message: '렌더 취소됨' });
        return;
      }
      const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
      const filename = `coda_export_${Date.now()}.${ext}`;
      setJobStatus({ phase: 'done', blob, filename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '렌더 오류 발생';
      setJobStatus({ phase: 'error', message: msg });
    } finally {
      renderHandleRef.current = null;
    }
  }, [audioTracks, activeAudioTrackId]);

  // ── Render start (플레이리스트 전체) ────────────────────────────────────

  const handlePlaylistRender = useCallback(async () => {
    const container = document.getElementById('studio-canvas-container');
    if (!container) {
      setJobStatus({ phase: 'error', message: 'canvas container를 찾을 수 없습니다.' });
      return;
    }

    if (audioTracks.length === 0) {
      setJobStatus({ phase: 'error', message: '플레이리스트에 트랙이 없습니다.' });
      return;
    }

    const rect = container.getBoundingClientRect();
    const w = Math.round(rect.width)  || 1920;
    const h = Math.round(rect.height) || 1080;

    // 전체 오디오 트랙을 PlaylistTrack으로 변환
    const playlist: PlaylistTrack[] = audioTracks
      .filter((t) => t.url)
      .map((t) => ({
        src: t.url!,
        durationSec: t.durationSec ?? 0,
        title: t.fileName ?? t.id,
      }));

    if (playlist.length === 0) {
      setJobStatus({ phase: 'error', message: '재생 가능한 트랙이 없습니다.' });
      return;
    }

    setJobStatus({ phase: 'rendering', progress: 0, message: `플레이리스트 렌더 (1/${playlist.length})` });

    const [handle, renderPromise] = startCompositeRender(container, {
      width: w,
      height: h,
      fps: 30,
      audioPlaylist: playlist,
      onProgress: (p) =>
        setJobStatus({
          phase: 'rendering',
          progress: p,
          message: `플레이리스트 렌더 중... ${Math.round(p * 100)}%`,
        }),
      onTrackChange: (idx, track) =>
        setJobStatus({
          phase: 'rendering',
          progress: 0,
          message: `트랙 ${idx + 1}/${playlist.length}: ${track.title ?? ''}`,
        }),
    });
    renderHandleRef.current = handle;

    try {
      const blob = await renderPromise;
      if (!blob) {
        setJobStatus({ phase: 'error', message: '렌더 취소됨' });
        return;
      }
      const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
      const filename = `coda_playlist_${Date.now()}.${ext}`;
      setJobStatus({ phase: 'done', blob, filename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '렌더 오류 발생';
      setJobStatus({ phase: 'error', message: msg });
    } finally {
      renderHandleRef.current = null;
    }
  }, [audioTracks]);

  const handleStop = useCallback(() => {
    renderHandleRef.current?.stop();
  }, []);

  const handleReset = useCallback(() => {
    setJobStatus({ phase: 'idle' });
  }, []);

  const handleDownload = useCallback(() => {
    if (jobStatus.phase !== 'done') return;
    downloadBlob(jobStatus.blob, jobStatus.filename);
  }, [jobStatus]);

  // Cleanup on unmount
  useEffect(() => () => { renderHandleRef.current?.stop(); }, []);

  const isRendering = jobStatus.phase === 'rendering';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex items-center gap-6 px-5 py-3 border-t border-cream-300 bg-cream-200 flex-wrap">

      {/* Format selector */}
      <div className="flex items-center gap-2">
        <FieldLabel>Format</FieldLabel>
        <div className="flex items-center gap-1">
          {(['16:9', '9:16', 'both'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setExportFormat(fmt)}
              className={`px-3 py-1.5 rounded-none border text-xs font-medium tracking-wide transition-colors ${
                exportFormat === fmt
                  ? 'bg-ink-900 border-ink-900 text-cream-100'
                  : 'border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500'
              }`}
            >
              {fmt === 'both' ? 'BOTH ★' : fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-cream-300" />

      {/* Title mode */}
      <div className="flex items-center gap-2">
        <FieldLabel>Title</FieldLabel>
        <div className="flex items-center gap-1">
          {TITLE_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setTitleMode(m.value)}
              className={`px-2.5 py-1 rounded-none border text-[11px] tracking-wide transition-colors ${
                titleMode === m.value
                  ? 'bg-ink-900 border-ink-900 text-cream-100'
                  : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-cream-300" />

      {/* Render button + status */}
      <div className="flex items-center gap-3 flex-1 min-w-[280px]">

        {/* Action button */}
        {jobStatus.phase === 'idle' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRender}
              className="flex items-center gap-2 px-6 py-2.5 rounded-none text-xs uppercase tracking-widest bg-accent border-accent-dark text-ink-900 hover:bg-accent-light font-semibold transition-colors whitespace-nowrap"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              RENDER
            </button>
            {audioTracks.length > 1 && (
              <button
                onClick={handlePlaylistRender}
                className="flex items-center gap-2 px-4 py-2.5 rounded-none text-xs font-semibold uppercase tracking-widest border border-ink-500 text-ink-700 hover:bg-cream-300 transition-colors whitespace-nowrap"
              >
                <PlayIcon className="w-3.5 h-3.5" />
                RENDER ALL
              </button>
            )}
          </div>
        )}

        {jobStatus.phase === 'rendering' && (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-6 py-2.5 rounded-none text-xs font-semibold uppercase tracking-widest border border-ink-500 text-ink-700 hover:bg-cream-300 transition-colors whitespace-nowrap"
          >
            <StopIcon className="w-3.5 h-3.5" />
            STOP
          </button>
        )}

        {(jobStatus.phase === 'done' || jobStatus.phase === 'error') && (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-none border border-cream-300 text-xs text-ink-500 hover:text-ink-900 hover:border-ink-500 transition-colors whitespace-nowrap"
          >
            RE-RENDER
          </button>
        )}

        {/* Status area */}
        <div className="flex-1 min-w-0">
          {jobStatus.phase === 'idle' && (
            <span className="label-caps text-ink-300">Ready</span>
          )}

          {jobStatus.phase === 'rendering' && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-500">{jobStatus.message}</span>
                <span className="font-mono text-[11px] text-ink-900 tabular-nums">
                  {Math.round(jobStatus.progress * 100)}%
                </span>
              </div>
              <ProgressBar progress={jobStatus.progress} />
            </div>
          )}

          {jobStatus.phase === 'done' && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-ink-700">✓ Complete</span>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2.5 py-1 rounded-none border border-ink-500 text-[11px] text-ink-700 hover:bg-cream-300 transition-colors"
              >
                <DownloadIcon className="w-3 h-3" />
                {jobStatus.filename}
              </button>
            </div>
          )}

          {jobStatus.phase === 'error' && (
            <span className="text-[11px] text-red-800">✗ {jobStatus.message}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="label-caps whitespace-nowrap">{children}</span>;
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
