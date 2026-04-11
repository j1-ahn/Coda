'use client';

/**
 * MainScene.tsx
 * React Three Fiber 캔버스 — 3-Pass 렌더 아키텍처
 *
 * ┌──────────────────────────────────────────────────┐
 * │  Pass 1: Background Layer                        │
 * │    - Scene별 image / video texture               │
 * │    - Parallax effect (선택적)                    │
 * │    - Masking effect (선택적)                     │
 * ├──────────────────────────────────────────────────┤
 * │  Pass 2: VFX Layer (EffectComposer)              │
 * │    - Bloom (threshold + intensity)               │
 * │    - FilmGrain (noise intensity)                 │
 * │    - Vignette (darkness)                         │
 * │    - applyVFX=true 인 ExternalAsset 포함         │
 * ├──────────────────────────────────────────────────┤
 * │  Pass 3: Bypass Layer                            │
 * │    - applyVFX=false 인 ExternalAsset             │
 * │    - Post-processing 없이 클린 렌더              │
 * │    - 별도 orthographic camera로 합성             │
 * └──────────────────────────────────────────────────┘
 */

import React, { useRef, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  EffectComposer,
  Bloom,
  Noise,
  Vignette,
} from '@react-three/postprocessing';

import { useCodaStore, Scene, ExternalAsset, VFXParams } from '@/store/useCodaStore';
import TitleLayer from './TitleLayer';
import LyricOverlay from './LyricOverlay';
import { useParallax } from '@/hooks/useParallax';
import { LoopShaderMesh } from './LoopShader';

// ---------------------------------------------------------------------------
// Pass 1: Background — image or video
// ---------------------------------------------------------------------------

interface BackgroundMeshProps {
  scene: Scene;
}

/** Image background — uses drei useTexture */
function ImageBackgroundMesh({ scene }: BackgroundMeshProps) {
  const meshRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const texture = useTexture(scene.background.url ?? '');
  const parallaxPos = useParallax(0.08);

  useFrame(() => {
    if (!meshRef.current || !scene.effects.parallaxEnabled) return;
    meshRef.current.position.x = parallaxPos.current.x;
    meshRef.current.position.y = parallaxPos.current.y;
  });

  const { loopMode, loopStrength } = scene.effects;
  return (
    <group ref={meshRef}>
      <LoopShaderMesh
        texture={texture}
        mode={loopMode}
        strength={loopStrength}
        scale={[viewport.width, viewport.height, 1]}
      />
    </group>
  );
}

/** Video background — creates HTMLVideoElement + VideoTexture */
function VideoBackgroundMesh({ scene }: BackgroundMeshProps) {
  const meshRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const parallaxPos = useParallax(0.08);

  const { video, texture } = useMemo(() => {
    const vid = document.createElement('video');
    vid.src = scene.background.url ?? '';
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.autoplay = true;
    vid.play().catch(() => {});
    const tex = new THREE.VideoTexture(vid);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { video: vid, texture: tex };
  }, [scene.background.url]);

  useEffect(() => {
    return () => {
      video.pause();
      video.src = '';
      texture.dispose();
    };
  }, [video, texture]);

  useFrame(() => {
    if (meshRef.current && scene.effects.parallaxEnabled) {
      meshRef.current.position.x = parallaxPos.current.x;
      meshRef.current.position.y = parallaxPos.current.y;
    }
    texture.needsUpdate = true;
  });

  const { loopMode, loopStrength } = scene.effects;
  return (
    <group ref={meshRef}>
      <LoopShaderMesh
        texture={texture}
        mode={loopMode}
        strength={loopStrength}
        scale={[viewport.width, viewport.height, 1]}
      />
    </group>
  );
}

function BackgroundMesh({ scene }: BackgroundMeshProps) {
  if (!scene.background.url) return null;
  if (scene.background.type === 'video') {
    return <VideoBackgroundMesh scene={scene} />;
  }
  return <ImageBackgroundMesh scene={scene} />;
}

// ---------------------------------------------------------------------------
// Pass 2: VFX Assets (applyVFX=true)
// ---------------------------------------------------------------------------

interface VFXAssetMeshProps {
  asset: ExternalAsset;
}

