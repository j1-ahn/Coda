'use client';

/**
 * StudioTab — v2 "Studio" tab
 * Collapsible accordion sections to reduce scroll depth.
 */

import { useState } from 'react';
import PromptPanel from '@/components/UI/PromptPanel';
import GraphicsPanel from '@/components/UI/GraphicsPanel';
import VFXPanel from '@/components/UI/VFXPanel';
import LoopPanel from '@/components/UI/LoopPanel';

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-cream-300 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-cream-200 border-b border-cream-300 hover:bg-cream-300/50 transition-colors"
      >
        <span className="label-caps">{title}</span>
        <svg
          className={`w-3 h-3 text-ink-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export default function StudioTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <CollapsibleSection title="AI Prompt" defaultOpen>
        <PromptPanel />
      </CollapsibleSection>

      <CollapsibleSection title="Background">
        <GraphicsPanel />
      </CollapsibleSection>

      <CollapsibleSection title="VFX">
        <VFXPanel />
      </CollapsibleSection>

      <CollapsibleSection title="Loop Animation">
        <LoopPanel />
      </CollapsibleSection>
    </div>
  );
}
