'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useCallback } from 'react';
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

import {
  startCompositeRender,
  downloadBlob,
  type CompositeRenderHandle,
} from '@/lib/compositeRenderer';

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

type TabId = 'STUDIO' | 'EQ & VFX' | 'LYRIC' | 'RENDER';

const TABS: { id: TabId; label: string }[] = [
  { id: 'STUDIO',   label: 'LOADER' },
  { id: 'EQ & VFX', label: 'EQ&PL'  },
  { id: 'LYRIC',    label: 'LYRIC'  },
  { id: 'RENDER',   label: 'RENDER' },
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
// STUDIO Tab — 배경 업로드 + 타이틀 (오디오는 EQ&PL Playlist 패널에서)
// ---------------------------------------------------------------------------

function StudioTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">
      <UploadPanel mode="background" />
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
      {/* EQ */}
      <EqualizerTab />
      {/* Playlist — COLOR 바로 아래 */}
      <PlaylistPanel />
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
// RENDER Tab — 타이틀 + 렌더 설정
// ---------------------------------------------------------------------------

type RenderPhase =
  | { phase: 'idle' }
  | { phase: 'rendering'; progress: number; msg: string }
  | { phase: 'done'; blob: Blob; filename: string }
  | { phase: 'error'; msg: string };

function RenderTab() {
  const exportFormat      = useCodaStore((s) => s.exportFormat);
  const titleMode         = useCodaStore((s) => s.titleMode);
  const setTitleMode      = useCodaStore((s) => s.setTitleMode);
  const audioTracks       = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId = useCodaStore((s) => s.activeAudioTrackId);

  const [status, setStatus] = useState<RenderPhase>({ phase: 'idle' });
  const handleRef = useRef<CompositeRenderHandle | null>(null);

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);

  const handleRender = useCallback(async () => {
    const container = document.getElementById('studio-canvas-container');
    if (!container) { setStatus({ phase: 'error', msg: 'canvas container 없음' }); return; }

    const rect = container.getBoundingClientRect();
    const w = Math.round(rect.width)  || 1920;
    const h = Math.round(rect.height) || 1080;

    setStatus({ phase: 'rendering', progress: 0, msg: '렌더 준비 중...' });

    const [handle, promise] = startCompositeRender(container, {
      width: w,
      height: h,
      fps: 30,
      durationSec: activeTrack?.durationSec ?? 10,
      audioSrc: activeTrack?.url ?? null,
      onProgress: (p) =>
        setStatus({ phase: 'rendering', progress: p, msg: `렌더 중... ${Math.round(p * 100)}%` }),
    });
    handleRef.current = handle;

    try {
      const blob = await promise;
      if (!blob) { setStatus({ phase: 'error', msg: '렌더 취소' }); return; }
      const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
      setStatus({ phase: 'done', blob, filename: `coda_${Date.now()}.${ext}` });
    } catch (e) {
      setStatus({ phase: 'error', msg: e instanceof Error ? e.message : '오류' });
    } finally {
      handleRef.current = null;
    }
  }, [activeTrack]);

  useEffect(() => () => { handleRef.current?.stop(); }, []);

  const isRendering = status.phase === 'rendering';

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">

      {/* VFX */}
      <PanelSection title="VFX">
        <VFXPanel />
      </PanelSection>

      {/* Loop */}
      <PanelSection title="Loop Animation">
        <LoopPanel />
      </PanelSection>

      {/* 렌더 설정 */}
      <div className="flex flex-col gap-3 p-3 shrink-0">
        <span className="label-caps">렌더 설정</span>

        {/* 포맷 (읽기 전용 — 헤더에서 변경) */}
        <Row label="FORMAT">
          <span className="font-mono text-[11px] text-ink-700 bg-cream-200 px-2 py-0.5 border border-cream-300">
            {exportFormat}
          </span>
          <span className="text-[9px] text-ink-300 label-caps">헤더에서 변경</span>
        </Row>

        {/* 활성 오디오 트랙 */}
        <Row label="AUDIO">
          {activeTrack ? (
            <span className="text-[11px] text-ink-700 truncate max-w-[160px]" title={activeTrack.fileName}>
              {activeTrack.fileName}
            </span>
          ) : (
            <span className="text-[11px] text-ink-300">트랙 없음 — Studio 탭에서 추가</span>
          )}
        </Row>

        {/* 길이 */}
        {activeTrack?.durationSec ? (
          <Row label="DURATION">
            <span className="font-mono text-[11px] text-ink-500">
              {Math.floor(activeTrack.durationSec / 60)}:{String(Math.floor(activeTrack.durationSec % 60)).padStart(2, '0')}
            </span>
          </Row>
        ) : null}
      </div>

      {/* 렌더 버튼 + 상태 */}
      <div className="flex flex-col gap-3 p-3 shrink-0">
        {/* Button */}
        {status.phase === 'idle' && (
          <button
            onClick={handleRender}
            className="w-full py-3 bg-ink-900 text-cream-100 text-xs font-semibold uppercase tracking-widest hover:bg-ink-700 transition-colors flex items-center justify-center gap-2"
          >
            <PlayIcon className="w-3.5 h-3.5" />
            렌더 시작
          </button>
        )}

        {isRendering && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-ink-500">{(status as Extract<RenderPhase, { phase: 'rendering' }>).msg}</span>
              <span className="font-mono text-[11px] text-ink-900 tabular-nums">
                {Math.round((status as Extract<RenderPhase, { phase: 'rendering' }>).progress * 100)}%
              </span>
            </div>
            <div className="w-full bg-cream-300 h-1">
              <div
                className="h-full bg-ink-900 transition-all duration-300"
                style={{ width: `${Math.round((status as Extract<RenderPhase, { phase: 'rendering' }>).progress * 100)}%` }}
              />
            </div>
            <button
              onClick={() => handleRef.current?.stop()}
              className="w-full py-2 border border-ink-400 text-xs text-ink-700 hover:bg-cream-200 transition-colors"
            >
              중단
            </button>
          </>
        )}

        {status.phase === 'done' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] text-ink-700">
              <CheckIcon className="w-4 h-4 text-ink-700" />
              렌더 완료
            </div>
            <button
              onClick={() => downloadBlob((status as Extract<RenderPhase, { phase: 'done' }>).blob, (status as Extract<RenderPhase, { phase: 'done' }>).filename)}
              className="w-full py-2.5 border border-ink-900 text-xs font-semibold tracking-wide text-ink-900 hover:bg-ink-900 hover:text-cream-100 transition-colors flex items-center justify-center gap-2"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              {(status as Extract<RenderPhase, { phase: 'done' }>).filename}
            </button>
            <button
              onClick={() => setStatus({ phase: 'idle' })}
              className="text-[10px] text-ink-300 hover:text-ink-900 transition-colors text-center"
            >
              다시 렌더
            </button>
          </div>
        )}

        {status.phase === 'error' && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-red-800">✗ {(status as Extract<RenderPhase, { phase: 'error' }>).msg}</span>
            <button
              onClick={() => setStatus({ phase: 'idle' })}
              className="text-[10px] text-ink-300 hover:text-ink-900 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

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

  const [activeTab, setActiveTab] = useState<TabId>('STUDIO');

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
            {activeTab === 'STUDIO'   && <StudioTab />}
            {activeTab === 'EQ & VFX' && <EQTab />}
            {activeTab === 'LYRIC'    && <LyricTab />}
            {activeTab === 'RENDER'   && <RenderTab />}
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
