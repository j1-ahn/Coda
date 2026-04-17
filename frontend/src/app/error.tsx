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
    <div className="flex flex-col items-center justify-center h-screen bg-cream-100 text-ink-900 gap-6 px-8">
      <div className="flex flex-col items-center gap-2">
        <span className="font-serif italic text-2xl">Coda Studio</span>
        <span className="label-caps">
          An unexpected error occurred
        </span>
      </div>

      <div className="max-w-md w-full bg-white/60 border border-cream-300 p-4">
        <p className="text-xs text-ink-500 leading-relaxed mb-3">
          Something went wrong while running the app. Your work may have been auto-saved.
        </p>
        <p className="text-[10px] text-ink-300 font-mono break-all">
          {error.message || 'Unknown error'}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="btn-primary px-6 py-2.5"
        >
          RETRY
        </button>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary px-6 py-2.5"
        >
          RELOAD PAGE
        </button>
      </div>
    </div>
  );
}
