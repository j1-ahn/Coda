'use client';

/**
 * SceneTab — v2 "Scene" tab
 * Scene management, transitions, timeline.
 */

import GraphicsPanel from '@/components/UI/GraphicsPanel';

export default function SceneTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <GraphicsPanel />

      {/* Timeline placeholder */}
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
