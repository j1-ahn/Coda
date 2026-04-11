'use client';

import { useState, useEffect } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import EQCanvas, { type EQPreset } from './EQCanvas';
import PresetGrid, { DEFAULT_PRESETS } from './PresetGrid';
import EQReactModeSelector from './EQReactModeSelector';

// ---------------------------------------------------------------------------
// EqualizerTab
// ---------------------------------------------------------------------------

export default function EqualizerTab() {
  // Zustand EQ state
  const eqPresetId       = useCodaStore((s) => s.eqPresetId);
  const eqReactMode      = useCodaStore((s) => s.eqReactMode);
  const eqCustomImageUrl = useCodaStore((s) => s.eqCustomImageUrl);
  const setEQPreset      = useCodaStore((s) => s.setEQPreset);
  const setEQReactMode   = useCodaStore((s) => s.setEQReactMode);
  const setEQCustomImage = useCodaStore((s) => s.setEQCustomImage);

  // Local preset list (may be patched with custom image URL)
  const [presets, setPresets] = useState<EQPreset[]>(DEFAULT_PRESETS);

  // Sync custom image from store into preset list on mount
  useEffect(() => {
    if (eqCustomImageUrl) {
      setPresets((prev) =>
        prev.map((p) =>
          p.id === 'custom' ? { ...p, imagePath: eqCustomImageUrl } : p
        )
      );
    }
  }, [eqCustomImageUrl]);

  // Derived selected preset (always reflect eqReactMode from store)
  const selectedPreset: EQPreset = (() => {
    const found = presets.find((p) => p.id === eqPresetId);
    if (!found) return { ...DEFAULT_PRESETS[0], reactMode: eqReactMode };
    return { ...found, reactMode: eqReactMode };
  })();

  // Web Audio analyser — connects to document.querySelector('audio') automatically
  const analyserData = useAudioAnalyser();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePresetSelect = (preset: EQPreset) => {
    setEQPreset(preset.id);
    // When switching preset, adopt the preset's default react mode
    setEQReactMode(preset.reactMode);
    // Update local preset list if id matches (e.g., custom with new imagePath)
    setPresets((prev) =>
      prev.map((p) => (p.id === preset.id ? { ...p, imagePath: preset.imagePath } : p))
    );
  };

  const handleCustomImage = (url: string, _preset: EQPreset) => {
    setEQCustomImage(url);
    setEQPreset('custom');
  };

  const handleReactModeChange = (mode: EQPreset['reactMode']) => {
    setEQReactMode(mode);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <span className="label-caps">Equalizer</span>
      </div>

      {/* EQ Canvas — flex-1 */}
      <div className="flex-1 min-h-0 relative">
        <EQCanvas preset={selectedPreset} analyserData={analyserData} />
      </div>

      {/* Preset Grid */}
      <div className="shrink-0">
        <PresetGrid
          presets={presets}
          selectedId={eqPresetId}
          onSelect={handlePresetSelect}
          onCustomImage={handleCustomImage}
        />
      </div>

      {/* React Mode Selector */}
      <div className="shrink-0">
        <EQReactModeSelector
          value={eqReactMode}
          onChange={handleReactModeChange}
        />
      </div>

    </div>
  );
}
