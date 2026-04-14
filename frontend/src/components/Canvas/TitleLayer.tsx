'use client';

/**
 * TitleLayer.tsx
 * Three.js SDF text rendering — high-quality 3D title via troika-three-text.
 *
 * Uses @react-three/drei <Text> with color/emissive for reliable rendering.
 * No <Environment> (causes Suspense hang on HDR load).
 * Strong directional + point lights provide metallic sheen.
 */

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useCodaStore } from '@/store/useCodaStore';

// ── 3D title material presets ────────────────────────────────────────────────

interface Title3DPreset {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  outlineColor: string;
  outlineWidth: number;       // troika outline (0 = none)
  strokeColor?: string;
  strokeWidth?: number;       // troika stroke (0 = none)
}

const PRESETS_3D: Record<string, Title3DPreset> = {
  gold: {
    color: '#d4a850',
    emissive: '#8b6914',
    emissiveIntensity: 0.4,
    outlineColor: '#a06820',
    outlineWidth: 0.015,
  },
  silver: {
    color: '#e0e0e0',
    emissive: '#888888',
    emissiveIntensity: 0.3,
    outlineColor: '#666666',
    outlineWidth: 0.015,
  },
  chrome: {
    color: '#ffffff',
    emissive: '#aaaaaa',
    emissiveIntensity: 0.2,
    outlineColor: '#999999',
    outlineWidth: 0.012,
  },
  neon: {
    color: '#00e5ff',
    emissive: '#00e5ff',
    emissiveIntensity: 1.2,
    outlineColor: '#7b2ff7',
    outlineWidth: 0.02,
  },
  fire: {
    color: '#ff5500',
    emissive: '#ff3300',
    emissiveIntensity: 0.8,
    outlineColor: '#ffb300',
    outlineWidth: 0.018,
  },
  ice: {
    color: '#67e8f9',
    emissive: '#67e8f9',
    emissiveIntensity: 0.5,
    outlineColor: '#818cf8',
    outlineWidth: 0.015,
  },
  dark: {
    color: '#444444',
    emissive: '#222222',
    emissiveIntensity: 0.1,
    outlineColor: '#111111',
    outlineWidth: 0.012,
  },
};

// ── Font URLs (Google Fonts woff — used by troika-three-text) ────────────────

const FONT_MAP: Record<string, string> = {
  elegant: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3YmX5slCNuHLi8bLeY9MK7whWMhyjQAllvuQ.woff',
  lofi: 'https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff',
  pop: 'https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs18NvgUE.woff',
  bold: 'https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs18NvgUE.woff',
};

// ── Title3D component ────────────────────────────────────────────────────────

function Title3DText({
  text,
  subtext,
  presetName,
  animate,
  fontScale,
}: {
  text: string;
  subtext: string;
  presetName: string;
  animate: 'breathing' | 'float' | 'static';
  fontScale: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef   = useRef<THREE.MeshStandardMaterial>(null);
  const preset = PRESETS_3D[presetName] || PRESETS_3D.gold;
  const { viewport } = useThree();

  const fontSize    = viewport.width * 0.08 * fontScale;
  const subFontSize = fontSize * 0.35;

  // Create material once, update on preset change
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(preset.color),
      emissive: new THREE.Color(preset.emissive),
      emissiveIntensity: preset.emissiveIntensity,
      metalness: 0.8,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    return mat;
  }, [preset.color, preset.emissive, preset.emissiveIntensity]);

  const subMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(preset.color),
      emissive: new THREE.Color(preset.emissive),
      emissiveIntensity: preset.emissiveIntensity * 0.5,
      metalness: 0.6,
      roughness: 0.35,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
  }, [preset.color, preset.emissive, preset.emissiveIntensity]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    if (animate === 'breathing') {
      const s = 1 + Math.sin(t * 0.8) * 0.02;
      groupRef.current.scale.setScalar(s);
    } else if (animate === 'float') {
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.05;
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.02;
    }
  });

  const fontUrl = FONT_MAP[useCodaStore.getState().titleFontPreset ?? ''] || FONT_MAP.lofi;

  return (
    <group ref={groupRef} renderOrder={800}>
      {/* Strong directional light for metallic sheen */}
      <directionalLight position={[2, 3, 4]} intensity={1.5} color="#ffffff" />
      <pointLight position={[0, 0.5, 1]} intensity={0.8} color={preset.color} distance={5} />
      <pointLight position={[-1, -0.3, 0.8]} intensity={0.4} color={preset.outlineColor} distance={4} />

      {/* Main title text */}
      <Text
        font={fontUrl}
        fontSize={fontSize}
        anchorX="center"
        anchorY="middle"
        position={[0, subtext ? 0.08 : 0, 2]}
        maxWidth={viewport.width * 0.9}
        material={material}
        outlineColor={preset.outlineColor}
        outlineWidth={fontSize * preset.outlineWidth}
      >
        {text}
      </Text>

      {/* Subtext */}
      {subtext && (
        <Text
          font={fontUrl}
          fontSize={subFontSize}
          anchorX="center"
          anchorY="top"
          position={[0, -fontSize * 0.5, 2]}
          maxWidth={viewport.width * 0.9}
          material={subMaterial}
          outlineColor={preset.outlineColor}
          outlineWidth={subFontSize * preset.outlineWidth * 0.5}
        >
          {subtext}
        </Text>
      )}
    </group>
  );
}

// ── Root export ──────────────────────────────────────────────────────────────

export default function TitleLayer() {
  const titleText      = useCodaStore((s) => s.titleText);
  const titleSubtext   = useCodaStore((s) => s.titleSubtext);
  const titleRender3D  = useCodaStore((s) => s.titleRender3D);
  const title3DPreset  = useCodaStore((s) => s.title3DPreset);
  const title3DAnimate = useCodaStore((s) => s.title3DAnimate);
  const titleFontScale = useCodaStore((s) => s.titleFontScale);

  if (!titleText || !titleRender3D) return null;

  return (
    <Title3DText
      text={titleText}
      subtext={titleSubtext}
      presetName={title3DPreset ?? 'gold'}
      animate={title3DAnimate ?? 'breathing'}
      fontScale={titleFontScale ?? 1.0}
    />
  );
}
