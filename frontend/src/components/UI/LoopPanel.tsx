'use client';

import { useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Mode button
// ---------------------------------------------------------------------------

interface ModeBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ModeBtn({ label, active, onClick }: ModeBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1 rounded-none border text-[10px] font-semibold tracking-widest transition-colors ${
        active
          ? 'bg-ink-900 text-cream-100 border-ink-900'
          : 'border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500'
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// LoopPanel
// ---------------------------------------------------------------------------

export default function LoopPanel() {
  const scenes         = useCodaStore((s) => s.scenes);
  const activeSceneId  = useCodaStore((s) => s.activeSceneId);
  const setLoopMode    = useCodaStore((s) => s.setLoopMode);
  const setLoopStrength = useCodaStore((s) => s.setLoopStrength);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];

  const loopMode     = activeScene?.effects.loopMode     ?? 'none';
  const loopStrength = activeScene?.effects.loopStrength ?? 0.5;

  const handleMode = useCallback(
    (mode: 'none' | 'wind' | 'ripple') => {
      if (activeScene) setLoopMode(activeScene.id, mode);
    },
    [activeScene, setLoopMode]
  );

  const handleStrength = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (activeScene) setLoopStrength(activeScene.id, parseFloat(e.target.value));
    },
    [activeScene, setLoopStrength]
  );

  return (
    <div className="px-3 py-2.5 flex flex-col gap-3">

      {/* Mode selector */}
      <div className="flex gap-1">
        <ModeBtn
          label="NONE"
          active={loopMode === 'none'}
          onClick={() => handleMode('none')}
        />
        <ModeBtn
          label="WIND ≋"
          active={loopMode === 'wind'}
          onClick={() => handleMode('wind')}
        />
        <ModeBtn
          label="RIPPLE ◎"
          active={loopMode === 'ripple'}
          onClick={() => handleMode('ripple')}
        />
      </div>

      {/* Strength slider — only meaningful when a mode is active */}
      <div className={`flex flex-col gap-1.5 transition-opacity ${loopMode === 'none' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center justify-between">
          <span className="label-caps">Strength</span>
          <span className="font-mono text-[11px] text-ink-500 tabular-nums">
            {loopStrength.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={loopStrength}
          onChange={handleStrength}
          className="w-full h-1 cursor-pointer"
          style={{ accentColor: '#1a1a16' }}
        />
      </div>

    </div>
  );
}
