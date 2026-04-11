'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

import UploadPanel from '@/components/UI/UploadPanel';
import WhisperSyncPanel from '@/components/UI/WhisperSyncPanel';
import SubtitleEditor from '@/components/UI/SubtitleEditor';
import VFXPanel from '@/components/UI/VFXPanel';
import LoopPanel from '@/components/UI/LoopPanel';
import TitleCustomPanel from '@/components/UI/TitleCustomPanel';
import EqualizerTab from '@/components/Equalizer/EqualizerTab';
import CanvasSceneInfoBar from '@/components/UI/CanvasSceneInfoBar';
import CanvasBottomBar from '@/components/UI/CanvasBottomBar';
import PlaylistPanel from '@/components/UI/PlaylistPanel';


const EQOverlayWidget = dynamic(
  () => import('@/components/Equalizer/EQOverlayWidget'),
  { ssr: false }
);
const EQCanvasLayer = dynamic(
  () => import('@/components/Equalizer/EQCanvasLayer'),
  { ssr: false }
);
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
// Tab definition
// ---------------------------------------------------------------------------

type TabId = 'IMAGE' | 'EQ & VFX' | 'LYRIC';

const TABS: { id: TabId; label: string }[] = [
  { id: 'IMAGE',    label: 'IMAGE'  },
  { id: 'EQ & VFX', label: 'EQ&PL' },
  { id: 'LYRIC',   label: 'LYRIC'  },
];

// ---------------------------------------------------------------------------
// PanelSection — collapsible header + body
// ---------------------------------------------------------------------------

function PanelSection({
  title,
  badge,
  children,
  grow = false,
  minHeight = '0',
  noPad = false,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  grow?: boolean;
  minHeight?: string;
  noPad?: boolean;
}) {
  return (
    <section
      className={`flex flex-col border-b border-cream-300 last:border-b-0 shrink-0 ${grow ? 'flex-1 min-h-0' : ''}`}
      style={minHeight ? { minHeight } : undefined}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-cream-200 border-b border-cream-300 shrink-0">
        <span className="label-caps">{title}</span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 bg-cream-300 text-ink-500">{badge}</span>
        )}
      </div>
      <div className={`${grow ? 'flex-1 min-h-0 overflow-hidden' : ''} ${noPad ? '' : ''}`}>
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// IMAGE Tab — 배경 업로드 + VFX + Loop + 타이틀
// ---------------------------------------------------------------------------

function ImageTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">
      <UploadPanel mode="background" />
      <PanelSection title="VFX">
        <VFXPanel />
      </PanelSection>
      <PanelSection title="Loop Animation">
        <LoopPanel />
      </PanelSection>
      <PanelSection title="타이틀">
        <TitleCustomPanel />
      </PanelSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EQ Tab — 이퀄라이저 + 플레이리스트
// ---------------------------------------------------------------------------

function EQTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <EqualizerTab />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LYRIC Tab — 자막 관리
// ---------------------------------------------------------------------------

function LyricTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden divide-y divide-cream-300">
      <PanelSection title="자막 동기화">
        <WhisperSyncPanel />
      </PanelSection>
      <PanelSection title="자막 편집" grow minHeight="160px">
        <div className="h-full overflow-hidden">
          <SubtitleEditor />
        </div>
      </PanelSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// (RenderTab removed — VFX + Loop moved to ImageTab)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-caps text-ink-300 shrink-0 w-16">{label}</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aspect ratio map
// ---------------------------------------------------------------------------

const ASPECT_MAP = { '16:9': '16/9', '9:16': '9/16', 'both': '16/9' } as const;

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Home() {
  const titleText      = useCodaStore((s) => s.titleText);
  const exportFormat   = useCodaStore((s) => s.exportFormat);
  const setExportFormat = useCodaStore((s) => s.setExportFormat);

  const [activeTab, setActiveTab] = useState<TabId>('IMAGE');

  return (
    <main className="flex flex-col h-screen bg-cream-100 overflow-hidden text-ink-900">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-cream-300 shrink-0 bg-cream-100 z-10">
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-ink-900 text-base tracking-tight select-none">
            {titleText}
          </span>
          <span className="text-cream-300 text-xs">|</span>
          <span className="text-ink-300 text-[10px]">v0.2.0</span>
        </div>

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

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Canvas column */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Scene info bar — always on top */}
          <CanvasSceneInfoBar />

          {/* Canvas area — fills remaining vertical space */}
          <div className="flex-1 min-h-0 flex items-center justify-center bg-cream-200 overflow-hidden">
            <div
              id="studio-canvas-container"
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
              <EQCanvasLayer />
            </div>
          </div>

          {/* Bottom bar — transport + waveform + tracks */}
          <CanvasBottomBar />
        </div>

        {/* RIGHT: 4-tab panel */}
        <aside className="w-[300px] shrink-0 flex flex-col border-l border-cream-300 bg-cream-100 overflow-hidden">

          {/* Tab headers */}
          <div className="flex border-b border-cream-300 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-1 py-2.5 text-[9px] font-semibold tracking-widest uppercase border-r border-cream-300 last:border-r-0 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-ink-900 text-cream-100'
                    : 'text-ink-400 hover:text-ink-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {activeTab === 'IMAGE'    && <ImageTab />}
            {activeTab === 'EQ & VFX' && <EQTab />}
            {activeTab === 'LYRIC'    && <LyricTab />}
          </div>

        </aside>
      </div>

      {/* EQ chrome — fixed, outside canvas (not captured in export) */}
      <EQOverlayWidget />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Icons
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

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v14l11-7-11-7z" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
