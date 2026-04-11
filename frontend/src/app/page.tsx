'use client';

import dynamic from 'next/dynamic';
import { useCodaStore } from '@/store/useCodaStore';
import UploadPanel from '@/components/UI/UploadPanel';
import SubtitleEditor from '@/components/UI/SubtitleEditor';
import VFXPanel from '@/components/UI/VFXPanel';
import ExportPanel from '@/components/UI/ExportPanel';

// Canvas는 SSR 비활성화 (Three.js는 브라우저 전용)
const MainScene = dynamic(
  () => import('@/components/Canvas/MainScene'),
  { ssr: false, loading: () => <SceneLoading /> }
);

function SceneLoading() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <span className="text-amber-400/50 text-xs tracking-[0.3em] animate-pulse">
        INITIALIZING CANVAS...
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel Section — collapsible header + content
// ---------------------------------------------------------------------------

function PanelSection({
  title,
  badge,
  children,
  minHeight = '0',
  grow = false,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  minHeight?: string;
  grow?: boolean;
}) {
  return (
    <section
      className={`flex flex-col border-b border-zinc-800 last:border-b-0 ${grow ? 'flex-1 min-h-0' : ''}`}
      style={grow ? { minHeight } : { minHeight }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800 shrink-0">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          {title}
        </span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-600">
            {badge}
          </span>
        )}
      </div>

      {/* Panel body */}
      <div className={`${grow ? 'flex-1 overflow-hidden' : ''}`}>
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

// exportFormat → 캔버스 aspect ratio
const ASPECT_MAP = { '16:9': '16/9', '9:16': '9/16', 'both': '16/9' } as const;

export default function Home() {
  const titleText = useCodaStore((s) => s.titleText);
  const exportFormat = useCodaStore((s) => s.exportFormat);
  const setExportFormat = useCodaStore((s) => s.setExportFormat);

  return (
    <main className="flex flex-col h-screen bg-zinc-950 overflow-hidden text-zinc-200">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800 shrink-0 bg-zinc-950 z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <LogoMark />
            <span className="text-amber-400 font-bold tracking-[0.25em] text-sm uppercase select-none">
              {titleText}
            </span>
          </div>
          <span className="text-zinc-800 text-xs">|</span>
          <span className="text-zinc-700 text-[10px] tracking-wider">v0.1.0</span>
        </div>

        {/* Format selector */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Format</span>
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded p-0.5">
            {(['16:9', '9:16', 'both'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={`px-3 py-1 text-[11px] rounded transition-colors font-medium tracking-wide ${
                  exportFormat === fmt
                    ? 'bg-amber-400 text-black'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {fmt === 'both' ? 'BOTH ★' : fmt}
              </button>
            ))}
          </div>
          <SettingsButton />
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Canvas ───────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-black overflow-hidden">
          <div
            className="relative bg-black"
            style={{
              aspectRatio: ASPECT_MAP[exportFormat],
              maxHeight: '100%',
              maxWidth: '100%',
              height: exportFormat === '9:16' ? '100%' : 'auto',
              width: exportFormat === '9:16' ? 'auto' : '100%',
            }}
          >
            <MainScene />
          </div>
        </div>

        {/* RIGHT: Control panels ──────────────────────────────────────────── */}
        <aside className="w-[300px] shrink-0 flex flex-col border-l border-zinc-800 bg-zinc-950 overflow-hidden">

          {/* Upload Panel */}
          <PanelSection title="업로드" minHeight="220px">
            <UploadPanel />
          </PanelSection>

          {/* Subtitle Editor — grows to fill remaining space */}
          <PanelSection title="자막 편집" grow minHeight="160px">
            <div className="h-full overflow-hidden">
              <SubtitleEditor />
            </div>
          </PanelSection>

          {/* VFX Panel */}
          <PanelSection title="VFX">
            <VFXPanel />
          </PanelSection>

        </aside>
      </div>

      {/* ── Export Panel (bottom) ────────────────────────────────────────── */}
      <ExportPanel />

    </main>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function LogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect width="16" height="16" rx="3" fill="#fbbf24" opacity="0.15" />
      <path d="M4 8 L8 4 L12 8 L8 12 Z" fill="#fbbf24" />
    </svg>
  );
}

function SettingsButton() {
  return (
    <button className="w-7 h-7 flex items-center justify-center rounded border border-zinc-800 text-zinc-600 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    </button>
  );
}
