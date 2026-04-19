'use client';

import { useState } from 'react';
import { useCodaStore, VFXParams } from '@/store/useCodaStore';
import { SliderRow } from '@/components/primitives';

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
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'BASE' | 'ATMOS' | 'STYLE';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function VFXPanel() {
  const vfxParams = useCodaStore((s) => s.vfxParams);
  const updateVFX = useCodaStore((s) => s.updateVFX);
  const [activeTab, setActiveTab] = useState<TabId>('BASE');

  const { bloom, filmGrain, vignette, sparkle, dust, filmBurn, chromatic, scanline, glitch } = vfxParams;

  // Helper: update a nested key
  const set = <K extends keyof VFXParams>(group: K, updates: Partial<VFXParams[K]>) => {
    updateVFX({ [group]: updates } as Partial<VFXParams>);
  };

  const tabs: TabId[] = ['BASE', 'ATMOS', 'STYLE'];

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-cream-200 border-b border-cream-300 shrink-0">
        <span className="label-caps">VFX</span>
      </div>

      {/* Tab buttons */}
      <div className="flex border-b border-cream-300 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 py-1.5 label-caps text-center transition-colors duration-150
              ${activeTab === tab
                ? 'bg-ink-900 text-white border-b-2 border-ink-900'
                : 'text-ink-400 hover:text-ink-700 bg-cream-100'}
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 p-3">

        {/* ── BASE tab ────────────────────────────────────────────────── */}
        {activeTab === 'BASE' && (
          <>
            {/* Bloom */}
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

            {/* Film Grain */}
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

            {/* Vignette */}
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
          </>
        )}

        {/* ── ATMOS tab ───────────────────────────────────────────────── */}
        {activeTab === 'ATMOS' && (
          <>
            {/* Sparkle */}
            <div className="flex flex-col gap-2">
              <GroupHeader
                label="Sparkle"
                enabled={sparkle.enabled}
                onToggle={(v) => set('sparkle', { enabled: v })}
              />
              <div className="flex flex-col gap-2 pl-1">
                <SliderRow
                  label="Count"
                  value={sparkle.count}
                  min={0}
                  max={200}
                  step={1}
                  onChange={(v) => set('sparkle', { count: v })}
                  disabled={!sparkle.enabled}
                />
                <SliderRow
                  label="Speed"
                  value={sparkle.speed}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => set('sparkle', { speed: v })}
                  disabled={!sparkle.enabled}
                />
              </div>
            </div>

            <div className="border-t border-cream-300" />

            {/* Dust */}
            <div className="flex flex-col gap-2">
              <GroupHeader
                label="Dust"
                enabled={dust.enabled}
                onToggle={(v) => set('dust', { enabled: v })}
              />
              <div className="flex flex-col gap-2 pl-1">
                <SliderRow
                  label="Count"
                  value={dust.count}
                  min={0}
                  max={200}
                  step={1}
                  onChange={(v) => set('dust', { count: v })}
                  disabled={!dust.enabled}
                />
                <SliderRow
                  label="Speed"
                  value={dust.speed}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => set('dust', { speed: v })}
                  disabled={!dust.enabled}
                />
              </div>
            </div>

            <div className="border-t border-cream-300" />

            {/* Film Burn */}
            <div className="flex flex-col gap-2">
              <GroupHeader
                label="Film Burn"
                enabled={filmBurn.enabled}
                onToggle={(v) => set('filmBurn', { enabled: v })}
              />
              <div className="flex flex-col gap-2 pl-1">
                <SliderRow
                  label="Intensity"
                  value={filmBurn.intensity}
                  onChange={(v) => set('filmBurn', { intensity: v })}
                  disabled={!filmBurn.enabled}
                />
              </div>
            </div>
          </>
        )}

        {/* ── STYLE tab ───────────────────────────────────────────────── */}
        {activeTab === 'STYLE' && (
          <>
            {/* Chromatic */}
            <div className="flex flex-col gap-2">
              <GroupHeader
                label="Chromatic"
                enabled={chromatic.enabled}
                onToggle={(v) => set('chromatic', { enabled: v })}
              />
              <div className="flex flex-col gap-2 pl-1">
                <SliderRow
                  label="Offset"
                  value={chromatic.offset}
                  min={0}
                  max={0.02}
                  step={0.001}
                  onChange={(v) => set('chromatic', { offset: v })}
                  disabled={!chromatic.enabled}
                />
              </div>
            </div>

            <div className="border-t border-cream-300" />

            {/* Scanline */}
            <div className="flex flex-col gap-2">
              <GroupHeader
                label="Scanline"
                enabled={scanline.enabled}
                onToggle={(v) => set('scanline', { enabled: v })}
              />
              <div className="flex flex-col gap-2 pl-1">
                <SliderRow
                  label="Density"
                  value={scanline.density}
                  min={0.5}
                  max={3}
                  step={0.05}
                  onChange={(v) => set('scanline', { density: v })}
                  disabled={!scanline.enabled}
                />
                <SliderRow
                  label="Opacity"
                  value={scanline.opacity}
                  min={0}
                  max={0.5}
                  step={0.01}
                  onChange={(v) => set('scanline', { opacity: v })}
                  disabled={!scanline.enabled}
                />
              </div>
            </div>

            <div className="border-t border-cream-300" />

            {/* Glitch */}
            <div className="flex flex-col gap-2">
              <GroupHeader
                label="Glitch"
                enabled={glitch.enabled}
                onToggle={(v) => set('glitch', { enabled: v })}
              />
              <div className="flex flex-col gap-2 pl-1">
                <SliderRow
                  label="Strength"
                  value={glitch.strength}
                  onChange={(v) => set('glitch', { strength: v })}
                  disabled={!glitch.enabled}
                />
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
