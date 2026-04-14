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

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Phase labels — 백엔드 phase 문자열을 한국어로 변환
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<string, string> = {
  queued: '대기 중…',
  loading_model: '모델 로딩 중…',
  preprocessing: 'ffmpeg 전처리 중…',
  transcribing: '음성 인식 중…',
  done: '완료',
  error: '오류 발생',
  unknown: '상태 확인 중…',
};

// ---------------------------------------------------------------------------
// Progress bar component
// ---------------------------------------------------------------------------

function TranscribeProgress({
  jobId,
  onDone,
  onError,
}: {
  jobId: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>('queued');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 마운트 상태 추적 (cleanup 후 setState 방지)
  const mountedRef = useRef(true);
  const startRef = useRef(Date.now());

  // 경과 시간 카운터
  useEffect(() => {
    const t = setInterval(() => {
      if (mountedRef.current) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // 폴링 루프
  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    // 연속 실패 카운터 (백엔드 다운 감지)
    let consecutiveFailures = 0;
    const MAX_FAILURES = 10; // 5초간 (500ms * 10) 연속 실패하면 포기

    const poll = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/whisper/progress/${jobId}`);
        if (cancelled) return;

        if (!res.ok) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES) {
            const msg = `백엔드 응답 없음 (HTTP ${res.status}). 서버가 실행 중인지 확인하세요.`;
            setErrorMsg(msg);
            onError(msg);
            return;
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
            const msg = '백엔드가 재시작되어 작업이 유실되었습니다. 다시 시도해주세요.';
            setErrorMsg(msg);
            onError(msg);
            return;
          }
          if (!cancelled) timerId = setTimeout(poll, 500);
          return;
        }

        setProgress(p);
        setPhase(serverPhase);

        // 에러 상태
        if (data.error) {
          setErrorMsg(data.error);
          setProgress(0);
          onError(data.error);
          return;
        }

        // 완료 상태
        if (data.done) {
          setProgress(1);
          setPhase('done');
          onDone();
          return;
        }

        // 계속 폴링
        if (!cancelled) timerId = setTimeout(poll, 500);
      } catch {
        // fetch 자체 실패 (네트워크 오류 등)
        if (cancelled) return;
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_FAILURES) {
          const msg = '백엔드 연결 실패. 서버가 실행 중인지 확인하세요.';
          setErrorMsg(msg);
          onError(msg);
          return;
        }
        if (!cancelled) timerId = setTimeout(poll, 1000); // 네트워크 오류 시 1초 대기
      }
    };

    // 최초 폴링 시작 (약간의 지연 — 백엔드에 job_id가 등록될 시간 확보)
    timerId = setTimeout(poll, 300);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
    // onDone, onError는 useCallback으로 안정화되어 있으므로 의존성에 포함해도 안전
  }, [jobId, onDone, onError]);

  // 언마운트 추적
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pct = Math.round(progress * 100);
  const isLoading = phase === 'queued' || phase === 'loading_model' || phase === 'preprocessing';
  const phaseLabel = PHASE_LABELS[phase] ?? phase;

  return (
    <div className="flex flex-col gap-2">

      {/* 단계 + 경과 시간 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ink-500 label-caps">
          {errorMsg ? '오류 발생' : phaseLabel}
        </span>
        <span className="text-[10px] text-ink-400 tabular-nums">
          {isLoading ? `${elapsed}s` : errorMsg ? '' : `${pct}%`}
        </span>
      </div>

      {/* 프로그레스 바 */}
      <div className="relative w-full h-2 bg-cream-300 overflow-hidden">
        {errorMsg ? (
          /* 에러 — 빨간 바 */
          <div className="h-full bg-red-400 w-full" />
        ) : isLoading ? (
          /* 인디터미네이트 셔머 — 모델 로딩 / 전처리 중 */
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

      // 대용량 파일은 Next.js proxy를 거치지 않고 백엔드 직접 호출
      const res = await fetch('http://localhost:8000/api/whisper/transcribe', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        // 백엔드가 반환한 에러 메시지 추출
        let detail = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody.detail) detail = errBody.detail;
        } catch { /* JSON 파싱 실패 시 status code만 사용 */ }
        throw new Error(detail);
      }

      const data = await res.json();
      setWhisperSegments(
        activeTrack.id,
        data.segments ?? [],
        data.duration ?? activeTrack.durationSec,
      );
      setAudioTrackProcessing(activeTrack.id, 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
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
          페이지 새로고침 후 blob URL이 만료됐습니다.
          <br />IMAGE 탭에서 파일을 다시 업로드해주세요.
        </div>
      )}

      {/* 에러 표시 */}
      {activeTrack.processing === 'error' && activeTrack.error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-[10px] text-red-600 break-words">
          {activeTrack.error}
          <br /><span className="text-red-400">백엔드가 실행 중인지 확인하세요 (uvicorn port 8000)</span>
        </div>
      )}

      {/* 실시간 진행률 — 인식 중일 때만 */}
      {isProcessing && currentJobId && (
        <TranscribeProgress
          jobId={currentJobId}
          onDone={handleProgressDone}
          onError={handleProgressError}
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
        {isProcessing ? '인식 중…' : isDone ? '다시 인식' : 'STT 인식 시작'}
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
          {translateWarning}
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
