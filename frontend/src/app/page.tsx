'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import UploadPanel from '@/components/UI/UploadPanel';
import SubtitleEditor from '@/components/UI/SubtitleEditor';
import VFXPanel from '@/components/UI/VFXPanel';
import ExportPanel from '@/components/UI/ExportPanel';
import AudioPlayer from '@/components/UI/AudioPlayer';
import LoopPanel from '@/components/UI/LoopPanel';
import WhisperSyncPanel from '@/components/UI/WhisperSyncPanel';
import TitleCustomPanel from '@/components/UI/TitleCustomPanel';
import EqualizerTab from '@/components/Equalizer/EqualizerTab';

// Canvas는 SSR 비활성화 (Three.js는 브라우저 전용)
const MainScene = dynamic(
  () => import('@/components/Canvas/MainScene'),
  { ssr: false, loading: () => <SceneLoading /> }
);

function SceneLoading() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-cream-200">
      <span className="label-caps text-ink-300 animate-pulse">LOADING</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type TabId = 'STUDIO' | 'EQUALIZER' | 'EXPORT';

const TABS: TabId[] = ['STUDIO', 'EQUALIZER', 'EXPORT'];

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
      className={`flex flex-col border-b border-cream-300 last:border-b-0 ${grow ? 'flex-1 min-h-0' : ''}`}
      style={grow ? { minHeight } : { minHeight }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-cream-200 border-b border-cream-300 shrink-0">
        <span className="label-caps">{title}</span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 bg-cream-300 text-ink-500">
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
// Tab content components
// ---------------------------------------------------------------------------

function StudioTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">
      <PanelSection title="업로드" minHeight="220px">
        <UploadPanel />
      </PanelSection>
      <PanelSection title="재생">
        <AudioPlayer />
      </PanelSection>
      <PanelSection title="자막 동기화">
        <WhisperSyncPanel />
      </PanelSection>
      <PanelSection title="타이틀">
        <TitleCustomPanel />
      </PanelSection>
    </div>
  );
}

function ExportTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">
      <PanelSection title="자막 편집" grow minHeight="160px">
        <div className="h-full overflow-hidden">
          <SubtitleEditor />
        </div>
      </PanelSection>
      <PanelSection title="VFX">
        <VFXPanel />
      </PanelSection>
      <PanelSection title="루프 애니메이션">
        <LoopPanel />
      </PanelSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// exportFormat → 캔버스 aspect ratio
// ---------------------------------------------------------------------------

const ASPECT_MAP = { '16:9': '16/9', '9:16': '9/16', 'both': '16/9' } as const;

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Home() {
  const titleText      = useCodaStore((s) => s.titleText);
  const exportFormat   = useCodaStore((s) => s.exportFormat);
  const setExportFormat = useCodaStore((s) => s.setExportFormat);

  const [activeTab, setActiveTab] = useState<TabId>('STUDIO');

  return (
    <main className="flex flex-col h-screen bg-cream-100 overflow-hidden text-ink-900">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-cream-300 shrink-0 bg-cream-100 z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-ink-900 text-base tracking-tight select-none">
              {titleText}
            </span>
          </div>
          <span className="text-cream-300 text-xs">|</span>
          <span className="text-ink-300 text-[10px]">v0.1.0</span>
        </div>

        {/* Format selector */}
        <div className="flex items-center gap-3">
          <span className="label-caps">Format</span>
          <div className="flex items-center gap-0.5">
            {(['16:9', '9:16', 'both'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={`px-3 py-1.5 text-[11px] rounded-none transition-colors font-medium tracking-wide border ${
                  exportFormat === fmt
                    ? 'bg-ink-900 text-cream-100 border-ink-900'
                    : 'text-ink-500 border-cream-300 hover:text-ink-900 hover:border-ink-500'
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
        <div className="flex-1 min-w-0 flex items-center justify-center bg-cream-200 overflow-hidden">
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

        {/* RIGHT: Tabbed control panels ───────────────────────────────────── */}
        <aside className="w-[300px] shrink-0 flex flex-col border-l border-cream-300 bg-cream-100 overflow-hidden">

          {/* Tab headers */}
          <div className="flex border-b border-cream-300 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 label-caps border-r border-cream-300 last:border-r-0 flex-1
                  transition-colors
                  ${activeTab === tab
                    ? 'bg-ink-900 text-cream-100'
                    : 'text-ink-500 hover:text-ink-900'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {activeTab === 'STUDIO'    && <StudioTab />}
            {activeTab === 'EQUALIZER' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <EqualizerTab />
              </div>
            )}
            {activeTab === 'EXPORT'    && <ExportTab />}
          </div>

        </aside>
      </div>

      {/* ── Export Panel (bottom, always visible) ───────────────────────── */}
      <ExportPanel />

    </main>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function SettingsButton() {
  return (
    <button className="w-7 h-7 flex items-center justify-center border border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500 transition-colors">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    </button>
  );
}
