# Coda Studio — Gemini Handoff Report (2026-04-10)

## Project Overview
**Coda Studio** is an AI-powered cinematic video generation tool running locally on RTX 5070 (12GB VRAM).  
Target: Generate 16:9 playlist videos and 9:16 Shorts from a single image + audio input.  
Stack: Next.js 14 (App Router) + React Three Fiber + Zustand / FastAPI + Whisper + Ollama (Gemma 4)

---

## Architecture Summary

### Frontend
```
src/
  store/useCodaStore.ts       # Zustand master store
  components/
    Canvas/MainScene.tsx      # R3F 3-pass renderer
    UI/UploadPanel.tsx        # Image + audio upload
    UI/SubtitleEditor.tsx     # Whisper segment editor
    UI/VFXPanel.tsx           # Bloom/Grain/Vignette controls
    UI/ExportPanel.tsx        # Format + render control
  app/page.tsx                # 4-panel layout
```

### Backend
```
app/
  core/model_manager.py       # VRAM sequential purge singleton
  api/
    whisper_router.py         # POST /api/whisper/transcribe
    ollama_router.py          # POST /api/ollama/analyze-audio
    vision_router.py          # POST /api/vision/process
    export_router.py          # POST /api/export/render
```

---

## Data Model (Zustand Store)

### Core Types
```typescript
interface Scene {
  id: string;
  order: number;
  background: { type: 'image' | 'video'; url: string | null; fileName: string | null };
  durationSec: number;
  textTracks: TextTrack[];         // Whisper segments → canvas text
  effects: { parallaxEnabled: boolean; maskingEnabled: boolean };
}

interface AudioTrack {
  id: string;
  fileName: string;
  url: string | null;
  durationSec: number;
  whisperSegments: WhisperSegment[];
  linkedSceneId: string | null;    // v2: per-scene audio
  processing: 'idle' | 'uploading' | 'transcribing' | 'done' | 'error';
}

interface WhisperSegment {
  id: string; start: number; end: number; text: string;
}
```

### v2 Extension Points
- `scenes: Scene[]` — v1 uses `scenes[0]`, v2 adds multi-cut
- `TextTrack.type: 'lyric' | 'subtitle' | 'speech_bubble'` — speech bubble for webtoon mode
- `AudioTrack.linkedSceneId` — per-scene audio in v2

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/whisper/transcribe | multipart audio → `{segments, duration, language}` |
| POST | /api/ollama/analyze-audio | track metadata → VFX params, highlight ranges |
| POST | /api/vision/process | image → mask_url + depth_url (SAM-HQ → Depth-Anything) |
| POST | /api/export/render | trigger FFmpeg NVENC dual export, returns job_id |
| GET  | /api/export/status/{job_id} | poll render progress 0.0–1.0 |
| GET  | /api/whisper/vram | VRAM usage stats |
| GET  | /api/ollama/health | Ollama server health check |

---

## VRAM Pipeline (RTX 5070 / 12GB)

Sequential purge order:
1. Whisper inference → `torch.cuda.empty_cache()`
2. SAM-HQ masking → `torch.cuda.empty_cache()`
3. Depth-Anything-V2 → `torch.cuda.empty_cache()`
4. WebGL Canvas load (browser)
5. FFmpeg NVENC encode

ModelManager singleton (`app/core/model_manager.py`) handles load/unload with threading.Lock.

---

## 3-Pass Render Architecture (WebGL)

```
Pass 1 (Base)    — background texture + mouse parallax
Pass 2 (VFX)     — EffectComposer: Bloom + FilmGrain (Noise) + Vignette
                   + ExternalAssets with applyVFX=true
Pass 3 (Bypass)  — ExternalAssets with applyVFX=false, renderOrder=999, depthTest=false
```

---

## Today's Test Results

| Feature | Status | Notes |
|---------|--------|-------|
| Format switching (16:9↔9:16) | ✅ | Aspect ratio constraint applied |
| Title Mode (3 modes) | ✅ | Zustand state updates correctly |
| VFX toggle + sliders | ✅ | Real-time store update |
| Image upload → canvas | ✅ | R3F texture load confirmed |
| Audio track upload | ✅ | Card + duration display |
| Whisper transcribe | ⏳ | Backend not started yet |
| Export render | ⏳ | Backend not started yet |

---

## Known Issues / Next Steps

1. **Title animation** — 3 modes (Hero-to-Corner, Ambient-Object, Breathing) are state-only; WebGL animation not yet implemented (Phase 3)
2. **Parallax** — `useFrame` hook in place, needs tuning with real content
3. **Text → canvas sync** — Whisper segments parsed but not yet rendered on canvas
4. **Backend startup** — requires `pip install -r requirements.txt` + `ollama run gemma3:4b`

---

## Start Commands

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
# → http://localhost:3000
```
