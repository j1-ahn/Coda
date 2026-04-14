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
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  EffectComposer,
  Bloom,
  Noise,
  Vignette,
  ChromaticAberration,
  Scanline,
  Glitch,
} from '@react-three/postprocessing';
// BlendFunction numeric constants (from postprocessing package)
// NORMAL = 23, OVERLAY = 24
const BlendFunction = { NORMAL: 23, OVERLAY: 24 } as const;

import { useCodaStore, Scene, ExternalAsset, VFXParams } from '@/store/useCodaStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import TitleLayer from './TitleLayer';
// LyricOverlay (WebGL) replaced by LyricHTMLOverlay (HTML) in page.tsx
import { LoopShaderMesh } from './LoopShader';
import ParticleLayer from './ParticleLayer';
import FilmBurnLayer from './FilmBurnLayer';
import TransitionLayer from './TransitionLayer';

// ---------------------------------------------------------------------------
// Pass 1: Background — image or video
// ---------------------------------------------------------------------------

interface BackgroundMeshProps {
  scene: Scene;
}

function buildMaskTexture(points: { x: number; y: number }[]): THREE.CanvasTexture | null {
  if (points.length < 4) return null; // minimum for a closed polygon
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'white';
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = p.x * SIZE, y = p.y * SIZE;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Image background — uses drei useTexture */
function ImageBackgroundMesh({ scene }: BackgroundMeshProps) {
  const { viewport } = useThree();
  const texture = useTexture(scene.background.url ?? '');
  const depthTexture = useTexture(scene.effects.depthMapUrl ?? scene.background.url ?? '');

  const {
    loopModes, loopStrength, depthMapUrl, loopMaskPoints,
    windDirection, windSpeed, windFrequency, windTurbulence,
    rippleOriginX, rippleOriginY, rippleSpeed, rippleDecay,
    depthNearSpeed, depthMidSpeed, depthFarSpeed, depthHaze,
  } = scene.effects;
  const maskTex = useMemo(() => buildMaskTexture(loopMaskPoints), [loopMaskPoints]);
  const hasMask = loopMaskPoints.length >= 4;

  return (
    <LoopShaderMesh
      texture={texture}
      loopModes={loopModes}
      strength={loopStrength}
      depthMap={loopModes.depth && depthMapUrl ? depthTexture : null}
      maskTex={hasMask ? maskTex : null}
      scale={[viewport.width, viewport.height, 1]}
      windDirection={windDirection != null ? windDirection * Math.PI / 4 : 0}
      windSpeed={windSpeed}
      windFrequency={windFrequency}
      windTurbulence={windTurbulence}
      rippleOriginX={rippleOriginX}
      rippleOriginY={rippleOriginY}
      rippleSpeed={rippleSpeed}
      rippleDecay={rippleDecay}
      depthNearSpeed={depthNearSpeed}
      depthMidSpeed={depthMidSpeed}
      depthFarSpeed={depthFarSpeed}
      depthHaze={depthHaze}
    />
  );
}

/** Video background — creates HTMLVideoElement + VideoTexture */
function VideoBackgroundMesh({ scene }: BackgroundMeshProps) {
  const meshRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();
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
    texture.needsUpdate = true;
  });

  const { loopModes, loopStrength, loopMaskPoints } = scene.effects;
  const maskTex = useMemo(() => buildMaskTexture(loopMaskPoints), [loopMaskPoints]);
  const hasMask = loopMaskPoints.length >= 4;

  return (
    <group ref={meshRef}>
      <LoopShaderMesh
        texture={texture}
        loopModes={loopModes}
        strength={loopStrength}
        maskTex={hasMask ? maskTex : null}
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

      {/* EffectComposer: Bloom + FilmGrain + Vignette + Chromatic + Scanline + Glitch */}
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
        {params.chromatic.enabled ? (
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={new THREE.Vector2(params.chromatic.offset, params.chromatic.offset)}
            radialModulation={false}
            modulationOffset={0}
          />
        ) : <></>}
        {params.scanline.enabled ? (
          <Scanline
            blendFunction={BlendFunction.OVERLAY}
            density={params.scanline.density}
            opacity={params.scanline.opacity}
          />
        ) : <></>}
        {params.glitch.enabled ? (
          <Glitch
            delay={new THREE.Vector2(1.5, 3.5)}
            duration={new THREE.Vector2(0.1, 0.3)}
            strength={new THREE.Vector2(params.glitch.strength * 0.3, params.glitch.strength)}
            active
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

      {/* Pass 4: Transition overlay (between scenes) */}
      <TransitionLayer />

      {/* Pass 5: Particle + FilmBurn layers */}
      <Suspense fallback={null}>
        <ParticleLayer />
        <FilmBurnLayer />
      </Suspense>

      {/* Pass 5: Title overlay — LyricHTMLOverlay mounted as HTML in page.tsx */}
      <Suspense fallback={null}>
        <TitleLayer />
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
  const previewDpr = useSettingsStore((s) => s.previewDpr);
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
          preserveDrawingBuffer: true,
        }}
        dpr={previewDpr}
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
