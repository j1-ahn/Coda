'use client';

/**
 * WhisperSyncPanel.tsx
 * STT 소스 패널 — 활성 오디오 트랙 표시 + Whisper 트랜스크립션 실행.
 */

import { useState, useEffect, useRef } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import { useSettingsStore } from '@/store/useSettingsStore';

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Progress bar component
// ---------------------------------------------------------------------------

function TranscribeProgress({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'transcribing'>('loading');
  const [elapsed, setElapsed] = useState(0);
  const doneRef   = useRef(false);
  const startRef  = useRef(Date.now());

  // 경과 시간 카운터
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!jobId || doneRef.current) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/whisper/progress/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        const p: number = data.progress ?? 0;
        setProgress(p);
        if (p > 0) setPhase('transcribing');
        if (data.done && !doneRef.current) {
          doneRef.current = true;
          setProgress(1);
          onDone();
          return;
        }
      } catch {
        // ignore polling errors
      }
      if (!doneRef.current) setTimeout(poll, 500);
    };

    poll();
    return () => { doneRef.current = true; };
  }, [jobId, onDone]);

  const pct = Math.round(progress * 100);

  return (
    <div className="flex flex-col gap-2">

      {/* 단계 + 경과 시간 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ink-500 label-caps">
          {phase === 'loading' ? '모델 로딩 중…' : '음성 인식 중…'}
        </span>
        <span className="text-[10px] text-ink-400 tabular-nums">
          {phase === 'loading' ? `${elapsed}s` : `${pct}%`}
        </span>
      </div>

      {/* 프로그레스 바 */}
      <div className="relative w-full h-2 bg-cream-300 overflow-hidden">
        {phase === 'loading' ? (
          /* 인디터미네이트 셔머 */
          <div
            className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-ink-600 to-transparent"
            style={{ animation: 'sttShimmer 1.4s ease-in-out infinite' }}
          />
        ) : (
          /* 실제 진행률 바 */
          <div
            className="h-full bg-ink-700 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* 파형 — 두 단계 모두 표시 */}
      <div className="flex items-center gap-0.5 h-5 justify-center">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="w-[3px] bg-ink-400 origin-bottom"
            style={{
              height: phase === 'transcribing'
                ? `${Math.max(15, Math.min(100, pct * 0.7 + Math.abs(Math.sin(i * 0.6)) * 60))}%`
                : '60%',
              animation: 'sttWave 0.9s ease-in-out infinite',
              animationDelay: `${(i * 0.045) % 0.9}s`,
            }}
          />
        ))}
      </div>

      {/* 로딩 단계 힌트 */}
      {phase === 'loading' && elapsed > 5 && (
        <p className="text-[9px] text-ink-300 text-center">
          첫 실행 시 모델 로딩에 최대 1분 소요됩니다
        </p>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WhisperSyncPanel() {
  const audioTracks        = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId = useCodaStore((s) => s.activeAudioTrackId);
  const setAudioTrackProcessing = useCodaStore((s) => s.setAudioTrackProcessing);
  const setWhisperSegments      = useCodaStore((s) => s.setWhisperSegments);

  const [isTranslating, setIsTranslating] = useState(false);
  const [translateWarning, setTranslateWarning] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('auto');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const activeTrack  = audioTracks.find((t) => t.id === activeAudioTrackId) ?? null;
  const isProcessing = activeTrack?.processing === 'transcribing';
  const isDone       = (activeTrack?.whisperSegments.length ?? 0) > 0;
  const needsReload  = !!activeTrack && !activeTrack.url;

  const handleSTT = async () => {
    if (!activeTrack?.url || isProcessing) return;

    const jobId = crypto.randomUUID();
    setCurrentJobId(jobId);
    setAudioTrackProcessing(activeTrack.id, 'transcribing');

    try {
      const blob = await fetch(activeTrack.url).then((r) => r.blob());
      const form = new FormData();
      form.append('file', blob, activeTrack.fileName);
      form.append('model', useSettingsStore.getState().whisperModel);
      form.append('job_id', jobId);
      if (language !== 'auto') form.append('language', language);
      // 대용량 파일은 Next.js proxy를 거치지 않고 백엔드 직접 호출
      const res = await fetch('http://localhost:8000/api/whisper/transcribe', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWhisperSegments(activeTrack.id, data.segments ?? [], data.duration ?? activeTrack.durationSec);
      setAudioTrackProcessing(activeTrack.id, 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오류';
      setAudioTrackProcessing(activeTrack.id, 'error', msg);
    } finally {
      setCurrentJobId(null);
    }
  };

  const handleTranslate = async () => {
    if (!activeTrack || !isDone || isTranslating) return;
    setIsTranslating(true);
    setTranslateWarning(null);
    try {
      const res = await fetch('/api/ollama/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: activeTrack.whisperSegments,
          target_language: 'Korean',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWhisperSegments(activeTrack.id, data.segments, activeTrack.durationSec);
      if (data.warning) setTranslateWarning(data.warning);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오류';
      setTranslateWarning(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  // ── 트랙 없음 ─────────────────────────────────────────────────────────────
  if (!activeTrack) {
    return (
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
        <p className="text-[11px] text-ink-400">오디오 트랙이 없습니다</p>
        <p className="text-[10px] text-ink-300">IMAGE 탭에서 오디오 파일을 업로드하세요</p>
      </div>
    );
  }

  // ── 트랙 있음 ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-4 flex flex-col gap-4">

      {/* 트랙 정보 */}
      <div className="flex items-center gap-3 py-2.5 px-3 bg-cream-200 border border-cream-300">
        <div className="w-7 h-7 flex items-center justify-center bg-ink-900 text-cream-100 shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-ink-900 font-medium truncate leading-tight">
            {activeTrack.fileName}
          </span>
          <span className="text-[10px] text-ink-300">
            {formatTime(activeTrack.durationSec)}
            {isDone && ` · ${activeTrack.whisperSegments.length}개 세그먼트`}
          </span>
        </div>
      </div>

      {/* 파일 재업로드 필요 */}
      {needsReload && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          ⚠ 페이지 새로고침 후 blob URL이 만료됐습니다.
          <br />IMAGE 탭에서 파일을 다시 업로드해주세요.
        </div>
      )}

      {/* 에러 표시 */}
      {activeTrack.processing === 'error' && activeTrack.error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-[10px] text-red-600 break-words">
          ✕ {activeTrack.error}
          <br /><span className="text-red-400">백엔드가 실행 중인지 확인하세요 (uvicorn port 8000)</span>
        </div>
      )}

      {/* 실시간 진행률 — 인식 중일 때만 */}
      {isProcessing && currentJobId && (
        <TranscribeProgress
          jobId={currentJobId}
          onDone={() => {/* handleSTT의 finally에서 처리 */}}
        />
      )}

      {/* 언어 선택 */}
      {!isProcessing && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-400 shrink-0 label-caps">언어</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 bg-cream-100 border border-cream-300 text-ink-900 text-[10px] px-2 py-1 outline-none focus:border-ink-500"
          >
            <option value="auto">자동 감지</option>
            <option value="ko">한국어 (ko)</option>
            <option value="en">영어 (en)</option>
            <option value="ja">일본어 (ja)</option>
            <option value="zh">중국어 (zh)</option>
          </select>
        </div>
      )}

      {/* STT 실행 버튼 */}
      <button
        onClick={handleSTT}
        disabled={isProcessing || needsReload}
        className={`w-full py-2.5 label-caps text-[11px] border transition-colors
          ${isProcessing || needsReload
            ? 'bg-cream-200 text-ink-300 border-cream-300 cursor-not-allowed'
            : isDone
            ? 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
            : 'bg-ink-900 text-cream-100 border-ink-900 hover:bg-ink-700'
          }`}
      >
        {isProcessing ? '인식 중…' : isDone ? '▶ 다시 인식' : '▶ STT 인식 시작'}
      </button>

      {/* 번역 버튼 — STT 완료 후만 표시 */}
      {isDone && !isProcessing && (
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className={`w-full py-2 label-caps text-[11px] border transition-colors
            ${isTranslating
              ? 'bg-cream-200 text-ink-300 border-cream-300 cursor-not-allowed'
              : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
            }`}
        >
          {isTranslating ? '번역 중…' : '한국어 번역 (Ollama)'}
        </button>
      )}

      {/* 번역 경고/오류 */}
      {translateWarning && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-[10px] text-amber-700 break-words">
          ⚠ {translateWarning}
        </div>
      )}

      {/* 모델 힌트 */}
      <p className="text-[9px] text-ink-300 text-center">
        Whisper {useSettingsStore.getState().whisperModel} ·
        설정에서 모델 변경 가능
      </p>

    </div>
  );
}
