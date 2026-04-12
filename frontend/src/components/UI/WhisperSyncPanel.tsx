'use client';

import { useCodaStore } from '@/store/useCodaStore';
import type { TextTrack, CodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// SliderRow — 재사용 슬라이더
// ---------------------------------------------------------------------------

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-ink-500 w-[40px] shrink-0 tabular-nums">{value.toFixed(2)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-ink-900
          [&::-webkit-slider-thumb]:cursor-pointer
          focus:outline-none"
        style={{
          background: `linear-gradient(to right, #1a1a16 0%, #1a1a16 ${pct}%, #d4cfc6 ${pct}%, #d4cfc6 100%)`,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhisperSyncPanel
// ---------------------------------------------------------------------------

const COLOR_OPTIONS: { label: string; value: string }[] = [
  { label: 'WHITE', value: '#ffffff' },
  { label: 'CREAM', value: '#f5f0e8' },
  { label: 'BLACK', value: '#1a1a16' },
];

const POSITION_OPTIONS: { label: string; value: CodaStore['lyricPosition'] }[] = [
  { label: 'BTM',   value: 'bottom'       },
  { label: 'CTR',   value: 'center'       },
  { label: 'R·C',   value: 'right-center' },
];

export default function WhisperSyncPanel() {
  const audioTracks        = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId = useCodaStore((s) => s.activeAudioTrackId);
  const scenes             = useCodaStore((s) => s.scenes);
  const activeSceneId      = useCodaStore((s) => s.activeSceneId);
  const lyricPosition      = useCodaStore((s) => s.lyricPosition);
  const lyricSize          = useCodaStore((s) => s.lyricSize);
  const setLyricPosition   = useCodaStore((s) => s.setLyricPosition);
  const setLyricSize       = useCodaStore((s) => s.setLyricSize);

  const addTextTrack           = useCodaStore((s) => s.addTextTrack);
  const updateTextTrackSegments = useCodaStore((s) => s.updateTextTrackSegments);
  const updateTextTrackStyle    = useCodaStore((s) => s.updateTextTrackStyle);

  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId) ?? null;
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;

  // 현재 씬의 첫 번째 lyric TextTrack (없으면 null)
  const lyricTrack = activeScene?.textTracks.find((t) => t.type === 'lyric') ?? null;
  const style = lyricTrack?.style ?? {
    fontSize: 0.07,
    color: '#ffffff',
    position: 'bottom' as const,
    fontFamily: 'sans-serif',
  };

  // ── 동기화 버튼 핸들러 ──────────────────────────────────────────────────
  const handleSync = () => {
    if (!activeSceneId || !activeTrack) return;

    let trackId = lyricTrack?.id ?? null;

    // lyric 트랙이 없으면 새로 생성
    if (!trackId) {
      addTextTrack(activeSceneId, 'lyric');
      // 방금 추가된 트랙 찾기 (마지막 lyric)
      const updatedScene = useCodaStore
        .getState()
        .scenes.find((s) => s.id === activeSceneId);
      const newTrack = updatedScene?.textTracks
        .filter((t) => t.type === 'lyric')
        .at(-1);
      trackId = newTrack?.id ?? null;
    }

    if (!trackId) return;
    updateTextTrackSegments(activeSceneId, trackId, activeTrack.whisperSegments);
  };

  // ── 스타일 업데이트 헬퍼 ────────────────────────────────────────────────
  const updateStyle = (partial: Partial<TextTrack['style']>) => {
    if (!activeSceneId || !lyricTrack) return;
    updateTextTrackStyle(activeSceneId, lyricTrack.id, partial);
  };

  const hasSegments = (activeTrack?.whisperSegments.length ?? 0) > 0;
  const isSynced    = !!lyricTrack && lyricTrack.segments.length > 0;

  return (
    <div className="flex flex-col gap-0 divide-y divide-cream-300">

      {/* ── 활성 트랙 정보 ───────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 flex flex-col gap-1">
        <span className="label-caps text-ink-300">활성 트랙</span>
        <span className="text-xs text-ink-900 truncate leading-tight">
          {activeTrack ? activeTrack.fileName : (
            <span className="text-ink-300 italic">트랙 없음</span>
          )}
        </span>
        {activeTrack && (
          <span className="text-[10px] text-ink-300">
            {activeTrack.whisperSegments.length}개 세그먼트
            {activeTrack.processing !== 'idle' && activeTrack.processing !== 'done' && (
              <span className="ml-1 text-ink-500 animate-pulse">
                · {activeTrack.processing}
              </span>
            )}
          </span>
        )}
      </div>

      {/* ── 동기화 버튼 ─────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 flex flex-col gap-2">
        <button
          onClick={handleSync}
          disabled={!hasSegments || !activeSceneId}
          className="w-full py-2 label-caps bg-ink-900 text-cream-100
            hover:bg-ink-700 transition-colors rounded-none
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSynced ? '▶ 캔버스에 재동기화' : '▶ 캔버스에 동기화'}
        </button>
        {isSynced && (
          <span className="text-[10px] text-ink-300 text-center">
            {lyricTrack?.segments.length}개 세그먼트 동기화됨
          </span>
        )}
        {!hasSegments && activeTrack && (
          <span className="text-[10px] text-ink-300 text-center">
            Whisper 트랜스크립션이 필요합니다
          </span>
        )}
      </div>

      {/* ── STYLE ───────────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 flex flex-col gap-3">
        <span className="label-caps">Style</span>

        {/* Position */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-ink-500">Position</span>
          <div className="flex gap-0">
            {POSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLyricPosition(opt.value)}
                className={`flex-1 py-1.5 text-[10px] tracking-wider uppercase border rounded-none transition-colors
                  ${lyricPosition === opt.value
                    ? 'bg-ink-900 text-cream-100 border-ink-900'
                    : 'bg-transparent text-ink-500 border-cream-300 hover:text-ink-900 hover:border-ink-500'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-ink-500">Color</span>
          <div className="flex gap-3">
            {COLOR_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-1.5 cursor-pointer text-[10px] uppercase tracking-wider
                  ${lyricTrack ? 'text-ink-700' : 'text-ink-300 pointer-events-none'}`}
              >
                <span
                  className={`w-3 h-3 border shrink-0 transition-all
                    ${style.color === opt.value
                      ? 'border-ink-900 bg-ink-900'
                      : 'border-cream-400 bg-transparent'
                    }`}
                  style={
                    style.color === opt.value
                      ? { backgroundColor: opt.value, borderColor: '#1a1a16' }
                      : { backgroundColor: opt.value, borderColor: '#c4bfb6' }
                  }
                  onClick={() => updateStyle({ color: opt.value })}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Size */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-ink-500">Size</span>
          <div className="flex gap-0">
            {(['S', 'M', 'L'] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => setLyricSize(sz)}
                className={`flex-1 py-1.5 text-[10px] tracking-wider border rounded-none transition-colors
                  ${lyricSize === sz
                    ? 'bg-ink-900 text-cream-100 border-ink-900'
                    : 'bg-transparent text-ink-500 border-cream-300 hover:text-ink-900 hover:border-ink-500'
                  }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
