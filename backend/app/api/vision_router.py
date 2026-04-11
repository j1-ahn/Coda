"""
vision_router.py
SAM-HQ + Depth-Anything-V2 VRAM 순차 파이프라인.

엔드포인트:
  POST /api/vision/process  — 이미지를 받아 마스크 + 깊이맵 추출
"""

from __future__ import annotations

import io
import logging
import time
import uuid
from pathlib import Path
from typing import Optional

import torch
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vision", tags=["vision"])

# ---------------------------------------------------------------------------
# Output directory (main.py에서도 생성하지만 여기서도 보장)
# ---------------------------------------------------------------------------

_OUTPUTS_DIR = Path("outputs")


def _ensure_outputs_dir() -> None:
    _OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------


class VisionProcessResponse(BaseModel):
    mask_url: str
    depth_url: str
    processing_time_ms: float
    vram_peak_mb: Optional[float] = None


# ---------------------------------------------------------------------------
# Mock image generators (Pillow 기반)
# ---------------------------------------------------------------------------


def _create_mock_mask(width: int, height: int) -> bytes:
    """흰색 PNG 마스크 (모델 없을 때 fallback)."""
    from PIL import Image  # type: ignore

    img = Image.new("L", (width, height), color=255)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _create_mock_depth(width: int, height: int) -> bytes:
    """그레이스케일 그라디언트 깊이맵 (모델 없을 때 fallback)."""
    from PIL import Image  # type: ignore
    import numpy as np  # type: ignore

    arr = np.linspace(0, 255, width * height, dtype=np.uint8).reshape(height, width)
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _get_image_size(image_bytes: bytes) -> tuple[int, int]:
    """이미지 바이트에서 (width, height) 반환."""
    from PIL import Image  # type: ignore

    img = Image.open(io.BytesIO(image_bytes))
    return img.size  # (width, height)


# ---------------------------------------------------------------------------
# SAM-HQ 처리 (모델 없으면 mock 반환)
# ---------------------------------------------------------------------------


def _run_sam_hq(image_bytes: bytes, model: object) -> bytes:
    """
    SAM-HQ로 이미지 마스킹을 수행합니다.
    model이 None이면 mock PNG를 반환합니다.
    """
    width, height = _get_image_size(image_bytes)

    if model is None:
        logger.info("SAM-HQ model not available — returning mock mask.")
        return _create_mock_mask(width, height)

    try:
        import numpy as np
        from PIL import Image  # type: ignore

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img)

        # SamPredictor API
        model.set_image(img_np)
        # 이미지 중앙 포인트를 기준으로 단일 마스크 추출
        cx, cy = width // 2, height // 2
        masks, _, _ = model.predict(
            point_coords=np.array([[cx, cy]]),
            point_labels=np.array([1]),
            multimask_output=False,
        )
        mask_arr = (masks[0].astype(np.uint8)) * 255
        mask_img = Image.fromarray(mask_arr, mode="L")
        buf = io.BytesIO()
        mask_img.save(buf, format="PNG")
        return buf.getvalue()

    except Exception as exc:
        logger.warning("SAM-HQ processing error: %s — returning mock.", exc)
        return _create_mock_mask(width, height)


# ---------------------------------------------------------------------------
# Depth-Anything-V2 처리 (모델 없으면 mock 반환)
# ---------------------------------------------------------------------------


def _run_depth(image_bytes: bytes, model: object) -> bytes:
    """
    Depth-Anything-V2로 깊이맵을 추출합니다.
    model이 None이면 mock PNG를 반환합니다.
    """
    width, height = _get_image_size(image_bytes)

    if model is None:
        logger.info("Depth model not available — returning mock depth map.")
        return _create_mock_depth(width, height)

    try:
        import cv2  # type: ignore
        import numpy as np
        from PIL import Image  # type: ignore

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img)
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        depth = model.infer_image(img_bgr)

        # 정규화 → 8bit
        depth_norm = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
        depth_uint8 = (depth_norm * 255).astype("uint8")
        depth_img = Image.fromarray(depth_uint8, mode="L")
        buf = io.BytesIO()
        depth_img.save(buf, format="PNG")
        return buf.getvalue()

    except Exception as exc:
        logger.warning("Depth processing error: %s — returning mock.", exc)
        return _create_mock_depth(width, height)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/process", response_model=VisionProcessResponse)
