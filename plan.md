# Coda Studio Master Plan

## 1. Project Objective
10주 내에 로컬(RTX 5070 / 32GB RAM / Intel Core Ultra 5 환경)에서 완벽히 구동되는 End-to-End 영상화 자동화 툴 구축 및 Coda Cutter 확장의 기반 마련.

## 2. Phased Roadmap

- **Phase 1 (Week 1-2)** ✅: FastAPI 기초 및 Gemma 4 (Ollama) 파라미터 제네레이터 구축.
- **Phase 2 (Week 3-4)** ✅: Vision AI (SAM-HQ, Depth-Anything) 순차 실행 및 VRAM Purge 엔진.
- **Phase 3 (Week 5-6)** ✅: R3F WebGL 캔버스, 3대 타이틀, 루프 애니메이션, 에셋 바이패스 렌더 패스 구현.
- **Phase 4 (Week 7-8)** ✅: **EQ 오버레이 레이어 시스템** — 13종 Canvas 2D 프리셋, 드래그앤드랍, 색상/강도/투명도/미러 컨트롤, 익스포트 분리 레이어.
- **Phase 5 (Week 9-10)** 🔜: Studio 페이지 완성 + FFmpeg NVENC 듀얼 익스포트 연동.

## 3. Phase 5 상세 계획

### Studio 페이지
- [ ] 배경 이미지/영상 실제 업로드 → Three.js 씬 반영
- [ ] Scene 타임라인 다중 씬 지원 (v2)
- [ ] Whisper 가사 동기화 → 캔버스 텍스트 실시간 렌더

### 렌더링 파이프라인
- [ ] EQCanvasLayer → OffscreenCanvas 프레임 캡처
- [ ] FFmpeg NVENC (H.264/H.265) 16:9 + 9:16 듀얼 익스포트
- [ ] 백엔드 실제 연결 테스트 (uvicorn + Whisper + Export API)

## 4. EQ 탭 추가 기능 후보 (Phase 5 이후)
- POSITION 프리셋 버튼 (상단/중앙/하단 원클릭 이동)
- BLEND MODE (screen / multiply / overlay)
- SPEED 슬라이더 (애니메이션 속도 배수)
