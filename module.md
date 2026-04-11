# Coda Code Modules

## 1. /backend (FastAPI)
- `/ai/orchestrator.py`: Gemma 4 연동 및 JSON 스키마 변환.
- `/ai/vision.py`: SAM-HQ, Depth-Anything 모델 로더 및 VRAM 관리자.
- `/export/encoder.py`: FFmpeg NVENC 듀얼 익스포트 제어 라우터.
- `/addon/cutter.py`: (추후) Coda Cutter 비디오 트림/머지 엔드포인트.

## 2. /frontend (Next.js)
- `/store/useCodaStore.ts`: 상태 중앙 관리 (타이틀 모드, 렌더 포맷, VFX 파라미터, 외부 에셋 리스트).
- `/components/Canvas/MainScene.tsx`: 다중 렌더 패스(EffectComposer) 구현부.
- `/components/UI/Dashboard.tsx`: 사용자 커스텀 패널 (Dat.GUI / Leva 스타일).