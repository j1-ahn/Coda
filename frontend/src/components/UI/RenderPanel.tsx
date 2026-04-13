'use client';

/**
 * RenderPanel.tsx
 * Header button → modal with render settings, progress bar, download links.
 *
 * Architecture:
 *  - RenderButton  : small header button (film icon)
 *  - RenderModal   : full settings + live progress
 *  - Uses RenderJob from lib/renderer/RenderJob.ts
 */

import { useState, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import { RenderJob } from '@/lib/renderer/RenderJob';
import { RenderOptions, RenderProgress, RenderFormat, RenderQuality } from '@/lib/renderer/types';

// ── Icons ─────────────────────────────────────────────────────────────────────

function FilmIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-1 bg-cream-300 relative overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 bg-ink-900 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Phase badge ───────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  idle:      'IDLE',
  preparing: 'PREP',
  capturing: 'CAPTURE',
  uploading: 'UPLOAD',
  encoding:  'NVENC',
  done:      'DONE',
  error:     'ERROR',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function RenderPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-900 text-cream-100
          border border-ink-900 hover:bg-ink-700 hover:border-ink-700
          transition-colors text-[11px] font-semibold tracking-widest uppercase"
        title="Render video"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
        RENDER
      </button>
      {open && <RenderModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function RenderModal({ onClose }: { onClose: () => void }) {
  const audioTracks       = useCodaStore((s) => s.audioTracks);
  const activeAudioId     = useCodaStore((s) => s.activeAudioTrackId);
  const storeExportFormat = useCodaStore((s) => s.exportFormat);

  const activeTrack = audioTracks.find((t) => t.id === activeAudioId);
  const maxDuration = activeTrack?.durationSec ?? 0;

  // Settings
  const [fps,      setFps]      = useState<24 | 30>(30);
  const [format,   setFormat]   = useState<RenderFormat>(
    storeExportFormat === 'both' ? 'both' : storeExportFormat,
  );
  const [quality,  setQuality]  = useState<RenderQuality>('medium');
  const [duration, setDuration] = useState(maxDuration);

  // Progress
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const jobRef = useRef<RenderJob | null>(null);

  const isRunning = progress !== null &&
    !['done', 'error', 'idle'].includes(progress.phase);

  const handleRender = useCallback(async () => {
    if (isRunning) return;

    const opts: RenderOptions = {
      fps,
      format,
      quality,
      durationSec: duration,
    };

    const job = new RenderJob();
    jobRef.current = job;
    setProgress({ phase: 'preparing', phasePct: 0, totalPct: 0, message: '준비 중…' });

    try {
      await job.start(opts, setProgress);
    } catch (err) {
      setProgress((prev) => ({
        ...(prev ?? { phase: 'error', phasePct: 0, totalPct: 0, message: '' }),
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
        message: '렌더 실패',
      }));
    }
  }, [fps, format, quality, duration, isRunning]);

  const handleAbort = () => {
    jobRef.current?.abort();
    setProgress(null);
  };

  const handleDownload = (url: string, label: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `coda_${label}.mp4`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="w-[360px] bg-cream-100 border border-cream-300 shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-300">
          <span className="label-caps text-ink-900">RENDER</span>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Settings */}
        <div className="p-4 flex flex-col gap-3 border-b border-cream-300">

          {/* FPS */}
          <SettingRow label="FPS">
            {([24, 30] as const).map((f) => (
              <ToggleBtn key={f} active={fps === f} onClick={() => setFps(f)} disabled={isRunning}>
                {f}
              </ToggleBtn>
            ))}
          </SettingRow>

          {/* Format */}
          <SettingRow label="Format">
            {(['16:9', '9:16', 'both'] as const).map((fmt) => (
              <ToggleBtn key={fmt} active={format === fmt} onClick={() => setFormat(fmt)} disabled={isRunning}>
                {fmt === 'both' ? 'BOTH' : fmt}
              </ToggleBtn>
            ))}
          </SettingRow>

          {/* Quality */}
          <SettingRow label="Quality">
            {(['high', 'medium'] as const).map((q) => (
              <ToggleBtn key={q} active={quality === q} onClick={() => setQuality(q)} disabled={isRunning}>
                {q.toUpperCase()}
              </ToggleBtn>
            ))}
          </SettingRow>

          {/* Duration */}
          <SettingRow label="Duration">
            <span className="text-xs text-ink-500 tabular-nums">
              {formatTime(duration)}
              {maxDuration > 0 && (
                <span className="text-ink-300 ml-1">
                  / {formatTime(maxDuration)}
                </span>
              )}
            </span>
            {maxDuration > 0 && (
              <input
                type="range"
                min={1}
                max={Math.ceil(maxDuration)}
                step={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={isRunning}
                className="flex-1 ml-2 accent-ink-900"
              />
            )}
          </SettingRow>

          {/* Quality hint */}
          <div className="text-[9px] text-ink-300 label-caps">
            {quality === 'high' ? '8 Mbps — YouTube 권장' : '4 Mbps — 균형'}
            {' · '}
            {format === 'both'
              ? '16:9 + 9:16 크롭 (2개 파일)'
              : format === '9:16'
              ? '세로형 Shorts'
              : '가로형 풀버전'}
          </div>
        </div>

        {/* Progress section */}
        {progress && (
          <div className="px-4 py-3 flex flex-col gap-2 border-b border-cream-300">
            <div className="flex items-center justify-between">
              <span className="text-[9px] label-caps text-ink-500">
                {PHASE_LABELS[progress.phase] ?? progress.phase}
              </span>
              <span className="text-[9px] label-caps text-ink-500 tabular-nums">
                {progress.totalPct}%
              </span>
            </div>
            <ProgressBar pct={progress.totalPct} />
            <p className="text-[10px] text-ink-400 truncate">{progress.message}</p>

            {progress.phase === 'error' && (
              <p className="text-[10px] text-red-500 break-words">{progress.error}</p>
            )}
          </div>
        )}

        {/* Download links */}
        {progress?.phase === 'done' && progress.downloadUrls && (
          <div className="px-4 py-3 flex flex-col gap-2 border-b border-cream-300">
            <span className="label-caps text-ink-300 text-[9px]">다운로드</span>
            <div className="flex gap-2">
              {progress.downloadUrls['16-9'] && (
                <button
                  onClick={() => handleDownload(progress.downloadUrls!['16-9']!, '16-9')}
                  className="flex items-center gap-1.5 px-3 py-1.5 label-caps text-[10px]
                    border border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500 transition-colors"
                >
                  <DownloadIcon /> 16:9
                </button>
              )}
              {progress.downloadUrls['9-16'] && (
                <button
                  onClick={() => handleDownload(progress.downloadUrls!['9-16']!, '9-16')}
                  className="flex items-center gap-1.5 px-3 py-1.5 label-caps text-[10px]
                    border border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500 transition-colors"
                >
                  <DownloadIcon /> 9:16
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          {isRunning ? (
            <button
              onClick={handleAbort}
              className="px-4 py-1.5 label-caps text-[11px] border border-cream-300
                text-ink-500 hover:border-red-400 hover:text-red-500 transition-colors"
            >
              중단
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-1.5 label-caps text-[11px] border border-cream-300
                  text-ink-500 hover:text-ink-900 hover:border-ink-500 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleRender}
                disabled={!maxDuration && duration === 0}
                className="px-4 py-1.5 label-caps text-[11px] bg-ink-900 text-cream-100
                  border border-ink-900 hover:bg-ink-700 transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                RENDER
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-caps text-ink-300 text-[9px] w-14 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1">{children}</div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 text-[10px] label-caps border transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'bg-ink-900 text-cream-100 border-ink-900'
          : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
        }`}
    >
      {children}
    </button>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
