'use client';

import { useCodaStore, VFXParams } from '@/store/useCodaStore';
import type { Scene } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex h-4 w-7 shrink-0 cursor-pointer border-2 transition-colors duration-200
        ${enabled ? 'bg-ink-900 border-ink-900' : 'bg-cream-300 border-cream-300'}
      `}
    >
      <span
        className={`
          inline-block h-3 w-3 bg-white shadow transform transition-transform duration-200
          ${enabled ? 'translate-x-3' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

interface SliderRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function SliderRow({ label, value, onChange, disabled = false }: SliderRowProps) {
  const pct = Math.round(value * 100);

  return (
    <div className={`flex items-center gap-2 transition-opacity ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <span className="text-[10px] text-[#6b6760] w-[64px] shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-ink-900
          [&::-webkit-slider-thumb]:cursor-pointer
          focus:outline-none"
        style={{
          background: `linear-gradient(to right, #1a1a16 0%, #1a1a16 ${pct}%, #d4cfc6 ${pct}%, #d4cfc6 100%)`,
        }}
      />
      <span className="font-mono text-[11px] text-ink-500 w-[28px] text-right tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VFX Group header
// ---------------------------------------------------------------------------

function GroupHeader({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-caps text-ink-900 flex-1">{label}</span>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function VFXPanel() {
  const vfxParams          = useCodaStore((s) => s.vfxParams);
  const updateVFX          = useCodaStore((s) => s.updateVFX);
  const scenes             = useCodaStore((s) => s.scenes);
  const activeSceneId      = useCodaStore((s) => s.activeSceneId);
  const setParallaxEnabled = useCodaStore((s) => s.setParallaxEnabled);
  const setParallaxStrength = useCodaStore((s) => s.setParallaxStrength);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const parallaxEnabled  = activeScene?.effects.parallaxEnabled  ?? false;
  const parallaxStrength = activeScene?.effects.parallaxStrength ?? 0.08;

  const { bloom, filmGrain, vignette } = vfxParams;

  // Helper: update a nested key
  const set = <K extends keyof VFXParams>(group: K, updates: Partial<VFXParams[K]>) => {
    updateVFX({ [group]: updates } as Partial<VFXParams>);
  };

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto">

      {/* ── Bloom ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <GroupHeader
          label="Bloom"
          enabled={bloom.enabled}
          onToggle={(v) => set('bloom', { enabled: v })}
        />
        <div className="flex flex-col gap-2 pl-1">
          <SliderRow
            label="Intensity"
            value={bloom.intensity}
            onChange={(v) => set('bloom', { intensity: v })}
            disabled={!bloom.enabled}
          />
          <SliderRow
            label="Threshold"
            value={bloom.threshold}
            onChange={(v) => set('bloom', { threshold: v })}
            disabled={!bloom.enabled}
          />
        </div>
      </div>

      <div className="border-t border-cream-300" />

      {/* ── Film Grain ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <GroupHeader
          label="Film Grain"
          enabled={filmGrain.enabled}
          onToggle={(v) => set('filmGrain', { enabled: v })}
        />
        <div className="flex flex-col gap-2 pl-1">
          <SliderRow
            label="Intensity"
            value={filmGrain.intensity}
            onChange={(v) => set('filmGrain', { intensity: v })}
            disabled={!filmGrain.enabled}
          />
        </div>
      </div>

      <div className="border-t border-cream-300" />

      {/* ── Vignette ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <GroupHeader
          label="Vignette"
          enabled={vignette.enabled}
          onToggle={(v) => set('vignette', { enabled: v })}
        />
        <div className="flex flex-col gap-2 pl-1">
          <SliderRow
            label="Darkness"
            value={vignette.darkness}
            onChange={(v) => set('vignette', { darkness: v })}
            disabled={!vignette.enabled}
          />
        </div>
      </div>

      <div className="border-t border-cream-300" />

      {/* ── Parallax ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <GroupHeader
          label="Parallax"
          enabled={parallaxEnabled}
          onToggle={(v) => activeScene && setParallaxEnabled(activeScene.id, v)}
        />
        <div className="flex flex-col gap-2 pl-1">
          <SliderRow
            label="Strength"
            value={parallaxStrength}
            onChange={(v) => activeScene && setParallaxStrength(activeScene.id, v)}
            disabled={!parallaxEnabled}
          />
        </div>
      </div>

      <div className="border-t border-cream-300" />

      {/* ── Live preview hint ────────────────────────────────────────────── */}
      <p className="label-caps text-ink-300 text-center">
        변경사항은 캔버스에 실시간 반영됩니다
      </p>
    </div>
  );
}
