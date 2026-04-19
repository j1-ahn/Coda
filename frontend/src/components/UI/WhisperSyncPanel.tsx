'use client';

/**
 * WhisperSyncPanel.tsx
 * STT 소스 패널 — 활성 오디오 트랙 표시 + Whisper 트랜스크립션 실행.
 *
 * 개선 사항:
 * - TranscribeProgress: 백엔드 재시작 감지, 에러 표시, 안정적 폴링
 * - onDone 콜백 useCallback으로 안정화 (무한 리렌더 방지)
 * - 폴링 cleanup 안전하게 처리 (AbortController)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { apiFetchJson, humanizeError } from '@/lib/api';

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Phase labels — 백엔드 phase 문자열을 한국어로 변환
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<string, string> = {
  queued: 'Queued…',
  loading_model: 'Loading model…',
  preprocessing: 'Preprocessing (ffmpeg)…',
  transcribing: 'Transcribing…',
  done: 'Done',
  error: 'Error',
  unknown: 'Checking status…',
};

// ---------------------------------------------------------------------------
// Progress bar component
// ---------------------------------------------------------------------------

function TranscribeProgress({
  jobId,
  audioDurationSec,
  modelName,
  onDone,
  onError,
}: {
  jobId: string;
  audioDurationSec: number;
  modelName: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [phase, setPhase] = useState<string>('queued');
  const [fakeProgress, setFakeProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const startRef = useRef(Date.now());
  const transcribeStartRef = useRef<number | null>(null);

  // 모델별 처리 시간 팩터 계산
  const estimatedSec = (() => {
    const m = modelName.toLowerCase();
    let factor = 0.25; // default: large-v3
    if (m.includes('tiny')) factor = 0.05;
    else if (m.includes('base')) factor = 0.1;
    else if (m.includes('small')) factor = 0.15;
    else if (m.includes('medium')) factor = 0.2;
    return Math.max(8, audioDurationSec * factor);
  })();

  // 경과 시간 카운터 + 시간 기반 fake progress 애니메이션
  useEffect(() => {
    const t = setInterval(() => {
      if (!mountedRef.current) return;
      const now = Date.now();
      setElapsed(Math.floor((now - startRef.current) / 1000));

      // transcribing 단계에서만 fake progress 애니메이션
      if (transcribeStartRef.current !== null) {
        const tSec = (now - transcribeStartRef.current) / 1000;
        // 점근 곡선: 0 → 90% (0.9)
        const p = 0.9 * (1 - Math.exp(-2.5 * tSec / estimatedSec));
        setFakeProgress(p);
      }
    }, 200);
    return () => clearInterval(t);
  }, [estimatedSec]);

  // 폴링 루프 — phase 감지, 에러 감지, done 감지 전용 (progress 값 사용 안 함)
  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;
    const MAX_FAILURES = 10;

    const poll = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/whisper/progress/${jobId}`);
        if (cancelled) return;

        if (!res.ok) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES) {
            const msg = `Backend not responding (HTTP ${res.status}). Check if the server is running.`;
            setErrorMsg(msg); onError(msg); return;
          }
          if (!cancelled) timerId = setTimeout(poll, 500);
          return;
        }

        consecutiveFailures = 0;
        const data = await res.json();
        if (cancelled) return;

        const p: number = data.progress ?? 0;
        const serverPhase: string = data.phase ?? 'unknown';

        // progress === -1: 백엔드가 이 job_id를 모름 (재시작됨)
        if (p < 0) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES) {
            const msg = 'Backend was restarted and the job was lost. Please try again.';
            setErrorMsg(msg); onError(msg); return;
          }
          if (!cancelled) timerId = setTimeout(poll, 500);
          return;
        }

        // phase 업데이트 — transcribing 시작 시점 기록
        setPhase((prev) => {
          if (serverPhase === 'transcribing' && prev !== 'transcribing') {
            transcribeStartRef.current = Date.now();
          }
          return serverPhase;
        });

        // 에러 상태
        if (data.error) {
          setErrorMsg(data.error); onError(data.error); return;
        }

        // 완료 — handleSTT fetch가 곧 resolve되므로 bar는 현재 위치 유지
        // (100%로 점프하지 않음, isProcessing=false로 컴포넌트가 언마운트됨)
        if (data.done) {
          onDone(); return;
        }

        if (!cancelled) timerId = setTimeout(poll, 500);
      } catch {
        if (cancelled) return;
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_FAILURES) {
          const msg = 'Backend connection failed. Check if the server is running.';
          setErrorMsg(msg); onError(msg); return;
        }
        if (!cancelled) timerId = setTimeout(poll, 1000);
      }
    };

    timerId = setTimeout(poll, 300);
    return () => { cancelled = true; if (timerId) clearTimeout(timerId); };
  }, [jobId, onDone, onError]);

  // 언마운트 추적
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const pct = Math.round(fakeProgress * 100);
  const isLoading = phase === 'queued' || phase === 'loading_model' || phase === 'preprocessing';
  const phaseLabel = PHASE_LABELS[phase] ?? phase;

  // 남은 시간 계산 (transcribing 단계)
  const remainingLabel = (() => {
    if (isLoading || errorMsg || transcribeStartRef.current === null) return null;
    const tSec = (Date.now() - transcribeStartRef.current) / 1000;
    const remaining = Math.round(estimatedSec - tSec);
    if (remaining <= 0) return 'Finishing…';
    return `~${remaining}s left`;
  })();

  return (
    <div className="flex flex-col gap-2">

      {/* 단계 + 시간 정보 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ink-500 label-caps">
          {errorMsg ? 'Error' : phaseLabel}
        </span>
        <span className="text-[10px] text-ink-400 tabular-nums">
          {errorMsg ? '' : isLoading ? `${elapsed}s` : remainingLabel ?? `${pct}%`}
        </span>
      </div>

      {/* 프로그레스 바 */}
      <div className="relative w-full h-2 bg-cream-300 overflow-hidden">
        {errorMsg ? (
          <div className="h-full bg-red-400 w-full" />
        ) : isLoading ? (
          <div
            className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-ink-600 to-transparent"
            style={{ animation: 'sttShimmer 1.4s ease-in-out infinite' }}
          />
        ) : (
          <div
            className="h-full bg-ink-700 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* 파형 — 에러가 아닐 때만 표시 */}
      {!errorMsg && (
        <div className="flex items-center gap-0.5 h-5 justify-center">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] bg-ink-400 origin-bottom"
              style={{
                height: !isLoading
                  ? `${Math.max(15, Math.min(100, pct * 0.7 + Math.abs(Math.sin(i * 0.6)) * 60))}%`
                  : '60%',
                animation: 'sttWave 0.9s ease-in-out infinite',
                animationDelay: `${(i * 0.045) % 0.9}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* 에러 메시지 표시 */}
      {errorMsg && (
        <p className="text-[9px] text-red-500 text-center break-words">
          {errorMsg}
        </p>
      )}

      {/* 로딩 단계 힌트 */}
      {!errorMsg && phase === 'loading_model' && elapsed > 5 && (
        <p className="text-[9px] text-ink-300 text-center">
          First run may take up to 1 min to load the model
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

  // activeTrack.id를 ref로 캡처 (콜백 안정성)
  const activeTrackIdRef = useRef(activeTrack?.id);
  activeTrackIdRef.current = activeTrack?.id;

  // onDone / onError를 useCallback으로 안정화 — TranscribeProgress의 useEffect가
  // 매 렌더마다 재실행되지 않도록 함
  const handleProgressDone = useCallback(() => {
    // progress 컴포넌트가 done을 감지했을 때 호출됨.
    // 실제 결과 처리는 handleSTT의 fetch 응답에서 하므로 여기선 아무것도 안 함.
  }, []);

  const handleProgressError = useCallback((msg: string) => {
    // 폴링에서 에러 감지 — 트랙 상태를 에러로 전환
    const trackId = activeTrackIdRef.current;
    if (trackId) {
      setAudioTrackProcessing(trackId, 'error', msg);
    }
    setCurrentJobId(null);
  }, [setAudioTrackProcessing]);

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

      // Bypass Next.js proxy — big audio payloads go straight to the backend.
      // apiFetchJson auto-extracts `detail` from error responses and normalizes
      // common statuses (503 model loading, 413 too large, offline, etc).
      const data = await apiFetchJson<{ segments?: unknown[]; duration?: number }>(
        '/api/whisper/transcribe',
        { method: 'POST', body: form, absolute: true },
      );
      setWhisperSegments(
        activeTrack.id,
        (data.segments as never[]) ?? [],
        data.duration ?? activeTrack.durationSec,
      );
      setAudioTrackProcessing(activeTrack.id, 'done');
    } catch (err) {
      setAudioTrackProcessing(activeTrack.id, 'error', humanizeError(err));
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
      const msg = err instanceof Error ? err.message : 'Error';
      setTranslateWarning(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  // ── 트랙 없음 ─────────────────────────────────────────────────────────────
  if (!activeTrack) {
    return (
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
        <p className="text-[11px] text-ink-400">No audio track</p>
        <p className="text-[10px] text-ink-300">Upload an audio file in the bottom bar</p>
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
            {isDone && ` · ${activeTrack.whisperSegments.length} segments`}
          </span>
        </div>
      </div>

      {/* 파일 재업로드 필요 */}
      {needsReload && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          Blob URL expired after page reload.
          <br />Please re-upload the file in the bottom bar.
        </div>
      )}

      {/* 에러 표시 */}
      {activeTrack.processing === 'error' && activeTrack.error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-[10px] text-red-600 break-words">
          {activeTrack.error}
          <br /><span className="text-red-400">Check if the backend is running (uvicorn port 8000)</span>
        </div>
      )}

      {/* 실시간 진행률 — 인식 중일 때만 */}
      {isProcessing && currentJobId && (
        <TranscribeProgress
          jobId={currentJobId}
          audioDurationSec={activeTrack.durationSec}
          modelName={useSettingsStore.getState().whisperModel}
          onDone={handleProgressDone}
          onError={handleProgressError}
        />
      )}

      {/* 언어 선택 */}
      {!isProcessing && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-400 shrink-0 label-caps">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 bg-cream-100 border border-cream-300 text-ink-900 text-[10px] px-2 py-1 outline-none focus:border-ink-500"
          >
            <option value="auto">Auto-detect</option>
            <option value="ko">Korean (ko)</option>
            <option value="en">English (en)</option>
            <option value="ja">Japanese (ja)</option>
            <option value="zh">Chinese (zh)</option>
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
        {isProcessing ? 'TRANSCRIBING…' : isDone ? 'RE-TRANSCRIBE' : 'START STT'}
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
          {isTranslating ? 'TRANSLATING…' : 'TRANSLATE TO KOREAN (Ollama)'}
        </button>
      )}

      {/* 번역 경고/오류 */}
      {translateWarning && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-[10px] text-amber-700 break-words">
          {translateWarning}
        </div>
      )}

      {/* 모델 힌트 */}
      <p className="text-[9px] text-ink-300 text-center">
        Whisper {useSettingsStore.getState().whisperModel} ·
        Change model in Settings
      </p>

    </div>
  );
}
