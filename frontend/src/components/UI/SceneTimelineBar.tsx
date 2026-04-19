'use client';

/**
 * SceneTimelineBar — segmented strip that shows each scene's share of the
 * total track duration, a playhead line, and click-to-jump. Rendered under
 * CanvasBottomBar as a single-row proxy for the (future) timeline view.
 */

import type { Scene } from '@/store/useCodaStore';

const SCENE_COLORS = [
  'bg-ink-900', 'bg-ink-700', 'bg-ink-500', 'bg-ink-400',
  'bg-amber-700', 'bg-emerald-700', 'bg-blue-700', 'bg-rose-700',
];

interface SceneTimelineBarProps {
  scenes: Scene[];
  activeSceneId: string | null;
  totalDuration: number;
  currentTime: number;
  onClickScene: (sceneId: string) => void;
}

export function SceneTimelineBar({
  scenes,
  activeSceneId,
  totalDuration,
  currentTime,
  onClickScene,
}: SceneTimelineBarProps) {
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const playheadPct = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  return (
    <div className="relative h-5 flex items-stretch border-t border-cream-300 bg-cream-200">
      {sorted.map((scene, idx) => {
        const pct = totalDuration > 0 ? ((scene.durationSec || 0) / totalDuration) * 100 : 0;
        if (pct <= 0) return null;
        const isActive = scene.id === activeSceneId;
        const colorClass = SCENE_COLORS[idx % SCENE_COLORS.length];
        return (
          <button
            key={scene.id}
            onClick={() => onClickScene(scene.id)}
            className={`relative flex items-center justify-center text-[8px] label-caps transition-opacity
              ${isActive ? 'opacity-100' : 'opacity-50 hover:opacity-80'}
              ${colorClass} text-cream-100
              ${idx > 0 ? 'border-l border-cream-300' : ''}`}
            style={{ width: `${pct}%` }}
            title={`Scene ${idx + 1} — ${(scene.durationSec || 0).toFixed(1)}s`}
          >
            S{idx + 1}
          </button>
        );
      })}
      {/* Playhead indicator */}
      <div
        className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-10"
        style={{ left: `${playheadPct}%` }}
      />
    </div>
  );
}
