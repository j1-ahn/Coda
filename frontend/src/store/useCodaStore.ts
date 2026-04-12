import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

export interface WhisperSegment {
  id: string;
  start: number;   // seconds
  end: number;
  text: string;
}

export interface TextTrack {
  id: string;
  type: 'lyric' | 'subtitle' | 'speech_bubble';
  segments: WhisperSegment[];
  style: {
    fontSize: number;
    color: string;
    position: 'bottom' | 'top' | 'center';
    fontFamily: string;
  };
}

export interface Scene {
  id: string;
  order: number;
  background: {
    type: 'image' | 'video';
    url: string | null;      // object URL or remote URL
    fileName: string | null;
  };
  durationSec: number;
  textTracks: TextTrack[];
  effects: {
    parallaxEnabled: boolean;
    parallaxStrength: number;
    maskingEnabled: boolean;
    loopModes: { wind: boolean; ripple: boolean; depth: boolean };
    loopStrength: number;             // 0~1
    depthMapUrl: string | null;       // grayscale depth map (bright=near, dark=far)
    loopMaskPoints: { x: number; y: number }[];  // normalized 0-1, screen coord
    // NEW: per-mode detailed params
    windDirection: number;    // 0-7 (octant index: 0=right,1=↘,2=down,3=↙,4=left,5=↖,6=up,7=↗)
    windSpeed: number;        // 0.1-3.0, default 1.0
    windFrequency: number;    // 1-12, default 4.0
    windTurbulence: number;   // 0-1, default 0.0
    rippleOriginX: number;    // 0-1, default 0.5
    rippleOriginY: number;    // 0-1, default 0.5
    rippleSpeed: number;      // 0.1-3.0, default 1.0
    rippleDecay: number;      // 0.1-1.0, default 0.65
    depthNearSpeed: number;   // 0-3.0,  default 1.5  (근거리)
    depthMidSpeed:  number;   // 0-2.0,  default 1.0  (중거리)
    depthFarSpeed:  number;   // 0-1.0,  default 0.25 (원거리)
    depthHaze: number;        // 0-1, default 0.5
  };
}

export interface AudioTrack {
  id: string;
  fileName: string;
  url: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  whisperSegments: WhisperSegment[];
  linkedSceneId: string | null;   // v2: 특정 씬에 오디오 연결
  processing: 'idle' | 'uploading' | 'transcribing' | 'done' | 'error';
  error: string | null;
}

export interface ExternalAsset {
  id: string;
  fileName: string;
  url: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  applyVFX: boolean;  // true → VFX 패스 포함, false → Bypass 패스
}

export interface VFXParams {
  bloom:     { enabled: boolean; intensity: number; threshold: number };
  filmGrain: { enabled: boolean; intensity: number };
  vignette:  { enabled: boolean; darkness: number };
  sparkle:   { enabled: boolean; count: number; speed: number };
  dust:      { enabled: boolean; count: number; speed: number };
  filmBurn:  { enabled: boolean; intensity: number };
  chromatic: { enabled: boolean; offset: number };
  scanline:  { enabled: boolean; density: number; opacity: number };
  glitch:    { enabled: boolean; strength: number };
}

// ---------------------------------------------------------------------------
// Store Interface
// ---------------------------------------------------------------------------

export interface CodaStore {
  // 프로젝트 ID (백엔드 업로드 키)
  projectId: string;

  // 레이아웃/익스포트
  exportFormat: '16:9' | '9:16' | 'both';

  // 타임라인 - scenes 배열 (v1: 항상 1개, v2: 다수)
  scenes: Scene[];
  activeSceneId: string | null;

  // 오디오 트랙 (다중)
  audioTracks: AudioTrack[];
  activeAudioTrackId: string | null;
  currentPlaybackTime: number;   // seconds, WebGL 동기화용

  // 외부 에셋 (로고, 아이콘 등)
  externalAssets: ExternalAsset[];

  // VFX 파라미터
  vfxParams: VFXParams;

