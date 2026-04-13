'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCodaStore } from '@/store/useCodaStore';

const vert = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */`
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c * vec2(1.2, 1.6));
    // Warm vignette — orange/brown at edges
    float burn = smoothstep(0.3, 0.85, d) * uIntensity;
    // Slight flicker
    float flicker = 1.0 + 0.03 * sin(uTime * 7.3) * sin(uTime * 13.1);
    burn *= flicker;
    vec3 warmColor = vec3(0.55, 0.22, 0.05);
    gl_FragColor = vec4(warmColor, burn * 0.65);
  }
`;

export default function FilmBurnLayer() {
  const { filmBurn } = useCodaStore((s) => s.vfxParams);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useRef({
    uIntensity: { value: filmBurn.intensity },
    uTime:      { value: 0 },
  });

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value += delta;
    matRef.current.uniforms.uIntensity.value = filmBurn.intensity;
  });

  if (!filmBurn.enabled) return null;

  return (
    <mesh renderOrder={210} position={[0, 0, 0.5]}>
      <planeGeometry args={[4, 4]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms.current}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}
