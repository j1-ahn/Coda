'use client';

import dynamic from 'next/dynamic';
import { useRef, useMemo, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import type { AudioAnalyserData } from '@/hooks/useAudioAnalyser';

// ---------------------------------------------------------------------------
// Error Boundary — catches useLoader 404 / texture failures
// ---------------------------------------------------------------------------
class TextureErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EQPreset {
  id: string;
  name: string;
  imagePath: string;
  reactMode: 'pulse' | 'ripple' | 'chromatic' | 'warp';
  colorTint: string;
}

interface EQCanvasProps {
  preset: EQPreset;
  analyserData: AudioAnalyserData;
}

// ---------------------------------------------------------------------------
// GLSL Shader sources
// ---------------------------------------------------------------------------

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Each mode bakes all 4 branches; active mode selected via uniform uMode (0-3)
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uTexture;
  uniform int uMode;       // 0=pulse 1=ripple 2=chromatic 3=warp
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uOverall;
  uniform float uTime;
  uniform vec3 uTint;
  uniform bool uHasTexture;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // ---------- pulse ----------
    if (uMode == 0) {
      vec2 center = vec2(0.5);
      uv = uv - center;
      uv *= 1.0 - uBass * 0.08;
      uv += center;

      if (uHasTexture) {
        vec4 col = texture2D(uTexture, clamp(uv, 0.0, 1.0));
        gl_FragColor = mix(col, vec4(uTint, 1.0), uBass * 0.15);
      } else {
        vec3 base = mix(vec3(0.93, 0.918, 0.886), uTint, uBass * 0.4);
        gl_FragColor = vec4(base, 1.0);
      }
      return;
    }

    // ---------- ripple ----------
    if (uMode == 1) {
      float dist = distance(uv, vec2(0.5));
      float ripple = sin(dist * 25.0 - uTime * 3.0) * uMid * 0.015;
      vec2 dir = normalize(uv - vec2(0.5) + vec2(0.0001));
      uv = uv + dir * ripple;

      if (uHasTexture) {
        vec4 col = texture2D(uTexture, clamp(uv, 0.0, 1.0));
        gl_FragColor = mix(col, vec4(uTint, 1.0), uMid * 0.1);
      } else {
        float g = 0.5 + 0.5 * sin(dist * 8.0 - uTime * 2.0);
        vec3 base = mix(vec3(0.93, 0.918, 0.886), uTint, g * uMid * 0.5);
        gl_FragColor = vec4(base, 1.0);
      }
      return;
    }

    // ---------- chromatic ----------
    if (uMode == 2) {
      float split = uTreble * 0.02;
      if (uHasTexture) {
        float r = texture2D(uTexture, clamp(uv + vec2(split, 0.0), 0.0, 1.0)).r;
        float g = texture2D(uTexture, clamp(uv,                     0.0, 1.0)).g;
        float b = texture2D(uTexture, clamp(uv - vec2(split, 0.0), 0.0, 1.0)).b;
        gl_FragColor = vec4(r, g, b, 1.0);
      } else {
        // Gradient placeholder with chromatic split
        vec3 base = mix(vec3(0.12), vec3(0.88, 0.86, 0.82), uv.y);
        float r = base.r + uTint.r * split * 30.0;
        float gb = base.g;
        gl_FragColor = vec4(r, gb, gb - split * 20.0, 1.0);
      }
      return;
    }

    // ---------- warp ----------
    if (uMode == 3) {
      uv.x += sin(uv.y * 10.0 + uTime * 2.0) * uOverall * 0.01;
      uv.y += cos(uv.x * 8.0 + uTime * 1.5) * uOverall * 0.01;

      if (uHasTexture) {
        gl_FragColor = texture2D(uTexture, clamp(uv, 0.0, 1.0));
      } else {
        vec3 base = mix(vec3(0.12), vec3(0.88, 0.86, 0.82), uv.y);
        gl_FragColor = vec4(mix(base, uTint, uOverall * 0.3), 1.0);
      }
      return;
    }

    gl_FragColor = vec4(0.93, 0.918, 0.886, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Inner mesh that consumes uniforms every frame
// ---------------------------------------------------------------------------

interface ShaderPlaneProps {
  texture: THREE.Texture | null;
  preset: EQPreset;
  analyserData: AudioAnalyserData;
}

function ShaderPlane({ texture, preset, analyserData }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const modeIndex: Record<EQPreset['reactMode'], number> = {
    pulse: 0,
    ripple: 1,
    chromatic: 2,
    warp: 3,
  };

  const tintColor = useMemo(() => {
    const c = new THREE.Color(preset.colorTint);
    return [c.r, c.g, c.b];
  }, [preset.colorTint]);

  const uniforms = useMemo(
    () => ({
      uTexture:    { value: texture ?? new THREE.Texture() },
      uMode:       { value: modeIndex[preset.reactMode] },
      uBass:       { value: 0 },
      uMid:        { value: 0 },
      uTreble:     { value: 0 },
      uOverall:    { value: 0 },
      uTime:       { value: 0 },
      uTint:       { value: new THREE.Vector3(...tintColor) },
      uHasTexture: { value: texture !== null },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame(({ clock }) => {
    uniforms.uTime.value    = clock.getElapsedTime();
    uniforms.uBass.value    = analyserData.bassLevel;
    uniforms.uMid.value     = analyserData.midLevel;
    uniforms.uTreble.value  = analyserData.trebleLevel;
    uniforms.uOverall.value = analyserData.overallLevel;
    uniforms.uMode.value    = modeIndex[preset.reactMode];

    const c = new THREE.Color(preset.colorTint);
    uniforms.uTint.value.set(c.r, c.g, c.b);

    if (texture) {
      uniforms.uTexture.value  = texture;
      uniforms.uHasTexture.value = true;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// TextureLoader wrapper — gracefully handles missing images
// ---------------------------------------------------------------------------

function TexturedPlane({ preset, analyserData }: { preset: EQPreset; analyserData: AudioAnalyserData }) {
  const hasImage = preset.imagePath !== '' && preset.id !== 'custom';

  // Always call useLoader — pass a 1×1 transparent PNG data URI when no image
  const FALLBACK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const src = hasImage ? preset.imagePath : FALLBACK;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const texture = useLoader(THREE.TextureLoader, src);

  return <ShaderPlane texture={hasImage ? texture : null} preset={preset} analyserData={analyserData} />;
}

// ---------------------------------------------------------------------------
// Scene wrapper (needs to be inside Canvas)
// ---------------------------------------------------------------------------

function EQScene({ preset, analyserData }: EQCanvasProps) {
  const noTextureFallback = <ShaderPlane texture={null} preset={preset} analyserData={analyserData} />;
  return (
    <TextureErrorBoundary fallback={noTextureFallback}>
      <TexturedPlane preset={preset} analyserData={analyserData} />
    </TextureErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Frequency bars (HTML/CSS — outside WebGL)
// ---------------------------------------------------------------------------

function FrequencyBars({ frequencyData }: { frequencyData: Uint8Array }) {
  // Downsample 256 bins → 50 bars
  const bars = useMemo(() => {
    const count = 50;
    const result: number[] = [];
    const step = Math.floor(frequencyData.length / count);
    for (let i = 0; i < count; i++) {
      result.push((frequencyData[i * step] / 255) * 100);
    }
    return result;
  }, [frequencyData]);

  return (
    <div className="flex items-end gap-px h-12 px-4 bg-cream-100">
      {bars.map((height, i) => (
        <div
          key={i}
          className="flex-1 bg-ink-900 transition-none"
          style={{ height: `${Math.max(2, height)}%`, opacity: 0.6 + height * 0.004 }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EQCanvas — exported as dynamic (SSR disabled)
// ---------------------------------------------------------------------------

function EQCanvasInner({ preset, analyserData }: EQCanvasProps) {
  return (
    <div className="flex flex-col w-full h-full" style={{ background: '#edeae3' }}>
      {/* WebGL Canvas */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 0, 1], fov: 90 }}
          gl={{ antialias: false }}
          style={{ background: '#edeae3', width: '100%', height: '100%' }}
        >
          <EQScene preset={preset} analyserData={analyserData} />
        </Canvas>
      </div>

      {/* Frequency bars */}
      <FrequencyBars frequencyData={analyserData.frequencyData} />
    </div>
  );
}

// Export with SSR disabled
const EQCanvas = dynamic(() => Promise.resolve(EQCanvasInner), { ssr: false });

export default EQCanvas;
