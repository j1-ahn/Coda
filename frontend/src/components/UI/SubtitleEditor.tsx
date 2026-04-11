'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useCodaStore, WhisperSegment } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** seconds → "MM:SS.s" */
function toTimestamp(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SubtitleEditor() {
  const {
    audioTracks,
    activeAudioTrackId,
    currentPlaybackTime,
    updateTextSegment,
    addTextSegment,
    removeTextSegment,
  } = useCodaStore();

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);
  const segments: WhisperSegment[] = activeTrack?.whisperSegments ?? [];

  // Ref for the scrollable list
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently active segment index
  const activeIdx = segments.findIndex(
    (seg) => currentPlaybackTime >= seg.start && currentPlaybackTime < seg.end
  );

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const row = listRef.current.children[activeIdx] as HTMLElement | undefined;
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIdx]);

  // ── Segment handlers ─────────────────────────────────────────────────────

  const handleTextChange = useCallback(
    (segId: string, text: string) => {
      if (!activeAudioTrackId) return;
      updateTextSegment(activeAudioTrackId, segId, { text });
    },
    [activeAudioTrackId, updateTextSegment]
  );

  const handleTimeChange = useCallback(
    (segId: string, field: 'start' | 'end', value: string) => {
      if (!activeAudioTrackId) return;
      const num = parseFloat(value);
      if (isNaN(num)) return;
      updateTextSegment(activeAudioTrackId, segId, { [field]: num });
    },
    [activeAudioTrackId, updateTextSegment]
  );

  const handleAdd = useCallback(() => {
    if (!activeAudioTrackId) return;
    addTextSegment(activeAudioTrackId);
  }, [activeAudioTrackId, addTextSegment]);

  const handleRemove = useCallback(
    (segId: string) => {
      if (!activeAudioTrackId) return;
      removeTextSegment(activeAudioTrackId, segId);
    },
    [activeAudioTrackId, removeTextSegment]
  );

  const handleExport = useCallback(() => {
    const filename = activeTrack
      ? `${activeTrack.fileName.replace(/\.[^.]+$/, '')}_subtitles.json`
      : 'subtitles.json';
    downloadJSON(segments, filename);
  }, [activeTrack, segments]);

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!activeTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <SubtitleIcon className="w-8 h-8 text-zinc-700" />
        <p className="text-[11px] text-zinc-600 text-center">
          오디오 트랙을 선택하면<br />자막 세그먼트가 표시됩니다
        </p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col h-full p-3 gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>{activeTrack.fileName}</SectionLabel>
          <span className="text-[10px] text-zinc-600">세그먼트 없음</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          {activeTrack.processing === 'idle' && (
            <p className="text-[11px] text-zinc-600 text-center">
              업로드 패널에서 "자막 분석"을 눌러주세요
            </p>
          )}
          {activeTrack.processing === 'transcribing' && (
            <p className="text-[11px] text-amber-400/70 text-center animate-pulse">
              Whisper 분석 중...
            </p>
          )}
        </div>
        <BottomControls onAdd={handleAdd} onExport={handleExport} />
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full p-3 gap-2 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <SectionLabel>{activeTrack.fileName}</SectionLabel>
        <span className="text-[10px] text-zinc-600">{segments.length} 세그먼트</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[80px_80px_1fr_24px] gap-1.5 px-1 shrink-0">
        <span className="text-[9px] text-zinc-700 uppercase tracking-wider">시작</span>
        <span className="text-[9px] text-zinc-700 uppercase tracking-wider">끝</span>
        <span className="text-[9px] text-zinc-700 uppercase tracking-wider">텍스트</span>
        <span />
      </div>

      {/* Segment list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0 pr-0.5"
      >
        {segments.map((seg, idx) => (
          <SegmentRow
            key={seg.id}
            seg={seg}
            isActive={idx === activeIdx}
            onTextChange={(text) => handleTextChange(seg.id, text)}
            onStartChange={(v) => handleTimeChange(seg.id, 'start', v)}
            onEndChange={(v) => handleTimeChange(seg.id, 'end', v)}
            onRemove={() => handleRemove(seg.id)}
          />
        ))}
      </div>

      {/* Bottom controls */}
      <BottomControls onAdd={handleAdd} onExport={handleExport} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentRow
// ---------------------------------------------------------------------------

interface SegmentRowProps {
  seg: WhisperSegment;
  isActive: boolean;
  onTextChange: (text: string) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onRemove: () => void;
}

function SegmentRow({ seg, isActive, onTextChange, onStartChange, onEndChange, onRemove }: SegmentRowProps) {
  return (
    <div
      className={`
        grid grid-cols-[80px_80px_1fr_24px] gap-1.5 items-center px-1 py-1 rounded transition-colors
        ${isActive ? 'bg-amber-400/20 border border-amber-400/30' : 'border border-transparent hover:bg-zinc-800/40'}
      `}
    >
      {/* Start time */}
      <TimeInput
        value={seg.start}
        onChange={onStartChange}
        isActive={isActive}
      />

      {/* End time */}
      <TimeInput
        value={seg.end}
        onChange={onEndChange}
        isActive={isActive}
      />

      {/* Text */}
      <input
        type="text"
        value={seg.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="텍스트 입력..."
        className={`
          w-full bg-transparent border rounded px-1.5 py-0.5 text-[11px] outline-none transition-colors
          ${isActive
            ? 'border-amber-400/40 text-amber-100 placeholder-amber-400/30 focus:border-amber-400'
            : 'border-zinc-700 text-zinc-300 placeholder-zinc-700 focus:border-zinc-500'
          }
        `}
      />

      {/* Remove */}
      <button
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center rounded text-zinc-700 hover:text-red-400 hover:bg-red-900/20 transition-colors text-base leading-none"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimeInput — shows formatted timestamp, edit as number on focus
// ---------------------------------------------------------------------------

function TimeInput({
  value,
  onChange,
  isActive,
}: {
  value: number;
  onChange: (v: string) => void;
  isActive: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.type = 'number';
      inputRef.current.value = value.toFixed(1);
      inputRef.current.select();
    }
  };

  const handleBlur = () => {
    if (inputRef.current) {
      onChange(inputRef.current.value);
      inputRef.current.type = 'text';
      inputRef.current.value = toTimestamp(parseFloat(inputRef.current.value) || value);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={toTimestamp(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`
        w-full bg-transparent border rounded px-1.5 py-0.5 text-[10px] font-mono outline-none transition-colors
        ${isActive
          ? 'border-amber-400/40 text-amber-300 focus:border-amber-400'
          : 'border-zinc-800 text-zinc-500 focus:border-zinc-600'
        }
      `}
    />
  );
}

// ---------------------------------------------------------------------------
// BottomControls
// ---------------------------------------------------------------------------

function BottomControls({ onAdd, onExport }: { onAdd: () => void; onExport: () => void }) {
  return (
    <div className="flex items-center gap-2 shrink-0 pt-1 border-t border-zinc-800">
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
      >
        <span className="text-base leading-none">+</span>
        세그먼트 추가
      </button>
      <button
        onClick={onExport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700 text-[11px] text-zinc-400 hover:border-amber-400/50 hover:text-amber-400 transition-colors ml-auto"
      >
        <ExportIcon className="w-3 h-3" />
        JSON 내보내기
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc UI
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase truncate max-w-[160px]">
      {children}
    </p>
  );
}

function SubtitleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path strokeLinecap="round" d="M6 12h4M12 12h6M6 16h8" />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
