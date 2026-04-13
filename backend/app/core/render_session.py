"""
render_session.py
In-memory render job registry.
Each session tracks: temp dir, frame receipt, encode status, output paths.
"""

from __future__ import annotations

import shutil
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ─── Base temp directory ────────────────────────────────────────────────────
RENDER_TMP_ROOT = Path("render_tmp")


@dataclass
class RenderSession:
    session_id: str
    temp_dir: Path
    total_frames: int = 0
    received_frames: int = 0
    status: str = "receiving"   # receiving | encoding | done | error
    progress: float = 0.0       # 0.0 – 1.0 (encode progress)
    message: str = ""
    output_files: dict[str, str] = field(default_factory=dict)  # format → filename
    created_at: float = field(default_factory=time.time)

    @property
    def frames_dir(self) -> Path:
        return self.temp_dir / "frames"

    @property
    def audio_path(self) -> Optional[Path]:
        for ext in ("mp3", "wav", "m4a", "flac", "ogg", "webm"):
            p = self.temp_dir / f"audio.{ext}"
            if p.exists():
                return p
        return None

    @property
    def all_frames_received(self) -> bool:
        return (
            self.total_frames > 0
            and self.received_frames >= self.total_frames
        )


class RenderSessionManager:
    """Thread-safe in-memory session store (single-process FastAPI)."""

    def __init__(self) -> None:
        self._sessions: dict[str, RenderSession] = {}

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def create(self, total_frames: int = 0) -> RenderSession:
        sid = uuid.uuid4().hex
        tmp = RENDER_TMP_ROOT / sid
        (tmp / "frames").mkdir(parents=True, exist_ok=True)
        session = RenderSession(
            session_id=sid,
            temp_dir=tmp,
            total_frames=total_frames,
        )
        self._sessions[sid] = session
        return session

    def get(self, session_id: str) -> RenderSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(f"Session not found: {session_id}")
        return session

    def cleanup(self, session_id: str) -> None:
        session = self._sessions.pop(session_id, None)
        if session and session.temp_dir.exists():
            shutil.rmtree(session.temp_dir, ignore_errors=True)

    def cleanup_stale(self, max_age_secs: float = 3600.0) -> int:
        """Remove sessions older than max_age_secs. Returns count removed."""
        cutoff = time.time() - max_age_secs
        stale = [sid for sid, s in self._sessions.items() if s.created_at < cutoff]
        for sid in stale:
            self.cleanup(sid)
        return len(stale)


# Singleton used across the application
session_manager = RenderSessionManager()
