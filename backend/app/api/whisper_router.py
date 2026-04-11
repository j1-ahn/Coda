"""
whisper_router.py
POST /api/whisper/transcribe — 오디오 파일을 받아 Whisper large-v3로 전사합니다.
"""

from __future__ import annotations

import logging
import tempfile
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.model_manager import get_whisper, vram_stats
import torch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/whisper", tags=["whisper"])

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


class VRAMResponse(BaseModel):
    cuda_available: bool
    allocated_mb: Optional[float] = None
    reserved_mb: Optional[float] = None
    model_loaded: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(..., description="오디오 파일 (mp3, wav, m4a, flac 등)"),
    language: Optional[str] = Form(default="ko", description="언어 코드 (기본값: ko)"),
) -> TranscribeResponse:
    """
    오디오 파일을 Whisper large-v3로 전사합니다.

    - 모델은 최초 호출 시 로드 후 캐시됩니다 (재로드 없음).
    - 처리 완료 후 torch.cuda.empty_cache()를 호출해 VRAM을 회수합니다.
    - 반환: segments 리스트 (id, start, end, text), 전체 duration, 감지 언어.
    """
    # 허용 확장자 검증
    allowed_suffixes = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm", ".mp4"}
    suffix = Path(file.filename or "audio.mp3").suffix.lower()
    if suffix not in allowed_suffixes:
        raise HTTPException(
            status_code=415,
            detail=f"지원하지 않는 파일 형식입니다: '{suffix}'. "
                   f"허용: {', '.join(sorted(allowed_suffixes))}",
        )

    # 임시 파일에 저장 (whisper는 파일 경로를 받음)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    logger.info(
        "Transcribe request: file='%s', size=%d bytes, language='%s'",
        file.filename,
        len(content),
        language,
    )

    try:
        model = get_whisper("large-v3")

        # Whisper transcribe
        result = model.transcribe(
            tmp_path,
            language=language if language else None,
            task="transcribe",
            verbose=False,
        )

        detected_language: str = result.get("language", language or "unknown")
        raw_segments: list = result.get("segments", [])

        # 전체 duration: 마지막 세그먼트 end 또는 result 자체의 duration
        if raw_segments:
            duration = float(raw_segments[-1]["end"])
        else:
            duration = 0.0

        segments_out: List[SegmentOut] = [
            SegmentOut(
                id=str(uuid.uuid4()),
                start=float(seg["start"]),
                end=float(seg["end"]),
                text=seg["text"].strip(),
            )
            for seg in raw_segments
        ]

        logger.info(
            "Transcription done: %d segments, duration=%.1fs, lang='%s'",
            len(segments_out),
            duration,
            detected_language,
        )

        return TranscribeResponse(
            segments=segments_out,
            duration=duration,
            language=detected_language,
        )

    except Exception as exc:
        logger.exception("Whisper transcription failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"전사 실패: {exc}") from exc

    finally:
        # VRAM Sequential Purge 원칙: 작업 완료 후 캐시 해제
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.debug("torch.cuda.empty_cache() called after transcription.")
        # 임시 파일 삭제
        Path(tmp_path).unlink(missing_ok=True)


@router.get("/vram", response_model=VRAMResponse)
async def get_vram_stats() -> VRAMResponse:
    """현재 VRAM 사용 현황을 반환합니다."""
    stats = vram_stats()
    return VRAMResponse(**stats)
