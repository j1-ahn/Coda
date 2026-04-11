'use client';

import { useCodaStore, VFXParams } from '@/store/useCodaStore';

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
        relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200
        ${enabled ? 'bg-amber-400 border-amber-400' : 'bg-zinc-700 border-zinc-700'}
      `}
    >
      <span
        className={`
          inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform duration-200
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
      <span className="text-[10px] text-zinc-500 w-[64px] shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 appearance-none rounded-full bg-zinc-700 cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-amber-400
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[0_0_4px_rgba(251,191,36,0.4)]
          focus:outline-none"
        style={{
          background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${pct}%, #3f3f46 ${pct}%, #3f3f46 100%)`,
        }}
      />
      <span className="text-[10px] text-zinc-600 w-[24px] text-right tabular-nums">{value.toFixed(2)}</span>
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
      <span className="text-[11px] font-semibold tracking-widest text-zinc-300 uppercase flex-1">
        {label}
      </span>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function VFXPanel() {
  const vfxParams = useCodaStore((s) => s.vfxParams);
  const updateVFX = useCodaStore((s) => s.updateVFX);

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

      <div className="border-t border-zinc-800" />

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

      <div className="border-t border-zinc-800" />

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

      <div className="border-t border-zinc-800" />

      {/* ── Live preview hint ────────────────────────────────────────────── */}
      <p className="text-[10px] text-zinc-700 text-center">
        변경사항은 캔버스에 실시간 반영됩니다
      </p>
    </div>
  );
}