async def process_image(
    file: UploadFile = File(..., description="처리할 이미지 파일 (PNG, JPEG 등)"),
) -> VisionProcessResponse:
    """
    이미지를 SAM-HQ(마스킹) → Depth-Anything-V2(깊이맵) 순으로 처리합니다.

    VRAM Sequential Purge 패턴:
      load_model('sam_hq') → SAM 처리 → unload_model('sam_hq')
      → load_model('depth') → Depth 처리 → unload_model('depth')

    모델 파일이 없으면 mock PNG를 반환합니다.
    """
    _ensure_outputs_dir()

    # 파일 확장자 검증
    allowed_suffixes = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
    suffix = Path(file.filename or "image.png").suffix.lower()
    if suffix not in allowed_suffixes:
        raise HTTPException(
            status_code=415,
            detail=f"지원하지 않는 파일 형식: '{suffix}'. 허용: {', '.join(sorted(allowed_suffixes))}",
        )

    image_bytes = await file.read()
    logger.info(
        "Vision process request: file='%s', size=%d bytes",
        file.filename,
        len(image_bytes),
    )

    file_id = uuid.uuid4().hex[:8]
    mask_filename = f"mask_{file_id}.png"
    depth_filename = f"depth_{file_id}.png"
    mask_path = _OUTPUTS_DIR / mask_filename
    depth_path = _OUTPUTS_DIR / depth_filename

    # VRAM 피크 측정 시작
    vram_start = 0.0
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()
        vram_start = torch.cuda.memory_allocated() / 1024 ** 2

    t_start = time.monotonic()

    # ── Phase 1: SAM-HQ ────────────────────────────────────────────────────
    from app.core.model_manager import load_model, unload_model

    logger.info("Loading SAM-HQ for masking...")
    sam_model = load_model("sam_hq")

    mask_bytes = _run_sam_hq(image_bytes, sam_model)

    unload_model("sam_hq")
    torch.cuda.empty_cache() if torch.cuda.is_available() else None
    logger.info("SAM-HQ unloaded, VRAM cleared.")

    # ── Phase 2: Depth-Anything-V2 ─────────────────────────────────────────
    logger.info("Loading Depth-Anything-V2...")
    depth_model = load_model("depth")

    depth_bytes = _run_depth(image_bytes, depth_model)

    unload_model("depth")
    torch.cuda.empty_cache() if torch.cuda.is_available() else None
    logger.info("Depth model unloaded, VRAM cleared.")

    # ── Save outputs ───────────────────────────────────────────────────────
    mask_path.write_bytes(mask_bytes)
    depth_path.write_bytes(depth_bytes)

    elapsed_ms = (time.monotonic() - t_start) * 1000

    # VRAM 피크
    vram_peak_mb: Optional[float] = None
    if torch.cuda.is_available():
        vram_peak_mb = round(torch.cuda.max_memory_allocated() / 1024 ** 2, 2)

    logger.info(
        "Vision processing done: mask=%s, depth=%s, time=%.0fms, vram_peak=%.0fMB",
        mask_filename,
        depth_filename,
        elapsed_ms,
        vram_peak_mb or 0,
    )

    return VisionProcessResponse(
        mask_url=f"/outputs/{mask_filename}",
        depth_url=f"/outputs/{depth_filename}",
        processing_time_ms=round(elapsed_ms, 1),
        vram_peak_mb=vram_peak_mb,
    )
