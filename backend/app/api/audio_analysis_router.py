"""
audio_analysis_router.py
/api/audio-analysis/* — librosa 기반 오디오 특성 추출 + Ollama 프롬프트 파이프라인

Endpoints:
  POST /api/audio-analysis/features    — 오디오 파일 업로드 → BPM/key/energy/spectral 추출
  POST /api/audio-analysis/generate    — features + whisper segments → Ollama 프롬프트 생성
"""

from __future__ import annotations

import io
import json
import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/audio-analysis", tags=["audio-analysis"])

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "gemma4:e4b"
OLLAMA_TIMEOUT = 120.0

# ── Key detection helpers ────────────────────────────────────────────────────

_KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _estimate_key(y: "np.ndarray", sr: int) -> str:
    """Estimate musical key using chroma features (Krumhansl-Schmuckler)."""
    import librosa

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)  # 12-dimensional

    # Krumhansl-Kessler major/minor profiles
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    best_corr = -1.0
    best_key = "C major"

    for shift in range(12):
        shifted = np.roll(chroma_mean, -shift)
        corr_maj = float(np.corrcoef(shifted, major_profile)[0, 1])
        corr_min = float(np.corrcoef(shifted, minor_profile)[0, 1])

        if corr_maj > best_corr:
            best_corr = corr_maj
            best_key = f"{_KEY_NAMES[shift]} major"
        if corr_min > best_corr:
            best_corr = corr_min
            best_key = f"{_KEY_NAMES[shift]} minor"

    return best_key


def _classify_energy(rms_mean: float) -> str:
    """Classify track energy level from RMS mean."""
    if rms_mean < 0.02:
        return "very_low"
    elif rms_mean < 0.05:
        return "low"
    elif rms_mean < 0.12:
        return "medium"
    elif rms_mean < 0.25:
        return "high"
    else:
        return "very_high"


def _classify_mood(spectral_centroid: float, rms_mean: float, tempo: float) -> str:
    """Heuristic mood classification from audio features."""
    if rms_mean < 0.03 and tempo < 90:
        return "calm"
    elif rms_mean < 0.05 and spectral_centroid < 2000:
        return "melancholic"
    elif tempo > 140 and rms_mean > 0.15:
        return "energetic"
    elif spectral_centroid > 3500 and rms_mean > 0.1:
        return "bright"
    elif spectral_centroid < 1500 and rms_mean > 0.08:
        return "dark"
    elif tempo > 110 and rms_mean > 0.08:
        return "uplifting"
    else:
        return "neutral"


# ── Request/Response schemas ─────────────────────────────────────────────────

class AudioFeatures(BaseModel):
    bpm: float = Field(description="Estimated BPM")
    key: str = Field(description="Estimated musical key (e.g. 'C minor')")
    energy_level: str = Field(description="very_low|low|medium|high|very_high")
    spectral_centroid_hz: float = Field(description="Mean spectral centroid (Hz)")
    spectral_bandwidth_hz: float = Field(description="Mean spectral bandwidth (Hz)")
    zero_crossing_rate: float = Field(description="Mean ZCR")
    rms_mean: float = Field(description="Mean RMS energy")
    mood: str = Field(description="Heuristic mood classification")
    duration_sec: float = Field(description="Audio duration in seconds")
    onset_density: float = Field(description="Onsets per second — rhythmic density")


class FeaturesResponse(BaseModel):
    features: AudioFeatures
    energy_curve: List[float] = Field(
        default_factory=list,
        description="RMS energy curve (downsampled to ~100 points)",
    )


class GenerateFromAudioRequest(BaseModel):
    features: AudioFeatures
    whisper_segments: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Whisper STT segments [{start, end, text}, ...]",
    )
    model: str = Field(default="gemma4:e4b", description="Ollama model to use")


class GenerateFromAudioResponse(BaseModel):
    image_prompts: List[str] = Field(default_factory=list)
    audio_prompt: str = ""
    lyrics: str = ""
    scene_suggestions: List[Dict[str, Any]] = Field(default_factory=list)
    raw_response: str = ""


# ── Feature extraction endpoint ──────────────────────────────────────────────

