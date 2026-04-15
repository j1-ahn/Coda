/**
 * compositeRenderer.ts
 *
 * studio-canvas-container 안의 canvas들을 OffscreenCanvas로 합성,
 * MediaRecorder로 실시간 녹화해 WebM Blob을 반환한다.
 *
 *   ┌─────────────────────────────┐
 *   │  #studio-canvas-container   │
 *   │  ├─ canvas[0]  Three.js WebGL│  ← Pass 1–3 + VFX
 *   │  └─ canvas[1]  EQCanvasLayer│  ← 투명 2D 오버레이
 *   └─────────────────────────────┘
 *           ↓  합성 (OffscreenCanvas)
 *   MediaRecorder(video stream) + AudioContext(audio stream)
 *           ↓
 *       WebM Blob
 *
 * v2: 플레이리스트 연속 렌더 지원
 *   - audioPlaylist: 여러 트랙을 순서대로 재생하며 녹화
 *   - 기존 단일 audioSrc도 호환 유지
 */

export interface PlaylistTrack {
  /** 오디오 src URL (object URL 또는 파일 URL) */
  src: string;
  /** 트랙 길이(초) — 0이면 오디오 자연 종료까지 */
  durationSec: number;
  /** 트랙 제목 (진행률 콜백용) */
  title?: string;
}

export interface CompositeRenderOptions {
  /** 출력 해상도 (컨테이너 CSS 크기 기준) */
  width: number;
  height: number;
  /** 초당 프레임 수 */
  fps?: number;
  /** 녹화 길이(초). 0이면 stopRender() 호출 전까지 무한 녹화 */
  durationSec?: number;
  /** 오디오 src URL (object URL) — null이면 무음 (단일 트랙 모드) */
  audioSrc?: string | null;
  /** 플레이리스트 연속 렌더 — audioSrc보다 우선 */
  audioPlaylist?: PlaylistTrack[];
  /** 진행률 콜백 0–1 */
  onProgress?: (progress: number) => void;
  /** 트랙 전환 콜백 (플레이리스트 모드) */
  onTrackChange?: (trackIndex: number, track: PlaylistTrack) => void;
}

export interface CompositeRenderHandle {
  /** 녹화를 중단하고 지금까지 녹화된 Blob을 반환 */
  stop: () => void;
}

/**
 * 렌더링을 시작한다.
 *
 * @returns [handle, promise]
 *   - handle.stop() — 조기 종료
 *   - promise       — 완료 시 Blob 반환 (cancel 시 null)
 */
