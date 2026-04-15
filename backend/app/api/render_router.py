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
import shutil
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.core.render_session import session_manager
from app.core.ffmpeg_nvenc import encode, encode_916_crop, concat_videos

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
    # Gallery export metadata
    gallery_export: bool = False
    gallery_title: Optional[str] = None
    gallery_artist: Optional[str] = None
    gallery_tags: Optional[List[str]] = None


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

        # Copy to user-specified output path if provided
        if req.output_path:
            out_dir = Path(req.output_path)
            out_dir.mkdir(parents=True, exist_ok=True)
            for key, fname in session.output_files.items():
                src = tmp / fname
                if src.exists():
                    dst = out_dir / f"coda_{key}.mp4"
                    shutil.copy2(src, dst)
                    logger.info("Session %s: copied %s → %s", session_id, src, dst)

        # ── Gallery export: thumbnail + metadata.json ─────────────────────
        if req.gallery_export and req.output_path:
            _export_gallery_metadata(
                session_id=session_id,
                tmp=tmp,
                out_dir=Path(req.output_path),
                req=req,
            )

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


# ─── Playlist concat ────────────────────────────────────────────────────────

class ConcatRequest(BaseModel):
    session_ids: List[str]
    format: Literal["16:9", "9:16", "both"] = "16:9"
    ffmpeg_path: Optional[str] = None


@router.post("/concat")
async def concat_sessions(req: ConcatRequest, background_tasks: BackgroundTasks):
    """
    Concatenate finished render sessions into a single video.
    Creates a new session to hold the concatenated output.
    """
    # Validate all source sessions are done
    for sid in req.session_ids:
        try:
            s = session_manager.get(sid)
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Session {sid} not found")
        if s.status != "done":
            raise HTTPException(status_code=409, detail=f"Session {sid} not done yet")

    # Create new session for concat output
    concat_session = session_manager.create(total_frames=0)
    concat_session.status = "encoding"
    concat_session.message = "연결 렌더 준비 중…"

    background_tasks.add_task(_run_concat, concat_session.session_id, req)
    return {"session_id": concat_session.session_id}


async def _run_concat(concat_session_id: str, req: ConcatRequest) -> None:
    """Background task: concatenate multiple rendered videos."""
    try:
        concat_session = session_manager.get(concat_session_id)
    except KeyError:
        return

    try:
        # Collect 16:9 outputs
        videos_169: List[Path] = []
        for sid in req.session_ids:
            s = session_manager.get(sid)
            fname = s.output_files.get("16-9")
            if fname:
                videos_169.append(s.temp_dir / fname)

        if not videos_169:
            raise RuntimeError("No 16:9 outputs to concatenate")

        out_169 = concat_session.temp_dir / "output_16-9.mp4"

        def on_progress_169(frac: float) -> None:
            concat_session.progress = frac * (0.7 if req.format == "both" else 1.0)
            concat_session.message = f"16:9 연결 중… {int(frac * 100)}%"

        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: concat_videos(
                video_paths=videos_169,
                output_path=out_169,
                ffmpeg_path=req.ffmpeg_path,
                on_progress=on_progress_169,
            ),
        )
        concat_session.output_files["16-9"] = out_169.name

        # 9:16
        if req.format in ("9:16", "both"):
            videos_916: List[Path] = []
            for sid in req.session_ids:
                s = session_manager.get(sid)
                fname = s.output_files.get("9-16")
                if fname:
                    videos_916.append(s.temp_dir / fname)

            if videos_916:
                out_916 = concat_session.temp_dir / "output_9-16.mp4"

                def on_progress_916(frac: float) -> None:
                    concat_session.progress = 0.7 + frac * 0.3
                    concat_session.message = f"9:16 연결 중… {int(frac * 100)}%"

                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: concat_videos(
                        video_paths=videos_916,
                        output_path=out_916,
                        ffmpeg_path=req.ffmpeg_path,
                        on_progress=on_progress_916,
                    ),
                )
                concat_session.output_files["9-16"] = out_916.name

        concat_session.status = "done"
        concat_session.progress = 1.0
        concat_session.message = "플레이리스트 연결 렌더 완료"
        logger.info("Concat session %s: done → %s", concat_session_id, concat_session.output_files)

    except Exception as exc:
        concat_session.status = "error"
        concat_session.message = str(exc)
        logger.exception("Concat session %s failed: %s", concat_session_id, exc)


# ── Gallery export helper ─────────────────────────────────────────────────────

def _export_gallery_metadata(
    session_id: str,
    tmp: Path,
    out_dir: Path,
    req: EncodeRequest,
) -> None:
    """Generate thumbnail + gallery-metadata.json alongside rendered video."""
    import subprocess
    from datetime import datetime

    out_dir.mkdir(parents=True, exist_ok=True)

    # Extract thumbnail from first frame of 16:9 video
    video_169 = out_dir / "coda_16-9.mp4"
    thumb_path = out_dir / "thumbnail.jpg"
    if video_169.exists():
        try:
            ffmpeg_bin = req.ffmpeg_path or "ffmpeg"
            subprocess.run(
                [
                    ffmpeg_bin, "-y",
                    "-i", str(video_169),
                    "-vframes", "1",
                    "-q:v", "2",
                    str(thumb_path),
                ],
                capture_output=True,
                timeout=30,
            )
            logger.info("Session %s: thumbnail → %s", session_id, thumb_path)
        except Exception as e:
            logger.warning("Session %s: thumbnail extraction failed: %s", session_id, e)

    # Write metadata JSON
    metadata = {
        "catalog": f"CODA-{session_id[:6].upper()}",
        "title": req.gallery_title or "Untitled",
        "artist": req.gallery_artist or "j1",
        "tags": req.gallery_tags or [],
        "duration_sec": None,  # filled below
        "thumbnail": "thumbnail.jpg" if thumb_path.exists() else None,
        "video_16_9": "coda_16-9.mp4" if (out_dir / "coda_16-9.mp4").exists() else None,
        "video_9_16": "coda_9-16.mp4" if (out_dir / "coda_9-16.mp4").exists() else None,
        "rendered_at": datetime.now().isoformat(),
        "resolution": f"{req.width}x{req.height}",
        "fps": req.fps,
    }

    # Get duration via ffprobe
    if video_169.exists():
        try:
            ffprobe_bin = (req.ffmpeg_path or "ffmpeg").replace("ffmpeg", "ffprobe")
            result = subprocess.run(
                [
                    ffprobe_bin,
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "csv=p=0",
                    str(video_169),
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.stdout.strip():
                metadata["duration_sec"] = round(float(result.stdout.strip()), 2)
        except Exception:
            pass

    meta_path = out_dir / "gallery-metadata.json"
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Session %s: gallery metadata → %s", session_id, meta_path)