@router.post("/features", response_model=FeaturesResponse)
async def extract_features(file: UploadFile = File(...)):
    """
    Upload an audio file → returns librosa-extracted audio features.
    Supports: mp3, wav, ogg, flac, m4a (anything ffmpeg can decode).
    """
    try:
        import librosa
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="librosa not installed. Run: pip install librosa soundfile",
        )

    # Save to temp file (librosa needs file path or buffer)
    audio_bytes = await file.read()
    suffix = Path(file.filename or "audio.mp3").suffix.lower() or ".mp3"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=22050, mono=True)
        duration = float(librosa.get_duration(y=y, sr=sr))

        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])

        # Key
        key = _estimate_key(y, sr)

        # RMS energy
        rms = librosa.feature.rms(y=y)[0]
        rms_mean = float(np.mean(rms))

        # Spectral centroid
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_mean = float(np.mean(centroid))

        # Spectral bandwidth
        bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        bandwidth_mean = float(np.mean(bandwidth))

        # Zero crossing rate
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_mean = float(np.mean(zcr))

        # Onset density (onsets per second)
        onsets = librosa.onset.onset_detect(y=y, sr=sr)
        onset_density = float(len(onsets) / max(duration, 0.1))

        # Energy level & mood classification
        energy_level = _classify_energy(rms_mean)
        mood = _classify_mood(centroid_mean, rms_mean, bpm)

        # Downsample RMS curve to ~100 points for frontend visualization
        target_points = 100
        if len(rms) > target_points:
            indices = np.linspace(0, len(rms) - 1, target_points, dtype=int)
            energy_curve = [round(float(rms[i]), 4) for i in indices]
        else:
            energy_curve = [round(float(v), 4) for v in rms]

        features = AudioFeatures(
            bpm=round(bpm, 1),
            key=key,
            energy_level=energy_level,
            spectral_centroid_hz=round(centroid_mean, 1),
            spectral_bandwidth_hz=round(bandwidth_mean, 1),
            zero_crossing_rate=round(zcr_mean, 4),
            rms_mean=round(rms_mean, 4),
            mood=mood,
            duration_sec=round(duration, 2),
            onset_density=round(onset_density, 2),
        )

        logger.info(
            "Audio features: BPM=%.1f key=%s energy=%s mood=%s dur=%.1fs",
            bpm, key, energy_level, mood, duration,
        )

        return FeaturesResponse(features=features, energy_curve=energy_curve)

    except Exception as exc:
        logger.exception("Feature extraction failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {exc}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# ── Ollama prompt generation from features ───────────────────────────────────

_AUDIO_PROMPT_SYSTEM = """You are a cinematic music video director AI.
Given real audio analysis data (BPM, key, energy, mood) and optional lyrics from speech-to-text,
generate creative content for a music video production.

Return a JSON object with EXACTLY this schema:
{
  "image_prompts": [
    "<Midjourney prompt 1 — cinematic scene matching the audio mood>",
    "<Midjourney prompt 2 — different angle/scene>",
    "<Niji prompt — anime style scene>"
  ],
  "audio_prompt": "<music production prompt: genre, subgenre, BPM, key, instruments, mood>",
  "lyrics": "<Korean lyrics 8-16 lines matching the mood, or refined version of provided lyrics>",
  "scene_suggestions": [
    {
      "time_range": "<e.g. 0:00-0:30>",
      "description": "<scene description>",
      "vfx_hint": "<bloom|vignette|grain|glitch|none>",
      "transition": "<fade|dissolve|wipe-left|cut>"
    }
  ]
}

Rules:
- image_prompts: 2 Midjourney (end with --ar 16:9 --v 6 --style raw) + 1 Niji (--ar 16:9 --niji 6)
- Match the detected BPM, key, energy, and mood precisely
- scene_suggestions: 3-5 scenes spread across the track duration
- If lyrics are provided from STT, use them as inspiration; if not, create original Korean lyrics
- Output ONLY valid JSON — no markdown, no explanation.
"""


def _build_audio_user_prompt(
    features: AudioFeatures,
    whisper_segments: List[Dict[str, Any]],
) -> str:
    parts = [
        "=== Audio Analysis ===",
        f"BPM: {features.bpm}",
        f"Key: {features.key}",
        f"Energy: {features.energy_level} (RMS={features.rms_mean:.3f})",
        f"Mood: {features.mood}",
        f"Spectral Centroid: {features.spectral_centroid_hz:.0f} Hz",
        f"Onset Density: {features.onset_density:.1f} onsets/sec",
        f"Duration: {features.duration_sec:.0f}s",
    ]

    if whisper_segments:
        lyrics_text = " / ".join(
            seg.get("text", "") for seg in whisper_segments[:30]
        )
        parts.append(f"\n=== Detected Lyrics (STT) ===\n{lyrics_text}")

    return "\n".join(parts)


def _default_generate_response(raw: str = "") -> GenerateFromAudioResponse:
    return GenerateFromAudioResponse(
        image_prompts=["(생성 실패)"],
        audio_prompt="",
        lyrics="",
        scene_suggestions=[],
        raw_response=raw,
    )


def _parse_generate_response(raw: str) -> GenerateFromAudioResponse:
    text = raw.strip()
    if "```" in text:
        blocks = text.split("```")
        for i, block in enumerate(blocks):
            if i % 2 == 1:
                text = block.strip()
                if text.startswith("json"):
                    text = text[4:].strip()
                break

    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        return _default_generate_response(raw)

    try:
        data: Dict[str, Any] = json.loads(text[start:end])
    except json.JSONDecodeError:
        return _default_generate_response(raw)

    return GenerateFromAudioResponse(
        image_prompts=data.get("image_prompts", []),
        audio_prompt=data.get("audio_prompt", ""),
        lyrics=data.get("lyrics", ""),
        scene_suggestions=data.get("scene_suggestions", []),
        raw_response=raw,
    )


@router.post("/generate", response_model=GenerateFromAudioResponse)
async def generate_from_audio(req: GenerateFromAudioRequest):
    """
    Audio features + optional whisper segments → Ollama 프롬프트 파이프라인.
    실제 오디오 분석 데이터를 기반으로 이미지/오디오/가사 프롬프트를 생성합니다.
    """
    user_prompt = _build_audio_user_prompt(req.features, req.whisper_segments)
    payload = {
        "model": req.model or OLLAMA_MODEL,
        "prompt": user_prompt,
        "system": _AUDIO_PROMPT_SYSTEM,
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 2000},
    }

    logger.info(
        "Generating from audio: BPM=%.1f key=%s mood=%s model=%s",
        req.features.bpm, req.features.key, req.features.mood, req.model,
    )

    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            resp.raise_for_status()
            raw_text = resp.json().get("response", "")
            logger.info("Audio generate response length: %d chars", len(raw_text))
    except httpx.ConnectError:
        logger.warning("Ollama unreachable for audio prompt generation.")
        return _default_generate_response("(Ollama unreachable)")
    except Exception as exc:
        logger.warning("Audio prompt gen failed: %s", exc)
        return _default_generate_response(str(exc))

    return _parse_generate_response(raw_text)
