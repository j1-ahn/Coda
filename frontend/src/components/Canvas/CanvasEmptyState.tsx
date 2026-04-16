'use client';

import { useCodaStore } from '@/store/useCodaStore';

export default function CanvasEmptyState() {
  const scenes = useCodaStore((s) => s.scenes);
  const activeSceneId = useCodaStore((s) => s.activeSceneId);
  const activeScene = scenes.find((s) => s.id === activeSceneId);

  // Show empty state only when active scene has no background
  if (activeScene?.background?.url) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none select-none">
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 bg-gradient-radial from-[#1a1a16]/0 via-[#1a1a16]/0 to-[#0a0a0a]/80" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo */}
        <span className="font-serif italic text-[#c4a882]/40 text-4xl tracking-tight">
          Coda
        </span>

        {/* Upload icon */}
        <div className="flex flex-col items-center gap-3">
          <svg
            className="w-10 h-10 text-[#c4a882]/25"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21"
            />
          </svg>
          <span className="text-[11px] tracking-[0.2em] uppercase text-[#9b9891]/60 font-medium">
            Drop image to begin
          </span>
        </div>

        {/* Subtle hint */}
        <span className="text-[9px] text-[#6b6760]/40 tracking-wider">
          JPG &middot; PNG &middot; GIF &middot; MP4
        </span>
      </div>
    </div>
  );
}
