'use client';

/**
 * MusicSoundTab — v2 "Music & Sound" 탭
 *
 * EQ 비주얼라이저, 오디오 파일 관리, 재생 컨트롤.
 * 기존 EqualizerTab을 그대로 래핑 (내부에 PlaylistPanel 포함).
 */

import EqualizerTab from '@/components/Equalizer/EqualizerTab';

export default function MusicSoundTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <EqualizerTab />
    </div>
  );
}
