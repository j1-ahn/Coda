/**
 * useParallax.ts
 * 마우스 위치 기반 패럴랙스 훅 — BackgroundMesh에서 사용
 *
 * Returns: posRef (THREE.Vector2) — 매 프레임 lerp 업데이트됨
 * 사용 측에서 posRef.current.x / .y 를 mesh position에 적용
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * @param strength  수평 이동 강도 (기본값 0.08)
 * @returns posRef  THREE.Vector2 — 현재 패럴랙스 오프셋
 */
export function useParallax(strength = 0.08) {
  const posRef = useRef(new THREE.Vector2(0, 0));

  useFrame(({ mouse }) => {
    posRef.current.x = THREE.MathUtils.lerp(
      posRef.current.x,
      mouse.x * strength,
      0.05
    );
    posRef.current.y = THREE.MathUtils.lerp(
      posRef.current.y,
      mouse.y * strength * 0.6,
      0.05
    );
  });

  return posRef;
}
