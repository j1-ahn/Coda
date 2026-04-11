/**
 * LyricOverlay.tsx
 * Whisper 세그먼트 → WebGL 캔버스 자막 동기화
 *
 * - activeAudioTrackId 트랙의 whisperSegments 구독
 * - currentPlaybackTime 기준으로 활성 세그먼트 찾기
 * - activeScene TextTrack style (fontSize, color, position) 반영
 * - @react-three/drei <Text> 표시 위치: bottom / center / top
 * - 세그먼트 전환 시 opacity 페이드 인/아웃
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { useCodaStore, WhisperSegment, TextTrack } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FADE_SPEED = 4.0;    // opacity lerp 속도 (per second) — 부드러운 전환
const TEXT_MAX_WIDTH = 1.8;

// position 값 → Y 좌표 매핑
const POSITION_Y: Record<TextTrack['style']['position'], number> = {
  bottom: -0.75,
  center: 0,
  top: 0.75,
};

// ---------------------------------------------------------------------------
// LyricOverlay
// ---------------------------------------------------------------------------

export default function LyricOverlay() {
  const audioTracks         = useCodaStore((s) => s.audioTracks);
  const activeAudioTrackId  = useCodaStore((s) => s.activeAudioTrackId);
  const currentPlaybackTime = useCodaStore((s) => s.currentPlaybackTime);

  // activeScene TextTrack 스타일 구독
  const scenes        = useCodaStore((s) => s.scenes);
  const activeSceneId = useCodaStore((s) => s.activeSceneId);
  const activeScene   = scenes.find((s) => s.id === activeSceneId) ?? null;
  // 첫 번째 lyric 트랙 스타일을 사용 (없으면 기본값)
  const firstLyricTrack = activeScene?.textTracks.find((t) => t.type === 'lyric') ?? null;
  const trackStyle = firstLyricTrack?.style ?? {
    fontSize: 0.07,
    color: '#ffffff',
    position: 'bottom' as const,
    fontFamily: 'sans-serif',
  };

  // fontSize: 스토어에 0.0x 단위로 저장돼 있으면 그대로, px 단위(> 1)면 /400 으로 정규화
  const resolvedFontSize = trackStyle.fontSize > 1
    ? trackStyle.fontSize / 400
    : trackStyle.fontSize;

  // Y 좌표 (position 기반)
  const positionY = POSITION_Y[trackStyle.position] ?? POSITION_Y.bottom;
  const textPosition: [number, number, number] = [0, positionY, 0];

  // 활성 트랙의 whisperSegments
  const activeTrack = audioTracks.find((t) => t.id === activeAudioTrackId) ?? null;
  const segments: WhisperSegment[] = activeTrack?.whisperSegments ?? [];

  // 현재 활성 세그먼트
  const activeSegment: WhisperSegment | undefined = segments.find(
    (seg) => currentPlaybackTime >= seg.start && currentPlaybackTime < seg.end
  );

  const targetText = activeSegment?.text ?? '';

  // opacity 애니메이션용 ref
  const opacityRef = useRef(0);
  const meshRef    = useRef<THREE.Mesh>(null);

  // -------------------------------------------------------------------------
  // useFrame: opacity 페이드 인/아웃
  // -------------------------------------------------------------------------
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const targetOpacity = targetText ? 1.0 : 0.0;
    opacityRef.current = THREE.MathUtils.lerp(
      opacityRef.current,
      targetOpacity,
      Math.min(FADE_SPEED * delta, 1.0)
    );

    // Text의 fillOpacity는 prop으로만 제어 가능하므로
    // mesh material opacity로 근사 처리
    const mat = meshRef.current.material as THREE.MeshBasicMaterial | undefined;
    if (mat && 'opacity' in mat) {
      mat.opacity = opacityRef.current;
      mat.transparent = true;
    }

    // 완전 투명 시 렌더링 스킵을 위해 visible 토글
    meshRef.current.visible = opacityRef.current > 0.01;
  });

  return (
    <Text
      ref={meshRef}
      position={textPosition}
      fontSize={resolvedFontSize}
      color={trackStyle.color}
      anchorX="center"
      anchorY="middle"
      textAlign="center"
      maxWidth={TEXT_MAX_WIDTH}
      outlineWidth={0.005}
      outlineColor="#000000"
      renderOrder={101}
      depthTest={false}
    >
      {targetText}
    </Text>
  );
}
