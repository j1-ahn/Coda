'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useCodaStore, WhisperSegment } from '@/store/useCodaStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function toTS(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

function parseTS(str: string): number | null {
  const trimmed = str.trim();
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

function toSRTTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${ms.toString().padStart(3, '0')}`;
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── TimeField — always MM:SS.s text, no type-switch ──────────────────────────

function TimeField({
  value,
  onChange,
  active,
}: {
  value: number;
  onChange: (v: number) => void;
  active: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(toTS(value));

  useEffect(() => {
    if (!editing) setText(toTS(value));
  }, [value, editing]);

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        const parsed = parseTS(text);
        if (parsed !== null && parsed !== value) {
          onChange(parsed);
          setText(toTS(parsed));
        } else {
          setText(toTS(value));
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(toTS(value));
          setEditing(false);
          e.currentTarget.blur();
        }
        // prevent [ ] Space from bubbling to tap handler while typing
        e.stopPropagation();
      }}
      className={`w-[58px] bg-transparent border-b font-mono text-[10px] outline-none px-0.5 py-0.5 transition-colors
        ${active ? 'border-ink-500 text-ink-900' : 'border-cream-300 text-ink-400'}
        focus:border-ink-700`}
    />
  );
}

// ── SegmentRow ────────────────────────────────────────────────────────────────

interface RowProps {
  seg: WhisperSegment;
  idx: number;
  isActive: boolean;
  isTapFocused: boolean;
  onTapFocus: () => void;
  onTextChange: (text: string) => void;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
  onRemove: () => void;
  onInsertAbove: () => void;
}

function SegmentRow({
  seg, idx, isActive, isTapFocused,
  onTapFocus, onTextChange, onStartChange, onEndChange, onRemove, onInsertAbove,
}: RowProps) {
  return (
    <div
      onClick={onTapFocus}
      onContextMenu={(e) => { e.preventDefault(); onInsertAbove(); }}
      className={`flex items-center gap-1.5 px-2 py-1 border-b border-cream-200 cursor-pointer transition-colors
        ${isActive ? 'bg-ink-900/8' : ''}
        ${isTapFocused ? 'ring-1 ring-inset ring-ink-900/30' : ''}
        hover:bg-cream-200/60`}
    >
      {/* line number */}
      <span className="label-caps text-ink-300 w-4 shrink-0 text-right select-none">
        {idx + 1}
      </span>

      {/* active dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isActive ? 'bg-ink-900' : 'bg-transparent'}`} />

      {/* text */}
      <input
        type="text"
        value={seg.text}
        onChange={(e) => onTextChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Enter lyrics..."
        className={`flex-1 min-w-0 bg-transparent outline-none text-xs py-0.5 border-b transition-colors
          ${isActive ? 'border-ink-400 text-ink-900 font-medium' : 'border-transparent text-ink-700'}
          focus:border-ink-500 placeholder:text-ink-300`}
      />

      {/* timestamps */}
      <TimeField value={seg.start} onChange={onStartChange} active={isActive} />
      <span className="text-ink-300 text-[9px] select-none">→</span>
      <TimeField value={seg.end} onChange={onEndChange} active={isActive} />

      {/* remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="w-4 h-4 shrink-0 flex items-center justify-center text-ink-300 hover:text-ink-900 transition-colors text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SubtitleEditor() {
  const {
    audioTracks,
    activeAudioTrackId,
    currentPlaybackTime,
    updateTextSegment,
    addTextSegment,
    removeTextSegment,
    setWhisperSegments,
  } = useCodaStore();

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);
  const segments: WhisperSegment[] = activeTrack?.whisperSegments ?? [];

  const [tapMode, setTapMode] = useState(false);
  const [tapIdx, setTapIdx] = useState<number>(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Index of segment currently playing
  const activeIdx = segments.findIndex(
    (seg) => currentPlaybackTime >= seg.start && currentPlaybackTime < seg.end
  );

  // Auto-scroll to active
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const row = listRef.current.children[activeIdx] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  // Sync tapIdx to playback when not manually set
  useEffect(() => {
    if (tapMode && activeIdx >= 0) setTapIdx(activeIdx);
  }, [tapMode, activeIdx]);

  // ── Key bindings ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tapMode || !activeAudioTrackId) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const idx = tapIdx;
      if (idx < 0 || idx >= segments.length) return;
      const seg = segments[idx];

      if (e.key === '[') {
        e.preventDefault();
        updateTextSegment(activeAudioTrackId, seg.id, { start: currentPlaybackTime });
        if (idx > 0) {
          updateTextSegment(activeAudioTrackId, segments[idx - 1].id, { end: currentPlaybackTime });
        }
      } else if (e.key === ']') {
        e.preventDefault();
        updateTextSegment(activeAudioTrackId, seg.id, { end: currentPlaybackTime });
        if (idx + 1 < segments.length) setTapIdx(idx + 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        updateTextSegment(activeAudioTrackId, seg.id, { start: currentPlaybackTime });
        if (idx > 0) {
          updateTextSegment(activeAudioTrackId, segments[idx - 1].id, { end: currentPlaybackTime });
        }
        setTapIdx(Math.min(idx + 1, segments.length - 1));
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [tapMode, tapIdx, segments, currentPlaybackTime, activeAudioTrackId, updateTextSegment]);

  // ── Insert above ──────────────────────────────────────────────────────────
  const handleInsertAbove = useCallback((idx: number) => {
    if (!activeAudioTrackId) return;
    const prevEnd = idx > 0 ? segments[idx - 1].end : 0;
    const nextStart = segments[idx].start;
    const mid = (prevEnd + nextStart) / 2;
    const newSeg: WhisperSegment = {
      id: `manual-${Date.now()}`,
      start: Math.max(prevEnd, mid - 1),
      end: Math.min(nextStart, mid + 1),
      text: '',
    };
    const newSegs = [...segments];
    newSegs.splice(idx, 0, newSeg);
    const dur = activeTrack?.durationSec ?? newSegs[newSegs.length - 1].end;
    setWhisperSegments(activeAudioTrackId, newSegs, dur);
  }, [activeAudioTrackId, segments, activeTrack, setWhisperSegments]);

  // ── Split ─────────────────────────────────────────────────────────────────
  const handleSplit = useCallback(() => {
    if (!activeAudioTrackId || activeIdx < 0) return;
    const seg = segments[activeIdx];
    const splitAt = currentPlaybackTime;
    if (splitAt <= seg.start || splitAt >= seg.end) return;

    const newSegs = [...segments];
    newSegs.splice(
      activeIdx,
      1,
      { ...seg, end: splitAt },
      {
        id: `split-${Date.now()}`,
        start: splitAt,
        end: seg.end,
        text: seg.text,
      }
    );
    const dur = activeTrack?.durationSec ?? newSegs[newSegs.length - 1].end;
    setWhisperSegments(activeAudioTrackId, newSegs, dur);
  }, [activeAudioTrackId, activeIdx, segments, currentPlaybackTime, activeTrack, setWhisperSegments]);

  // ── Exports ───────────────────────────────────────────────────────────────
  const handleExportSRT = useCallback(() => {
    const content = segments
      .map((seg, i) => `${i + 1}\n${toSRTTime(seg.start)} --> ${toSRTTime(seg.end)}\n${seg.text}\n`)
      .join('\n');
    const name = activeTrack?.fileName.replace(/\.[^.]+$/, '') ?? 'subtitles';
    downloadText(content, `${name}.srt`);
  }, [segments, activeTrack]);

  const handleExportJSON = useCallback(() => {
    const name = activeTrack?.fileName.replace(/\.[^.]+$/, '') ?? 'subtitles';
    downloadText(JSON.stringify(segments, null, 2), `${name}.json`);
  }, [segments, activeTrack]);

  // ── Empty states ──────────────────────────────────────────────────────────
  if (!activeTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <SubIcon className="w-7 h-7 text-ink-300" />
        <p className="label-caps text-ink-300 text-center text-[10px]">
          위 "직접 입력"에서 가사를 입력하거나<br />오디오를 업로드하세요
        </p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <p className="label-caps text-ink-300 text-center text-[10px]">
          {activeTrack.processing === 'transcribing'
            ? 'Whisper 분석 중...'
            : '세그먼트가 없습니다'}
        </p>
        <button
          onClick={() => addTextSegment(activeAudioTrackId!)}
          className="px-3 py-1 label-caps border border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900 transition-colors text-[10px]"
        >
          + 첫 줄 추가
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-cream-300 shrink-0 flex-wrap">
        <button
          onClick={() => setTapMode(!tapMode)}
          className={`px-2 py-0.5 label-caps border transition-colors text-[9px] ${
            tapMode
              ? 'bg-ink-900 text-cream-100 border-ink-900'
              : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
          }`}
        >
          {tapMode ? '● TAP ON' : '○ TAP'}
        </button>

        <button
          onClick={handleSplit}
          title="Split segment at current playback position"
          className="px-2 py-0.5 label-caps border border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900 transition-colors text-[9px]"
        >
          SPLIT
        </button>

        <div className="ml-auto flex gap-1">
          <button
            onClick={handleExportSRT}
            className="px-2 py-0.5 label-caps border border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900 transition-colors text-[9px]"
          >
            SRT ↓
          </button>
          <button
            onClick={handleExportJSON}
            className="px-2 py-0.5 label-caps border border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900 transition-colors text-[9px]"
          >
            JSON ↓
          </button>
        </div>
      </div>

      {/* Tap mode hint bar */}
      {tapMode && (
        <div className="px-3 py-1 bg-ink-900/5 border-b border-cream-300 shrink-0 flex items-center justify-between">
          <span className="label-caps text-ink-400 text-[9px]">
            <span className="text-ink-700">[ </span>= start &nbsp;
            <span className="text-ink-700">] </span>= end &nbsp;
            <span className="text-ink-700">space </span>= tap & next
          </span>
          <span className="font-mono text-[10px] text-ink-500">{toTS(currentPlaybackTime)}</span>
        </div>
      )}

      {/* Segment list */}
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
        {segments.map((seg, idx) => (
          <SegmentRow
            key={seg.id}
            seg={seg}
            idx={idx}
            isActive={idx === activeIdx}
            isTapFocused={tapMode && idx === tapIdx}
            onTapFocus={() => setTapIdx(idx)}
            onTextChange={(text) => updateTextSegment(activeAudioTrackId!, seg.id, { text })}
            onStartChange={(v) => updateTextSegment(activeAudioTrackId!, seg.id, { start: v })}
            onEndChange={(v) => updateTextSegment(activeAudioTrackId!, seg.id, { end: v })}
            onRemove={() => removeTextSegment(activeAudioTrackId!, seg.id)}
            onInsertAbove={() => handleInsertAbove(idx)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-cream-300 shrink-0">
        <button
          onClick={() => addTextSegment(activeAudioTrackId!)}
          className="label-caps text-[9px] text-ink-500 hover:text-ink-900 transition-colors"
        >
          + 추가
        </button>
        <span className="ml-auto label-caps text-[9px] text-ink-300">
          {segments.length} 라인
        </span>
      </div>

    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path strokeLinecap="round" d="M6 12h4M12 12h6M6 16h8" />
    </svg>
  );
}
