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
uniform sampler2D uDepthMap;
uniform sampler2D uMaskTex;
uniform bool uUseDepthMap;
uniform bool uUseMask;
uniform bool uWindEnabled;
uniform bool uRippleEnabled;
uniform bool uDepthEnabled;
uniform float uTime;
uniform float uStrength;

// Wind params
uniform float uWindDirection;   // angle in radians
uniform float uWindSpeed;
uniform float uWindFreq;
uniform float uWindTurb;

// Ripple params
uniform vec2  uRippleOrigin;
uniform float uRippleSpeed;
uniform float uRippleDecay;

// Depth params — 3-layer
uniform float uDepthNearSpeed;  // 근거리 (bright = near)
uniform float uDepthMidSpeed;   // 중거리
uniform float uDepthFarSpeed;   // 원거리 (dark = far)
uniform float uDepthHaze;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  float depthVal = 0.0;

  // 1. DEPTH — UV animation based on depth map
  if (uDepthEnabled) {
    if (uUseDepthMap) {
      depthVal = texture2D(uDepthMap, uv).r;
    } else {
      vec2 c = uv - 0.5;
      depthVal = 1.0 - smoothstep(0.0, 0.5, length(c) * 1.6);
      depthVal = pow(depthVal, 1.2);
    }
    // True 2.5D parallax:
    //   근거리 (depthVal > 0.5) → +방향 이동  (uDepthNearSpeed)
    //   중거리 (depthVal ≈ 0.5) → pivot, 거의 정지
    //   원거리 (depthVal < 0.5) → -방향 이동  (uDepthFarSpeed)
    float centered = (depthVal - 0.5) * 2.0;  // -1(far) ~ +1(near)
    float parallaxFactor;
    if (centered >= 0.0) {
      parallaxFactor =  centered * uDepthNearSpeed;
    } else {
      parallaxFactor =  centered * uDepthFarSpeed;
    }

    float amp = uStrength * 0.028;
    uv.x += sin(uTime * 0.38 + depthVal * 1.2) * parallaxFactor * amp;
    uv.y += cos(uTime * 0.26 + depthVal * 0.9) * parallaxFactor * amp * 0.55;
    uv = clamp(uv, 0.01, 0.99);
  }

  // 2. WIND — direction + turbulence
  if (uWindEnabled) {
    float mask = uUseMask ? texture2D(uMaskTex, vUv).r : 1.0;
    vec2 windDir = vec2(cos(uWindDirection), sin(uWindDirection));
    vec2 perp    = vec2(-windDir.y, windDir.x);

    // Turbulence: cross-axis noise
    float turb = sin(uv.x * uWindFreq * 2.3 + uTime * uWindSpeed * 0.71)
               * sin(uv.y * uWindFreq * 1.9 + uTime * uWindSpeed * 0.53)
               * uWindTurb * 1.6;

    float wave = sin(dot(uv, windDir) * uWindFreq * 6.0 + uTime * uWindSpeed + turb)
               * uStrength * (1.0 - uv.y * 0.4) * 0.016 * mask;

    uv += windDir * wave;
    uv += perp * sin(dot(uv, windDir) * uWindFreq * 3.5 + uTime * uWindSpeed * 1.2)
        * uStrength * 0.005 * mask;
  }

  // 3. RIPPLE — custom origin, speed, decay
  if (uRippleEnabled) {
    float mask = uUseMask ? texture2D(uMaskTex, vUv).r : 1.0;
    float dist  = distance(uv, uRippleOrigin);
    float decay = 1.0 - smoothstep(0.0, max(uRippleDecay, 0.05), dist);
    float ripple = sin(dist * 20.0 - uTime * uRippleSpeed * 2.0)
                 * uStrength * 0.012 * mask * (decay * 0.7 + 0.3);
    vec2 dir = normalize(uv - uRippleOrigin + vec2(0.0001));
    uv += dir * ripple;
  }

  vec4 color = texture2D(uTexture, clamp(uv, 0.0, 1.0));

  // Atmospheric haze for depth mode
  if (uDepthEnabled) {
    float haze = (1.0 - depthVal) * 0.18 * uStrength * uDepthHaze * 2.0;
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(luma), haze * 0.5);
    color.rgb = mix(color.rgb, vec3(0.72, 0.76, 0.82), haze * 0.3);
  }

  gl_FragColor = color;
}
`;

// ---------------------------------------------------------------------------
// Fallback textures
// ---------------------------------------------------------------------------

const fallbackDepth = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
fallbackDepth.needsUpdate = true;

const fallbackMask = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
fallbackMask.needsUpdate = true;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LoopShaderMeshProps {
  texture: THREE.Texture;
  loopModes: { wind: boolean; ripple: boolean; depth: boolean };
  strength?: number;
  depthMap?: THREE.Texture | null;
  maskTex?: THREE.Texture | null;
  scale?: [number, number, number];
  position?: [number, number, number];
  // wind
  windDirection?: number;
  windSpeed?: number;
  windFrequency?: number;
  windTurbulence?: number;
  // ripple
  rippleOriginX?: number;
  rippleOriginY?: number;
  rippleSpeed?: number;
  rippleDecay?: number;
  // depth
  depthNearSpeed?: number;
  depthMidSpeed?: number;
  depthFarSpeed?: number;
  depthHaze?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoopShaderMesh({
  texture,
  loopModes,
  strength = 0.5,
  depthMap = null,
  maskTex = null,
  scale = [1, 1, 1],
  position = [0, 0, 0],
  windDirection = 0,
  windSpeed = 1.0,
  windFrequency = 4.0,
  windTurbulence = 0.0,
  rippleOriginX = 0.5,
  rippleOriginY = 0.5,
  rippleSpeed = 1.0,
  rippleDecay = 0.65,
  depthNearSpeed = 1.5,
  depthMidSpeed = 1.0,
  depthFarSpeed = 0.25,
  depthHaze = 0.5,
}: LoopShaderMeshProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useRef<Record<string, THREE.IUniform>>({
    uTexture:       { value: texture },
    uDepthMap:      { value: depthMap ?? fallbackDepth },
    uMaskTex:       { value: maskTex ?? fallbackMask },
    uUseDepthMap:   { value: depthMap != null },
    uUseMask:       { value: maskTex != null },
    uWindEnabled:   { value: loopModes.wind },
    uRippleEnabled: { value: loopModes.ripple },
    uDepthEnabled:  { value: loopModes.depth },
    uTime:          { value: 0 },
    uStrength:      { value: strength },
    uWindDirection: { value: windDirection },
    uWindSpeed:     { value: windSpeed },
    uWindFreq:      { value: windFrequency },
    uWindTurb:      { value: windTurbulence },
    uRippleOrigin:  { value: new THREE.Vector2(rippleOriginX, 1.0 - rippleOriginY) },
    uRippleSpeed:   { value: rippleSpeed },
    uRippleDecay:   { value: rippleDecay },
    uDepthNearSpeed:{ value: depthNearSpeed },
    uDepthMidSpeed: { value: depthMidSpeed },
    uDepthFarSpeed: { value: depthFarSpeed },
    uDepthHaze:     { value: depthHaze },
  });

  useFrame((_state, delta) => {
    const u = uniforms.current;
    u.uTime.value += delta;
    u.uTexture.value        = texture;
    u.uDepthMap.value       = depthMap ?? fallbackDepth;
    u.uMaskTex.value        = maskTex ?? fallbackMask;
    u.uUseDepthMap.value    = depthMap != null;
    u.uUseMask.value        = maskTex != null;
    u.uWindEnabled.value    = loopModes.wind;
    u.uRippleEnabled.value  = loopModes.ripple;
    u.uDepthEnabled.value   = loopModes.depth;
    u.uStrength.value       = strength;
    u.uWindDirection.value  = windDirection;
    u.uWindSpeed.value      = windSpeed;
    u.uWindFreq.value       = windFrequency;
    u.uWindTurb.value       = windTurbulence;
    u.uRippleOrigin.value.set(rippleOriginX, 1.0 - rippleOriginY);
    u.uRippleSpeed.value    = rippleSpeed;
    u.uRippleDecay.value    = rippleDecay;
    u.uDepthNearSpeed.value = depthNearSpeed;
    u.uDepthMidSpeed.value  = depthMidSpeed;
    u.uDepthFarSpeed.value  = depthFarSpeed;
    u.uDepthHaze.value      = depthHaze;
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
