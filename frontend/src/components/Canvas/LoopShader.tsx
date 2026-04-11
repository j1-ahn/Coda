'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// GLSL Shaders
// ---------------------------------------------------------------------------

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uTexture;
uniform float uTime;
uniform float uStrength;
uniform int uMode;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  if (uMode == 1) {
    // Wind: 상단은 많이 흔들, 하단은 고정
    float wave = sin(uv.x * 8.0 + uTime * 1.5) * uStrength * (1.0 - uv.y) * 0.015;
    uv.x += wave;
    uv.y += sin(uv.x * 5.0 + uTime * 1.2) * uStrength * 0.005;
  } else if (uMode == 2) {
    // Ripple: 중심에서 퍼지는 물결
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(uv, center);
    float ripple = sin(dist * 20.0 - uTime * 2.0) * uStrength * 0.01;
    uv += normalize(uv - center) * ripple;
  }

  gl_FragColor = texture2D(uTexture, uv);
}
`;

// ---------------------------------------------------------------------------
// Mode mapping helper
// ---------------------------------------------------------------------------

const MODE_INDEX: Record<'none' | 'wind' | 'ripple', number> = {
  none: 0,
  wind: 1,
  ripple: 2,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LoopShaderMeshProps {
  texture: THREE.Texture;
  mode: 'none' | 'wind' | 'ripple';
  strength?: number;
  /** Pass scale from parent so the mesh fills the viewport */
  scale?: [number, number, number];
  position?: [number, number, number];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoopShaderMesh({
  texture,
  mode,
  strength = 0.5,
  scale = [1, 1, 1],
  position = [0, 0, 0],
}: LoopShaderMeshProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Build uniforms once; keep refs stable across re-renders
  const uniforms = useRef<Record<string, THREE.IUniform>>({
    uTexture: { value: texture },
    uTime: { value: 0 },
    uStrength: { value: strength },
    uMode: { value: MODE_INDEX[mode] },
  });

  // Sync prop changes into uniforms every frame (cheap ref assignment)
  useFrame((_state, delta) => {
    const u = uniforms.current;
    u.uTime.value += delta;
    u.uTexture.value = texture;
    u.uStrength.value = strength;
    u.uMode.value = MODE_INDEX[mode];
  });

  return (
    <mesh scale={scale} position={position}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
        toneMapped={false}
      />
    </mesh>
  );
}
