"""
ollama_router.py
Ollama Gemma 4 연동 — 오디오 메타데이터 분석 및 씬/VFX 파라미터 추천.

엔드포인트:
  POST /api/ollama/analyze-audio  — Gemma 4로 씬/VFX 파라미터 추천 생성
  GET  /api/ollama/health         — Ollama 서버 연결 상태 체크
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ollama", tags=["ollama"])

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "gemma3:4b"
OLLAMA_TIMEOUT = 120.0  # seconds — LLM generation can be slow

# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AnalyzeAudioRequest(BaseModel):
    track_name: str = Field(..., description="트랙명", examples=["봄비"])
    duration_sec: float = Field(..., description="길이(초)", examples=[185.0])
    lyrics_hint: Optional[str] = Field(
        default=None,
        description="사용자 입력 가사 또는 설명",
        examples=["봄비가 내리는 거리..."],
    )
    style_hint: Optional[str] = Field(
        default=None,
        description="스타일 힌트",
        examples=["lofi, melancholic"],
    )


class BloomParams(BaseModel):
    enabled: bool = True
    intensity: float = 0.4
    threshold: float = 0.8


class FilmGrainParams(BaseModel):
    enabled: bool = True
    intensity: float = 0.15


class VignetteParams(BaseModel):
    enabled: bool = True
    darkness: float = 0.4


class SuggestedVFX(BaseModel):
    bloom: BloomParams = Field(default_factory=BloomParams)
    film_grain: FilmGrainParams = Field(default_factory=FilmGrainParams)
    vignette: VignetteParams = Field(default_factory=VignetteParams)


class HighlightRange(BaseModel):
    start: float
    end: float
    reason: str


class AnalyzeAudioResponse(BaseModel):
    suggested_title_mode: str = "breathing"
    suggested_vfx: SuggestedVFX = Field(default_factory=SuggestedVFX)
    highlight_ranges: List[HighlightRange] = Field(default_factory=list)
    color_mood: str = "neutral"
    raw_response: str = ""


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a cinematic VFX and music video director AI.
Given audio metadata, return a JSON object with EXACTLY this schema — no extra keys:

{
  "suggested_title_mode": "<shrink|spatial|breathing>",
  "suggested_vfx": {
    "bloom": {"enabled": <bool>, "intensity": <0.0-1.0>, "threshold": <0.0-1.0>},
    "film_grain": {"enabled": <bool>, "intensity": <0.0-0.5>},
    "vignette": {"enabled": <bool>, "darkness": <0.0-1.0>}
  },
  "highlight_ranges": [
    {"start": <seconds float>, "end": <seconds float>, "reason": "<short reason>"}
  ],
  "color_mood": "<cool_blue|warm_amber|neon_pink|muted_green|neutral|dark_crimson>"
}

Rules:
- Output ONLY valid JSON — no markdown, no explanation.
- highlight_ranges should contain 1-3 emotionally significant time windows.
- Match the mood and style hints carefully.
"""


