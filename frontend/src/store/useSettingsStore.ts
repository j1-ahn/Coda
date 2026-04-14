/**
 * useSettingsStore.ts
 * App-level settings — separate from project state (useCodaStore).
 * Persisted to localStorage under 'coda-settings-v1'.
 */

import { create } from 'zustand';

export interface AppSettings {
  // ── General ──────────────────────────────────────────────────────────────
  language: 'ko' | 'en';
  autoSaveInterval: 30 | 60 | 0;   // seconds; 0 = off

  // ── Preview ───────────────────────────────────────────────────────────────
  previewResolution: '1920x1080' | '1280x720';
  previewDpr: 1 | 2;

  // ── Render ────────────────────────────────────────────────────────────────
  renderOutputPath: string;         // informational only (backend decides)
  nvencMode: 'auto' | 'nvenc' | 'cpu';
  ffmpegPath: string;               // '' = use system PATH

  // ── AI Models ─────────────────────────────────────────────────────────────
  whisperModel: 'tiny' | 'base' | 'large-v3';
  ollamaModel: string;

  // ── Connection ────────────────────────────────────────────────────────────
  backendUrl: string;               // default '' = relative proxy

  // ── EQ ───────────────────────────────────────────────────────────────────
  eqDefaultSensitivity: number;     // 0.1–3.0
}

const DEFAULTS: AppSettings = {
  language:             'ko',
  autoSaveInterval:     30,
  previewResolution:    '1920x1080',
  previewDpr:           1,
  renderOutputPath:     '',
  nvencMode:            'auto',
  ffmpegPath:           '',
  whisperModel:         'large-v3',
  ollamaModel:          'gemma4:e4b',
  backendUrl:           '',
  eqDefaultSensitivity: 1.0,
};

const STORAGE_KEY = 'coda-settings-v1';

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

interface SettingsStore extends AppSettings {
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((setState) => ({
  ...loadSettings(),

  set: (key, value) => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next as AppSettings);
      return { [key]: value };
    });
  },

  reset: () => {
    saveSettings(DEFAULTS);
    setState(DEFAULTS);
  },
}));

/** Read a single setting value outside React (e.g. in fetch helpers). */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return useSettingsStore.getState()[key] as AppSettings[K];
}
