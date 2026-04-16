'use client';

import { useRef } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

export default function CanvasEmptyState() {
  const scenes = useCodaStore((s) => s.scenes);
  const activeSceneId = useCodaStore((s) => s.activeSceneId);
  const updateSceneBackground = useCodaStore((s) => s.updateSceneBackground);
  const activeScene = scenes.find((s) => s.id === activeSceneId);
  const fileRef = useRef<HTMLInputElement>(null);

  // Show empty state only when active scene has no background
  if (activeScene?.background?.url) return null;

  const handleFile = (file: File) => {
    const sceneId = activeSceneId ?? scenes[0]?.id;
    if (!sceneId) return;
    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);
    updateSceneBackground(sceneId, {
      type: isVideo ? 'video' : 'image',
      url,
      fileName: file.name,
    });
  };

  const handleClick = () => fileRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 bg-gradient-radial from-[#1a1a16]/0 via-[#1a1a16]/0 to-[#0a0a0a]/80 pointer-events-none" />

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
            Drop image or click to upload
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
