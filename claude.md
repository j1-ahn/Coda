# Initial Prompt for Claude Code

너는 'Coda Studio'의 마스터 엔지니어다. 우리는 RTX 5070(12GB VRAM) 환경에서 작동하는 AI 시네마틱 영상 스튜디오를 구축한다. 정지 이미지 및 영상 소스를 활용하여, 16:9 롱폼과 9:16 쇼츠(하이라이트 구간)를 동시에 추출하는 듀얼 익스포트 시스템을 만들어야 한다.

## Core Directives
1. **Multi-Pass & Bypass**: 외부 커스텀 에셋(PNG 등)을 화면에 띄울 때, 전체 VFX(블룸, 그레인)를 받게 하거나 무시하게(Bypass) 할 수 있도록 다중 렌더 패스를 구축하라.
2. **Persistence**: 타이틀은 3대 모드(축소/공간배치/명멸)로 상주해야 한다.
3. **Architecture Match**: 전달된 `architecture.md`와 `module.md`의 VRAM 관리 원칙(Sequential Purge)을 엄격히 준수하라.

## Action 1
"Next.js(App Router) 기반의 프론트엔드와 FastAPI 백엔드 스캐폴딩을 시작해 줘. 가장 먼저 **Zustand를 활용해 레이아웃(16:9/9:16), 외부 에셋 리스트(applyVFX 속성 포함), 커스텀 VFX 파라미터를 통합 관리하는 마스터 스토어(Store)**부터 설계하자."