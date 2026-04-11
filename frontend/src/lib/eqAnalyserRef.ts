import type { AudioAnalyserData } from '@/hooks/useAudioAnalyser';

export const EMPTY_ANALYSER: AudioAnalyserData = {
  frequencyData: new Uint8Array(256),
  bassLevel: 0, midLevel: 0, trebleLevel: 0, overallLevel: 0,
};

// Module-level mutable ref — updated by EQAudioPlayer RAF at 60fps.
// Read by EQOverlayWidget without going through React state/props.
export const eqAnalyserRef: { current: AudioAnalyserData } = {
  current: EMPTY_ANALYSER,
};
