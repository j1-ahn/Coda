'use client';

/**
 * TransitionLayer.tsx
 * Fullscreen quad overlay for scene transitions.
 *
 * When activeSceneId changes:
 *   1. Snapshot the current WebGL canvas → oldFrame texture
 *   2. Show a fullscreen quad above everything (renderOrder=998)
 *   3. Animate uProgress 0→1 over transition.durationMs
 *   4. ShaderMaterial blends oldFrame with the live scene underneath
 *   5. On complete, remove the quad
 *
 * Transition types supported:
 *   fade, dissolve, white-flash, black-flash,
 *   wipe-left/right/up/down, slide-left/right/up/down,
 *   zoom-in, zoom-out, blur, circle-wipe, spin,
 *   glitch, film-burn
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCodaStore, TransitionType } from '@/store/useCodaStore';

// ── Transition shader ────────────────────────────────────────────────────────

const transitionVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const transitionFragment = /* glsl */ `
uniform sampler2D uOldFrame;
uniform float uProgress;  // 0 = old scene fully visible, 1 = new scene fully visible
uniform int uType;        // transition type index

varying vec2 vUv;

// Type indices (match TRANSITION_INDEX map)
// 0=cut, 1=fade, 2=dissolve, 3=white-flash, 4=black-flash
// 5=wipe-left, 6=wipe-right, 7=wipe-up, 8=wipe-down
// 9=slide-left, 10=slide-right, 11=slide-up, 12=slide-down
// 13=zoom-in, 14=zoom-out, 15=blur, 16=glitch, 17=film-burn
// 18=circle-wipe, 19=spin

void main() {
  vec4 oldColor = texture2D(uOldFrame, vUv);
  float p = clamp(uProgress, 0.0, 1.0);

  // Default: just show old frame fading out
  float alpha = 1.0 - p;

  if (uType == 0) {
    // cut — instant switch
    alpha = p < 0.5 ? 1.0 : 0.0;

  } else if (uType == 1) {
    // fade — simple crossfade (old frame fades out)
    alpha = 1.0 - p;

  } else if (uType == 2) {
    // dissolve — noise-based threshold
    float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
    alpha = step(p, noise);

  } else if (uType == 3) {
    // white-flash — flash white at midpoint
    float flash = 1.0 - abs(2.0 * p - 1.0);
    vec3 white = vec3(1.0);
    vec3 blended = mix(oldColor.rgb, white, flash);
    gl_FragColor = vec4(blended, p < 0.5 ? 1.0 : 1.0 - (p - 0.5) * 2.0);
    return;

  } else if (uType == 4) {
    // black-flash — flash black at midpoint
    float flash = 1.0 - abs(2.0 * p - 1.0);
    vec3 blended = mix(oldColor.rgb, vec3(0.0), flash);
    gl_FragColor = vec4(blended, p < 0.5 ? 1.0 : 1.0 - (p - 0.5) * 2.0);
    return;

  } else if (uType == 5) {
    // wipe-left — new scene reveals from right to left
    alpha = step(p, vUv.x) > 0.5 ? 1.0 : 0.0;

  } else if (uType == 6) {
    // wipe-right — new scene reveals from left to right
    alpha = step(1.0 - p, vUv.x) > 0.5 ? 0.0 : 1.0;

  } else if (uType == 7) {
    // wipe-up — reveal from bottom
    alpha = step(p, vUv.y) > 0.5 ? 1.0 : 0.0;

  } else if (uType == 8) {
    // wipe-down — reveal from top
    alpha = step(1.0 - p, vUv.y) > 0.5 ? 0.0 : 1.0;

  } else if (uType == 9) {
    // slide-left — old frame slides out left
    vec2 slideUv = vUv + vec2(p, 0.0);
    if (slideUv.x > 1.0) { alpha = 0.0; }
    else { oldColor = texture2D(uOldFrame, slideUv); alpha = 1.0; }

  } else if (uType == 10) {
    // slide-right — old frame slides out right
    vec2 slideUv = vUv - vec2(p, 0.0);
    if (slideUv.x < 0.0) { alpha = 0.0; }
    else { oldColor = texture2D(uOldFrame, slideUv); alpha = 1.0; }

  } else if (uType == 11) {
    // slide-up — old frame slides out upward
    vec2 slideUv = vUv + vec2(0.0, p);
    if (slideUv.y > 1.0) { alpha = 0.0; }
    else { oldColor = texture2D(uOldFrame, slideUv); alpha = 1.0; }

  } else if (uType == 12) {
    // slide-down — old frame slides out downward
    vec2 slideUv = vUv - vec2(0.0, p);
    if (slideUv.y < 0.0) { alpha = 0.0; }
    else { oldColor = texture2D(uOldFrame, slideUv); alpha = 1.0; }

  } else if (uType == 13) {
    // zoom-in — old frame scales up and fades
    vec2 center = vec2(0.5);
    float scale = 1.0 + p * 0.5;
    vec2 zoomUv = center + (vUv - center) / scale;
    if (zoomUv.x < 0.0 || zoomUv.x > 1.0 || zoomUv.y < 0.0 || zoomUv.y > 1.0) {
      alpha = 0.0;
    } else {
      oldColor = texture2D(uOldFrame, zoomUv);
      alpha = 1.0 - p;
    }

  } else if (uType == 14) {
    // zoom-out — old frame scales down and fades
    vec2 center = vec2(0.5);
    float scale = 1.0 - p * 0.5;
    vec2 zoomUv = center + (vUv - center) / scale;
    if (zoomUv.x < 0.0 || zoomUv.x > 1.0 || zoomUv.y < 0.0 || zoomUv.y > 1.0) {
      alpha = 0.0;
    } else {
      oldColor = texture2D(uOldFrame, zoomUv);
      alpha = 1.0 - p;
    }

  } else if (uType == 15) {
    // blur — fake blur by sampling offset + fade
    float blurAmount = p * 0.02;
    vec4 blurred = vec4(0.0);
    blurred += texture2D(uOldFrame, vUv + vec2(-blurAmount, -blurAmount));
    blurred += texture2D(uOldFrame, vUv + vec2( blurAmount, -blurAmount));
    blurred += texture2D(uOldFrame, vUv + vec2(-blurAmount,  blurAmount));
    blurred += texture2D(uOldFrame, vUv + vec2( blurAmount,  blurAmount));
    blurred += texture2D(uOldFrame, vUv);
    oldColor = blurred / 5.0;
    alpha = 1.0 - p;

  } else if (uType == 16) {
    // glitch — block displacement + color split
    float blockY = floor(vUv.y * 20.0) / 20.0;
    float shift = sin(blockY * 50.0 + p * 30.0) * p * 0.1;
    vec2 glitchUv = vUv + vec2(shift, 0.0);
    float r = texture2D(uOldFrame, glitchUv + vec2(p * 0.01, 0.0)).r;
    float g = texture2D(uOldFrame, glitchUv).g;
    float b = texture2D(uOldFrame, glitchUv - vec2(p * 0.01, 0.0)).b;
    oldColor = vec4(r, g, b, 1.0);
    alpha = 1.0 - p;

  } else if (uType == 17) {
    // film-burn — warm color burn from edges
    float dist = length(vUv - vec2(0.5)) * 2.0;
    float burn = smoothstep(1.0 - p * 1.5, 1.0 - p * 0.5, dist);
    vec3 burnColor = vec3(1.0, 0.6, 0.2);
    oldColor.rgb = mix(oldColor.rgb, burnColor, burn * p);
    alpha = 1.0 - p;

  } else if (uType == 18) {
    // circle-wipe — circular reveal from center
    float dist = length(vUv - vec2(0.5)) * 1.414;
    alpha = dist > p ? 1.0 : 0.0;

  } else if (uType == 19) {
    // spin — rotate old frame and fade
    vec2 center = vec2(0.5);
    float angle = p * 3.14159;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 rotUv = center + rot * (vUv - center);
    if (rotUv.x < 0.0 || rotUv.x > 1.0 || rotUv.y < 0.0 || rotUv.y > 1.0) {
      alpha = 0.0;
    } else {
      oldColor = texture2D(uOldFrame, rotUv);
      alpha = 1.0 - p;
    }
  }

  gl_FragColor = vec4(oldColor.rgb, oldColor.a * alpha);
}
`;

