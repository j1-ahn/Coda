# Coda Studio Dev Report — 2026-04-10

## 오늘 완료된 작업

### Phase 0: 스캐폴딩
- GitHub 리포 생성 및 초기 push (https://github.com/j1-ahn/Coda)
- Next.js 14 (App Router) + FastAPI 프로젝트 구조 생성
- Zustand 마스터 스토어 설계 (Scene 기반, v2 확장 고려)

### Phase 1: Backend
- FastAPI 기본 앱 + CORS 설정
- `/api/whisper/transcribe` — Whisper large-v3, VRAM Purge
- `/api/ollama/analyze-audio` — Gemma 4 (gemma3:4b) 파라미터 추천
- `/api/vision/process` — SAM-HQ → Depth-Anything 순차 파이프라인, graceful fallback
- `/api/export/render` — FFmpeg NVENC 듀얼 익스포트 (16:9 + 9:16), NVENC 없으면 libx264 fallback
- `ModelManager` — 범용 VRAM Sequential Purge 싱글톤

### Phase 2: Frontend
- Zustand 스토어: Scene[], AudioTrack[], ExternalAsset[], VFXParams, TitleMode
- MainScene (React Three Fiber): 3-Pass 렌더 (Background / VFX EffectComposer / Bypass)
- UploadPanel: 이미지 D&D + 오디오 다중 업로드, Whisper API 연동
- SubtitleEditor: Whisper 세그먼트 편집, 플레이헤드 하이라이트, JSON 내보내기
- VFXPanel: Bloom/FilmGrain/Vignette 슬라이더+토글
- ExportPanel: Format/TitleMode 셀렉터, 렌더 진행 폴링

### Phase 2.5: 프론트 UI 테스트 및 버그 수정
- 테스트 결과: Format 전환 ✅, TitleMode 전환 ✅, VFX 토글 ✅, 이미지 업로드 ✅, 오디오 트랙 ✅
- 버그 수정:
  - `/placeholder.png` 404 → 배경 없을 때 mesh 렌더 스킵으로 변경
  - 9:16 전환 시 캔버스 비율 미적용 → `aspectRatio` CSS 동적 적용

## 내일 이어서 할 작업 (Phase 3)
- [ ] 패럴랙스 애니메이션 (마우스 추적 배경 이동)
- [ ] 3대 타이틀 모드 WebGL 구현 (Hero-to-Corner / Ambient Object / Breathing)
- [ ] Whisper 자막 ↔ 캔버스 텍스트 실시간 동기화
- [ ] 백엔드 연결 테스트 (pip install + uvicorn 실행)

## 알려진 이슈
- 백엔드 미실행 상태에서 "자막 분석" 버튼 클릭 시 HTTP 404 (정상 — 백엔드 미시작)
- Three.js Canvas가 SSR 비활성화로 초기 로딩 시 짧은 "INITIALIZING CANVAS..." 표시
