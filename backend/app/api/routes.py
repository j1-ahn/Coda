"""
routes.py
모든 API 라우터를 한 곳에서 등록합니다.
새 라우터 추가 시 여기에 include_router를 추가하세요.
"""

from fastapi import APIRouter

from app.api.whisper_router import router as whisper_router
from app.api.ollama_router import router as ollama_router
from app.api.vision_router import router as vision_router
from app.api.export_router import router as export_router
from app.api.depth_router import router as depth_router
from app.api.project_router import router as project_router
from app.api.render_router import router as render_router

# 루트 API 라우터
api_router = APIRouter()

api_router.include_router(whisper_router)   # /api/whisper
api_router.include_router(ollama_router)    # /api/ollama
api_router.include_router(vision_router)    # /api/vision
api_router.include_router(export_router)    # /api/export
api_router.include_router(depth_router)     # /api/depth
api_router.include_router(project_router)   # /api/project
api_router.include_router(render_router)    # /api/render
