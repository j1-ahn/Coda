'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
import { useCodaStore, hydrateFromLocalStorage, saveToLocalStorage } from '@/store/useCodaStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import PromptPanel from '@/components/UI/PromptPanel';
import UploadPanel from '@/components/UI/UploadPanel';
import GraphicsPanel from '@/components/UI/GraphicsPanel';
import WhisperSyncPanel from '@/components/UI/WhisperSyncPanel';
import SubtitleEditor from '@/components/UI/SubtitleEditor';
import VFXPanel from '@/components/UI/VFXPanel';
import LoopPanel from '@/components/UI/LoopPanel';
import TitleCustomPanel from '@/components/UI/TitleCustomPanel';
import LyricFontPanel from '@/components/UI/LyricFontPanel';
import EqualizerTab from '@/components/Equalizer/EqualizerTab';
import CanvasSceneInfoBar from '@/components/UI/CanvasSceneInfoBar';
import CanvasBottomBar from '@/components/UI/CanvasBottomBar';
import SaveLoadPanel from '@/components/UI/SaveLoadPanel';
import RenderPanel from '@/components/UI/RenderPanel';
import SettingsPanel from '@/components/UI/SettingsPanel';
import PlaylistPanel from '@/components/UI/PlaylistPanel';
import PlaylistOverlay from '@/components/UI/PlaylistOverlay';
import MaskDrawOverlay from '@/components/Canvas/MaskDrawOverlay';
import TitleHTMLOverlay from '@/components/Canvas/TitleHTMLOverlay';
import LyricHTMLOverlay from '@/components/Canvas/LyricHTMLOverlay';


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

type TabId = 'PROMPT' | 'GRAPHICS' | 'VFX/LOOP' | 'EQ & VFX' | 'LYRIC';

const TABS: { id: TabId; label: string }[] = [
  { id: 'PROMPT',   label: 'PR'    },
  { id: 'GRAPHICS', label: 'GFX'   },
  { id: 'VFX/LOOP', label: 'VFX'   },
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
// GRAPHICS Tab — 다중 이미지 업로드 + 씬 트랜지션
// ---------------------------------------------------------------------------

function GraphicsTab() {
  return <GraphicsPanel />;
}

// ---------------------------------------------------------------------------
// VFX/LOOP Tab — VFX + Loop 애니메이션
// ---------------------------------------------------------------------------

function VFXLoopTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">
      <div className="flex flex-col shrink-0">
        <VFXPanel />
      </div>
      <PanelSection title="Loop Animation">
        <LoopPanel />
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

// SRT 파싱 유틸
function parseSRT(raw: string): { id: string; start: number; end: number; text: string }[] {
  const segments: { id: string; start: number; end: number; text: string }[] = [];
  const timeToSec = (t: string) => {
    const [h, m, rest] = t.split(':');
    const [s, ms] = rest.replace(',', '.').split('.');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseFloat('0.' + (ms ?? '0'));
  };
  const blocks = raw.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const timeMatch = lines[1]?.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
    if (!timeMatch) continue;
    const text = lines.slice(2).join(' ').trim();
    if (!text) continue;
    segments.push({
      id: `srt-${segments.length}`,
      start: timeToSec(timeMatch[1]),
      end: timeToSec(timeMatch[2]),
      text,
    });
  }
  return segments;
}

function ManualLyricInput() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [applied, setApplied] = useState(false);
  const [srtLoaded, setSrtLoaded] = useState<string | null>(null);

  const { addAudioTrack, setActiveAudioTrack, setWhisperSegments, audioTracks, activeAudioTrackId } = useCodaStore();

  const applySegments = (segments: { id: string; start: number; end: number; text: string }[], label: string) => {
    let trackId = audioTracks.find((t) => t.fileName === label)?.id
                ?? audioTracks.find((t) => t.fileName === '직접 입력')?.id;
    if (!trackId) trackId = addAudioTrack(label, '');
    else useCodaStore.getState().audioTracks.find(t => t.id === trackId) && void 0; // noop
    setActiveAudioTrack(trackId!);
    const duration = segments[segments.length - 1]?.end ?? segments.length * 3;
    setWhisperSegments(trackId!, segments, duration);
  };

  const handleApply = () => {
    const raw = textareaRef.current?.value ?? '';
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const secsPerLine = 3;
    const segments = lines.map((text, i) => ({
      id: `manual-${i}`,
      start: i * secsPerLine,
      end: (i + 1) * secsPerLine,
      text,
    }));
    applySegments(segments, '직접 입력');
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  };

  const handleSRTFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      const segments = parseSRT(raw);
      if (segments.length === 0) { setSrtLoaded('SRT 파싱 실패 — 형식을 확인하세요'); return; }
      applySegments(segments, file.name.replace(/\.srt$/i, ''));
      setSrtLoaded(`${file.name} — ${segments.length}개 로드됨`);
      setTimeout(() => setSrtLoaded(null), 3000);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* SRT 불러오기 */}
      <button
        onClick={() => srtInputRef.current?.click()}
        className="w-full py-1.5 label-caps text-[10px] border border-dashed border-cream-300 text-ink-400 hover:border-ink-500 hover:text-ink-900 transition-colors"
      >
        SRT 파일 불러오기
      </button>
      <input ref={srtInputRef} type="file" accept=".srt" className="hidden" onChange={handleSRTFile} />
      {srtLoaded && (
        <p className={`text-[10px] px-2 py-1 ${srtLoaded.includes('실패') ? 'text-red-500 bg-red-50 border border-red-200' : 'text-ink-500 bg-cream-200'}`}>
          {srtLoaded}
        </p>
      )}

      <div className="border-t border-cream-300 pt-2">
        <textarea
          ref={textareaRef}
          rows={5}
          placeholder={"가사를 한 줄씩 입력하세요\n예시: 내일 시작이야\n또 다른 날이 오면"}
          className="w-full resize-none bg-cream-100 border border-cream-300 text-ink-900 text-xs p-2 outline-none
            placeholder:text-ink-300 focus:border-ink-500 transition-colors leading-relaxed"
        />
        <button
          onClick={handleApply}
          className={`mt-1.5 w-full px-3 py-1.5 label-caps border transition-colors ${
            applied
              ? 'bg-ink-900 text-cream-100 border-ink-900'
              : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
          }`}
        >
          {applied ? '적용됨' : '적용'}
        </button>
      </div>
    </div>
  );
}

