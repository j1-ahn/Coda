"""
model_manager.py
VRAM Sequential Purge 관리자 (일반화 버전).

원칙:
- 모델은 최초 요청 시 로드, 이후 메모리에 캐시.
- unload 시 모델 레퍼런스를 해제하고 torch.cuda.empty_cache() 호출.
- 여러 모델이 공존할 경우 Sequential Purge: 새 모델 로드 전 이전 모델 언로드.

지원 모델: 'whisper', 'sam_hq', 'depth'
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Dict, Optional

import torch

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singleton state
# ---------------------------------------------------------------------------

_models: Dict[str, Any] = {}          # name -> model object
_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Model loaders (lazy imports to avoid heavy deps at startup)
# ---------------------------------------------------------------------------

def _load_whisper_model() -> Any:
    """Whisper large-v3 로드."""
    import whisper  # type: ignore
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("Loading Whisper large-v3 on device='%s' ...", device)
    return whisper.load_model("large-v3", device=device)


def _load_sam_hq_model() -> Any:
    """SAM-HQ 로드. 패키지가 없으면 None 반환 (graceful fallback)."""
    try:
        from segment_anything import sam_model_registry, SamPredictor  # type: ignore
        device = "cuda" if torch.cuda.is_available() else "cpu"
        checkpoint = "sam_hq_vit_h.pth"
        logger.info("Loading SAM-HQ on device='%s' ...", device)
        sam = sam_model_registry["vit_h"](checkpoint=checkpoint)
        sam.to(device=device)
        return SamPredictor(sam)
    except Exception as exc:
        logger.warning("SAM-HQ load failed (%s) — will use mock fallback.", exc)
        return None


def _load_depth_model() -> Any:
    """Depth-Anything-V2 로드. 패키지가 없으면 None 반환 (graceful fallback)."""
    try:
        from depth_anything_v2.dpt import DepthAnythingV2  # type: ignore
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Loading Depth-Anything-V2 on device='%s' ...", device)
        model_configs = {
            "vitl": {"encoder": "vitl", "features": 256, "out_channels": [256, 512, 1024, 1024]},
        }
        model = DepthAnythingV2(**model_configs["vitl"])
        model.load_state_dict(
            torch.load("depth_anything_v2_vitl.pth", map_location="cpu")
        )
        model = model.to(device).eval()
        return model
    except Exception as exc:
        logger.warning("Depth-Anything-V2 load failed (%s) — will use mock fallback.", exc)
        return None


# 지원 모델별 로더 함수 레지스트리
_LOADERS: Dict[str, Any] = {
    "whisper": _load_whisper_model,
    "sam_hq": _load_sam_hq_model,
    "depth": _load_depth_model,
}


# ---------------------------------------------------------------------------
# Public API — 일반화된 인터페이스
# ---------------------------------------------------------------------------

def load_model(name: str) -> Any:
    """
    지정한 모델을 로드하고 캐시합니다.
    이미 로드되어 있으면 캐시를 반환합니다.

    Args:
        name: 'whisper' | 'sam_hq' | 'depth'

    Returns:
        로드된 모델 객체 (실패 시 None).
    """
    if name not in _LOADERS:
        raise ValueError(f"Unknown model '{name}'. Supported: {list(_LOADERS.keys())}")

    with _lock:
        if name in _models:
            logger.info("Model '%s' already loaded, reusing cache.", name)
            return _models[name]

        loader = _LOADERS[name]
        model = loader()
        _models[name] = model
        logger.info("Model '%s' loaded (object=%s).", name, type(model).__name__)
        return model


def unload_model(name: str) -> None:
    """
    지정한 모델을 메모리에서 해제하고 VRAM 캐시를 비웁니다.

    Args:
        name: 'whisper' | 'sam_hq' | 'depth'
    """
    with _lock:
        if name not in _models:
            logger.debug("unload_model('%s') called but not loaded.", name)
            return
        model = _models.pop(name)
        del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.debug("torch.cuda.empty_cache() called after unloading '%s'.", name)
        logger.info("Model '%s' unloaded.", name)


def get_model(name: str) -> Any:
    """
    캐시된 모델을 반환합니다. 로드되지 않았으면 자동으로 로드합니다.

    Args:
        name: 'whisper' | 'sam_hq' | 'depth'
    """
    # Fast path without lock
    if name in _models:
        return _models[name]
    return load_model(name)


def is_loaded(name: str) -> bool:
    """모델이 캐시에 올라와 있는지 확인합니다."""
    return name in _models


def vram_stats() -> dict:
    """VRAM 사용 현황을 반환합니다 (CUDA가 없으면 cuda_available=False)."""
    loaded = list(_models.keys())
    if not torch.cuda.is_available():
        return {"cuda_available": False, "loaded_models": loaded}
    return {
        "cuda_available": True,
        "allocated_mb": round(torch.cuda.memory_allocated() / 1024 ** 2, 2),
        "reserved_mb": round(torch.cuda.memory_reserved() / 1024 ** 2, 2),
        "loaded_models": loaded,
    }


# ---------------------------------------------------------------------------
# Backward-compatible Whisper helpers (whisper_router.py 호환성 유지)
# ---------------------------------------------------------------------------

def load_whisper(model_name: str = "large-v3") -> Any:
    """하위 호환용. get_model('whisper') 를 직접 쓰는 것을 권장합니다."""
    return load_model("whisper")


def unload_whisper() -> None:
    """하위 호환용."""
    unload_model("whisper")


def get_whisper(model_name: str = "large-v3") -> Any:
    """하위 호환용."""
    return get_model("whisper")


def is_whisper_loaded() -> bool:
    """하위 호환용."""
    return is_loaded("whisper")
