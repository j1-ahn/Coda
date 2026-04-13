"""
depth_router.py
Depth-Anything-V2를 사용한 depth map 추정 엔드포인트.

POST /api/depth/estimate
  - 이미지 파일을 받아 그레이스케일 depth map(PNG)을 반환합니다.
  - 모델이 없으면 간단한 라플라시안 기반 edge-depth로 폴백합니다.
"""

from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/depth", tags=["depth"])

_OUTPUTS = Path("outputs")
_OUTPUTS.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pil_to_np(img) -> np.ndarray:  # type: ignore[no-untyped-def]
    return np.array(img)


def _np_to_png_bytes(arr: np.ndarray) -> bytes:
    """uint8 HxW numpy array → PNG bytes."""
    from PIL import Image
    img = Image.fromarray(arr.astype(np.uint8), mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _fallback_depth(img_rgb: np.ndarray) -> np.ndarray:
    """
    AI 모델이 없을 때 사용하는 간단한 depth 추정.
    - 중앙 = 근경(밝음), 외곽 = 원경(어두움) 방사형 그라디언트
    - 윤곽선(엣지) 영역은 약간 보정 (물체 경계 강조)
    """
    h, w = img_rgb.shape[:2]
    # Radial gradient
    yy, xx = np.meshgrid(np.linspace(-1, 1, h), np.linspace(-1, 1, w), indexing='ij')
    dist = np.sqrt(xx ** 2 + yy ** 2)
    radial = np.clip(1.0 - dist / 1.41, 0, 1)  # 1.41 ≈ sqrt(2), max distance to corner

    # Edge detection (simple sobel-like) → adjust depth near edges
    gray = img_rgb.mean(axis=2).astype(np.float32) / 255.0
    gx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
    gy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
    edges = np.clip((gx + gy) * 3.0, 0, 1)

    # Blend: radial base + slight edge boost
    depth = radial * 0.85 + edges * 0.15
    depth = np.clip(depth, 0, 1)
    return (depth * 255).astype(np.uint8)


def _ai_depth(img_rgb: np.ndarray) -> np.ndarray | None:
    """Depth-Anything-V2로 depth map 생성. 실패 시 None 반환."""
    try:
        import torch
        from app.core.model_manager import get_model

        model = get_model("depth")
        if model is None:
            return None

        import cv2  # type: ignore
        from PIL import Image

        h, w = img_rgb.shape[:2]

        # Depth-Anything-V2 inference
        depth = model.infer_image(img_rgb)  # returns HxW float32

        # Normalize to 0–255 (invert: near = bright)
        d_min, d_max = depth.min(), depth.max()
        if d_max - d_min < 1e-6:
            return None
        depth_norm = (depth - d_min) / (d_max - d_min)
        depth_norm = 1.0 - depth_norm  # invert: closer = brighter
        depth_u8 = (depth_norm * 255).astype(np.uint8)

        # Resize back to original if needed
        if depth_u8.shape[:2] != (h, w):
            depth_u8 = cv2.resize(depth_u8, (w, h), interpolation=cv2.INTER_LINEAR)

        return depth_u8
    except Exception as exc:
        logger.warning("AI depth inference failed: %s — using fallback.", exc)
        return None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/estimate")
async def estimate_depth(file: UploadFile = File(...)) -> Response:
    """
    이미지에서 depth map을 생성합니다.

    - AI 모델(Depth-Anything-V2) 사용 가능 시 → 정밀 depth map
    - 불가 시 → 방사형 gradient + edge 기반 폴백

    Returns:
        PNG 그레이스케일 이미지 (밝을수록 근경)
    """
    try:
        from PIL import Image

        raw = await file.read()
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        img_np = np.array(img)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    # Try AI first, fall back to heuristic
    depth_u8 = _ai_depth(img_np)
    used_ai = depth_u8 is not None
    if depth_u8 is None:
        depth_u8 = _fallback_depth(img_np)

    png_bytes = _np_to_png_bytes(depth_u8)
    logger.info(
        "Depth map generated (%s) — size=%dx%d bytes=%d",
        "AI" if used_ai else "fallback",
        img_np.shape[1], img_np.shape[0],
        len(png_bytes),
    )

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "X-Depth-Method": "ai" if used_ai else "fallback",
            "Cache-Control": "no-store",
        },
    )