function LyricTab() {
  const [source, setSource] = useState<'type' | 'stt'>('type');
  const audioTracks       = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId = useCodaStore((s) => s.activeAudioTrackId);
  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);
  const hasSegments = (activeTrack?.whisperSegments.length ?? 0) > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── 소스 선택 탭 ──────────────────────────────────────────────────── */}
      <div className="flex border-b border-cream-300 shrink-0">
        {([
          { id: 'type', label: '✏ 직접 입력' },
          { id: 'stt',  label: '🎤 STT 인식' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSource(tab.id)}
            className={`flex-1 py-2.5 text-[10px] font-semibold tracking-wider transition-colors border-r border-cream-300 last:border-r-0
              ${source === tab.id
                ? 'bg-ink-900 text-cream-100'
                : 'text-ink-400 hover:text-ink-900'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 소스 콘텐츠 ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-cream-300">
        {source === 'type' ? <ManualLyricInput /> : <WhisperSyncPanel />}
      </div>

      {/* ── 자막 편집 — 세그먼트 있을 때만 표시 ─────────────────────────── */}
      {hasSegments ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-3 py-2 bg-cream-200 border-b border-cream-300 shrink-0 flex items-center justify-between">
            <span className="label-caps text-ink-400 text-[9px]">자막 편집</span>
            <span className="text-[9px] text-ink-300">
              {activeTrack?.whisperSegments.length ?? 0}개
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <SubtitleEditor />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-center px-4">
          <p className="text-[10px] text-ink-300">
            {source === 'type'
              ? '가사를 입력하고 적용하면\n자막 편집창이 나타납니다'
              : 'STT 인식을 실행하면\n자막 편집창이 나타납니다'}
          </p>
        </div>
      )}

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
  const previewMode    = useCodaStore((s) => s.previewMode);

  const [activeTab, setActiveTab] = useState<TabId>('GRAPHICS');
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

  return (
    <main className="flex flex-col h-screen bg-cream-100 overflow-hidden text-ink-900">

      {/* ── Header — hidden in preview mode */}
      <header className={`flex items-center justify-between px-5 py-2.5 border-b border-cream-300 shrink-0 bg-cream-100 z-10 ${previewMode ? 'hidden' : ''}`}>
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
          <SaveLoadPanel />
          <RenderPanel />
          <SettingsPanel />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Canvas column */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Scene info bar — hidden in preview mode */}
          {!previewMode && <CanvasSceneInfoBar />}

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
              <PlaylistOverlay />
              <TitleHTMLOverlay />
              <LyricHTMLOverlay />
              {!previewMode && <EQOverlayWidget />}
              <MaskDrawOverlay />
            </div>
          </div>

          {/* Title / EQ font panel — footer 위에 고정 */}
          {!previewMode && activeTab === 'PROMPT' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <TitleCustomPanel group="pr" />
            </div>
          )}
          {!previewMode && activeTab === 'GRAPHICS' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <TitleCustomPanel group="gfx" />
            </div>
          )}
          {!previewMode && activeTab === 'VFX/LOOP' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <TitleCustomPanel group="vfx" />
            </div>
          )}
          {!previewMode && activeTab === 'EQ & VFX' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <TitleCustomPanel group="eqpl" />
            </div>
          )}
          {!previewMode && activeTab === 'LYRIC' && (
            <div className="shrink-0 border-t border-cream-300 bg-cream-100">
              <LyricFontPanel />
            </div>
          )}

          {/* Bottom bar — transport + waveform + tracks */}
          <CanvasBottomBar />
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
            {activeTab === 'PROMPT'   && <PromptPanel />}
            {activeTab === 'GRAPHICS' && <GraphicsTab />}
            {activeTab === 'VFX/LOOP' && <VFXLoopTab />}
            {activeTab === 'EQ & VFX' && <EQTab />}
            {activeTab === 'LYRIC'    && <LyricTab />}
          </div>

        </aside>
      </div>

      {/* EQOverlayWidget moved into canvas container above */}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------


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
