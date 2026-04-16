'use client';

import { useCodaStore } from '@/store/useCodaStore';

export default function CanvasSceneInfoBar() {
  const scenes        = useCodaStore((s) => s.scenes);
  const activeSceneId = useCodaStore((s) => s.activeSceneId);
  const exportFormat  = useCodaStore((s) => s.exportFormat);
  const eqPresetId    = useCodaStore((s) => s.eqPresetId);

  const scene  = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const bgName = scene?.background.fileName;
  const sceneIdx = scenes.findIndex((s) => s.id === activeSceneId) + 1;

  return (
    <div className="shrink-0 h-7 flex items-center gap-3 px-3 border-b border-cream-300 bg-cream-200 overflow-hidden select-none">
      {/* Scene badge */}
      <span className="label-caps text-ink-400 shrink-0">SCENE {sceneIdx}</span>

      <span className="text-cream-400 text-xs shrink-0">|</span>

      {/* Background file name */}
      {bgName ? (
        <span className="text-[10px] text-ink-600 truncate flex-1 min-w-0">{bgName}</span>
      ) : (
        <span className="text-[10px] text-ink-300 italic flex-1 min-w-0">No background</span>
      )}

      {/* EQ preset */}
      <span className="label-caps text-ink-300 shrink-0 hidden sm:block">{eqPresetId.toUpperCase()}</span>

      <span className="text-cream-400 text-xs shrink-0">|</span>

      {/* Format */}
      <span className="label-caps text-ink-500 shrink-0">{exportFormat}</span>
    </div>
  );
}
