"""
whisper_router.py
POST /api/whisper/transcribe — 오디오 파일을 받아 Whisper로 전사합니다.
GET  /api/whisper/progress/{job_id} — 전사 진행률을 실시간으로 반환합니다.
GET  /api/whisper/vram — VRAM 사용 현황을 반환합니다.
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import tempfile
import threading
import uuid
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

# tqdm 패치 락 (동시 요청 시 race condition 방지)
_tqdm_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Progress store  { job_id: {"progress": 0.0~1.0, "done": bool, "error": str|None} }
# ---------------------------------------------------------------------------

_progress: Dict[str, dict] = {}


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
    progress: float          # 0.0 ~ 1.0
    done: bool
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
    """ffmpeg로 오디오를 16kHz mono PCM WAV로 변환합니다. Whisper 입력 안정화."""
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


def _get_whisper_model(model_name: str):
    """Whisper 모델을 로드합니다. 캐시 우선, CUDA OOM 시 CPU fallback."""
    # 모델별 캐시 키 사용
    cache_key = f"whisper_{model_name}"
    if cache_key not in _model_cache:
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


_model_cache: Dict[str, object] = {}


def _run_transcribe(job_id: str, tmp_path: str, language: Optional[str], model_name: str) -> dict:
    """
    스레드풀에서 실행되는 동기 함수.
    tqdm을 로컬로 패치하고 전사 후 복원합니다.
    """
    import tqdm as tqdm_module

    whisper_model = _get_whisper_model(model_name)

    # tqdm 패치 (락으로 보호)
    with _tqdm_lock:
        original_tqdm = tqdm_module.tqdm

        class TrackingTqdm(tqdm_module.tqdm):  # type: ignore
            def update(self, n=1):
                result = super().update(n)
                if self.total and self.total > 0:
                    _progress[job_id]["progress"] = min(0.99, self.n / self.total)
                return result

        tqdm_module.tqdm = TrackingTqdm  # type: ignore

    try:
        result = whisper_model.transcribe(  # type: ignore
            tmp_path,
            language=language if language else None,
            task="transcribe",
            verbose=False,
            no_speech_threshold=0.3,
            condition_on_previous_text=True,
            compression_ratio_threshold=2.4,
        )
    finally:
        with _tqdm_lock:
            tqdm_module.tqdm = original_tqdm
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    return result


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(..., description="오디오 파일 (mp3, wav, m4a, flac 등)"),
    language: Optional[str] = Form(default=None, description="언어 코드 (ko, en, ja … 또는 None=자동감지)"),
    model: Optional[str] = Form(default="large-v3", description="Whisper 모델 크기 (tiny|base|large-v3)"),
    job_id: Optional[str] = Form(default=None, description="진행률 추적용 job ID"),
) -> TranscribeResponse:
    """
    오디오 파일을 Whisper로 전사합니다.

    - 모든 포맷을 ffmpeg로 16kHz mono WAV로 전처리합니다.
    - 전사는 ThreadPoolExecutor에서 실행되어 이벤트 루프를 차단하지 않습니다.
    - CUDA OOM 시 자동으로 CPU fallback합니다.
    - job_id를 전달하면 GET /api/whisper/progress/{job_id}로 진행률을 polling할 수 있습니다.
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
    _progress[jid] = {"progress": 0.0, "done": False, "error": None}

    # 1) 파일 저장
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="파일이 비어 있습니다.")

    logger.info(
        "Transcribe request: file='%s', size=%d bytes, lang='%s', model='%s', job_id='%s'",
        file.filename, len(content), language, model_name, jid,
    )

    tmp_orig = None
    tmp_wav = None
    try:
        # 2) 원본 임시 파일 저장
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(content)
            tmp_orig = f.name

        # 3) ffmpeg로 16kHz mono WAV 변환 (비동기 실행)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            tmp_wav = f.name

        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, _preprocess_audio, tmp_orig, tmp_wav)
        except Exception as exc:
            logger.warning("ffmpeg 전처리 실패 (%s), 원본 파일로 직접 시도합니다.", exc)
            tmp_wav_path = tmp_orig  # fallback: 원본 직접 사용
        else:
            tmp_wav_path = tmp_wav

        # 4) Whisper 전사 (스레드풀에서 실행 — 이벤트 루프 차단하지 않음)
        try:
            result = await loop.run_in_executor(
                _executor,
                _run_transcribe,
                jid, tmp_wav_path, language, model_name,
            )
        except Exception as exc:
            _progress[jid]["error"] = str(exc)
            _progress[jid]["done"] = True
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
        if seg["text"].strip()  # 공백 세그먼트 제거
    ]

    _progress[jid]["progress"] = 1.0
    _progress[jid]["done"] = True

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
    """전사 진행률을 반환합니다. job_id가 없으면 done=True로 응답."""
    if job_id not in _progress:
        return ProgressResponse(progress=0.0, done=True)
    p = _progress[job_id]
    return ProgressResponse(progress=p["progress"], done=p["done"], error=p.get("error"))


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
