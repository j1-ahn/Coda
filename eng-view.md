# Engineering View

## 1. Dual Format Layout Engine
- `currentFormat: '16:9' | '9:16'` 상태 구독.
- 9:16 전환 시 Gemma 4가 도출한 `highlightFocus` 좌표를 기준으로 캔버스 오프셋 자동 리매핑.

## 2. Shader & Motion
- **Procedural Loop**: 카테고리별 마스크(물, 머리) 영역에 Perlin Noise를 적용한 UV 왜곡 (`uTime` 기반).
- **Spatial Object**: `uDepthTexture` 기반 `discard` 연산을 통한 투명도/가림(Occlusion) 처리.

## 3. Export Specification
- Canvas `captureStream(60)`으로 프레임 추출.
- FFmpeg: `-c:v h264_nvenc -preset p7 -cq 20 -b:v 20M` 적용으로 하드웨어 가속.