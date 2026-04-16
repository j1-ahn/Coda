'use client';

/**
 * Global Error Boundary — Next.js App Router convention.
 * 렌더 도중 발생한 모든 미처리 에러를 여기서 잡아
 * 화이트 스크린 대신 복구 UI를 보여줌.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Coda Studio] Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#edeae3] text-[#1a1a16] gap-6 px-8">
      <div className="flex flex-col items-center gap-2">
        <span className="font-serif italic text-2xl">Coda Studio</span>
        <span className="text-[10px] tracking-widest uppercase text-[#9e9b94]">
          An unexpected error occurred
        </span>
      </div>

      <div className="max-w-md w-full bg-white/60 border border-[#d6d3cc] p-4">
        <p className="text-xs text-[#504f4a] leading-relaxed mb-3">
          Something went wrong while running the app. Your work may have been auto-saved.
        </p>
        <p className="text-[10px] text-[#9e9b94] font-mono break-all">
          {error.message || 'Unknown error'}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 text-xs font-semibold uppercase tracking-widest bg-[#1a1a16] text-[#f5f2eb] hover:bg-[#504f4a] transition-colors"
        >
          RETRY
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 text-xs font-semibold uppercase tracking-widest border border-[#d6d3cc] text-[#504f4a] hover:border-[#504f4a] hover:text-[#1a1a16] transition-colors"
        >
          RELOAD PAGE
        </button>
      </div>
    </div>
  );
}