// ── Type → index mapping ─────────────────────────────────────────────────────

const TRANSITION_INDEX: Record<TransitionType, number> = {
  'cut': 0, 'fade': 1, 'dissolve': 2, 'white-flash': 3, 'black-flash': 4,
  'wipe-left': 5, 'wipe-right': 6, 'wipe-up': 7, 'wipe-down': 8,
  'slide-left': 9, 'slide-right': 10, 'slide-up': 11, 'slide-down': 12,
  'zoom-in': 13, 'zoom-out': 14, 'blur': 15, 'glitch': 16, 'film-burn': 17,
  'circle-wipe': 18, 'spin': 19,
};

// ── Easing ───────────────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TransitionLayer() {
  const { gl } = useThree();
  const activeSceneId = useCodaStore((s) => s.activeSceneId);
  const scenes = useCodaStore((s) => s.scenes);

  const [transitioning, setTransitioning] = useState(false);
  const prevSceneIdRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const typeRef = useRef(0);

  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);

  const snapshotCanvas = useCallback(() => {
    try {
      const canvas = gl.domElement;
      const tex = new THREE.Texture(canvas);
      tex.needsUpdate = true;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    } catch {
      return null;
    }
  }, [gl]);

  // Detect scene changes
  useEffect(() => {
    if (prevSceneIdRef.current === null) {
      // Initial mount — no transition needed
      prevSceneIdRef.current = activeSceneId;
      return;
    }

    if (activeSceneId === prevSceneIdRef.current) return;

    // Find the new scene's transition settings
    const newScene = scenes.find((s) => s.id === activeSceneId);
    const transType = newScene?.transition.type ?? 'cut';
    const transDur = newScene?.transition.durationMs ?? 0;

    if (transType === 'cut' || transDur <= 0) {
      prevSceneIdRef.current = activeSceneId;
      return;
    }

    // Snapshot current canvas before the new scene renders
    const oldTex = snapshotCanvas();
    if (!oldTex) {
      prevSceneIdRef.current = activeSceneId;
      return;
    }

    // Dispose old texture
    if (textureRef.current) textureRef.current.dispose();
    textureRef.current = oldTex;

    typeRef.current = TRANSITION_INDEX[transType] ?? 1;
    durationRef.current = transDur;
    startTimeRef.current = performance.now();
    progressRef.current = 0;
    setTransitioning(true);

    prevSceneIdRef.current = activeSceneId;
  }, [activeSceneId, scenes, snapshotCanvas]);

  // Animate progress
  useFrame(() => {
    if (!transitioning || !materialRef.current) return;

    const elapsed = performance.now() - startTimeRef.current;
    const raw = Math.min(elapsed / durationRef.current, 1);
    const eased = easeInOutCubic(raw);

    progressRef.current = eased;
    materialRef.current.uniforms.uProgress.value = eased;

    if (raw >= 1) {
      setTransitioning(false);
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    }
  });

  if (!transitioning || !textureRef.current) return null;

  return (
    <mesh renderOrder={998}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={transitionVertex}
        fragmentShader={transitionFragment}
        uniforms={{
          uOldFrame: { value: textureRef.current },
          uProgress: { value: 0 },
          uType: { value: typeRef.current },
        }}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
