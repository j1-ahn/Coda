# Coda Studio — Dev Report 2026-04-13
## Phase 3 v0.3.0 (commit `c14b65f`, tag `v0.3.0`)

---

## 오늘 완료한 작업

### 1. STT 파이프라인 실제 연결
- `openai-whisper` 패키지 설치 + `large-v3` 모델 로드 확인
- `no_speech_threshold=0.3`, `condition_on_previous_text=True` — 초반 30초 무음 판정 억제
- 언어 기본값 `None` (자동 감지) → 할루시네이션("다음 영상에서 만나요") 방지
- WhisperSyncPanel에 언어 드롭다운 추가 (auto / ko / en / ja / zh)
- 대용량 파일 Next.js proxy 우회: `http://localhost:8000/api/whisper/transcribe` 직접 호출

### 2. 실시간 STT 프로그레스 바
- `whisper_router.py`: tqdm monkey-patching → `_progress` dict 업데이트
- `GET /api/whisper/progress/{job_id}`: 500ms 폴링
- WhisperSyncPanel `TranscribeProgress` 컴포넌트:
  - "모델 로딩 중…" → "음성 인식 중…" 페이즈 전환
  - 진행률 바 + 파형 애니메이션 (16개 막대, pulse)

### 3. Ollama 번역
- `POST /api/ollama/translate`: gemma4:e4b, 배치 20세그먼트
- Ollama 미설치 시 warning 반환 (앱 크래시 없음)
- WhisperSyncPanel에 "한국어 번역(Ollama)" 버튼 추가

### 4. SRT 파일 불러오기
- `parseSRT()` 함수: 블록 분리 → timecode 정규식 → `timeToSec()` 변환
- ManualLyricInput에 SRT 파일 선택 버튼 + 성공/실패 메시지

### 5. 자막 색상 스타일 4종
- `lyricColorStyle` 스토어 필드: `white | black | outline-black | box`
- `LyricHTMLOverlay`: `COLOR_STYLE_CSS` 맵 적용
  - `outline-black`: text-shadow 4방향 ±1px (WebkitTextStroke 대신 — 흰 영역 더 넓음)
  - `box`: rgba(0,0,0,0.65) 래퍼
- `LyricFontPanel`: 색상 스타일 4종 버튼 행 추가

### 6. SubtitleEditor 우클릭 삽입
- SegmentRow `onContextMenu` → `handleInsertAbove(idx)` 호출
- 삽입 위치: 이전 세그먼트 end ~ 현재 세그먼트 start 중간값
- `setWhisperSegments`로 배열 직접 조작

### 7. EQ 오버레이 Overflow 수정
- 드래그/리사이즈 핸들러: `Math.min(newH, 100 - oy)` 등 clamp
- `EQCanvasLayer`: `safeOx`, `safeOy`, `safeOh` 계산 후 스타일 적용
- `overflow-hidden`은 EQCanvasLayer에만 적용

### 8. PlaylistPanel 만료 URL 처리
- `hydrateFromLocalStorage`: null URL 트랙 자동 필터링 + activeAudioTrackId 재설정
- PlaylistPanel: `url === null` 트랙 → 취소선 + "만료" 배지

### 9. 렌더 파이프라인 스캐폴딩 (신규 파일)
- `backend/app/api/render_router.py`
- `backend/app/core/render_session.py`, `ffmpeg_nvenc.py`
- `frontend/src/lib/renderer/`: RenderJob, FrameDumper, OverlayPainter, AudioExporter, types
- `frontend/src/components/UI/RenderPanel.tsx`

---

## 알려진 이슈 (내일 조치)

| 이슈 | 증상 | 원인 추정 |
|------|------|-----------|
| STT HTTP 500 간헐적 발생 | 특정 오디오 파일에서 에러 | 파일 포맷/인코딩 문제, 또는 VRAM 부족 (6GB 이미 점유) |

- 테스트 WAV (1초 무음)로는 정상 동작 확인됨
- 내일: 실제 파일로 재현 후 ffprobe로 포맷 확인, `ffmpeg -i` 전처리 추가 검토

---

## 내일 우선순위

1. **STT 안정화** — 실제 오디오 파일 에러 재현 + 수정
2. **이미지 다중 업로드** — 씬당 이미지 여러 장 등록 + 트랜지션 설정 (dissolve/cut/fade)
3. (선택) FFmpeg NVENC 렌더링 파이프라인 연결

---

## Git

```
tag:    v0.3.0
commit: c14b65f
branch: master
```
