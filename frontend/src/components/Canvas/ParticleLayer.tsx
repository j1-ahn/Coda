'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCodaStore } from '@/store/useCodaStore';

// --- Sparkle: 4각 별 모양 파티클, 반짝임 ---
const sparkleVert = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.5 + aPhase * 6.28);
    vAlpha = twinkle;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (1.0 + twinkle * 0.6) * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;
const sparkleFrag = /* glsl */`
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // 4-pointed star SDF
    float ax = abs(c.x), ay = abs(c.y);
    float star = max(ax + ay - 0.4, max(ax, ay) - 0.18);
    if (star > 0.0) discard;
    float bright = 1.0 - smoothstep(0.0, 0.18, length(c));
    gl_FragColor = vec4(uColor, bright * vAlpha * 0.5);
  }
`;

// --- Dust: 작은 원형 먼지 입자 ---
const dustVert = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  attribute vec2 aVelocity;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    pos.x += aVelocity.x * uTime * 0.08;
    pos.y += aVelocity.y * uTime * 0.06;
    // wrap around
    pos.x = mod(pos.x + 1.5, 3.0) - 1.5;
    pos.y = mod(pos.y + 1.5, 3.0) - 1.5;
    vAlpha = 0.4 + 0.3 * sin(uTime * 0.6 + aPhase * 6.28);
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;
const dustFrag = /* glsl */`
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d) * vAlpha;
    gl_FragColor = vec4(1.0, 1.0, 1.0, a * 0.32);
  }
`;

function SparklePoints({ count, speed }: { count: number; speed: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { positions, sizes, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);
    const phases    = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 3.2;
      positions[i*3+1] = (Math.random() - 0.5) * 2.0;
      positions[i*3+2] = 0.3;
      sizes[i]  = 2 + Math.random() * 3.5;
      phases[i] = Math.random();
    }
    return { positions, sizes, phases };
  }, [count]);

  const uniforms = useRef({
    uTime:  { value: 0 },
    uColor: { value: new THREE.Color('#ffffff') },
  });

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta * speed;
  });

  return (
    <points renderOrder={200}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize"    args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase"   args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={sparkleVert}
        fragmentShader={sparkleFrag}
        uniforms={uniforms.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function DustPoints({ count, speed }: { count: number; speed: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { positions, sizes, phases, velocities } = useMemo(() => {
    const positions  = new Float32Array(count * 3);
    const sizes      = new Float32Array(count);
    const phases     = new Float32Array(count);
    const velocities = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 3.0;
      positions[i*3+1] = (Math.random() - 0.5) * 2.0;
      positions[i*3+2] = 0.3;
      sizes[i]  = 0.8 + Math.random() * 1.8;
      phases[i] = Math.random();
      velocities[i*2]   = (Math.random() - 0.5) * 0.3;
      velocities[i*2+1] = (Math.random() - 0.5) * 0.3 + 0.05;
    }
    return { positions, sizes, phases, velocities };
  }, [count]);

  const uniforms = useRef({ uTime: { value: 0 } });

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta * speed;
  });

  return (
    <points renderOrder={200}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position"   args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize"      args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase"     args={[phases, 1]} />
        <bufferAttribute attach="attributes-aVelocity"  args={[velocities, 2]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={dustVert}
        fragmentShader={dustFrag}
        uniforms={uniforms.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function ParticleLayer() {
  const { sparkle, dust } = useCodaStore((s) => s.vfxParams);
  return (
    <>
      {sparkle.enabled && <SparklePoints count={sparkle.count} speed={sparkle.speed} />}
      {dust.enabled    && <DustPoints    count={dust.count}    speed={dust.speed}    />}
    </>
  );
}
