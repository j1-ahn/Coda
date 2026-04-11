# Coda Studio 개발 일지 — 2026-04-10

## 오늘 한 일 요약

### 1. 프로젝트 초기 세팅
- GitHub 리포 생성 및 초기 push → https://github.com/j1-ahn/Coda
- Next.js 14 + FastAPI 프로젝트 스캐폴딩 완료

### 2. Zustand 마스터 스토어 설계
- `scenes: Scene[]` 배열 기반 타임라인 구조 (v1=1개, v2=다중)
- `TextTrack.type`: `lyric | subtitle | speech_bubble` (말풍선 확장 준비)
- `AudioTrack.linkedSceneId`: v2 씬별 오디오 연결
- `ExternalAsset.applyVFX`: VFX 포함/Bypass 분기

### 3. Backend (FastAPI)
| 파일 | 내용 |
|------|------|
| `whisper_router.py` | 오디오 → Whisper 트랜스크립션, VRAM Purge |
| `ollama_router.py` | Gemma 4 연동, VFX 파라미터 추천 |
| `vision_router.py` | SAM-HQ → Depth-Anything 순차 파이프라인 |
| `export_router.py` | FFmpeg NVENC 듀얼 익스포트 (16:9 + 9:16) |
| `model_manager.py` | VRAM Sequential Purge 싱글톤 |

### 4. Frontend (React Three Fiber)
| 파일 | 내용 |
|------|------|
| `MainScene.tsx` | 3-Pass 렌더 (배경/VFX EffectComposer/Bypass) |
| `UploadPanel.tsx` | 이미지 D&D + 오디오 다중 업로드 |
| `SubtitleEditor.tsx` | Whisper 세그먼트 편집, 플레이헤드 하이라이트 |
| `VFXPanel.tsx` | Bloom/FilmGrain/Vignette 슬라이더 |
| `ExportPanel.tsx` | 포맷/타이틀 모드 + 렌더 폴링 |

### 5. UI 테스트 결과
- ✅ Format 전환 (16:9 ↔ 9:16) — 캔버스 비율 동적 적용
- ✅ Title Mode 전환 (Hero→Corner / Ambient / Breathing)
- ✅ VFX 슬라이더+토글 실시간 반영
- ✅ 이미지 업로드 → 캔버스 표시
- ✅ 오디오 트랙 카드 + 상태 배지
- ⏳ Whisper 분석, 렌더 — 백엔드 미시작 (정상)

### 6. 버그 수정
1. `/placeholder.png` 404 — 배경 없을 때 mesh 렌더 스킵으로 변경
2. 9:16 전환 시 캔버스 비율 미적용 — `aspectRatio` CSS 동적 적용

---

## 내일 이어서 (Phase 3)
- [ ] 3대 타이틀 모드 WebGL 구현 (Hero-to-Corner / Ambient Object / Breathing)
- [ ] 패럴랙스 애니메이션 심화 (마우스 추적 + 깊이 기반)
- [ ] Whisper 세그먼트 → 캔버스 텍스트 실시간 동기화
- [ ] 백엔드 실제 연결 테스트 (`pip install` + `uvicorn`)

---

## 알려진 이슈
- Three.js Canvas SSR 비활성화로 첫 로드 시 "INITIALIZING CANVAS..." 짧게 표시 (정상)
- 백엔드 미시작 상태에서 API 버튼 클릭 시 HTTP 404 (정상)
