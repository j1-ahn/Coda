# Product Requirements Document (PRD): Coda Studio

## 1. Product Overview
Coda Studio는 단일 이미지/오디오 파일 또는 원본 영상 소스를 활용하여 '시네마틱 감성'의 플레이리스트 영상(16:9)과 쇼츠(9:16)를 동시 생성하는 AI 제너러티브 스튜디오입니다. 

## 2. Target Audience
- AI 음악 창작자 (Suno/Udio 사용자)
- 로파이(Lo-fi) 및 플레이리스트 유튜버
- 고품질 오디오 비주얼라이저가 필요한 인디 뮤지션

## 3. Core Features (MVP)
- **AI Orchestration**: Gemma 4 기반 오디오/가사 분석, 하이라이트 구간 추출, 타이틀 모드 추천.
- **Cinematic Engine**: Depth-Anything 기반 패럴랙스, SAM-HQ 마스킹을 통한 절차적 루프 애니메이션(바람, 물결).
- **Persistent Title**: 3대 상주 모드(Hero-to-Corner, Ambient Object, Breathing) 적용.
- **Dual Export**: 16:9 풀버전과 9:16 하이라이트 쇼츠 동시 인코딩(FFmpeg NVENC).
- **Asset Layer**: 커스텀 로고/아이콘 배치 및 VFX(블룸, 그레인) 적용/우회(Bypass) 개별 설정.

## 4. Future Expansion (Add-on)
- **Coda Cutter**: 영상 소스(.mp4)를 타임라인에서 가볍게 컷/병합 편집 후 메인 스튜디오로 넘기는 프리프로세싱 모듈.