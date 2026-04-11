'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import {
  startCompositeRender,
  downloadBlob,
  type CompositeRenderHandle,
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

  // ── Render start ─────────────────────────────────────────────────────────

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
          <button
            onClick={handleRender}
            className="flex items-center gap-2 px-6 py-2.5 rounded-none text-xs font-semibold uppercase tracking-widest bg-ink-900 text-cream-100 hover:bg-ink-700 transition-colors whitespace-nowrap"
          >
            <PlayIcon className="w-3.5 h-3.5" />
            렌더 시작
          </button>
        )}

        {jobStatus.phase === 'rendering' && (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-6 py-2.5 rounded-none text-xs font-semibold uppercase tracking-widest border border-ink-500 text-ink-700 hover:bg-cream-300 transition-colors whitespace-nowrap"
          >
            <StopIcon className="w-3.5 h-3.5" />
            중단
          </button>
        )}

        {(jobStatus.phase === 'done' || jobStatus.phase === 'error') && (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-none border border-cream-300 text-xs text-ink-500 hover:text-ink-900 hover:border-ink-500 transition-colors whitespace-nowrap"
          >
            다시 렌더
          </button>
        )}

        {/* Status area */}
        <div className="flex-1 min-w-0">
          {jobStatus.phase === 'idle' && (
            <span className="label-caps text-ink-300">렌더 준비 완료</span>
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
              <span className="text-[11px] text-ink-700">✓ 렌더 완료</span>
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
