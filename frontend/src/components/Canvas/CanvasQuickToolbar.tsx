'use client';
import { useState } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

export default function CanvasQuickToolbar() {
  const previewMode = useCodaStore((s) => s.previewMode);
  const setPreviewMode = useCodaStore((s) => s.setPreviewMode);
  const canvasZoom = useCodaStore((s) => s.canvasZoom);
  const setCanvasZoom = useCodaStore((s) => s.setCanvasZoom);
  const [copied, setCopied] = useState(false);

  const handleScreenshot = async () => {
    const container = document.getElementById('studio-canvas-container');
    const canvas = container?.querySelector('canvas');
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }, 'image/png');
    } catch {
      // fallback: download
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `coda-screenshot-${Date.now()}.png`;
      a.click();
    }
  };

  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {/* Preview toggle */}
      <button
        onClick={() => setPreviewMode(!previewMode)}
        className="w-7 h-7 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cream-300 hover:text-accent hover:bg-black/80 transition-colors"
        title={previewMode ? 'Exit Preview' : 'Preview Mode'}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          {previewMode ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          )}
        </svg>
      </button>

      {/* Zoom controls */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
          className="w-7 h-6 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cream-300 hover:text-accent hover:bg-black/80 transition-colors text-xs font-mono"
          title="Zoom In"
        >+</button>
        <button
          onClick={() => setCanvasZoom(1)}
          className="w-7 h-5 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cream-400 hover:text-accent hover:bg-black/80 transition-colors text-[8px] font-mono"
          title="Reset Zoom"
        >{Math.round(canvasZoom * 100)}%</button>
        <button
          onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
          className="w-7 h-6 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cream-300 hover:text-accent hover:bg-black/80 transition-colors text-xs font-mono"
          title="Zoom Out"
        >&minus;</button>
      </div>

      {/* Screenshot */}
      <button
        onClick={handleScreenshot}
        className="w-7 h-7 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cream-300 hover:text-accent hover:bg-black/80 transition-colors"
        title={copied ? 'Copied!' : 'Screenshot to clipboard'}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}
