'use client';

/**
 * StudioTab — v2 "Studio" 탭
 *
 * 배경 업로드, AI 프롬프트, VFX 파라미터, Loop 애니메이션을 한 탭에 통합.
 * 기존 PromptPanel + GraphicsPanel + VFXPanel + LoopPanel 합성.
 */

import PromptPanel from '@/components/UI/PromptPanel';
import GraphicsPanel from '@/components/UI/GraphicsPanel';
import VFXPanel from '@/components/UI/VFXPanel';
import LoopPanel from '@/components/UI/LoopPanel';

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-cream-300 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2 bg-cream-200 border-b border-cream-300 shrink-0">
        <span className="label-caps">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StudioTab
// ---------------------------------------------------------------------------

export default function StudioTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">
      {/* AI Prompt Generation */}
      <PromptPanel />

      {/* Scene Background Upload + Management */}
      <GraphicsPanel />

      {/* VFX Controls */}
      <VFXPanel />

      {/* Loop Animation */}
      <Section title="Loop Animation">
        <LoopPanel />
      </Section>
    </div>
  );
}
