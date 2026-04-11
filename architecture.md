# System Architecture & Pipeline

## 1. Core Stack
- Frontend: Next.js 14, React Three Fiber, Zustand (상태/레이아웃/에셋 관리).
- Backend: FastAPI, PyTorch.
- AI: Ollama(Gemma 4), Grounded-SAM-HQ, Depth-Anything-V2, Whisper.

## 2. VRAM 12GB Defensive Pipeline
- 병목과 OOM(Out of Memory)을 막기 위한 동기식 순차 처리.
- `LLM 추론` -> `SAM 마스킹` -> `Depth 추출` -> **`torch.cuda.empty_cache()`** -> `WebGL Canvas 로드` -> `NVENC 인코딩`.

## 3. Multi-Pass Rendering Architecture
- **Pass 1 (Base)**: 배경 텍스처(비디오 포함), 루프 마스킹 영역, 패럴랙스 처리.
- **Pass 2 (VFX)**: Bloom, Film Grain 등 전역 포스트 프로세싱 (VFX 켜진 외부 에셋 포함).
- **Pass 3 (Bypass)**: VFX를 무시하는 선명한 외부 에셋(채널 로고 등) 및 UI 오버레이.