  // 타이틀 퍼시스턴스 (3대 모드)
  titleMode: 'hero-to-corner' | 'ambient-object' | 'breathing' | 'type' | 'fade' | 'rise' | 'zoom' | 'blur' | 'glide' | 'split' | 'flicker' | 'skate';
  titlePlayMode: 'loop' | 'once' | 'stay';
  titleText: string;
  titleFontPreset: 'elegant' | 'lofi' | 'pop' | 'retro3d' | 'emboss' | 'glitch'
                 | 'neon' | 'mono' | 'vapor' | 'chrome' | 'dark' | 'ice';
  titleSubtext: string;

  // Lyric style
  lyricFontPreset: 'clean' | 'mist' | 'slab' | 'glow' | 'outline' | 'kr';
  lyricPosition: 'bottom' | 'center' | 'right-center';
  lyricSize: 'S' | 'M' | 'L';

  // Mask drawing mode
  maskDrawingMode: boolean;

  // EQ
  eqPresetId: string;
  eqReactMode: 'original' | 'pulse' | 'ripple' | 'chromatic' | 'warp';
  eqCustomImageUrl: string | null;
  eqOverlayVisible: boolean;
  eqIntensity: number; // 0–1 canvas globalAlpha multiplier
  eqSensitivity: number; // 0.1–3.0 audio level multiplier (default 1.0)
  eqOverlayX: number;   // default 40
  eqOverlayY: number;   // default 40
  eqOverlayW: number;   // default 320
  eqOverlayH: number;   // default 180
  eqFlipX: boolean;
  eqFlipY: boolean;
  eqTintColor: string | null; // null = use preset default
  eqOpacity: number;  // 0–1, default 1
  eqMirror: boolean;

  setEQPreset: (id: string) => void;
  setEQReactMode: (mode: 'original' | 'pulse' | 'ripple' | 'chromatic' | 'warp') => void;
  setEQCustomImage: (url: string | null) => void;
  setEqOverlayVisible: (v: boolean) => void;
  setEqIntensity: (v: number) => void;
  setEqSensitivity: (v: number) => void;
  setEqOverlayGeometry: (x: number, y: number, w: number, h: number) => void;
  setEqFlip: (x: boolean, y: boolean) => void;
  setEqTintColor: (color: string | null) => void;
  setEqOpacity: (v: number) => void;
  setEqMirror: (v: boolean) => void;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  // Scene
  addScene: () => void;
  removeScene: (id: string) => void;
  setActiveScene: (id: string) => void;
  updateSceneBackground: (sceneId: string, background: Scene['background']) => void;
  updateSceneDuration: (sceneId: string, durationSec: number) => void;
  reorderScenes: (orderedIds: string[]) => void;

  // TextTrack (per scene)
  addTextTrack: (sceneId: string, type: TextTrack['type']) => void;
  removeTextTrack: (sceneId: string, trackId: string) => void;
  updateTextTrackSegments: (sceneId: string, trackId: string, segments: WhisperSegment[]) => void;
  updateTextTrackStyle: (sceneId: string, trackId: string, style: Partial<TextTrack['style']>) => void;

  // TextSegment (on AudioTrack.whisperSegments — used by SubtitleEditor)
  updateTextSegment: (trackId: string, segmentId: string, updates: Partial<WhisperSegment>) => void;
  addTextSegment: (trackId: string) => void;
  removeTextSegment: (trackId: string, segmentId: string) => void;

  // Audio
  addAudioTrack: (fileName: string, url: string) => string;  // returns new id
  removeAudioTrack: (id: string) => void;
  setAudioTrackProcessing: (id: string, status: AudioTrack['processing'], error?: string) => void;
  setWhisperSegments: (trackId: string, segments: WhisperSegment[], durationSec: number) => void;
  setActiveAudioTrack: (id: string) => void;
  setTrackThumbnail: (id: string, url: string | null) => void;
  setPlaybackTime: (time: number) => void;
  linkAudioToScene: (trackId: string, sceneId: string | null) => void;

  // External Assets
  addExternalAsset: (asset: Omit<ExternalAsset, 'id'>) => void;
  removeExternalAsset: (id: string) => void;
  toggleAssetVFX: (id: string) => void;
  updateAssetTransform: (
    id: string,
    transform: Partial<Pick<ExternalAsset, 'position' | 'size'>>
  ) => void;

  // VFX
  updateVFX: (updates: Partial<VFXParams>) => void;

