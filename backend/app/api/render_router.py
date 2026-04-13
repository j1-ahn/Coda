"""
render_router.py
/api/render/* — Phase-B NVENC render pipeline

Endpoints:
  POST   /session                   Create session, return session_id
  POST   /frames/{sid}              Receive JPEG frame batch (multipart)
  POST   /audio/{sid}               Receive audio file (multipart)
  POST   /encode/{sid}              Trigger FFmpeg NVENC encode (background task)
  GET    /progress/{sid}            SSE: encoding progress
  GET    /download/{sid}/{fmt}      Download finished video (16-9 | 9-16)
  DELETE /session/{sid}             Cleanup session + temp files
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import List, Literal

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.core.render_session import session_manager
from app.core.ffmpeg_nvenc import encode, encode_916_crop

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/render", tags=["render"])

# ─── Request / response models ────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    total_frames: int = 0


class EncodeRequest(BaseModel):
    fps: int = 30
    width: int = 1920
    height: int = 1080
    quality: Literal["high", "medium", "low"] = "medium"
    format: Literal["16:9", "9:16", "both"] = "16:9"
    nvenc_mode: Literal["auto", "nvenc", "cpu"] = "auto"
    ffmpeg_path: Optional[str] = None   # None = use system PATH
    output_path: Optional[str] = None   # None = use default render_tmp/


# ─── Session ──────────────────────────────────────────────────────────────────

@router.post("/session")
async def create_session(req: CreateSessionRequest):
    session = session_manager.create(total_frames=req.total_frames)
    logger.info("Created render session %s (total_frames=%d)", session.session_id, req.total_frames)
    return {"session_id": session.session_id}


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    session_manager.cleanup(session_id)
    return {"status": "cleaned_up"}


# ─── Frame upload ─────────────────────────────────────────────────────────────

@router.post("/frames/{session_id}")
async def upload_frames(
    session_id: str,
    files: List[UploadFile] = File(...),
):
    try:
        session = session_manager.get(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")

    frames_dir = session.frames_dir
    for f in files:
        filename = f.filename or "frame_00000.jpg"
        data = await f.read()
        (frames_dir / filename).write_bytes(data)
        session.received_frames += 1

    logger.debug(
        "Session %s: received %d frames (total so far: %d/%d)",
        session_id, len(files), session.received_frames, session.total_frames,
    )
    return {"received": session.received_frames, "total": session.total_frames}


# ─── Audio upload ─────────────────────────────────────────────────────────────

@router.post("/audio/{session_id}")
async def upload_audio(session_id: str, file: UploadFile = File(...)):
    try:
        session = session_manager.get(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")

    suffix = Path(file.filename or "audio.mp3").suffix.lower() or ".mp3"
    audio_path = session.temp_dir / f"audio{suffix}"
    audio_path.write_bytes(await file.read())
    logger.info("Session %s: audio saved → %s", session_id, audio_path.name)
    return {"status": "ok", "file": audio_path.name}


# ─── Encode ───────────────────────────────────────────────────────────────────

@router.post("/encode/{session_id}")
async def start_encode(
    session_id: str,
    req: EncodeRequest,
    background_tasks: BackgroundTasks,
):
    try:
        session = session_manager.get(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "receiving":
        raise HTTPException(status_code=409, detail="Session already encoding or done")

    session.status = "encoding"
    session.progress = 0.0

    background_tasks.add_task(_run_encode, session_id, req)
    return {"status": "encoding_started"}


async def _run_encode(session_id: str, req: EncodeRequest) -> None:
    """Background task: run FFmpeg encode(s) and update session state."""
    try:
        session = session_manager.get(session_id)
    except KeyError:
        return

    frames_dir = session.frames_dir
    audio_path = session.audio_path
    tmp        = session.temp_dir
    out_169    = tmp / "output_16-9.mp4"
    out_916    = tmp / "output_9-16.mp4"

    def on_progress_169(frac: float) -> None:
        session.progress = frac * (0.7 if req.format == "both" else 1.0)
        session.message = f"16:9 인코딩 {int(frac * 100)}%"

    def on_progress_916(frac: float) -> None:
        session.progress = 0.7 + frac * 0.3
        session.message = f"9:16 변환 {int(frac * 100)}%"

    try:
        logger.info(
            "Session %s: encoding %d frames → %s  audio=%s  codec=nvenc=%s",
            session_id, session.total_frames, req.format, audio_path is not None,
            True,
        )

        # Always produce 16:9 first
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: encode(
                frames_dir=frames_dir,
                audio_path=audio_path,
                output_path=out_169,
                fps=req.fps,
                width=req.width,
                height=req.height,
                quality=req.quality,
                nvenc_mode=req.nvenc_mode,
                ffmpeg_path=req.ffmpeg_path,
                on_progress=on_progress_169,
            ),
        )
        session.output_files["16-9"] = out_169.name

        # 9:16 crop if requested
        if req.format in ("9:16", "both"):
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: encode_916_crop(
                    input_path=out_169,
                    output_path=out_916,
                    on_progress=on_progress_916,
                ),
            )
            session.output_files["9-16"] = out_916.name

        session.status = "done"
        session.progress = 1.0
        session.message = "렌더 완료"
        logger.info("Session %s: encode done → %s", session_id, session.output_files)

    except Exception as exc:
        session.status = "error"
        session.message = str(exc)
        logger.exception("Session %s: encode failed: %s", session_id, exc)


# ─── SSE progress ─────────────────────────────────────────────────────────────

@router.get("/progress/{session_id}")
async def progress_stream(session_id: str):
    try:
        session_manager.get(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")

    async def generate():
        while True:
            try:
                session = session_manager.get(session_id)
            except KeyError:
                break

            payload = json.dumps({
                "status":   session.status,
                "progress": round(session.progress, 3),
                "message":  session.message,
                "outputs":  session.output_files if session.status == "done" else {},
            })
            yield f"data: {payload}\n\n"

            if session.status in ("done", "error"):
                break

            await asyncio.sleep(0.4)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Download ─────────────────────────────────────────────────────────────────

@router.get("/download/{session_id}/{fmt}")
async def download_video(session_id: str, fmt: str):
    try:
        session = session_manager.get(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "done":
        raise HTTPException(status_code=425, detail="Encoding not complete yet")

    filename = session.output_files.get(fmt)
    if not filename:
        raise HTTPException(status_code=404, detail=f"Format '{fmt}' not available")

    file_path = session.temp_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Output file missing")

    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=f"coda_{fmt}.mp4",
    )
