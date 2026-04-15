'use client';

/**
 * STTSubtitleTab — v2 "STT & Subtitle" 탭
 *
 * Whisper 가사 동기화, 자막 스타일/타이밍 편집.
 * 기존 LyricTab 로직 그대로 이동 (ManualLyricInput + WhisperSyncPanel + SubtitleEditor).
 */

import { useState, useRef } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import WhisperSyncPanel from '@/components/UI/WhisperSyncPanel';
import SubtitleEditor from '@/components/UI/SubtitleEditor';

// ---------------------------------------------------------------------------
// SRT Parser (page.tsx에서 이동)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ManualLyricInput (page.tsx에서 이동)
// ---------------------------------------------------------------------------

function ManualLyricInput() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [applied, setApplied] = useState(false);
  const [srtLoaded, setSrtLoaded] = useState<string | null>(null);

  const { addAudioTrack, setActiveAudioTrack, setWhisperSegments, audioTracks } = useCodaStore();

  const applySegments = (segments: { id: string; start: number; end: number; text: string }[], label: string) => {
    let trackId = audioTracks.find((t) => t.fileName === label)?.id
                ?? audioTracks.find((t) => t.fileName === '\uC9C1\uC811 \uC785\uB825')?.id;
    if (!trackId) trackId = addAudioTrack(label, '');
    else useCodaStore.getState().audioTracks.find(t => t.id === trackId) && void 0;
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
    applySegments(segments, '\uC9C1\uC811 \uC785\uB825');
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
      if (segments.length === 0) { setSrtLoaded('SRT \uD30C\uC2F1 \uC2E4\uD328 \u2014 \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC138\uC694'); return; }
      applySegments(segments, file.name.replace(/\.srt$/i, ''));
      setSrtLoaded(`${file.name} \u2014 ${segments.length}\uAC1C \uB85C\uB4DC\uB428`);
      setTimeout(() => setSrtLoaded(null), 3000);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <button
        onClick={() => srtInputRef.current?.click()}
        className="w-full py-1.5 label-caps text-[10px] border border-dashed border-cream-300 text-ink-400 hover:border-ink-500 hover:text-ink-900 transition-colors"
      >
        SRT \uD30C\uC77C \uBD88\uB7EC\uC624\uAE30
      </button>
      <input ref={srtInputRef} type="file" accept=".srt" className="hidden" onChange={handleSRTFile} />
      {srtLoaded && (
        <p className={`text-[10px] px-2 py-1 ${srtLoaded.includes('\uC2E4\uD328') ? 'text-red-500 bg-red-50 border border-red-200' : 'text-ink-500 bg-cream-200'}`}>
          {srtLoaded}
        </p>
      )}

      <div className="border-t border-cream-300 pt-2">
        <textarea
          ref={textareaRef}
          rows={5}
          placeholder={"\uAC00\uC0AC\uB97C \uD55C \uC904\uC529 \uC785\uB825\uD558\uC138\uC694\n\uC608\uC2DC: \uB0B4\uC77C \uC2DC\uC791\uC774\uC57C\n\uB610 \uB2E4\uB978 \uB0A0\uC774 \uC624\uBA74"}
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
          {applied ? '\uC801\uC6A9\uB428' : '\uC801\uC6A9'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STTSubtitleTab
// ---------------------------------------------------------------------------

export default function STTSubtitleTab() {
  const [source, setSource] = useState<'type' | 'stt'>('type');
  const audioTracks       = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId = useCodaStore((s) => s.activeAudioTrackId);
  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId);
  const hasSegments = (activeTrack?.whisperSegments.length ?? 0) > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Source toggle */}
      <div className="flex border-b border-cream-300 shrink-0">
        {([
          { id: 'type', label: '\u270F \uC9C1\uC811 \uC785\uB825' },
          { id: 'stt',  label: '\uD83C\uDFA4 STT \uC778\uC2DD' },
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

      {/* Source content */}
      <div className="shrink-0 border-b border-cream-300">
        {source === 'type' ? <ManualLyricInput /> : <WhisperSyncPanel />}
      </div>

      {/* Subtitle editor */}
      {hasSegments ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-3 py-2 bg-cream-200 border-b border-cream-300 shrink-0 flex items-center justify-between">
            <span className="label-caps text-ink-400 text-[9px]">\uC790\uB9C9 \uD3B8\uC9D1</span>
            <span className="text-[9px] text-ink-300">
              {activeTrack?.whisperSegments.length ?? 0}\uAC1C
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
              ? '\uAC00\uC0AC\uB97C \uC785\uB825\uD558\uACE0 \uC801\uC6A9\uD558\uBA74\n\uC790\uB9C9 \uD3B8\uC9D1\uCC3D\uC774 \uB098\uD0C0\uB0A9\uB2C8\uB2E4'
              : 'STT \uC778\uC2DD\uC744 \uC2E4\uD589\uD558\uBA74\n\uC790\uB9C9 \uD3B8\uC9D1\uCC3D\uC774 \uB098\uD0C0\uB0A9\uB2C8\uB2E4'}
          </p>
        </div>
      )}
    </div>
  );
}
