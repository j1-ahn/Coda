'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { useCodaStore, hydrateFromLocalStorage, saveToLocalStorage } from '@/store/useCodaStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import TitleCustomPanel from '@/components/UI/TitleCustomPanel';
import LyricFontPanel from '@/components/UI/LyricFontPanel';
import CanvasSceneInfoBar from '@/components/UI/CanvasSceneInfoBar';
import CanvasBottomBar from '@/components/UI/CanvasBottomBar';
import SaveLoadPanel from '@/components/UI/SaveLoadPanel';
import RenderPanel from '@/components/UI/RenderPanel';
import SettingsPanel from '@/components/UI/SettingsPanel';
import PlaylistOverlay from '@/components/UI/PlaylistOverlay';
import MaskDrawOverlay from '@/components/Canvas/MaskDrawOverlay';
import CanvasEmptyState from '@/components/Canvas/CanvasEmptyState';
import CanvasQuickToolbar from '@/components/Canvas/CanvasQuickToolbar';
import TitleHTMLOverlay from '@/components/Canvas/TitleHTMLOverlay';
import LyricHTMLOverlay from '@/components/Canvas/LyricHTMLOverlay';

// v2 Tab components
import StudioTab from '@/components/Tabs/StudioTab';
import MusicSoundTab from '@/components/Tabs/MusicSoundTab';
import SceneTab from '@/components/Tabs/SceneTab';
import STTSubtitleTab from '@/components/Tabs/STTSubtitleTab';

import type { SidebarTabId } from '@/store/useCodaStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import OnboardingOverlay from '@/components/UI/OnboardingOverlay';


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

const TABS: { id: SidebarTabId; label: string }[] = [
  { id: 'STUDIO', label: 'STUDIO' },
  { id: 'MUSIC',  label: 'MUSIC'  },
  { id: 'SCENE',  label: 'SCENE'  },
  { id: 'STT',    label: 'STT'    },
];

// (v2: Tab wrapper components moved to @/components/Tabs/)

