"""
project_router.py
프로젝트 저장/불러오기 API
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/project", tags=["project"])

_PROJECTS_DIR = Path("projects")
_PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

_SAFE_ID = re.compile(r'^[a-zA-Z0-9_\-]{1,64}$')


def _safe_path(project_id: str) -> Path:
    if not _SAFE_ID.match(project_id):
        raise HTTPException(400, "Invalid project_id")
    return _PROJECTS_DIR / f"{project_id}.json"


# ── Models ────────────────────────────────────────────────────────────────────

class SaveRequest(BaseModel):
    project_id: str
    name: str = ""
    data: dict


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/save")
async def save_project(body: SaveRequest):
    path = _safe_path(body.project_id)
    payload = {
        "project_id": body.project_id,
        "name": body.name or body.project_id,
        "saved_at": time.time(),
        "data": body.data,
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {"status": "saved", "project_id": body.project_id}


@router.get("/list")
async def list_projects():
    projects = []
    for p in sorted(_PROJECTS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            meta = json.loads(p.read_text(encoding="utf-8"))
            projects.append({
                "project_id": meta.get("project_id", p.stem),
                "name": meta.get("name", p.stem),
                "saved_at": meta.get("saved_at", p.stat().st_mtime),
            })
        except Exception:
            pass
    return {"projects": projects}


@router.get("/load/{project_id}")
async def load_project(project_id: str):
    path = _safe_path(project_id)
    if not path.exists():
        raise HTTPException(404, "Project not found")
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    path = _safe_path(project_id)
    if path.exists():
        path.unlink()
    return {"status": "deleted", "project_id": project_id}
