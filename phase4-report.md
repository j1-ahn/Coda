# Phase 4 완료 리포트 — EQ 오버레이 레이어 시스템

**작업일:** 2026-04-11 ~ 2026-04-12  
**담당:** 제스테로 + Claude Sonnet 4.6

---

## 개요

EQ(이퀄라이저) 비주얼라이저를 단순 사이드바 프리뷰에서 **영상 캔버스 위에 자유롭게 배치 가능한 오버레이 레이어**로 발전시켰다. 렌더링 시 EQ 캔버스만 영상에 합성되고 컨트롤 UI는 제외되도록 레이어를 완전히 분리했다.

---

## 완료 항목

### 1. Canvas 2D 프리셋 시스템 (13종)
| 프리셋 | 특징 |
|--------|------|
| BASIC 1 | 오실로스코프 멀티 트레이스 |
| BASIC 2 | 그라디에이션 웨이브 블롭 |
| BASIC 3 | 스펙트럼 바 (52개) |
| BASIC 4 | 핑크 필드 스무스 웨이브폼 |
| BASIC 5 | 리본 흐름 (18선) |
| WAVEFORM | CRT 오실로스코프 스타일 |
| LISSAJOUS | 파라메트릭 리사주 도형 + 재생시간 |
| MAGENTA | 네온 블롭 메타볼 |
| ETHER | 소프트 클라우드 모핑 블롭 |
| RADIAL | 원형 바 비주얼라이저 (128바) |
| PIXEL | 스크롤 도트그리드 워터폴 |
| BLOOM | 수채화 블리드 확산 |
| HORIZON | 오디오 반응형 그라디에이션 |
| SINGULARITY | 단방향 스펙트럼 바 (64개) |

- 모든 프리셋: 배경 투명(`clearRect`), `colorTint` 기반 색상 반영
- `dynamic()` 래퍼 제거 → prop 변경 즉시 반영

### 2. EQ 오버레이 레이어 분리
- **`EQCanvasLayer`**: `#studio-canvas-container` 내부 `position:absolute` — 영상 익스포트 캡처 대상
- **`EQOverlayWidget`**: `position:fixed` 크롬 UI — 드래그/리사이즈 핸들만, 익스포트 제외
- 두 컴포넌트가 Zustand 스토어를 통해 위치/크기/플립 상태 공유

### 3. 드래그앤드랍 UX
- 사이드바 EQ 캔버스에서 메인 캔버스로 드래그
- 드랍 시 컨테이너 **정중앙**에 배치
- 고스트 div로 시각적 피드백

### 4. 리사이즈
- 상/하/좌/우 4방향 핸들 (`cursor-ns-resize` / `cursor-ew-resize`)
- 최소 너비 120px, 최소 높이 60px

### 5. 컨트롤 패널
| 컨트롤 | 범위 | 기능 |
|--------|------|------|
| INTENSITY | 0–100 (default 50) | 오디오 반응 강도 (`sensitivity × 2`) |
| OPACITY | 0–100 (default 100) | 오버레이 전체 투명도 |
| MIRROR | ON/OFF | 하단 거울 반사 + 그라디에이션 페이드 |
| COLOR | 컬러피커 + APPLY/RESET | EQ 색상 커스텀 (`eqTintColor`) |

### 6. 스토어 확장 (Zustand)
신규 필드: `eqSensitivity`, `eqOverlayX/Y/W/H`, `eqFlipX/Y`, `eqTintColor`, `eqOpacity`, `eqMirror`  
신규 액션: `setEqOverlayGeometry`, `setEqFlip`, `setEqTintColor`, `setEqOpacity`, `setEqMirror`

### 7. 정리 작업
- React Mode 제거 (모든 프리셋 `original` 고정)
- ORBIT, CUSTOM 프리셋 제거
- SENS 슬라이더 제거 (INTENSITY로 통합)
- `eqAnalyserRef` 모듈레벨 ref로 60fps 오디오 데이터 공유 (React 렌더 우회)

---

## 아키텍처 다이어그램

```
EqualizerTab (사이드바)
  ├── EQAudioPlayer  →  eqAnalyserRef.current (60fps RAF 업데이트)
  ├── EQCanvas (프리뷰, 160px)
  └── 컨트롤: INTENSITY / OPACITY / MIRROR / COLOR

page.tsx
  ├── #studio-canvas-container
  │     ├── MainScene (Three.js)
  │     └── EQCanvasLayer ← eqAnalyserRef 읽기 (익스포트 대상)
  └── EQOverlayWidget (fixed, 크롬 UI만)
```

---

## 다음 Phase (Phase 5)

- Studio 페이지 완성 (배경 업로드 실제 연동, 타임라인)
- FFmpeg NVENC 렌더링 파이프라인 (EQ 합성 포함)
- 백엔드 실제 연결 테스트
