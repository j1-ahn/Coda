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
 */

export interface CompositeRenderOptions {
  /** 출력 해상도 (컨테이너 CSS 크기 기준) */
  width: number;
  height: number;
  /** 초당 프레임 수 */
  fps?: number;
  /** 녹화 길이(초). 0이면 stopRender() 호출 전까지 무한 녹화 */
  durationSec?: number;
  /** 오디오 src URL (object URL) — null이면 무음 */
  audioSrc?: string | null;
  /** 진행률 콜백 0–1 */
  onProgress?: (progress: number) => void;
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
    onProgress,
  } = opts;

  let stopped = false;
  let resolveBlob: (b: Blob | null) => void = () => {};
  const promise = new Promise<Blob | null>((res) => { resolveBlob = res; });

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
    // captureStream은 OffscreenCanvas에서 지원되지 않으므로
    // 일반 canvas를 중간 단계로 사용한다.
    const bridge = document.createElement('canvas');
    bridge.width = width;
    bridge.height = height;
    const bridgeCtx = bridge.getContext('2d')!;

    const videoStream = (bridge as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(fps);

    // ── 4. 오디오 스트림 ────────────────────────────────────────────────
    const audioTracks: MediaStreamTrack[] = [];
    let audioEl: HTMLAudioElement | null = null;
    let audioCtx: AudioContext | null = null;
    let audioDestNode: MediaStreamAudioDestinationNode | null = null;

    if (audioSrc) {
      audioCtx = new AudioContext();
      audioDestNode = audioCtx.createMediaStreamDestination();
      audioEl = new Audio(audioSrc);
      audioEl.currentTime = 0;
      const srcNode = audioCtx.createMediaElementSource(audioEl);
      srcNode.connect(audioDestNode);
      srcNode.connect(audioCtx.destination); // 스피커 모니터링도 유지
      audioTracks.push(...audioDestNode.stream.getAudioTracks());
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

    // ── 6. 오디오 재생 ─────────────────────────────────────────────────
    if (audioEl) {
      await audioEl.play().catch(() => {});
    }

    // ── 7. RAF 합성 루프 ────────────────────────────────────────────────
    const startTime = performance.now();
    const totalMs = durationSec > 0 ? durationSec * 1000 : Infinity;

    const drawFrame = () => {
      if (stopped) {
        finish();
        return;
      }

      const elapsed = performance.now() - startTime;
      if (elapsed >= totalMs) {
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
      if (onProgress && durationSec > 0) {
        onProgress(Math.min(elapsed / totalMs, 1));
      }

      requestAnimationFrame(drawFrame);
    };

    const finish = () => {
      if (audioEl) { audioEl.pause(); audioEl.src = ''; }
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
