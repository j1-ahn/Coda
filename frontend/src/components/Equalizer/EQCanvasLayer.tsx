'use client';

import { useCodaStore } from '@/store/useCodaStore';
import EQCanvas from './EQCanvas';
import { DEFAULT_PRESETS } from './PresetGrid';
import { eqAnalyserRef, EMPTY_ANALYSER } from '@/lib/eqAnalyserRef';
import type { EQPreset } from './EQCanvas';

export default function EQCanvasLayer() {
  const visible     = useCodaStore((s) => s.eqOverlayVisible);
  const eqPresetId  = useCodaStore((s) => s.eqPresetId);
  const eqIntensity = useCodaStore((s) => s.eqIntensity);
  const eqOpacity   = useCodaStore((s) => s.eqOpacity);
  const eqMirror    = useCodaStore((s) => s.eqMirror);
  const ox          = useCodaStore((s) => s.eqOverlayX);
  const oy          = useCodaStore((s) => s.eqOverlayY);
  const ow          = useCodaStore((s) => s.eqOverlayW);
  const oh          = useCodaStore((s) => s.eqOverlayH);
  const flipX       = useCodaStore((s) => s.eqFlipX);
  const flipY       = useCodaStore((s) => s.eqFlipY);
  const eqTintColor = useCodaStore((s) => s.eqTintColor);

  if (!visible) return null;

  const preset: EQPreset = (() => {
    const base = DEFAULT_PRESETS.find((p) => p.id === eqPresetId) ?? DEFAULT_PRESETS[0];
    return { ...base, reactMode: 'original', colorTint: eqTintColor ?? base.colorTint };
  })();

  const flipTransform = [flipX ? 'scaleX(-1)' : '', flipY ? 'scaleY(-1)' : ''].filter(Boolean).join(' ') || undefined;
  const mirrorH = `${oh * 0.5}%`; // reflection height = 50% of main height

  // 컨테이너 밖으로 삐져나오지 않도록 클램핑
  const safeOx = Math.max(0, Math.min(ox, 100 - ow));
  const safeOy = Math.max(0, Math.min(oy, 100 - oh));
  // oh가 캔버스 하단을 넘지 않도록
  const safeOh = Math.min(oh, 100 - safeOy);

  return (
    <div
      className="absolute pointer-events-none overflow-hidden"
      style={{ left: `${safeOx}%`, top: `${safeOy}%`, width: `${ow}%`, height: `${safeOh}%`, opacity: eqOpacity }}
    >
      {/* Main canvas */}
      <div style={{ width: '100%', height: '100%', transform: flipTransform }}>
        <EQCanvas
          preset={preset}
          analyserData={EMPTY_ANALYSER}
          intensity={1}
          sensitivity={eqIntensity * 2}
          externalDataRef={eqAnalyserRef}
        />
      </div>

      {/* Mirror reflection — outer container flipped so bottom of canvas shows at top */}
      {eqMirror && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: mirrorH,
          overflow: 'hidden',
          transform: `scaleY(-1)${flipX ? ' scaleX(-1)' : ''}`,
        }}>
          <div style={{ width: '100%', height: '200%' }}>
            <EQCanvas
              preset={preset}
              analyserData={EMPTY_ANALYSER}
              intensity={1}
              sensitivity={eqIntensity * 2}
              externalDataRef={eqAnalyserRef}
            />
          </div>
          {/* Gradient fade — in flipped space, 'to bottom' fades toward the viewer's top */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,1) 100%)',
            pointerEvents: 'none',
          }} />
        </div>
      )}
    </div>
  );
}
