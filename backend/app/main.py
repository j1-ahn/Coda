"""
main.py
Coda Studio — FastAPI 애플리케이션 엔트리포인트.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import api_router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Outputs directory (정적 파일 서빙용)
# ---------------------------------------------------------------------------

_OUTPUTS_DIR = Path("outputs")
_OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Coda Studio API",
    description=(
        "AI 시네마틱 영상 스튜디오 백엔드. "
        "Whisper 전사, Ollama VFX 추천, SAM-HQ/Depth 비전, 듀얼 익스포트(16:9 / 9:16)를 담당합니다."
    ),
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

# 개발 환경: Next.js dev server 허용
# 프로덕션: 환경변수 ALLOWED_ORIGINS 로 제한
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(api_router)

# ---------------------------------------------------------------------------
# Static files — /outputs → outputs/ 디렉토리
# ---------------------------------------------------------------------------

app.mount("/outputs", StaticFiles(directory=str(_OUTPUTS_DIR)), name="outputs")

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health", tags=["system"])
async def health() -> dict:
    """서버 상태 확인."""
    return {"status": "ok", "version": app.version}


# ---------------------------------------------------------------------------
# Startup / Shutdown events
# ---------------------------------------------------------------------------


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Coda Studio API server started (v%s).", app.version)
    logger.info("Allowed CORS origins: %s", allowed_origins)
    logger.info("Static files: /outputs → %s", _OUTPUTS_DIR.resolve())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    from app.core.model_manager import unload_model, is_loaded

    logger.info("Server shutting down — unloading models...")
    for name in ("whisper", "sam_hq", "depth"):
        if is_loaded(name):
            unload_model(name)
    logger.info("Models unloaded. Goodbye.")


# ---------------------------------------------------------------------------
# Entrypoint (uvicorn direct run)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
        log_level="info",
    )
