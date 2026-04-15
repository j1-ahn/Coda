'use client';

/**
 * SceneTab — v2 "Scene" 탭
 *
 * 다중 씬 편집, 씬 타임라인, 씬별 설정, 트랜지션.
 * 현재는 GraphicsPanel의 씬 관리 기능을 래핑.
 * TODO: 타임라인 UI 추가, 씬 정렬/복사/이동 등 확장 예정.
 */

import { useCodaStore } from '@/store/useCodaStore';
import GraphicsPanel from '@/components/UI/GraphicsPanel';

export default function SceneTab() {
  const scenes = useCodaStore((s) => s.scenes);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* Scene header with count */}
      <div className="flex items-center justify-between px-3 py-2 bg-cream-200 border-b border-cream-300 shrink-0">
        <span className="label-caps">Scenes</span>
        <span className="text-[9px] text-ink-300">{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* GraphicsPanel handles scene listing + upload for now */}
      <GraphicsPanel />

      {/* Timeline placeholder — will be built in next phase */}
      <div className="px-3 py-4 border-t border-cream-300">
        <div className="flex items-center justify-center py-6 border border-dashed border-cream-300 bg-cream-50">
          <span className="text-[10px] text-ink-300 tracking-wider">
            TIMELINE — COMING SOON
          </span>
        </div>
      </div>
    </div>
  );
}