export function startCompositeRender(
  container: HTMLElement,
  opts: CompositeRenderOptions
): [CompositeRenderHandle, Promise<Blob | null>] {
  const {
    width,
    height,
    fps = 30,
    durationSec = 0,
    audioSrc = null,
    audioPlaylist,
    onProgress,
    onTrackChange,
  } = opts;

  let stopped = false;
  let resolveBlob: (b: Blob | null) => void = () => {};
  const promise = new Promise<Blob | null>((res) => { resolveBlob = res; });

  // 플레이리스트 모드: audioPlaylist 우선, 없으면 단일 트랙 변환
  const playlist: PlaylistTrack[] = audioPlaylist && audioPlaylist.length > 0
    ? audioPlaylist
    : audioSrc
      ? [{ src: audioSrc, durationSec: durationSec || 0 }]
      : [];

  // totalDuration: durationSec===0 트랙은 알 수 없으므로 Infinity로 취급
  const hasUnknownDuration = playlist.some((t) => t.durationSec <= 0);
  const totalDuration = playlist.length > 0
    ? hasUnknownDuration
      ? 0  // 0 = unknown → totalMs will be Infinity
      : playlist.reduce((sum, t) => sum + t.durationSec, 0)
    : durationSec;

  (async () => {
    // ── 1. 컨테이너에서 canvas 목록 수집 ──────────────────────────────
    const canvases = Array.from(container.querySelectorAll('canvas')) as HTMLCanvasElement[];
    if (canvases.length === 0) {
      console.warn('[compositeRenderer] canvas not found in container');
      resolveBlob(null);
      return;
    }

    // ── 2. 합성용 OffscreenCanvas ──────────────────────────────────────
    const composite = new OffscreenCanvas(width, height);
    const ctx = composite.getContext('2d')!;

    // ── 3. 비디오 스트림 ────────────────────────────────────────────────
    const bridge = document.createElement('canvas');
    bridge.width = width;
    bridge.height = height;
    const bridgeCtx = bridge.getContext('2d')!;

    const videoStream = (bridge as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(fps);

    // ── 4. 오디오 스트림 셋업 ──────────────────────────────────────────
    let audioCtx: AudioContext | null = null;
    let audioDestNode: MediaStreamAudioDestinationNode | null = null;
    let currentAudioEl: HTMLAudioElement | null = null;
    let currentSrcNode: MediaElementAudioSourceNode | null = null;
    const audioTracks: MediaStreamTrack[] = [];

    if (playlist.length > 0) {
      audioCtx = new AudioContext();
      audioDestNode = audioCtx.createMediaStreamDestination();
      audioTracks.push(...audioDestNode.stream.getAudioTracks());
    }

    // 트랙이 자연 종료되었는지 추적 (durationSec===0 트랙용)
    let trackEndedNaturally = false;

    // 트랙 재생 함수 (플레이리스트 순회용)
    async function playTrack(track: PlaylistTrack): Promise<void> {
      if (!audioCtx || !audioDestNode) return;

      // 이전 소스 정리
      if (currentSrcNode) {
        currentSrcNode.disconnect();
      }
      if (currentAudioEl) {
        currentAudioEl.onended = null;
        currentAudioEl.pause();
        currentAudioEl.src = '';
      }

      trackEndedNaturally = false;

      currentAudioEl = new Audio(track.src);
      currentAudioEl.currentTime = 0;
      currentAudioEl.onended = () => { trackEndedNaturally = true; };
      currentSrcNode = audioCtx.createMediaElementSource(currentAudioEl);
      currentSrcNode.connect(audioDestNode);
      currentSrcNode.connect(audioCtx.destination); // 스피커 모니터링 유지

      await currentAudioEl.play().catch(() => {});
    }

    // ── 5. MediaRecorder 설정 ──────────────────────────────────────────
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioTracks,
    ]);

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolveBlob(blob);
    };

    recorder.start(200); // 200ms 단위로 chunk 수집

    // ── 6. 플레이리스트 순차 재생 ─────────────────────────────────────
    let currentTrackIdx = 0;
    let trackStartTime = performance.now();

    if (playlist.length > 0) {
      onTrackChange?.(0, playlist[0]);
      await playTrack(playlist[0]);
    }

    // ── 7. RAF 합성 루프 ────────────────────────────────────────────────
    const renderStartTime = performance.now();
    const totalMs = totalDuration > 0 ? totalDuration * 1000 : Infinity;

    const drawFrame = async () => {
      if (stopped) {
        finish();
        return;
      }

      const elapsed = performance.now() - renderStartTime;

      // 전체 종료 체크
      if (totalMs !== Infinity && elapsed >= totalMs) {
        finish();
        return;
      }

      // 플레이리스트 트랙 전환 체크
      if (playlist.length > 0 && currentTrackIdx < playlist.length) {
        const trackElapsed = performance.now() - trackStartTime;
        const trackDurMs = playlist[currentTrackIdx].durationSec * 1000;

        // 트랙 종료 조건: 명시적 duration 초과 OR 오디오 자연 종료
        const shouldAdvance =
          trackEndedNaturally || (trackDurMs > 0 && trackElapsed >= trackDurMs);

        if (shouldAdvance) {
          currentTrackIdx++;
          if (currentTrackIdx >= playlist.length) {
            // 모든 트랙 완료
            finish();
            return;
          }
          trackStartTime = performance.now();
          onTrackChange?.(currentTrackIdx, playlist[currentTrackIdx]);
          await playTrack(playlist[currentTrackIdx]);
        }
      }

      // 단일 트랙(playlist.length===1)이 자연 종료된 경우
      if (playlist.length === 1 && trackEndedNaturally && totalMs === Infinity) {
        finish();
        return;
      }

      // 합성
      ctx.clearRect(0, 0, width, height);
      for (const canvas of canvases) {
        try {
          ctx.drawImage(canvas, 0, 0, width, height);
        } catch {
          // WebGL canvas가 아직 준비 안 됐을 때 무시
        }
      }

      // bridge canvas로 복사 (captureStream을 위해)
      bridgeCtx.drawImage(composite, 0, 0);

      // 진행률 콜백
      if (onProgress) {
        if (totalMs !== Infinity) {
          onProgress(Math.min(elapsed / totalMs, 1));
        } else if (playlist.length > 0) {
          // unknown duration: 트랙 인덱스 기반 대략적 진행률
          onProgress(currentTrackIdx / playlist.length);
        }
      }

      requestAnimationFrame(drawFrame);
    };

    const finish = () => {
      if (currentAudioEl) { currentAudioEl.pause(); currentAudioEl.src = ''; }
      if (audioCtx) audioCtx.close();
      recorder.stop();
    };

    requestAnimationFrame(drawFrame);
  })();

  const handle: CompositeRenderHandle = {
    stop: () => { stopped = true; },
  };

  return [handle, promise];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

/** WebM Blob을 다운로드 링크로 열기 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
