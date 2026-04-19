/**
 * Domain type barrel.
 *
 * Re-exports the core domain types so consumers don't have to reach into the
 * Zustand store file just to get a type. The store remains the canonical
 * source — this file only forwards. As types grow, split them into siblings
 * (e.g. `scene.ts`, `audio.ts`) and re-export from here.
 *
 *   import type { Scene, AudioTrack, WhisperSegment } from '@/types';
 */

export type {
  Scene,
  AudioTrack,
  WhisperSegment,
  TextTrack,
  ExternalAsset,
  VFXParams,
  TransitionType,
  SidebarTabId,
  SceneTimeInfo,
} from '@/store/useCodaStore';
