/**
 * TitleLayer.tsx
 * 3대 타이틀 모드 WebGL 컴포넌트
 *
 * Mode 1: hero-to-corner  — 중앙 Hero → 우측 상단 코너 이동 후 상주
 * Mode 2: ambient-object  — 은은한 부유 오브젝트
 * Mode 3: breathing       — 정중앙 호흡 펄스
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Mode 1: Hero → Corner
// ---------------------------------------------------------------------------

interface TitleTextProps {
  text: string;
}

function HeroToCornerTitle({ text }: TitleTextProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef(0);

  // 시작: 중앙 (0, 0), 목표: 우측 상단 코너 (0.85, 0.45)
  const startPos = new THREE.Vector3(0, 0, 0);
  const targetPos = new THREE.Vector3(0.85, 0.45, 0);

  // 시작 fontSize=0.5, 목표 fontSize=0.1 (Text는 material을 통해 opacity 조작)
  const startSize = 0.5;
  const targetSize = 0.1;
  const transitionDuration = 3.0; // seconds

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    elapsedRef.current += delta;
    const t = Math.min(elapsedRef.current / transitionDuration, 1.0);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);

    meshRef.current.position.x = THREE.MathUtils.lerp(startPos.x, targetPos.x, eased);
    meshRef.current.position.y = THREE.MathUtils.lerp(startPos.y, targetPos.y, eased);

    // fontSize는 Text의 scale로 근사
    const currentScale = THREE.MathUtils.lerp(startSize, targetSize, eased);
    meshRef.current.scale.setScalar(currentScale / startSize);
  });

  return (
    <Text
      ref={meshRef}
      fontSize={startSize}
      color="#fbbf24"
      anchorX="center"
      anchorY="middle"
      renderOrder={100}
      outlineWidth={0.01}
      outlineColor="#000000"
    >
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Mode 2: Ambient Object
// ---------------------------------------------------------------------------

function AmbientTitle({ text }: TitleTextProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const baseY = -0.2;
  const baseFontSize = 0.12;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    // sin 부유 (y축)
    meshRef.current.position.y = baseY + Math.sin(t * 0.4) * 0.05;
    // 미세 x 흔들림
    meshRef.current.position.x = Math.sin(t * 0.3) * 0.02;
  });

  return (
    <Text
      ref={meshRef}
      position={[0, baseY, 0]}
      fontSize={baseFontSize}
      color="#fbbf24"
      fillOpacity={0.35}
      anchorX="center"
      anchorY="middle"
      renderOrder={100}
    >
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Mode 3: Breathing
// ---------------------------------------------------------------------------

function BreathingTitle({ text }: TitleTextProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const baseFontSize = 0.18;
  // opacity/scale은 useFrame에서 material 직접 조작
  const opacityRef = useRef(1.0);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    // opacity: 0.5 ↔ 1.0
    const opacity = 0.75 + Math.sin(t * 0.8) * 0.25;
    opacityRef.current = opacity;

    // material opacity 업데이트
    const mat = meshRef.current.material as THREE.MeshBasicMaterial | undefined;
    if (mat && 'opacity' in mat) {
      mat.opacity = opacity;
      mat.transparent = true;
    }

    // scale 펄스: 0.98 ↔ 1.02
    const s = 1.0 + Math.sin(t * 0.8) * 0.02;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <Text
      ref={meshRef}
      position={[0, 0, 0]}
      fontSize={baseFontSize}
      color="#fbbf24"
      anchorX="center"
      anchorY="middle"
      renderOrder={100}
      outlineWidth={0.008}
      outlineColor="#000000"
    >
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// TitleLayer — root export
// ---------------------------------------------------------------------------

export default function TitleLayer() {
  const titleMode = useCodaStore((s) => s.titleMode);
  const titleText = useCodaStore((s) => s.titleText);

  if (!titleText) return null;

  return (
    <group renderOrder={100}>
      {titleMode === 'hero-to-corner' && <HeroToCornerTitle text={titleText} />}
      {titleMode === 'ambient-object' && <AmbientTitle text={titleText} />}
      {titleMode === 'breathing' && <BreathingTitle text={titleText} />}
    </group>
  );
}
