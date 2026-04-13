"""
ffmpeg_nvenc.py
FFmpeg wrapper with NVENC hardware encoding + libx264 fallback.

encode()         — frames dir + audio → H.264/HEVC MP4
encode_916_crop() — center-crop 16:9 → 9:16 (Shorts)

Progress is reported via an on_progress(float) callback (0.0–1.0).
"""

from __future__ import annotations

import re
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Optional

# ─── Quality presets ─────────────────────────────────────────────────────────
_BITRATE = {
    "high":   "8M",
    "medium": "4M",
    "low":    "2M",
}

_NVENC_PRESET  = "p4"    # NVENC: balanced quality/speed
_X264_PRESET   = "medium"


# ─── NVENC availability ───────────────────────────────────────────────────────

def _nvenc_available() -> bool:
    """Return True if FFmpeg was built with h264_nvenc and a GPU is present."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-encoders"],
            capture_output=True, text=True, timeout=10,
        )
        return "h264_nvenc" in result.stdout
    except Exception:
        return False


_NVENC: Optional[bool] = None   # cached after first check


def nvenc_available() -> bool:
    global _NVENC
    if _NVENC is None:
        _NVENC = _nvenc_available()
    return _NVENC


# ─── Progress parser ──────────────────────────────────────────────────────────

def _parse_frame(line: str) -> Optional[int]:
    """Extract current frame number from an FFmpeg stderr progress line."""
    m = re.search(r"frame=\s*(\d+)", line)
    return int(m.group(1)) if m else None


# ─── Main encoder ─────────────────────────────────────────────────────────────

def encode(
    frames_dir: Path,
    audio_path: Optional[Path],
    output_path: Path,
    fps: int,
    width: int,
    height: int,
    quality: str = "medium",
    nvenc_mode: str = "auto",   # "auto" | "nvenc" | "cpu"
    ffmpeg_path: Optional[str] = None,  # None = use system PATH
    on_progress: Optional[Callable[[float], None]] = None,
) -> None:
    """
    Encode JPEG frame sequence + optional audio into H.264 MP4.

    frames_dir must contain files named frame_00000.jpg, frame_00001.jpg, …
    """
    use_nvenc = (
        nvenc_mode == "nvenc" or
        (nvenc_mode == "auto" and nvenc_available())
    ) and nvenc_mode != "cpu"
    codec   = "h264_nvenc" if use_nvenc else "libx264"
    preset  = _NVENC_PRESET if use_nvenc else _X264_PRESET
    bitrate = _BITRATE.get(quality, "4M")
    ffmpeg_bin = ffmpeg_path or "ffmpeg"

    total_frames = len(list(frames_dir.glob("frame_*.jpg")))

    cmd: list[str] = [
        ffmpeg_bin, "-y",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame_%05d.jpg"),
    ]

    has_audio = audio_path is not None and audio_path.exists()
    if has_audio:
        cmd += ["-i", str(audio_path)]

    cmd += [
        "-c:v", codec,
        "-preset", preset,
        "-b:v", bitrate,
        "-vf", f"scale={width}:{height}",
        "-pix_fmt", "yuv420p",
    ]

    if has_audio:
        cmd += ["-c:a", "aac", "-b:a", "192k"]

    cmd += ["-movflags", "+faststart", str(output_path)]

    _run_with_progress(cmd, total_frames, on_progress)


def encode_916_crop(
    input_path: Path,
    output_path: Path,
    on_progress: Optional[Callable[[float], None]] = None,
) -> None:
    """
    Center-crop a 16:9 video to 9:16 (portrait / Shorts).
    Uses the same codec as the source was encoded with (via -c:v copy on
    compatible formats, or re-encode if needed).
    """
    codec  = "h264_nvenc" if nvenc_available() else "libx264"
    preset = _NVENC_PRESET if nvenc_available() else _X264_PRESET

    # Probe total frames for progress
    total_frames = _probe_frame_count(input_path)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        # center-crop: keep full height, width = h × 9/16
        "-vf", "crop=ih*9/16:ih:(iw-ih*9/16)/2:0",
        "-c:v", codec,
        "-preset", preset,
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(output_path),
    ]

    _run_with_progress(cmd, total_frames, on_progress)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _run_with_progress(
    cmd: list[str],
    total_frames: int,
    on_progress: Optional[Callable[[float], None]],
) -> None:
    process = subprocess.Popen(
        cmd,
        stderr=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        text=True,
    )
    assert process.stderr is not None

    for line in process.stderr:
        if on_progress and total_frames > 0:
            frame = _parse_frame(line)
            if frame is not None:
                on_progress(min(frame / total_frames, 0.99))

    process.wait()
    if process.returncode != 0:
        raise RuntimeError(
            f"FFmpeg exited with code {process.returncode}. "
            f"Command: {' '.join(cmd)}"
        )

    if on_progress:
        on_progress(1.0)


def _probe_frame_count(video_path: Path) -> int:
    """Return approximate frame count via ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-count_packets",
                "-show_entries", "stream=nb_read_packets",
                "-of", "default=nokey=1:noprint_wrappers=1",
                str(video_path),
            ],
            capture_output=True, text=True, timeout=30,
        )
        return int(result.stdout.strip())
    except Exception:
        return 0
