"""
whisper_router.py
POST /api/whisper/transcribe — 오디오 파일을 받아 Whisper로 전사합니다.
GET  /api/whisper/progress/{job_id} — 전사 진행률을 실시간으로 반환합니다.
GET  /api/whisper/vram — VRAM 사용 현황을 반환합니다.

[안정화 v2 — Opus 분석 기반 12개 이슈 수정]
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import tempfile
import threading
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional

import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/whisper", tags=["whisper"])

# 전사 작업 전용 스레드풀 (1 worker — GPU는 순차 처리)
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="whisper")

# 모델 캐시 + 락 (이중-체크 패턴으로 thread-safe)
_model_cache: Dict[str, object] = {}
_model_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Progress store — OrderedDict + LRU eviction (최대 200개, 메모리 누수 방지)
# ---------------------------------------------------------------------------

_PROGRESS_MAX = 200
_progress: OrderedDict[str, dict] = OrderedDict()
_progress_lock = threading.Lock()


def _progress_set(job_id: str, data: dict) -> None:
    with _progress_lock:
        if job_id in _progress:
            _progress.move_to_end(job_id)
        _progress[job_id] = data
        while len(_progress) > _PROGRESS_MAX:
            _progress.popitem(last=False)


def _progress_get(job_id: str) -> Optional[dict]:
    with _progress_lock:
        return _progress.get(job_id)


def _progress_update(job_id: str, **kwargs) -> None:
    with _progress_lock:
        if job_id in _progress:
            _progress[job_id].update(kwargs)
            _progress.move_to_end(job_id)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SegmentOut(BaseModel):
    id: str
    start: float
    end: float
    text: str


class TranscribeResponse(BaseModel):
    segments: List[SegmentOut]
    duration: float
    language: str
    job_id: str


class ProgressResponse(BaseModel):
    progress: float          # 0.0 ~ 1.0 (또는 -1 = job 알 수 없음)
    done: bool
    phase: str = "unknown"   # queued | loading_model | preprocessing | transcribing | done | error
    error: Optional[str] = None


class VRAMResponse(BaseModel):
    cuda_available: bool
    allocated_mb: Optional[float] = None
    reserved_mb: Optional[float] = None
    loaded_models: List[str] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _preprocess_audio(src: str, dst: str) -> None:
    """ffmpeg로 오디오를 16kHz mono PCM WAV로 변환합니다."""
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", src,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            dst,
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        if result.returncode != 0:
            err = result.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(f"ffmpeg 변환 실패: {err[-500:]}")
    except FileNotFoundError:
        raise RuntimeError(
            "ffmpeg를 찾을 수 없습니다. PATH에 ffmpeg가 설치되어 있는지 확인하세요."
        )


def _get_whisper_model(model_name: str):
    """
    Whisper 모델을 로드합니다.
    - 이중-체크 락(double-check locking)으로 thread-safe 캐시
    - CUDA OOM 시 CPU fallback
    """
    cache_key = f"whisper_{model_name}"

    # 빠른 경로: 캐시 히트
    if cache_key in _model_cache:
        return _model_cache[cache_key]

    with _model_lock:
        # 락 획득 후 재확인 (다른 스레드가 이미 로드했을 수 있음)
        if cache_key in _model_cache:
            return _model_cache[cache_key]

        import whisper  # type: ignore
        device = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            logger.info("Loading Whisper '%s' on %s ...", model_name, device)
            _model_cache[cache_key] = whisper.load_model(model_name, device=device)
        except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
            if "CUDA" in str(exc) or "out of memory" in str(exc).lower():
                logger.warning("CUDA OOM loading '%s', falling back to CPU.", model_name)
                torch.cuda.empty_cache()
                _model_cache[cache_key] = whisper.load_model(model_name, device="cpu")
            else:
                raise

    return _model_cache[cache_key]


def _run_transcribe(job_id: str, tmp_path: str, language: Optional[str], model_name: str) -> dict:
    """
    스레드풀에서 실행되는 동기 함수.

    tqdm 패치 전략 변경 (v2):
    - 전역 tqdm.tqdm 대신 whisper.transcribe 모듈의 tqdm만 로컬 패치
    - race condition 원천 차단
    - CUDA OOM이 transcribe() 중 발생해도 CPU retry
    """
    import tqdm as tqdm_module

    _progress_update(job_id, phase="loading_model")
    whisper_model = _get_whisper_model(model_name)
    _progress_update(job_id, phase="transcribing")

    # whisper 내부에서 사용하는 tqdm만 교체 (전역 오염 없음)
    try:
        import whisper.transcribe as _wt_module  # type: ignore
        _orig_wt_tqdm = getattr(_wt_module, "tqdm", tqdm_module.tqdm)
    except Exception:
        _orig_wt_tqdm = tqdm_module.tqdm
        _wt_module = None

    class _ProgressTracker:
        """tqdm duck-type: update() 호출만 훅, 나머지는 원본 위임."""
        def __init__(self, *args, **kwargs):
            self._inner = _orig_wt_tqdm(*args, **kwargs)

        def update(self, n=1):
            ret = self._inner.update(n)
            total = getattr(self._inner, "total", None)
            n_val = getattr(self._inner, "n", 0)
            if total and total > 0:
                _progress_update(job_id, progress=min(0.99, n_val / total))
            return ret

        def __enter__(self):
            self._inner.__enter__()
            return self

        def __exit__(self, *a):
            return self._inner.__exit__(*a)

        def __getattr__(self, name):
            return getattr(self._inner, name)

    # whisper.transcribe 모듈의 tqdm만 패치
    if _wt_module is not None:
        _wt_module.tqdm = _ProgressTracker  # type: ignore

    try:
        # CUDA OOM이 transcribe() 도중 발생해도 CPU로 retry
        try:
            result = whisper_model.transcribe(  # type: ignore
                tmp_path,
                language=language if language else None,
                task="transcribe",
                verbose=False,
                no_speech_threshold=0.2,       # 0.3→0.2: 앞부분 묵음 오탐 감소
                condition_on_previous_text=True,
                compression_ratio_threshold=2.4,
            )
        except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
            if "CUDA" in str(exc) or "out of memory" in str(exc).lower():
                logger.warning("CUDA OOM during transcribe for job %s — retrying on CPU.", job_id)
                torch.cuda.empty_cache()
                # CPU 모델로 재로드
                cache_key = f"whisper_{model_name}"
                with _model_lock:
                    import whisper  # type: ignore
                    _model_cache[cache_key] = whisper.load_model(model_name, device="cpu")
                whisper_model = _model_cache[cache_key]
                result = whisper_model.transcribe(  # type: ignore
                    tmp_path,
                    language=language if language else None,
                    task="transcribe",
                    verbose=False,
                )
            else:
                raise
    finally:
        # 패치 복원
        if _wt_module is not None:
            _wt_module.tqdm = _orig_wt_tqdm  # type: ignore
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    return result


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(..., description="오디오 파일 (mp3, wav, m4a, flac 등)"),
    language: Optional[str] = Form(default=None),
    model: Optional[str] = Form(default="large-v3"),
    job_id: Optional[str] = Form(default=None),
) -> TranscribeResponse:
    """
    오디오 파일을 Whisper로 전사합니다.

    변경사항 (v2):
    - asyncio.get_running_loop() 사용 (get_event_loop() deprecation 수정)
    - 30분 타임아웃 (asyncio.wait_for)
    - 파일 내용을 temp 저장 후 즉시 메모리에서 해제
    - phase 필드로 프론트엔드에 상세 상태 전달
    """
    allowed_suffixes = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm", ".mp4", ".aac", ".opus"}
    suffix = Path(file.filename or "audio.mp3").suffix.lower()
    if suffix not in allowed_suffixes:
        raise HTTPException(
            status_code=415,
            detail=f"지원하지 않는 파일 형식: '{suffix}'. 허용: {', '.join(sorted(allowed_suffixes))}",
        )

    model_name = model if model in ("tiny", "base", "large-v3") else "large-v3"
    jid = job_id or str(uuid.uuid4())
    _progress_set(jid, {"progress": 0.0, "done": False, "phase": "queued", "error": None})

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="파일이 비어 있습니다.")

    logger.info(
        "Transcribe request: file='%s', size=%d bytes, lang='%s', model='%s', job_id='%s'",
        file.filename, len(content), language, model_name, jid,
    )

    tmp_orig = None
    tmp_wav  = None
    try:
        # 1) 원본 임시 파일 저장 후 메모리 즉시 해제
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(content)
            tmp_orig = f.name
        del content  # 대용량 파일 메모리 해제

        # 2) ffmpeg 전처리용 임시 파일
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            tmp_wav = f.name

        loop = asyncio.get_running_loop()

        # 3) ffmpeg 16kHz mono WAV 변환
        _progress_update(jid, phase="preprocessing")
        try:
            await loop.run_in_executor(None, _preprocess_audio, tmp_orig, tmp_wav)
            tmp_wav_path = tmp_wav
        except Exception as exc:
            logger.warning("ffmpeg 전처리 실패 (%s), 원본 파일로 직접 시도합니다.", exc)
            tmp_wav_path = tmp_orig

        # 4) Whisper 전사 — 30분 타임아웃
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(_executor, _run_transcribe, jid, tmp_wav_path, language, model_name),
                timeout=1800.0,
            )
        except asyncio.TimeoutError:
            _progress_update(jid, done=True, phase="error", error="전사 타임아웃 (30분 초과)")
            raise HTTPException(status_code=504, detail="전사 타임아웃: 파일이 너무 크거나 모델이 응답하지 않습니다.")
        except Exception as exc:
            _progress_update(jid, done=True, phase="error", error=str(exc))
            logger.exception("Whisper 전사 실패 (job_id=%s): %s", jid, exc)
            raise HTTPException(status_code=500, detail=f"전사 실패: {exc}") from exc

    finally:
        if tmp_orig:
            Path(tmp_orig).unlink(missing_ok=True)
        if tmp_wav and tmp_wav != tmp_orig:
            Path(tmp_wav).unlink(missing_ok=True)

    # 5) 결과 가공
    detected_language: str = result.get("language", language or "unknown")
    raw_segments: list = result.get("segments", [])
    duration = float(raw_segments[-1]["end"]) if raw_segments else 0.0

    segments_out: List[SegmentOut] = [
        SegmentOut(
            id=str(uuid.uuid4()),
            start=float(seg["start"]),
            end=float(seg["end"]),
            text=seg["text"].strip(),
        )
        for seg in raw_segments
        if seg["text"].strip()
    ]

    _progress_update(jid, progress=1.0, done=True, phase="done")

    logger.info(
        "전사 완료: %d 세그먼트, duration=%.1fs, lang='%s', job_id='%s'",
        len(segments_out), duration, detected_language, jid,
    )

    return TranscribeResponse(
        segments=segments_out,
        duration=duration,
        language=detected_language,
        job_id=jid,
    )


@router.get("/progress/{job_id}", response_model=ProgressResponse)
async def get_progress(job_id: str) -> ProgressResponse:
    """
    전사 진행률을 반환합니다.
    job_id를 모를 경우 progress=-1로 응답 → 프론트엔드가 '알 수 없는 작업'으로 처리 가능.
    """
    p = _progress_get(job_id)
    if p is None:
        # 백엔드 재시작 등으로 job을 모르는 경우 — done=False, progress=-1로 구분
        return ProgressResponse(progress=-1.0, done=False, phase="unknown")
    return ProgressResponse(
        progress=p.get("progress", 0.0),
        done=p.get("done", False),
        phase=p.get("phase", "unknown"),
        error=p.get("error"),
    )


class HealthResponse(BaseModel):
    status: str                        # "ok" | "degraded" | "error"
    ffmpeg_available: bool
    ffmpeg_version: Optional[str] = None
    cuda_available: bool
    loaded_models: List[str] = []
    errors: List[str] = []


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """STT 서비스 상태 확인 — ffmpeg, CUDA, 모델 캐시를 점검합니다."""
    errors: List[str] = []
    ffmpeg_ok = False
    ffmpeg_ver = None

    # ffmpeg 확인
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, timeout=10
        )
        if result.returncode == 0:
            ffmpeg_ok = True
            first_line = result.stdout.decode("utf-8", errors="replace").split("\n")[0]
            ffmpeg_ver = first_line.strip()
        else:
            errors.append("ffmpeg가 설치되어 있지만 실행에 실패했습니다.")
    except FileNotFoundError:
        errors.append("ffmpeg를 찾을 수 없습니다. PATH에 설치되어 있는지 확인하세요.")
    except Exception as exc:
        errors.append(f"ffmpeg 확인 중 오류: {exc}")

    cuda_ok = torch.cuda.is_available()
    if not cuda_ok:
        errors.append("CUDA가 사용 불가합니다. CPU fallback으로 동작합니다.")

    loaded = list(_model_cache.keys())

    status = "ok"
    if errors and ffmpeg_ok:
        status = "degraded"
    elif not ffmpeg_ok:
        status = "error"

    return HealthResponse(
        status=status,
        ffmpeg_available=ffmpeg_ok,
        ffmpeg_version=ffmpeg_ver,
        cuda_available=cuda_ok,
        loaded_models=loaded,
        errors=errors,
    )


@router.get("/vram", response_model=VRAMResponse)
async def get_vram_stats() -> VRAMResponse:
    """현재 VRAM 사용 현황을 반환합니다."""
    loaded = list(_model_cache.keys())
    if not torch.cuda.is_available():
        return VRAMResponse(cuda_available=False, loaded_models=loaded)
    return VRAMResponse(
        cuda_available=True,
        allocated_mb=round(torch.cuda.memory_allocated() / 1024 ** 2, 2),
        reserved_mb=round(torch.cuda.memory_reserved() / 1024 ** 2, 2),
        loaded_models=loaded,
    )
