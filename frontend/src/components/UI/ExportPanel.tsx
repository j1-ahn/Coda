'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobStatus =
  | { phase: 'idle' }
  | { phase: 'rendering'; progress: number; message: string }
  | { phase: 'done'; urls: { '16:9'?: string; '9:16'?: string } }
  | { phase: 'error'; message: string };

// ---------------------------------------------------------------------------
// Format Selector Button
// ---------------------------------------------------------------------------

function FormatBtn({
  label,
  active,
  star,
  onClick,
}: {
  label: string;
  active: boolean;
  star?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded border text-xs font-medium tracking-wide transition-colors
        ${active
          ? 'bg-amber-400 border-amber-400 text-black'
          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
        }
      `}
    >
      {label}
      {star && <span className="ml-1 text-[10px]">★</span>}
    </button>
  );
}

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
    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-amber-400 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ExportPanel() {
  const { exportFormat, setExportFormat, titleMode, setTitleMode, vfxParams, scenes, audioTracks } =
    useCodaStore();

  const [jobStatus, setJobStatus] = useState<JobStatus>({ phase: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling ──────────────────────────────────────────────────────────────

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/export/status/${jobId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Expected: { status: 'processing'|'done'|'error', progress: 0-100, message: string, urls?: {...} }
        if (data.status === 'done') {
          clearInterval(pollRef.current!);
          setJobStatus({ phase: 'done', urls: data.urls ?? {} });
        } else if (data.status === 'error') {
          clearInterval(pollRef.current!);
          setJobStatus({ phase: 'error', message: data.message ?? '렌더 오류 발생' });
        } else {
          setJobStatus({
            phase: 'rendering',
            progress: data.progress ?? 0,
            message: data.message ?? '렌더 중...',
          });
        }
      } catch (err) {
        clearInterval(pollRef.current!);
        const msg = err instanceof Error ? err.message : '폴링 실패';
        setJobStatus({ phase: 'error', message: msg });
      }
    }, 2000);
  }, []);

  // Clean up on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Render start ─────────────────────────────────────────────────────────

  const handleRender = async () => {
    setJobStatus({ phase: 'rendering', progress: 0, message: '렌더 요청 중...' });
    try {
      const payload = {
        format: exportFormat,
        titleMode,
        vfxParams,
        sceneIds: scenes.map((s) => s.id),
        audioTrackIds: audioTracks.map((t) => t.id),
      };

      const res = await fetch('/api/export/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? `HTTP ${res.status}`);
      }

      const { job_id } = await res.json();
      startPolling(job_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '렌더 시작 실패';
      setJobStatus({ phase: 'error', message: msg });
    }
  };

  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setJobStatus({ phase: 'idle' });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const isRendering = jobStatus.phase === 'rendering';

  return (
    <div className="flex items-center gap-6 px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex-wrap">

      {/* Format selector */}
      <div className="flex items-center gap-2">
        <FieldLabel>Format</FieldLabel>
        <div className="flex items-center gap-1">
          <FormatBtn
            label="16:9"
            active={exportFormat === '16:9'}
            onClick={() => setExportFormat('16:9')}
          />
          <FormatBtn
            label="9:16"
            active={exportFormat === '9:16'}
            onClick={() => setExportFormat('9:16')}
          />
          <FormatBtn
            label="BOTH"
            active={exportFormat === 'both'}
            star
            onClick={() => setExportFormat('both')}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-zinc-800" />

      {/* Title mode */}
      <div className="flex items-center gap-2">
        <FieldLabel>Title Mode</FieldLabel>
        <div className="flex items-center gap-1">
          {TITLE_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setTitleMode(m.value)}
              className={`
                px-2.5 py-1 rounded border text-[11px] tracking-wide transition-colors
                ${titleMode === m.value
                  ? 'bg-zinc-700 border-zinc-500 text-zinc-100'
                  : 'border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                }
              `}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-zinc-800" />

      {/* Render button + status */}
      <div className="flex items-center gap-3 flex-1 min-w-[260px]">
        {/* Render / Reset button */}
        {jobStatus.phase === 'done' || jobStatus.phase === 'error' ? (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors whitespace-nowrap"
          >
            다시 렌더
          </button>
        ) : (
          <button
            onClick={handleRender}
            disabled={isRendering}
            className={`
              flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold tracking-wider transition-colors whitespace-nowrap
              ${isRendering
                ? 'bg-zinc-800 border border-zinc-700 text-zinc-600 cursor-not-allowed'
                : 'bg-amber-400 text-black hover:bg-amber-300'
              }
            `}
          >
            {isRendering ? (
              <>
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                렌더 중...
              </>
            ) : (
              <>
                <PlayIcon className="w-3.5 h-3.5" />
                렌더 시작
              </>
            )}
          </button>
        )}

        {/* Status area */}
        <div className="flex-1 min-w-0">
          {jobStatus.phase === 'rendering' && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">{jobStatus.message}</span>
                <span className="text-[11px] text-amber-400 font-mono tabular-nums">
                  {jobStatus.progress}%
                </span>
              </div>
              <ProgressBar progress={jobStatus.progress} />
            </div>
          )}

          {jobStatus.phase === 'done' && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-emerald-400">✓ 렌더 완료</span>
              {jobStatus.urls['16:9'] && (
                <DownloadLink href={jobStatus.urls['16:9']} label="16:9 다운로드" />
              )}
              {jobStatus.urls['9:16'] && (
                <DownloadLink href={jobStatus.urls['9:16']} label="9:16 다운로드" />
              )}
            </div>
          )}

          {jobStatus.phase === 'error' && (
            <span className="text-[11px] text-red-400">
              ✗ {jobStatus.message}
            </span>
          )}

          {jobStatus.phase === 'idle' && (
            <span className="text-[11px] text-zinc-700">렌더 준비 완료</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-700/50 text-[11px] text-emerald-400 hover:bg-emerald-900/20 transition-colors"
    >
      <DownloadIcon className="w-3 h-3" />
      {label}
    </a>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase whitespace-nowrap">
      {children}
    </span>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
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
