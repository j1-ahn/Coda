'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import type { AudioAnalyserData } from '@/hooks/useAudioAnalyser';
import EQCanvas, { type EQPreset } from './EQCanvas';
import PresetGrid, { DEFAULT_PRESETS } from './PresetGrid';
import { eqAnalyserRef, EMPTY_ANALYSER } from '@/lib/eqAnalyserRef';
import PlaylistPanel from '@/components/UI/PlaylistPanel';

// ---------------------------------------------------------------------------
// EqualizerTab
// (EQAudioPlayer removed — audio engine now lives in CanvasBottomBar which
//  pushes data into eqAnalyserRef at 60fps; EqualizerTab polls it via RAF)
// ---------------------------------------------------------------------------

export default function EqualizerTab() {
  const eqPresetId          = useCodaStore((s) => s.eqPresetId);
  const eqIntensity         = useCodaStore((s) => s.eqIntensity);
  const eqSensitivity       = useCodaStore((s) => s.eqSensitivity);
  const eqTintColor         = useCodaStore((s) => s.eqTintColor);
  const setEQPreset         = useCodaStore((s) => s.setEQPreset);
  const setEqIntensity      = useCodaStore((s) => s.setEqIntensity);
  const setEqSensitivity    = useCodaStore((s) => s.setEqSensitivity);
  const eqOpacity           = useCodaStore((s) => s.eqOpacity);
  const eqMirror            = useCodaStore((s) => s.eqMirror);
  const setEqTintColor      = useCodaStore((s) => s.setEqTintColor);
  const setEqOpacity        = useCodaStore((s) => s.setEqOpacity);
  const setEqMirror         = useCodaStore((s) => s.setEqMirror);
  const setEqOverlayGeometry = useCodaStore((s) => s.setEqOverlayGeometry);
  const setEqOverlayVisible  = useCodaStore((s) => s.setEqOverlayVisible);

  // analyserData — polled from eqAnalyserRef (updated by CanvasBottomBar at 60fps)
  const [analyserData, setAnalyserData] = useState<AudioAnalyserData>(EMPTY_ANALYSER);
  const [presets, setPresets]           = useState<EQPreset[]>(DEFAULT_PRESETS);
  const [pendingColor, setPendingColor] = useState<string | null>(null);

  useEffect(() => {
    let animId: number;
    const tick = () => {
      animId = requestAnimationFrame(tick);
      setAnalyserData({ ...eqAnalyserRef.current });
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);


  const selectedPreset: EQPreset = (() => {
    const found = presets.find((p) => p.id === eqPresetId);
    const base = found ?? DEFAULT_PRESETS[0];
    return {
      ...base,
      reactMode: 'original',
      colorTint: eqTintColor ?? base.colorTint,
    };
  })();

  const handlePresetSelect = (preset: EQPreset) => {
    setEQPreset(preset.id);
    setPresets((prev) => prev.map((p) => p.id === preset.id ? { ...p, imagePath: preset.imagePath } : p));
  };


  // ----------------------------------------------------------
  // Drag EQ canvas to main studio canvas
  // ----------------------------------------------------------
  const handleEQDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    // Create ghost
    const ghost = document.createElement('div');
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:280px;height:140px;border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.5);transform:translate(-50%,-50%);left:${startX}px;top:${startY}px;display:flex;align-items:center;justify-content:center;`;
    ghost.innerHTML = '<span style="color:rgba(255,255,255,0.5);font-size:10px;font-family:monospace">EQ</span>';
    document.body.appendChild(ghost);

    const onMove = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top  = ev.clientY + 'px';
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.removeChild(ghost);

      // Check if dropped on main canvas → always center in container
      const container = document.getElementById('studio-canvas-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right &&
            ev.clientY >= rect.top  && ev.clientY <= rect.bottom) {
          const w = 280, h = 140;
          const x = Math.max(0, (rect.width  - w) / 2);
          const y = Math.max(0, (rect.height - h) / 2);
          setEqOverlayGeometry(x, y, w, h);
          setEqOverlayVisible(true);
        }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setEqOverlayGeometry, setEqOverlayVisible]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="px-3 pt-2.5 pb-1.5 shrink-0 flex items-center justify-between border-b border-cream-300">
        <span className="label-caps">Equalizer</span>
        <span className="text-[9px] text-ink-300 label-caps">Web Audio API</span>
      </div>

      {/* EQ Canvas — draggable to studio canvas */}
      <div
        className="relative shrink-0 cursor-grab active:cursor-grabbing"
        style={{ height: '140px' }}
        onMouseDown={handleEQDragStart}
      >
        <EQCanvas preset={selectedPreset} analyserData={analyserData} intensity={1} sensitivity={eqIntensity * 2} />
        <div className="absolute inset-0 flex items-end justify-center pb-1.5 pointer-events-none">
          <span className="text-[8px] label-caps text-white/30">drag to canvas</span>
        </div>
      </div>


      {/* Preset Grid */}
      <div className="shrink-0">
        <PresetGrid
          presets={presets}
          selectedId={eqPresetId}
          onSelect={handlePresetSelect}
        />
      </div>


      {/* Intensity = audio reactivity (0–100, stored 0–1, default 0.5) */}
      <div className="shrink-0 px-3 py-2 border-t border-cream-300">
        <div className="flex items-center gap-2">
          <span className="label-caps text-ink-300 shrink-0">INTENSITY</span>
          <input
            type="range" min={0} max={1} step={0.01} value={eqIntensity}
            onChange={(e) => setEqIntensity(parseFloat(e.target.value))}
            className="flex-1 h-0.5 cursor-pointer"
            style={{ accentColor: '#1a1a16' }}
          />
          <span className="font-mono text-[10px] text-ink-300 w-8 text-right tabular-nums">
            {Math.round(eqIntensity * 100)}
          </span>
        </div>
      </div>

      {/* Opacity slider */}
      <div className="shrink-0 px-3 py-2 border-t border-cream-300">
        <div className="flex items-center gap-2">
          <span className="label-caps text-ink-300 shrink-0">OPACITY</span>
          <input
            type="range" min={0} max={1} step={0.01} value={eqOpacity}
            onChange={(e) => setEqOpacity(parseFloat(e.target.value))}
            className="flex-1 h-0.5 cursor-pointer"
            style={{ accentColor: '#1a1a16' }}
          />
          <span className="font-mono text-[10px] text-ink-300 w-8 text-right tabular-nums">
            {Math.round(eqOpacity * 100)}
          </span>
        </div>
      </div>

      {/* Mirror toggle */}
      <div className="shrink-0 px-3 py-2 border-t border-cream-300 flex items-center justify-between">
        <span className="label-caps text-ink-300">MIRROR</span>
        <button
          onClick={() => setEqMirror(!eqMirror)}
          className={`px-3 py-1 text-[10px] label-caps border transition-colors ${
            eqMirror
              ? 'bg-ink-900 text-cream-100 border-ink-900'
              : 'text-ink-400 border-cream-300 hover:text-ink-900 hover:border-ink-500'
          }`}
        >
          {eqMirror ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Color tint — pick then APPLY */}
      {(() => {
        const presetDefault = presets.find((p) => p.id === eqPresetId)?.colorTint ?? '#ffffff';
        const displayColor  = pendingColor ?? eqTintColor ?? presetDefault;
        const isDirty       = pendingColor !== null && pendingColor !== (eqTintColor ?? presetDefault);
        return (
          <div className="shrink-0 px-3 py-2 border-t border-cream-300 flex items-center gap-2">
            <span className="label-caps text-ink-300 shrink-0">COLOR</span>
            <label className="relative cursor-pointer shrink-0" title="Pick EQ color">
              <span
                className="block w-5 h-5 border border-cream-300 hover:border-ink-500 transition-colors"
                style={{ background: displayColor }}
              />
              <input
                type="color"
                value={displayColor}
                onChange={(e) => setPendingColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </label>
            <span className="font-mono text-[9px] text-ink-400 flex-1">{displayColor}</span>
            <button
              onClick={() => { setEqTintColor(pendingColor); setPendingColor(null); }}
              disabled={!isDirty}
              className={`text-[9px] label-caps px-2 py-0.5 border transition-colors shrink-0 ${
                isDirty
                  ? 'border-ink-900 bg-ink-900 text-cream-100 hover:bg-ink-700'
                  : 'border-cream-300 text-ink-200 cursor-default'
              }`}
            >
              APPLY
            </button>
            <button
              onClick={() => { setEqTintColor(null); setPendingColor(null); }}
              className="text-[9px] label-caps text-ink-300 hover:text-ink-900 transition-colors shrink-0"
              title="Reset to preset default"
            >
              RESET
            </button>
          </div>
        );
      })()}

      {/* Playlist — Color 바로 아래 */}
      <PlaylistPanel />

    </div>
  );
}