  // Title
  setTitleMode: (mode: CodaStore['titleMode']) => void;
  setTitlePlayMode: (mode: CodaStore['titlePlayMode']) => void;
  setTitleText: (text: string) => void;
  setTitleFontPreset: (p: CodaStore['titleFontPreset']) => void;
  setTitleSubtext: (t: string) => void;

  setLyricFontPreset: (p: CodaStore['lyricFontPreset']) => void;
  setLyricPosition: (pos: CodaStore['lyricPosition']) => void;
  setLyricSize: (size: CodaStore['lyricSize']) => void;

  // Loop animation
  setParallaxEnabled: (sceneId: string, enabled: boolean) => void;
  setParallaxStrength: (sceneId: string, strength: number) => void;
  toggleLoopMode: (sceneId: string, mode: 'wind' | 'ripple' | 'depth') => void;
  setDepthMap: (sceneId: string, url: string | null) => void;
  setLoopStrength: (sceneId: string, strength: number) => void;
  setLoopMaskPoints: (sceneId: string, points: { x: number; y: number }[]) => void;
  setMaskDrawingMode: (v: boolean) => void;
  setLoopParam: (sceneId: string, key: string, value: number) => void;

  // Playlist overlay
  previewMode: boolean;
  setPreviewMode: (v: boolean) => void;

  playlistMode: 'simple' | 'box' | 'list';
  playlistVisible: boolean;
  playlistOverlayX: number;
  playlistOverlayY: number;
  playlistOverlayScale: number;
  setPlaylistMode: (mode: CodaStore['playlistMode']) => void;
  setPlaylistVisible: (v: boolean) => void;
  setPlaylistOverlayPos: (x: number, y: number) => void;
  setPlaylistOverlayScale: (s: number) => void;

  // Export
  setExportFormat: (format: CodaStore['exportFormat']) => void;
}

// ---------------------------------------------------------------------------
// Default factory helpers
// ---------------------------------------------------------------------------

const makeDefaultScene = (order: number): Scene => ({
  id: nanoid(),
  order,
  background: { type: 'image', url: null, fileName: null },
  durationSec: 0,
  textTracks: [],
  effects: {
    parallaxEnabled: false,
    parallaxStrength: 0.40,
    maskingEnabled: false,
    loopModes: { wind: false, ripple: false, depth: false },
    loopStrength: 0.5,
    depthMapUrl: null,
    loopMaskPoints: [],
    windDirection: 0,
    windSpeed: 1.0,
    windFrequency: 4.0,
    windTurbulence: 0.0,
    rippleOriginX: 0.5,
    rippleOriginY: 0.5,
    rippleSpeed: 1.0,
    rippleDecay: 0.65,
    depthNearSpeed: 1.5,
    depthMidSpeed:  1.0,
    depthFarSpeed:  0.8,
    depthHaze: 0.5,
  },
});

const defaultVFX: VFXParams = {
  bloom:     { enabled: true,  intensity: 0.8,  threshold: 0.6 },
  filmGrain: { enabled: true,  intensity: 0.15 },
  vignette:  { enabled: true,  darkness: 0.5 },
  sparkle:   { enabled: false, count: 25,   speed: 0.3 },
  dust:      { enabled: false, count: 30,   speed: 0.18 },
  filmBurn:  { enabled: false, intensity: 0.5 },
  chromatic: { enabled: false, offset: 0.003 },
  scanline:  { enabled: false, density: 1.5, opacity: 0.15 },
  glitch:    { enabled: false, strength: 0.3 },
};

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

const initialScene = makeDefaultScene(0);

// ── Blob URL cleaner (used for both localStorage and backend save) ──────────
export function sanitizeForSave(state: CodaStore): Partial<CodaStore> {
  const isBlob = (url: string | null | undefined) =>
    typeof url === 'string' && url.startsWith('blob:');
  return {
    ...state,
    scenes: state.scenes.map((s) => ({
      ...s,
      background: {
        ...s.background,
        url: isBlob(s.background.url) ? null : s.background.url,
      },
      effects: {
        ...s.effects,
        depthMapUrl: isBlob(s.effects.depthMapUrl) ? null : s.effects.depthMapUrl,
      },
    })),
    audioTracks: state.audioTracks.map((t) => ({
      ...t,
      url: isBlob(t.url) ? null : t.url,
      thumbnailUrl: null,
    })),
    eqCustomImageUrl: isBlob(state.eqCustomImageUrl) ? null : state.eqCustomImageUrl,
    externalAssets: state.externalAssets.map((a) => ({
      ...a,
      url: isBlob(a.url) ? '' : a.url,
    })),
  };
}