function VFXAssetMesh({ asset }: VFXAssetMeshProps) {
  const texture = useTexture(asset.url);
  return (
    <mesh position={[asset.position.x, asset.position.y, 0.1]}>
      <planeGeometry args={[asset.size.width, asset.size.height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Pass 3: Bypass Assets (applyVFX=false) — 별도 씬에서 렌더
// ---------------------------------------------------------------------------

interface BypassLayerProps {
  assets: ExternalAsset[];
}

function BypassLayer({ assets }: BypassLayerProps) {
  /**
   * Bypass 원칙:
   * - EffectComposer 바깥, depthTest=false로 위에 그림
   * - renderOrder를 높여 마지막에 그려지도록
   */
  return (
    <group renderOrder={999}>
      {assets.map((asset) => (
        <BypassAssetMesh key={asset.id} asset={asset} />
      ))}
    </group>
  );
}

function BypassAssetMesh({ asset }: VFXAssetMeshProps) {
  const texture = useTexture(asset.url);
  return (
    <mesh
      position={[asset.position.x, asset.position.y, 0.5]}
      renderOrder={999}
    >
      <planeGeometry args={[asset.size.width, asset.size.height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// VFX Composer wrapper
// ---------------------------------------------------------------------------

interface VFXComposerProps {
  params: VFXParams;
  vfxAssets: ExternalAsset[];
  scene: Scene;
}

function VFXComposer({ params, vfxAssets, scene }: VFXComposerProps) {
  return (
    <>
      {/* Pass 1: Background */}
      <Suspense fallback={null}>
        {scene.background.url && <BackgroundMesh scene={scene} />}
      </Suspense>

      {/* Pass 2: VFX assets (applyVFX=true) */}
      <Suspense fallback={null}>
        {vfxAssets.map((asset) => (
          <VFXAssetMesh key={asset.id} asset={asset} />
        ))}
      </Suspense>

      {/* EffectComposer: Bloom + FilmGrain + Vignette */}
      <EffectComposer>
        {params.bloom.enabled ? (
          <Bloom
            intensity={params.bloom.intensity}
            luminanceThreshold={params.bloom.threshold}
            luminanceSmoothing={0.9}
          />
        ) : <></>}
        {params.filmGrain.enabled ? (
          <Noise opacity={params.filmGrain.intensity} />
        ) : <></>}
        {params.vignette.enabled ? (
          <Vignette
            darkness={params.vignette.darkness}
            offset={0.3}
          />
        ) : <></>}
      </EffectComposer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Scene content — subscribes to store
// ---------------------------------------------------------------------------

function SceneContent() {
  const scenes = useCodaStore((s) => s.scenes);
  const activeSceneId = useCodaStore((s) => s.activeSceneId);
  const vfxParams = useCodaStore((s) => s.vfxParams);
  const externalAssets = useCodaStore((s) => s.externalAssets);

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) ?? scenes[0],
    [scenes, activeSceneId]
  );

  const vfxAssets = useMemo(
    () => externalAssets.filter((a) => a.applyVFX),
    [externalAssets]
  );
  const bypassAssets = useMemo(
    () => externalAssets.filter((a) => !a.applyVFX),
    [externalAssets]
  );

  if (!activeScene) return null;

  return (
    <>
      <VFXComposer
        params={vfxParams}
        vfxAssets={vfxAssets}
        scene={activeScene}
      />

      {/* Pass 3: Bypass — no postprocessing */}
      <Suspense fallback={null}>
        <BypassLayer assets={bypassAssets} />
      </Suspense>

      {/* Pass 4: Title + Lyric overlay — above all passes */}
      <Suspense fallback={null}>
        <TitleLayer />
        <LyricOverlay />
      </Suspense>
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state overlay (no scene background loaded)
// ---------------------------------------------------------------------------

function EmptyStateOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <p className="text-[#2a2a2a] text-xs tracking-[0.3em] uppercase mb-2">
        Drop image / video to begin
      </p>
      <div className="w-32 h-px bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function MainScene() {
  const scenes = useCodaStore((s) => s.scenes);
  const activeSceneId = useCodaStore((s) => s.activeSceneId);
  const hasBackground = useMemo(() => {
    const active = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
    return !!active?.background.url;
  }, [scenes, activeSceneId]);

  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,   // MediaRecorder 캡처에 필요
        }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ background: '#0a0a0a' }}
      >
        {/* Ambient light for any mesh-standard-material objects */}
        <ambientLight intensity={0.5} />

        <SceneContent />
      </Canvas>

      {!hasBackground && <EmptyStateOverlay />}
    </div>
  );
}
