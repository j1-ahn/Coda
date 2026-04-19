'use client';

/**
 * BackendStatusDot — tiny header indicator for backend liveness.
 *
 * Silent when online (subtle gold dot). When offline, pulses in amber and
 * exposes a "RETRY" + "COPY CMD" affordance on hover. Goal: users notice
 * before clicking a button that would otherwise fail several seconds later.
 *
 * Intentionally minimal — does NOT block the UI. Health is informational;
 * panels remain clickable (the user might be starting the backend right now).
 */

import { useState } from 'react';
import { BACKEND_URL, useBackendHealth } from '@/lib/api';

const UVICORN_CMD = 'uvicorn app.main:app --port 8000';

export default function BackendStatusDot() {
  const { status, recheck } = useBackendHealth();
  const [copied, setCopied] = useState(false);

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(UVICORN_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — user can select by hand */
    }
  };

  const color =
    status === 'online'  ? 'bg-accent'
    : status === 'offline' ? 'bg-amber-500 animate-pulse'
    : 'bg-ink-300';

  const label =
    status === 'online'  ? 'Backend online'
    : status === 'offline' ? 'Backend offline'
    : 'Checking backend…';

  return (
    <div className="group relative flex items-center">
      <span
        className={`block w-1.5 h-1.5 rounded-full ${color}`}
        title={`${label} · ${BACKEND_URL}`}
      />

      {/* Offline popover — only visible on hover when backend is down */}
      {status === 'offline' && (
        <div className="absolute top-full right-0 mt-2 hidden group-hover:flex flex-col gap-2 z-50 w-[260px] p-3 bg-cream-100 border border-cream-300 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="block w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[10px] label-caps text-ink-700">Backend offline</span>
          </div>
          <p className="text-[10px] text-ink-500 leading-relaxed">
            Cannot reach <code className="font-mono text-[9px] bg-cream-200 px-1 py-0.5">{BACKEND_URL}</code>.
            Start the server or set <code className="font-mono text-[9px] bg-cream-200 px-1 py-0.5">NEXT_PUBLIC_BACKEND_URL</code> in <code className="font-mono text-[9px] bg-cream-200 px-1 py-0.5">.env.local</code>.
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={recheck}
              className="text-[9px] label-caps px-2 py-1 border border-cream-300 hover:border-ink-500 text-ink-500 hover:text-ink-900 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={copyCmd}
              className="text-[9px] label-caps px-2 py-1 border border-cream-300 hover:border-ink-500 text-ink-500 hover:text-ink-900 transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy cmd'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
