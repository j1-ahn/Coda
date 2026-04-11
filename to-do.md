# Coda Implementation To-Do (For Claude)

- [x] FastAPI 환경 및 Ollama(Gemma 4) 연동 라우터 생성.
- [x] VRAM 12GB 안전을 위한 SAM/Depth 순차 로드 및 캐시 삭제 로직 구축.
- [x] Zustand 기반 마스터 스토어(레이아웃, VFX, 에셋, 타이틀 모드) 설계.
- [ ] Three.js `EffectComposer`를 활용한 VFX Bypass 다중 렌더 패스 세팅. (스켈레톤 완료, 타이틀 애니 미구현)
- [ ] 16:9 / 9:16 변환 캔버스 레이아웃 엔진 적용. (기본 비율 적용 완료, 세부 조정 필요)
- [ ] 외부 이미지 드래그 앤 드롭 및 뎁스 가림 셰이더 작성.
- [ ] FFmpeg(NVENC) 듀얼 인코딩 프로세스 구축. (API 완료, 실제 테스트 필요)