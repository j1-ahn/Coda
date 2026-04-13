"""
whisper_router.py
POST /api/whisper/transcribe — 오디오 파일을 받아 Whisper large-v3로 전사합니다.
GET  /api/whisper/progress/{job_id} — 전사 진행률을 실시간으로 반환합니다.
"""

from __future__ import annotations

import logging
import tempfile
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.model_manager import get_whisper, vram_stats
import torch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/whisper", tags=["whisper"])

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
    model_loaded: Optional[str] = None


# ---------------------------------------------------------------------------
# tqdm progress hook
# ---------------------------------------------------------------------------

def _make_tracking_tqdm(job_id: str):
    """Whisper 내부 tqdm을 가로채 진행률을 _progress 딕셔너리에 기록하는 클래스를 반환."""
    import tqdm as tqdm_module

    class TrackingTqdm(tqdm_module.tqdm):
        def update(self, n=1):
            result = super().update(n)
            if self.total and self.total > 0:
                _progress[job_id]["progress"] = min(0.99, self.n / self.total)
            return result

    return TrackingTqdm


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
    오디오 파일을 Whisper large-v3로 전사합니다.

    - 모델은 최초 호출 시 로드 후 캐시됩니다 (재로드 없음).
    - job_id를 전달하면 GET /api/whisper/progress/{job_id} 로 진행률을 polling할 수 있습니다.
    - 처리 완료 후 torch.cuda.empty_cache()를 호출해 VRAM을 회수합니다.
    """
    allowed_suffixes = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm", ".mp4"}
    suffix = Path(file.filename or "audio.mp3").suffix.lower()
    if suffix not in allowed_suffixes:
        raise HTTPException(
            status_code=415,
            detail=f"지원하지 않는 파일 형식입니다: '{suffix}'. "
                   f"허용: {', '.join(sorted(allowed_suffixes))}",
        )

    jid = job_id or str(uuid.uuid4())
    _progress[jid] = {"progress": 0.0, "done": False, "error": None}

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    logger.info(
        "Transcribe request: file='%s', size=%d bytes, language='%s', job_id='%s'",
        file.filename, len(content), language, jid,
    )

    import tqdm as tqdm_module
    original_tqdm = tqdm_module.tqdm

    try:
        whisper_model_name = model if model in ("tiny", "base", "large-v3") else "large-v3"
        whisper_model = get_whisper(whisper_model_name)

        # tqdm 패치 — Whisper 진행률 가로채기
        TrackingTqdm = _make_tracking_tqdm(jid)
        tqdm_module.tqdm = TrackingTqdm

        result = whisper_model.transcribe(
            tmp_path,
            language=language if language else None,
            task="transcribe",
            verbose=False,
            no_speech_threshold=0.3,        # 기본 0.6 → 낮출수록 묵음 판정 줄어듦
            condition_on_previous_text=True, # 이전 블록 컨텍스트 이어받기
            compression_ratio_threshold=2.4, # 기본 2.4 유지
        )

    except Exception as exc:
        _progress[jid]["error"] = str(exc)
        _progress[jid]["done"] = True
        logger.exception("Whisper transcription failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"전사 실패: {exc}") from exc

    finally:
        tqdm_module.tqdm = original_tqdm
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        Path(tmp_path).unlink(missing_ok=True)

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
    ]

    _progress[jid]["progress"] = 1.0
    _progress[jid]["done"] = True

    logger.info(
        "Transcription done: %d segments, duration=%.1fs, lang='%s'",
        len(segments_out), duration, detected_language,
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
    stats = vram_stats()
    return VRAMResponse(**stats)