// ---------------------------------------------------------------------------
// (RenderTab removed — VFX + Loop moved to ImageTab)

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
  const previewMode    = useCodaStore((s) => s.previewMode);
  const canvasZoom     = useCodaStore((s) => s.canvasZoom);
  const setCanvasZoom  = useCodaStore((s) => s.setCanvasZoom);

  const activeTab    = useCodaStore((s) => s.activeTab);
  const setActiveTab = useCodaStore((s) => s.setActiveTab);
  const [showGallery, setShowGallery] = useState(false);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);

  // Hydrate once on mount
  useEffect(() => { hydrateFromLocalStorage(); }, []);

  // Auto-save: debounce by interval setting. 0 = manual only.
  useEffect(() => {
    if (autoSaveInterval === 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useCodaStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(saveToLocalStorage, autoSaveInterval * 1000);
    });
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [autoSaveInterval]);

  // Ctrl+Scroll zoom — native listener with { passive: false } to allow preventDefault
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const current = useCodaStore.getState().canvasZoom;
      useCodaStore.getState().setCanvasZoom(Math.max(0.25, Math.min(3, current + delta)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Escape key exits focus/preview mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useCodaStore.getState().previewMode) {
        useCodaStore.getState().setPreviewMode(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <main className="flex flex-col h-screen bg-cream-100 overflow-hidden text-ink-900">
      <OnboardingOverlay />

      {/* ── Header — hidden in preview mode */}
      <header className={`flex items-center justify-between px-5 py-2.5 border-b border-cream-300 shrink-0 bg-cream-100 z-10 ${previewMode ? 'hidden' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-ink-900 text-xl tracking-tight leading-none select-none">
            {titleText}
          </span>
          <span className="text-cream-300 text-xs">|</span>
          <span className="text-ink-300 text-[10px]">v0.3.0</span>
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
          <button
            onClick={() => setShowGallery((v) => !v)}
            className={`px-2.5 py-1.5 text-[9px] label-caps border transition-colors ${
              showGallery
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : 'border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500'
            }`}
          >
            GALLERY
          </button>
          <SaveLoadPanel />
          <RenderPanel />
          <SettingsPanel />
        </div>
      </header>

      {/* ── Gallery iframe overlay ──────────────────────────────────────── */}
      {showGallery && (
        <div className="flex-1 min-h-0 flex flex-col relative">
          <iframe
            src="http://localhost:3001"
            className="w-full h-full border-0"
            title="Coda Gallery"
          />
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-white/80 backdrop-blur text-[10px] text-ink-900 border border-cream-300 hover:bg-ink-900 hover:text-cream-100 transition-colors z-10"
          >
            X
          </button>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className={`flex flex-1 min-h-0 overflow-hidden ${showGallery ? 'hidden' : ''}`}>

        {/* LEFT: Canvas column */}
        <div className="relative flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Scene info bar — hidden in preview mode */}
          {!previewMode && <CanvasSceneInfoBar />}

          {/* Canvas area — fills remaining vertical space */}
          <div
            ref={canvasAreaRef}
            className="flex-1 min-h-0 flex items-center justify-center bg-cream-200 overflow-hidden"
          >
            <div
              id="studio-canvas-container"
              className="group relative bg-black"
              style={{
                aspectRatio: ASPECT_MAP[exportFormat],
                maxHeight: '100%',
                maxWidth: '100%',
                height: exportFormat === '9:16' ? '100%' : 'auto',
                width: exportFormat === '9:16' ? 'auto' : '100%',
                transform: `scale(${canvasZoom})`,
                transformOrigin: 'center center',
              }}
            >
              <ErrorBoundary name="3D Canvas">
                <MainScene />
              </ErrorBoundary>
              <EQCanvasLayer />
              <PlaylistOverlay />
              <TitleHTMLOverlay />
              <LyricHTMLOverlay />
              {!previewMode && <EQOverlayWidget />}
              <MaskDrawOverlay />
              <CanvasEmptyState />
              <CanvasQuickToolbar />
            </div>
          </div>

          {/* Title / Lyric font panel — footer 위에 고정 */}
          {!previewMode && activeTab === 'STUDIO' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <TitleCustomPanel group="pr" />
            </div>
          )}
          {!previewMode && activeTab === 'MUSIC' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <TitleCustomPanel group="eqpl" />
            </div>
          )}
          {!previewMode && activeTab === 'SCENE' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <TitleCustomPanel group="gfx" />
            </div>
          )}
          {!previewMode && activeTab === 'STT' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <LyricFontPanel />
            </div>
          )}

          {/* Bottom bar — transport + waveform + tracks (CSS hidden, not unmounted, to keep audio playing) */}
          <div className={previewMode ? 'hidden' : ''}><CanvasBottomBar /></div>

          {/* Focus mode exit button — appears on hover */}
          {previewMode && (
            <button
              onClick={() => useCodaStore.getState().setPreviewMode(false)}
              className="absolute top-3 left-3 z-30 w-8 h-8 flex items-center justify-center
                bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70
                transition-all opacity-0 hover:opacity-100 focus:opacity-100"
              title="Exit Focus Mode (Esc)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            </button>
          )}
        </div>

        {/* RIGHT: 4-tab panel — hidden in preview mode */}
        <aside className={`w-[300px] shrink-0 flex flex-col border-l border-cream-300 bg-cream-100 overflow-hidden transition-all ${previewMode ? 'hidden' : ''}`}>

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
            <ErrorBoundary name="Sidebar">
              {activeTab === 'STUDIO' && <StudioTab />}
              {activeTab === 'MUSIC'  && <MusicSoundTab />}
              {activeTab === 'SCENE'  && <SceneTab />}
              {activeTab === 'STT'    && <STTSubtitleTab />}
            </ErrorBoundary>
          </div>

        </aside>
      </div>

      {/* EQOverlayWidget moved into canvas container above */}
    </main>
  );
}