def _build_user_prompt(req: AnalyzeAudioRequest) -> str:
    parts = [
        f"Track: {req.track_name}",
        f"Duration: {req.duration_sec}s",
    ]
    if req.lyrics_hint:
        parts.append(f"Lyrics/Description: {req.lyrics_hint}")
    if req.style_hint:
        parts.append(f"Style: {req.style_hint}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Default values (used when parsing fails)
# ---------------------------------------------------------------------------

def _default_response(raw: str = "") -> AnalyzeAudioResponse:
    return AnalyzeAudioResponse(
        suggested_title_mode="breathing",
        suggested_vfx=SuggestedVFX(
            bloom=BloomParams(enabled=True, intensity=0.4, threshold=0.8),
            film_grain=FilmGrainParams(enabled=True, intensity=0.15),
            vignette=VignetteParams(enabled=True, darkness=0.4),
        ),
        highlight_ranges=[],
        color_mood="neutral",
        raw_response=raw,
    )


def _parse_ollama_response(raw: str, duration_sec: float) -> AnalyzeAudioResponse:
    """
    Ollama의 raw 텍스트에서 JSON을 파싱합니다.
    실패 시 기본값을 반환하고 에러를 throw하지 않습니다.
    """
    # JSON 블록 추출 (마크다운 코드펜스 처리)
    text = raw.strip()
    if "```" in text:
        # ```json ... ``` 또는 ``` ... ``` 형태
        blocks = text.split("```")
        for i, block in enumerate(blocks):
            if i % 2 == 1:  # 홀수 인덱스 = 코드블록 내부
                text = block.strip()
                if text.startswith("json"):
                    text = text[4:].strip()
                break

    # 중괄호 기반 추출 시도
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        logger.warning("No JSON object found in Ollama response.")
        return _default_response(raw)

    json_str = text[start:end]

    try:
        data: Dict[str, Any] = json.loads(json_str)
    except json.JSONDecodeError as exc:
        logger.warning("JSON parse error: %s — raw=%r", exc, json_str[:200])
        return _default_response(raw)

    try:
        # highlight_ranges 범위 클램핑
        hl_raw = data.get("highlight_ranges", [])
        highlight_ranges = []
        for hl in hl_raw:
            s = float(hl.get("start", 0))
            e = float(hl.get("end", min(s + 30, duration_sec)))
            reason = str(hl.get("reason", ""))
            highlight_ranges.append(HighlightRange(start=s, end=e, reason=reason))

        vfx_raw = data.get("suggested_vfx", {})
        bloom_raw = vfx_raw.get("bloom", {})
        grain_raw = vfx_raw.get("film_grain", {})
        vign_raw = vfx_raw.get("vignette", {})

        return AnalyzeAudioResponse(
            suggested_title_mode=str(data.get("suggested_title_mode", "breathing")),
            suggested_vfx=SuggestedVFX(
                bloom=BloomParams(
                    enabled=bool(bloom_raw.get("enabled", True)),
                    intensity=float(bloom_raw.get("intensity", 0.4)),
                    threshold=float(bloom_raw.get("threshold", 0.8)),
                ),
                film_grain=FilmGrainParams(
                    enabled=bool(grain_raw.get("enabled", True)),
                    intensity=float(grain_raw.get("intensity", 0.15)),
                ),
                vignette=VignetteParams(
                    enabled=bool(vign_raw.get("enabled", True)),
                    darkness=float(vign_raw.get("darkness", 0.4)),
                ),
            ),
            highlight_ranges=highlight_ranges,
            color_mood=str(data.get("color_mood", "neutral")),
            raw_response=raw,
        )
    except Exception as exc:
        logger.warning("Response mapping error: %s", exc)
        return _default_response(raw)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/analyze-audio", response_model=AnalyzeAudioResponse)
async def analyze_audio(req: AnalyzeAudioRequest) -> AnalyzeAudioResponse:
    """
    오디오 메타데이터를 Gemma 4로 분석하여 씬/VFX 파라미터를 추천합니다.

    - Ollama HTTP API (`http://localhost:11434/api/generate`) 비동기 호출.
    - 파싱 실패 / 서버 연결 불가 시 기본값을 반환합니다 (에러 throw 안 함).
    """
    user_prompt = _build_user_prompt(req)
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": user_prompt,
        "system": _SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 512,
        },
    }

    logger.info(
        "Sending analyze-audio to Ollama. track='%s', duration=%.1fs",
        req.track_name,
        req.duration_sec,
    )

    raw_text = ""
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            raw_text = data.get("response", "")
            logger.info("Ollama response length: %d chars", len(raw_text))
    except httpx.ConnectError:
        logger.warning("Ollama server unreachable — returning default VFX params.")
        return _default_response("(Ollama unreachable)")
    except httpx.HTTPStatusError as exc:
        logger.warning("Ollama HTTP error %s — returning defaults.", exc.response.status_code)
        return _default_response(f"(HTTP {exc.response.status_code})")
    except Exception as exc:
        logger.warning("Ollama call failed: %s — returning defaults.", exc)
        return _default_response(str(exc))

    return _parse_ollama_response(raw_text, req.duration_sec)


@router.get("/health")
async def ollama_health() -> dict:
    """
    Ollama 서버 연결 상태를 확인합니다.

    Returns:
        {"status": "ok" | "unreachable", "model": "gemma3:4b"}
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            return {"status": "ok", "model": OLLAMA_MODEL}
    except Exception as exc:
        logger.warning("Ollama health check failed: %s", exc)
        return {"status": "unreachable", "model": OLLAMA_MODEL}
