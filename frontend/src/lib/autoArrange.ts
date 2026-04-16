import { useCodaStore, VFXParams } from '@/store/useCodaStore';

export interface AudioFeatures {
  bpm: number;
  key: string;
  energy_level: string;  // 'low' | 'medium' | 'high'
  mood: string;
  duration_sec: number;
  onset_density: number;
}

// Transition presets mapped to mood/energy
const MOOD_TRANSITIONS: Record<string, string[]> = {
  calm:       ['dissolve', 'fade', 'blur'],
  melancholy: ['fade', 'dissolve', 'blur', 'wipe-left'],
  energetic:  ['glitch', 'zoom-in', 'slide-left', 'film-burn', 'spin'],
  dark:       ['black-flash', 'glitch', 'wipe-down', 'zoom-out'],
  uplifting:  ['white-flash', 'zoom-in', 'wipe-up', 'circle-wipe'],
  dreamy:     ['dissolve', 'blur', 'fade', 'circle-wipe'],
  aggressive: ['glitch', 'film-burn', 'spin', 'black-flash', 'zoom-in'],
  neutral:    ['cut', 'fade', 'dissolve', 'wipe-left'],
};

// VFX presets mapped to mood — uses nested VFXParams structure
const MOOD_VFX: Record<string, Partial<VFXParams>> = {
  calm: {
    bloom:     { enabled: true,  intensity: 0.3, threshold: 0.6 },
    filmGrain: { enabled: true,  intensity: 0.08 },
    vignette:  { enabled: true,  darkness: 0.3 },
  },
  melancholy: {
    bloom:     { enabled: true,  intensity: 0.4, threshold: 0.5 },
    filmGrain: { enabled: true,  intensity: 0.15 },
    vignette:  { enabled: true,  darkness: 0.5 },
    chromatic: { enabled: true,  offset: 0.003 },
  },
  energetic: {
    bloom:     { enabled: true,  intensity: 0.5, threshold: 0.5 },
    filmGrain: { enabled: true,  intensity: 0.05 },
    scanline:  { enabled: true,  density: 1.5, opacity: 0.15 },
    glitch:    { enabled: true,  strength: 0.1 },
  },
  dark: {
    bloom:     { enabled: true,  intensity: 0.2, threshold: 0.7 },
    filmGrain: { enabled: true,  intensity: 0.2 },
    vignette:  { enabled: true,  darkness: 0.6 },
    chromatic: { enabled: true,  offset: 0.005 },
  },
  uplifting: {
    bloom:     { enabled: true,  intensity: 0.6, threshold: 0.4 },
    sparkle:   { enabled: true,  count: 80, speed: 0.5 },
    dust:      { enabled: true,  count: 30, speed: 0.2 },
  },
  dreamy: {
    bloom:     { enabled: true,  intensity: 0.7, threshold: 0.3 },
    sparkle:   { enabled: true,  count: 50, speed: 0.3 },
    dust:      { enabled: true,  count: 60, speed: 0.3 },
  },
  aggressive: {
    glitch:    { enabled: true,  strength: 0.3 },
    chromatic: { enabled: true,  offset: 0.008 },
    scanline:  { enabled: true,  density: 1.5, opacity: 0.2 },
    filmBurn:  { enabled: true,  intensity: 0.3 },
  },
  neutral: {
    bloom:     { enabled: true,  intensity: 0.3, threshold: 0.6 },
    filmGrain: { enabled: true,  intensity: 0.1 },
    vignette:  { enabled: true,  darkness: 0.2 },
  },
};

export interface AutoArrangeResult {
  sceneDuration: number;
  transitionPool: string[];
  transitionMs: number;
  vfxPreset: string;
  titleMode: string;
}

export function autoArrange(features: AudioFeatures): AutoArrangeResult | null {
  const store = useCodaStore.getState();
  const scenes = store.scenes;

  if (scenes.length === 0) return null;

  // 1. Calculate optimal scene duration based on BPM
  // Bars of 4 beats, transition every 2-4 bars depending on energy
  const beatSec = 60 / (features.bpm || 120);
  const barsPerScene = features.energy_level === 'high' ? 2
    : features.energy_level === 'medium' ? 4
    : 8;
  const sceneDuration = Math.round(beatSec * 4 * barsPerScene);
  const clampedDuration = Math.max(3, Math.min(60, sceneDuration));

  // 2. Pick transitions based on mood
  const mood = (features.mood || 'neutral').toLowerCase();
  const transitionPool = MOOD_TRANSITIONS[mood] || MOOD_TRANSITIONS.neutral;

  // Transition duration: faster BPM = shorter transitions
  const transitionMs = features.bpm > 140 ? 300 : features.bpm > 100 ? 500 : 800;

  // 3. Apply to each scene
  scenes.forEach((scene, i) => {
    // Set duration
    store.updateSceneDuration(scene.id, clampedDuration);

    // Set transition (cycle through pool, first scene gets 'cut')
    const transType = i === 0
      ? 'cut'
      : transitionPool[i % transitionPool.length];
    store.updateSceneTransition(scene.id, {
      type: transType as any,
      durationMs: i === 0 ? 0 : transitionMs,
    });
  });

  // 4. Apply VFX based on mood
  const vfxPreset = MOOD_VFX[mood] || MOOD_VFX.neutral;
  store.updateVFX(vfxPreset);

  // 5. Set title mode based on mood
  const titleModeMap: Record<string, string> = {
    calm:       'fade',
    melancholy: 'breathing',
    energetic:  'glide',
    dark:       'flicker',
    uplifting:  'rise',
    dreamy:     'blur',
    aggressive: 'skate',
    neutral:    'fade',
  };
  const titleMode = titleModeMap[mood] || 'fade';
  useCodaStore.setState({ titleMode: titleMode as any });

  return {
    sceneDuration: clampedDuration,
    transitionPool,
    transitionMs,
    vfxPreset: mood,
    titleMode,
  };
}
