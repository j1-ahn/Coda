# Coda Studio Master Plan

## 1. Project Objective
10주 내에 로컬(RTX 5070 / 32GB RAM / Intel Core Ultra 5 환경)에서 완벽히 구동되는 End-to-End 영상화 자동화 툴 구축 및 Coda Cutter 확장의 기반 마련.

## 2. Phased Roadmap
- **Phase 1 (Week 1-2)**: FastAPI 기초 및 Gemma 4 (Ollama) 파라미터 제네레이터 구축.
- **Phase 2 (Week 3-4)**: Vision AI (SAM-HQ, Depth-Anything) 순차 실행 및 VRAM Purge 엔진.
- **Phase 3 (Week 5-7)**: R3F WebGL 캔버스, 3대 타이틀, 루프 애니메이션, 에셋 바이패스 렌더 패스 구현.
- **Phase 4 (Week 8-9)**: Whisper 가사 동기화, 커스텀 대시보드(Zustand), 16:9/9:16 반응형 레이아웃 스토어.
- **Phase 5 (Week 10)**: FFmpeg(NVENC) 듀얼 자동 익스포트 연동.