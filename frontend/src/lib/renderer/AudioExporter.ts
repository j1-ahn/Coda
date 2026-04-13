/**
 * AudioExporter.ts
 * Fetches the active audio track's file and returns it as a Blob
 * ready for multipart upload to the render backend.
 *
 * Works with blob: URLs (local file drops) and http: URLs.
 * V2 note: extend to support OfflineAudioContext mixing when
 * playlist continuous render is implemented.
 */

import { useCodaStore } from '@/store/useCodaStore';

export interface AudioExportResult {
  blob: Blob;
  fileName: string;
  durationSec: number;
}

/**
 * Fetch the active audio track and return it as a Blob.
 * Throws if no audio track is loaded or the fetch fails.
 */
export async function exportActiveAudio(): Promise<AudioExportResult> {
  const state = useCodaStore.getState();
  const track = state.audioTracks.find((t) => t.id === state.activeAudioTrackId);

  if (!track?.url) {
    throw new Error('No active audio track with a loaded URL.');
  }

  const res = await fetch(track.url);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio: HTTP ${res.status}`);
  }

  const blob = await res.blob();
  return {
    blob,
    fileName: track.fileName || 'audio.mp3',
    durationSec: track.durationSec,
  };
}
