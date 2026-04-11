"""
export_router.py
FFmpeg NVENC 듀얼 익스포트 (16:9 / 9:16).

엔드포인트:
  POST /api/export/render             — 렌더링 작업 시작 (즉시 반환, 백그라운드 처리)
  GET  /api/export/status/{job_id}    — 작업 상태 조회
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import time
import uuid
from pathlib import Path
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_OUTPUTS_DIR = Path("outputs")

# 더미 소스 파일 (실제 프로젝트 파일이 없을 때 사용)
_DUMMY_IMAGE = "dummy.png"
_DUMMY_AUDIO = "dummy.mp3"


def _ensure_outputs_dir() -> None:
    _OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# In-memory job store (DB 불필요)
# ---------------------------------------------------------------------------

_jobs: Dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class RenderRequest(BaseModel):
    project_id: str
    export_format: str = "both"   # "16:9" | "9:16" | "both"
    output_name: str = "output"


class RenderResponse(BaseModel):
    job_id: str
    status: str   # "queued"
    message: str


class StatusResponse(BaseModel):
    job_id: str
    status: str           # "processing" | "done" | "error"
    progress: float       # 0.0 ~ 1.0
    outputs: Dict[str, str] = {}
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# FFmpeg helpers
# ---------------------------------------------------------------------------


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _build_ffmpeg_cmd_16x9(image: str, audio: str, duration: float, output: str) -> list[str]:
    return [
        "ffmpeg", "-y",
        "-loop", "1", "-i", image,
        "-i", audio,
        "-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "8M",
        "-vf", "scale=1920:1080",
        "-t", str(duration),
        "-shortest",
        output,
    ]


def _build_ffmpeg_cmd_9x16(image: str, audio: str, duration: float, output: str) -> list[str]:
    return [
        "ffmpeg", "-y",
        "-loop", "1", "-i", image,
        "-i", audio,
        "-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "8M",
        "-vf", "scale=1920:1920,crop=1080:1920",
        "-t", str(duration),
        "-shortest",
        output,
    ]


# ---------------------------------------------------------------------------
# Background rendering task
# ---------------------------------------------------------------------------


async def _render_task(job_id: str, req: RenderRequest) -> None:
    """백그라운드에서 FFmpeg 렌더링을 수행합니다."""
    _ensure_outputs_dir()
    job = _jobs[job_id]
    job["status"] = "processing"
    job["progress"] = 0.0

    output_16x9 = str(_OUTPUTS_DIR / f"{req.output_name}_16x9.mp4")
    output_9x16 = str(_OUTPUTS_DIR / f"{req.output_name}_9x16.mp4")

    # 프로젝트 소스 파일 경로 (실제 환경에서는 project_id 기반 조회)
    # 여기서는 outputs/ 아래에 image/audio가 있다고 가정, 없으면 mock
    image_path = str(_OUTPUTS_DIR / f"{req.project_id}_image.png")
    audio_path = str(_OUTPUTS_DIR / f"{req.project_id}_audio.mp3")
    duration = 30.0  # 기본값; 실제로는 프로젝트 메타에서 가져옴

    use_ffmpeg = _ffmpeg_available() and (
        Path(image_path).exists() and Path(audio_path).exists()
    )

    formats_to_render: list[str] = []
    if req.export_format in ("both", "16:9"):
        formats_to_render.append("16:9")
    if req.export_format in ("both", "9:16"):
        formats_to_render.append("9:16")

    total = len(formats_to_render)
    outputs: Dict[str, str] = {}

    for i, fmt in enumerate(formats_to_render):
        job["progress"] = i / total

        if fmt == "16:9":
            out_path = output_16x9
            cmd = _build_ffmpeg_cmd_16x9(image_path, audio_path, duration, out_path)
        else:
            out_path = output_9x16
            cmd = _build_ffmpeg_cmd_9x16(image_path, audio_path, duration, out_path)

        if use_ffmpeg:
            try:
                logger.info("Running FFmpeg: %s", " ".join(cmd))
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await proc.communicate()
                if proc.returncode != 0:
                    logger.warning("FFmpeg stderr: %s", stderr.decode(errors="replace")[:500])
                    # NVENC 실패 시 libx264 fallback
                    cpu_cmd = [c if c != "h264_nvenc" else "libx264" for c in cmd]
                    cpu_cmd = [c if c != "p4" else "medium" for c in cpu_cmd]
                    proc2 = await asyncio.create_subprocess_exec(
                        *cpu_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    await proc2.communicate()
            except Exception as exc:
                logger.warning("FFmpeg execution error: %s — using mock.", exc)
                use_ffmpeg = False

        if not use_ffmpeg:
            # Mock: 3초 딜레이 + 가짜 경로
            logger.info("FFmpeg not available — mock delay for format=%s", fmt)
            await asyncio.sleep(3.0 / total)
            # 빈 파일 생성 (경로 검증용)
            Path(out_path).touch()

        url_path = f"/outputs/{Path(out_path).name}"
        outputs[fmt] = url_path
        job["outputs"] = outputs
        job["progress"] = (i + 1) / total

    job["status"] = "done"
    job["progress"] = 1.0
    logger.info("Render job '%s' completed. outputs=%s", job_id, outputs)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/render", response_model=RenderResponse)
async def start_render(req: RenderRequest) -> RenderResponse:
    """
    렌더링 작업을 시작합니다. 즉시 job_id를 반환하며 실제 처리는 백그라운드에서 수행됩니다.

    - FFmpeg + NVENC 사용 가능 시 실제 인코딩.
    - FFmpeg 없거나 소스 파일 없으면 mock 딜레이(3초) + 가짜 경로 반환.
    """
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0.0,
        "outputs": {},
        "error": None,
        "project_id": req.project_id,
        "created_at": time.time(),
    }

    logger.info(
        "Render job queued: job_id='%s', project_id='%s', format='%s'",
        job_id,
        req.project_id,
        req.export_format,
    )

    # 백그라운드 실행
    asyncio.create_task(_render_task(job_id, req))

    return RenderResponse(
        job_id=job_id,
        status="queued",
        message="렌더링 시작됨",
    )


@router.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str) -> StatusResponse:
    """렌더링 작업 상태를 조회합니다."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"job_id '{job_id}' not found.")

    return StatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        outputs=job["outputs"],
        error=job.get("error"),
    )