export const useCodaStore = create<CodaStore>()(
  immer((set, _get) => ({
    // ---- initial state ----
    projectId: nanoid(),
    exportFormat: '16:9',

    scenes: [initialScene],
    activeSceneId: initialScene.id,

    audioTracks: [],
    activeAudioTrackId: null,
    currentPlaybackTime: 0,

    externalAssets: [],

    vfxParams: defaultVFX,

    titleMode: 'hero-to-corner',
    titlePlayMode: 'loop',
    titleText: 'Coda Studio',
    titleFontPreset: 'elegant',
    titleSubtext: '',

    lyricFontPreset: 'clean',
    lyricPosition: 'bottom' as const,
    lyricSize: 'M',

    eqPresetId: 'basic2',
    eqReactMode: 'original',
    eqCustomImageUrl: null,
    eqOverlayVisible: false,
    eqIntensity: 0.5,
    eqSensitivity: 1.0,
    eqOverlayX: 5,   // % of canvas width
    eqOverlayY: 10,  // % of canvas height
    eqOverlayW: 45,  // % of canvas width
    eqOverlayH: 45,  // % of canvas height
    eqFlipX: false,
    eqFlipY: false,
    eqTintColor: null,
    eqOpacity: 1,
    eqMirror: false,

    maskDrawingMode: false,

    previewMode: false,

    playlistMode: 'simple',
    playlistVisible: false,
    playlistOverlayX: 80,
    playlistOverlayY: 85,
    playlistOverlayScale: 1,

    // ---- Scene actions ----

    addScene: () =>
      set((state) => {
        const newScene = makeDefaultScene(state.scenes.length);
        state.scenes.push(newScene);
        state.activeSceneId = newScene.id;
      }),

    removeScene: (id) =>
      set((state) => {
        const idx = state.scenes.findIndex((s) => s.id === id);
        if (idx === -1) return;
        state.scenes.splice(idx, 1);
        // re-index order
        state.scenes.forEach((s, i) => { s.order = i; });
        // reset active if needed
        if (state.activeSceneId === id) {
          state.activeSceneId = state.scenes[Math.max(0, idx - 1)]?.id ?? null;
        }
      }),

    setActiveScene: (id) =>
      set((state) => { state.activeSceneId = id; }),

    updateSceneBackground: (sceneId, background) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.background = background;
      }),

    updateSceneDuration: (sceneId, durationSec) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.durationSec = durationSec;
      }),

    reorderScenes: (orderedIds) =>
      set((state) => {
        const map = new Map(state.scenes.map((s) => [s.id, s]));
        const reordered = orderedIds.map((id, i) => {
          const s = map.get(id);
          if (s) s.order = i;
          return s;
        }).filter(Boolean) as Scene[];
        state.scenes = reordered;
      }),

    // ---- TextTrack actions ----

    addTextTrack: (sceneId, type) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (!scene) return;
        const track: TextTrack = {
          id: nanoid(),
          type,
          segments: [],
          style: {
            fontSize: 28,
            color: '#ffffff',
            position: 'bottom',
            fontFamily: 'sans-serif',
          },
        };
        scene.textTracks.push(track);
      }),

    removeTextTrack: (sceneId, trackId) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (!scene) return;
        const idx = scene.textTracks.findIndex((t) => t.id === trackId);
        if (idx !== -1) scene.textTracks.splice(idx, 1);
      }),

    updateTextTrackSegments: (sceneId, trackId, segments) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        const track = scene?.textTracks.find((t) => t.id === trackId);
        if (track) track.segments = segments;
      }),

    updateTextTrackStyle: (sceneId, trackId, style) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        const track = scene?.textTracks.find((t) => t.id === trackId);
        if (track) Object.assign(track.style, style);
      }),

    // ---- Audio actions ----

    addAudioTrack: (fileName, url) => {
      const id = nanoid();
      set((state) => {
        const track: AudioTrack = {
          id,
          fileName,
          url,
          thumbnailUrl: null,
          durationSec: 0,
          whisperSegments: [],
          linkedSceneId: null,
          processing: 'idle',
          error: null,
        };
        state.audioTracks.push(track);
        if (!state.activeAudioTrackId) state.activeAudioTrackId = id;
      });
      return id;
    },

    removeAudioTrack: (id) =>
      set((state) => {
        const idx = state.audioTracks.findIndex((t) => t.id === id);
        if (idx === -1) return;
        state.audioTracks.splice(idx, 1);
        if (state.activeAudioTrackId === id) {
          state.activeAudioTrackId = state.audioTracks[0]?.id ?? null;
        }
      }),

    setAudioTrackProcessing: (id, status, error) =>
      set((state) => {
        const track = state.audioTracks.find((t) => t.id === id);
        if (!track) return;
        track.processing = status;
        track.error = error ?? null;
      }),

    setWhisperSegments: (trackId, segments, durationSec) =>
      set((state) => {
        const track = state.audioTracks.find((t) => t.id === trackId);
        if (!track) return;
        track.whisperSegments = segments;
        track.durationSec = durationSec;
        track.processing = 'done';
      }),

    setActiveAudioTrack: (id) =>
      set((state) => { state.activeAudioTrackId = id; }),

    setTrackThumbnail: (id, url) =>
      set((state) => {
        const t = state.audioTracks.find((t) => t.id === id);
        if (t) t.thumbnailUrl = url;
      }),

    setPlaybackTime: (time) =>
      set((state) => { state.currentPlaybackTime = time; }),

    linkAudioToScene: (trackId, sceneId) =>
      set((state) => {
        const track = state.audioTracks.find((t) => t.id === trackId);
        if (track) track.linkedSceneId = sceneId;
      }),

    // ---- External Asset actions ----

    addExternalAsset: (asset) =>
      set((state) => {
        state.externalAssets.push({ ...asset, id: nanoid() });
      }),

    removeExternalAsset: (id) =>
      set((state) => {
        const idx = state.externalAssets.findIndex((a) => a.id === id);
        if (idx !== -1) state.externalAssets.splice(idx, 1);
      }),

    toggleAssetVFX: (id) =>
      set((state) => {
        const asset = state.externalAssets.find((a) => a.id === id);
        if (asset) asset.applyVFX = !asset.applyVFX;
      }),

    updateAssetTransform: (id, transform) =>
      set((state) => {
        const asset = state.externalAssets.find((a) => a.id === id);
        if (!asset) return;
        if (transform.position) asset.position = transform.position;
        if (transform.size) asset.size = transform.size;
      }),

    // ---- VFX actions ----

    updateVFX: (updates) =>
      set((state) => {
        for (const [key, val] of Object.entries(updates)) {
          const k = key as keyof VFXParams;
          if (state.vfxParams[k] && val) {
            Object.assign(state.vfxParams[k] as object, val);
          }
        }
      }),

    // ---- Title actions ----

    setTitleMode: (mode) =>
      set((state) => { state.titleMode = mode; }),
    setTitlePlayMode: (mode) =>
      set((state) => { state.titlePlayMode = mode; }),

    setTitleText: (text) =>
      set((state) => { state.titleText = text; }),

    setTitleFontPreset: (p) =>
      set((state) => { state.titleFontPreset = p; }),

    setTitleSubtext: (t) =>
      set((state) => { state.titleSubtext = t; }),

    setLyricFontPreset: (p) =>
      set((state) => { state.lyricFontPreset = p; }),
    setLyricPosition: (pos) =>
      set((state) => { state.lyricPosition = pos; }),
    setLyricSize: (size) =>
      set((state) => { state.lyricSize = size; }),

    // ---- TextSegment actions (on AudioTrack.whisperSegments) ----

    updateTextSegment: (trackId, segmentId, updates) =>
      set((state) => {
        const track = state.audioTracks.find((t) => t.id === trackId);
        if (!track) return;
        const seg = track.whisperSegments.find((s) => s.id === segmentId);
        if (seg) Object.assign(seg, updates);
      }),

    addTextSegment: (trackId) =>
      set((state) => {
        const track = state.audioTracks.find((t) => t.id === trackId);
        if (!track) return;
        const lastSeg = track.whisperSegments[track.whisperSegments.length - 1];
        const start = lastSeg ? lastSeg.end : 0;
        track.whisperSegments.push({
          id: nanoid(),
          start,
          end: start + 2,
          text: '',
        });
      }),

    removeTextSegment: (trackId, segmentId) =>
      set((state) => {
        const track = state.audioTracks.find((t) => t.id === trackId);
        if (!track) return;
        const idx = track.whisperSegments.findIndex((s) => s.id === segmentId);
        if (idx !== -1) track.whisperSegments.splice(idx, 1);
      }),

    // ---- Parallax actions ----

    setParallaxEnabled: (sceneId, enabled) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.effects.parallaxEnabled = enabled;
      }),

    setParallaxStrength: (sceneId, strength) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.effects.parallaxStrength = strength;
      }),

    // ---- Loop animation actions ----

    toggleLoopMode: (sceneId, mode) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.effects.loopModes[mode] = !scene.effects.loopModes[mode];
      }),

    setDepthMap: (sceneId, url) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.effects.depthMapUrl = url;
      }),

    setLoopStrength: (sceneId, strength) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.effects.loopStrength = strength;
      }),

    setLoopMaskPoints: (sceneId, points) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) scene.effects.loopMaskPoints = points;
      }),

    setMaskDrawingMode: (v) =>
      set((state) => { state.maskDrawingMode = v; }),

    setLoopParam: (sceneId, key, value) =>
      set((state) => {
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (scene) (scene.effects as Record<string, unknown>)[key] = value;
      }),

    // ---- Playlist actions ----

    setPreviewMode: (v) =>
      set((state) => { state.previewMode = v; }),

    setPlaylistMode: (mode) =>
      set((state) => { state.playlistMode = mode; }),

    setPlaylistVisible: (v) =>
      set((state) => { state.playlistVisible = v; }),

    setPlaylistOverlayPos: (x, y) =>
      set((state) => { state.playlistOverlayX = x; state.playlistOverlayY = y; }),

    setPlaylistOverlayScale: (s) =>
      set((state) => { state.playlistOverlayScale = s; }),

    // ---- Export actions ----

    setExportFormat: (format) =>
      set((state) => { state.exportFormat = format; }),

    // ---- EQ actions ----

    setEQPreset: (id) =>
      set((state) => { state.eqPresetId = id; }),

    setEQReactMode: (mode) =>
      set((state) => { state.eqReactMode = mode; }),

    setEQCustomImage: (url) =>
      set((state) => { state.eqCustomImageUrl = url; }),

    setEqOverlayVisible: (v) =>
      set((state) => { state.eqOverlayVisible = v; }),

    setEqIntensity: (v) =>
      set((state) => { state.eqIntensity = v; }),

    setEqSensitivity: (v) =>
      set((state) => { state.eqSensitivity = v; }),

    setEqOverlayGeometry: (x, y, w, h) =>
      set((state) => {
        state.eqOverlayX = x; state.eqOverlayY = y;
        state.eqOverlayW = w; state.eqOverlayH = h;
      }),

    setEqFlip: (x, y) =>
      set((state) => { state.eqFlipX = x; state.eqFlipY = y; }),

    setEqTintColor: (color) =>
      set((state) => { state.eqTintColor = color; }),

    setEqOpacity: (v) =>
      set((state) => { state.eqOpacity = v; }),

    setEqMirror: (v) =>
      set((state) => { state.eqMirror = v; }),
  }))
);

// ── localStorage auto-persistence ────────────────────────────────────────────
const LS_KEY = 'coda-studio-v1';

export function hydrateFromLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    useCodaStore.setState(saved);
  } catch {
    // corrupted data — ignore
  }
}

export function saveToLocalStorage() {
  if (typeof window === 'undefined') return;
  const state = useCodaStore.getState();
  const clean = sanitizeForSave(state);
  localStorage.setItem(LS_KEY, JSON.stringify(clean));
}
