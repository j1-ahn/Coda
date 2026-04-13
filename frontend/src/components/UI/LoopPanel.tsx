'use client';

import { useCallback, useRef, useState } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Shared sub-components
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

interface SliderRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
}

function SliderRow({ label, value, min = 0, max = 1, step = 0.01, onChange, unit = '' }: SliderRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-ink-400 w-[72px] shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 cursor-pointer"
        style={{ accentColor: '#1a1a16' }}
      />
      <span className="font-mono text-[10px] text-ink-500 w-[30px] text-right tabular-nums">
        {value.toFixed(step < 0.1 ? 2 : 1)}{unit}
      </span>
    </div>
  );
}

// 8-direction buttons
const DIR_LABELS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

function DirectionPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-ink-400 w-[72px] shrink-0">Direction</span>
      <div className="flex gap-0.5">
        {DIR_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`w-6 h-6 text-[11px] border transition-colors ${
              value === i
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoopPanel
// ---------------------------------------------------------------------------

export default function LoopPanel() {
  const scenes            = useCodaStore((s) => s.scenes);
  const activeSceneId     = useCodaStore((s) => s.activeSceneId);
  const toggleLoopMode    = useCodaStore((s) => s.toggleLoopMode);
  const setLoopStrength   = useCodaStore((s) => s.setLoopStrength);
  const setDepthMap       = useCodaStore((s) => s.setDepthMap);
  const setLoopMaskPoints = useCodaStore((s) => s.setLoopMaskPoints);
  const setMaskDrawingMode = useCodaStore((s) => s.setMaskDrawingMode);
  const maskDrawingMode   = useCodaStore((s) => s.maskDrawingMode);
  const setLoopParam      = useCodaStore((s) => s.setLoopParam);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const fx = activeScene?.effects;
  const loopModes    = fx?.loopModes    ?? { wind: false, ripple: false, depth: false };
  const loopStrength = fx?.loopStrength ?? 0.5;
  const depthMapUrl  = fx?.depthMapUrl  ?? null;
  const hasMask      = (fx?.loopMaskPoints.length ?? 0) >= 4;

  const anyActive = loopModes.wind || loopModes.ripple || loopModes.depth;

  const depthInputRef = useRef<HTMLInputElement>(null);
  const [depthGenerating, setDepthGenerating] = useState(false);

  const generateDepthMap = useCallback(async (sceneId: string, bgUrl: string) => {
    setDepthGenerating(true);
    try {
      const res  = await fetch(bgUrl);
      const blob = await res.blob();
      const form = new FormData();
      form.append('file', blob, 'image.png');
      const resp = await fetch('/api/depth/estimate', {
        method: 'POST',
        body: form,
      });
      if (!resp.ok) throw new Error('depth API failed');
      const depthBlob = await resp.blob();
      setDepthMap(sceneId, URL.createObjectURL(depthBlob));
    } catch {
      // fallback: radial
    } finally {
      setDepthGenerating(false);
    }
  }, [setDepthMap]);

  const handleNone = useCallback(() => {
    if (!activeScene) return;
    if (loopModes.wind)   toggleLoopMode(activeScene.id, 'wind');
    if (loopModes.ripple) toggleLoopMode(activeScene.id, 'ripple');
    if (loopModes.depth)  toggleLoopMode(activeScene.id, 'depth');
  }, [activeScene, loopModes, toggleLoopMode]);

  const handleToggle = useCallback(
    (mode: 'wind' | 'ripple' | 'depth') => {
      if (!activeScene) return;

      if (mode === 'wind') {
        // Turn on wind → turn off ripple
        if (!loopModes.wind && loopModes.ripple) toggleLoopMode(activeScene.id, 'ripple');
        toggleLoopMode(activeScene.id, 'wind');
      } else if (mode === 'ripple') {
        // Turn on ripple → turn off wind
        if (!loopModes.ripple && loopModes.wind) toggleLoopMode(activeScene.id, 'wind');
        toggleLoopMode(activeScene.id, 'ripple');
      } else {
        // Depth toggles freely
        toggleLoopMode(activeScene.id, 'depth');
        if (!loopModes.depth && !depthMapUrl && activeScene.background.url) {
          generateDepthMap(activeScene.id, activeScene.background.url);
        }
      }
    },
    [activeScene, loopModes, toggleLoopMode, depthMapUrl, generateDepthMap]
  );

  const p = (key: string, value: number) => {
    if (activeScene) setLoopParam(activeScene.id, key, value);
  };

  return (
    <div className="px-3 py-2.5 flex flex-col gap-3">

      {/* Mode selector */}
      <div className="grid grid-cols-4 gap-1">
        <ModeBtn label="NONE"     active={!anyActive}       onClick={handleNone} />
        <ModeBtn label="WIND ≋"   active={loopModes.wind}   onClick={() => handleToggle('wind')} />
        <ModeBtn label="RIPPLE ◎" active={loopModes.ripple} onClick={() => handleToggle('ripple')} />
        <ModeBtn label="DEPTH ⊕"  active={loopModes.depth}  onClick={() => handleToggle('depth')} />
      </div>

      {/* Strength — common to all modes */}
      <div className={`transition-opacity ${!anyActive ? 'opacity-30 pointer-events-none' : ''}`}>
        <SliderRow
          label="Strength"
          value={loopStrength}
          onChange={(v) => activeScene && setLoopStrength(activeScene.id, v)}
        />
      </div>

      {/* ── WIND controls ──────────────────────────────────────────────── */}
      {loopModes.wind && (
        <div className="flex flex-col gap-2 border-t border-cream-300 pt-2.5">
          <span className="label-caps text-ink-400">Wind</span>
          <DirectionPicker
            value={fx?.windDirection ?? 0}
            onChange={(v) => p('windDirection', v)}
          />
          <SliderRow label="Speed"       value={fx?.windSpeed      ?? 1.0} min={0.1} max={3}  step={0.05} onChange={(v) => p('windSpeed', v)} unit="×" />
          <SliderRow label="Frequency"   value={fx?.windFrequency  ?? 4.0} min={1}   max={12} step={0.5}  onChange={(v) => p('windFrequency', v)} />
          <SliderRow label="Turbulence"  value={fx?.windTurbulence ?? 0.0} min={0}   max={1}  step={0.01} onChange={(v) => p('windTurbulence', v)} />
        </div>
      )}

      {/* ── RIPPLE controls ─────────────────────────────────────────────── */}
      {loopModes.ripple && (
        <div className="flex flex-col gap-2 border-t border-cream-300 pt-2.5">
          <span className="label-caps text-ink-400">Ripple</span>
          <SliderRow label="Origin X"  value={fx?.rippleOriginX ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => p('rippleOriginX', v)} />
          <SliderRow label="Origin Y"  value={fx?.rippleOriginY ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => p('rippleOriginY', v)} />
          <SliderRow label="Speed"     value={fx?.rippleSpeed   ?? 1.0} min={0.1} max={3} step={0.05} onChange={(v) => p('rippleSpeed', v)} unit="×" />
          <SliderRow label="Decay"     value={fx?.rippleDecay   ?? 0.65} min={0.05} max={1} step={0.01} onChange={(v) => p('rippleDecay', v)} />
        </div>
      )}

      {/* ── DEPTH controls ──────────────────────────────────────────────── */}
      {loopModes.depth && (
        <div className="flex flex-col gap-2 border-t border-cream-300 pt-2.5">
          <span className="label-caps text-ink-400">Depth</span>
          <SliderRow label="근거리 +"  value={fx?.depthNearSpeed ?? 1.5}  min={0} max={3}  step={0.05} onChange={(v) => p('depthNearSpeed', v)} unit="×" />
          <SliderRow label="원거리 −"  value={fx?.depthFarSpeed  ?? 0.8}  min={0} max={2}  step={0.05} onChange={(v) => p('depthFarSpeed', v)}  unit="×" />
          <SliderRow label="Haze"      value={fx?.depthHaze      ?? 0.5}  min={0} max={1}  step={0.01} onChange={(v) => p('depthHaze', v)} />

          {/* Depth map */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] text-ink-400 w-[72px] shrink-0">Depth Map</span>
            {depthGenerating && <span className="text-[9px] text-ink-400 animate-pulse">AI 분석 중…</span>}
            <button
              onClick={() => depthInputRef.current?.click()}
              className="text-[9px] label-caps px-2 py-1 border border-cream-300 hover:border-ink-500 text-ink-500 hover:text-ink-900 transition-colors"
            >
              {depthMapUrl ? 'CHANGE' : 'UPLOAD'}
            </button>
            {depthMapUrl && (
              <button
                onClick={() => activeScene && setDepthMap(activeScene.id, null)}
                className="text-[9px] label-caps text-ink-300 hover:text-ink-900 transition-colors"
              >
                RESET
              </button>
            )}
          </div>
          <input
            ref={depthInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && activeScene) setDepthMap(activeScene.id, URL.createObjectURL(file));
            }}
          />
        </div>
      )}

      {/* ── MASK (wind/ripple) ──────────────────────────────────────────── */}
      {(loopModes.wind || loopModes.ripple) && (
        <div className="flex items-center gap-2 border-t border-cream-300 pt-2">
          <button
            onClick={() => {
              if (hasMask) {
                if (activeScene) setLoopMaskPoints(activeScene.id, []);
              } else {
                setMaskDrawingMode(!maskDrawingMode);
              }
            }}
            className={`text-[9px] label-caps px-2 py-1 border transition-colors ${
              maskDrawingMode
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : hasMask
                ? 'border-ink-500 text-ink-600 hover:text-ink-900'
                : 'border-cream-300 text-ink-400 hover:border-ink-500'
            }`}
          >
            {maskDrawingMode ? 'DRAWING…' : hasMask ? 'MASK ✓' : 'MASK'}
          </button>
          {hasMask && (
            <button
              onClick={() => activeScene && setLoopMaskPoints(activeScene.id, [])}
              className="text-[9px] label-caps text-ink-300 hover:text-ink-900"
            >
              CLEAR
            </button>
          )}
          {maskDrawingMode && (
            <span className="text-[9px] text-ink-400">Ctrl+Click · 시작점으로 완성</span>
          )}
        </div>
      )}

    </div>
  );
}
