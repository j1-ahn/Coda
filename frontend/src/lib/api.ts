/**
 * Unified backend API client.
 *
 * Every fetch() to the FastAPI backend should go through this module.
 * Benefits:
 *   - Single source of truth for the backend URL (NEXT_PUBLIC_BACKEND_URL)
 *   - Uniform error shape → consistent UI messaging + toast/banner wiring
 *   - Human-readable hints for common failures (offline, model loading, 5xx)
 *   - Health probe + React hook for global "is backend up?" signal
 *
 * Do not call fetch() directly against the backend from components.
 * For uploads that bypass the Next.js proxy (big audio files), use
 * apiUrl(path) to build an absolute URL.
 */

import { useEffect, useRef, useState } from 'react';

// -----------------------------------------------------------------------------
// URL helpers
// -----------------------------------------------------------------------------

/**
 * Origin of the backend. Falls back to empty string in the browser, which makes
 * relative /api/* requests go through the Next.js rewrite (next.config.js).
 * Server-side (SSR / route handlers) we need the absolute URL.
 */
export const BACKEND_URL: string =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

/**
 * Build an absolute URL against the backend. Use for multipart uploads that
 * bypass the Next.js proxy (the proxy has body-size caveats with large audio).
 *
 *   apiUrl('/api/whisper/transcribe')
 *   apiUrl('api/whisper/transcribe')   // leading slash optional
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${normalized}`;
}

// -----------------------------------------------------------------------------
// Error shape
// -----------------------------------------------------------------------------

export type ApiErrorKind =
  | 'offline'      // fetch rejected (DNS/port/network) — backend not reachable
  | 'timeout'      // AbortController tripped
  | 'http'         // non-2xx response
  | 'parse'        // response was 2xx but body was not the expected shape
  | 'aborted';     // caller-initiated abort

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  detail?: string;

  constructor(kind: ApiErrorKind, message: string, opts?: { status?: number; detail?: string; cause?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts?.status;
    this.detail = opts?.detail;
    if (opts?.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

/** Turn any thrown value into a short, human-readable string. Never throws. */
export function humanizeError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.kind) {
      case 'offline':
        return `Backend not reachable at ${BACKEND_URL}. Is the server running?`;
      case 'timeout':
        return 'Backend request timed out.';
      case 'aborted':
        return 'Request aborted.';
      case 'parse':
        return e.detail || 'Invalid response from backend.';
      case 'http':
        if (e.status === 503) return e.detail || 'Model is loading — try again shortly.';
        if (e.status === 413) return e.detail || 'File too large.';
        if (e.status === 500) return e.detail || 'Backend error — check server logs.';
        return e.detail || `Backend returned ${e.status}.`;
    }
  }
  if (e instanceof Error) return e.message;
  return 'Unknown error.';
}

// -----------------------------------------------------------------------------
// Core fetch wrapper
// -----------------------------------------------------------------------------

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Abort after this many ms. 0 / undefined = no timeout. */
  timeoutMs?: number;
  /** JSON body (shorthand — sets Content-Type and stringifies). */
  json?: unknown;
  /** Multipart body (pass as-is, don't set Content-Type — browser will). */
  body?: BodyInit | null;
  /** Use absolute backend URL instead of Next.js proxy. Useful for uploads. */
  absolute?: boolean;
}

/**
 * Low-level wrapper. Returns the Response for non-JSON callers. Throws ApiError
 * on network/timeout/non-2xx, attaching any `detail` string from the body.
 *
 * Prefer apiFetchJson<T>() when you want the parsed body.
 */
export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs, json, body, absolute, headers, signal: externalSignal, ...rest } = opts;

  // Compose URL — relative path hits Next.js rewrite; absolute bypasses it.
  const url = absolute ? apiUrl(path) : path.startsWith('/') ? path : `/${path}`;

  // Compose headers / body.
  const finalHeaders = new Headers(headers);
  let finalBody: BodyInit | null | undefined = body ?? null;
  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
    finalBody = JSON.stringify(json);
  }

  // Timeout via AbortController, chained with any caller-provided signal.
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      const aborted = externalSignal?.aborted ?? false;
      throw new ApiError(aborted ? 'aborted' : 'timeout', aborted ? 'aborted' : 'timeout', { cause: e });
    }
    throw new ApiError('offline', `cannot reach ${BACKEND_URL}`, { cause: e });
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }

  if (!res.ok) {
    // Try to pull a human-readable detail out of the body.
    let detail = '';
    try {
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const body = await res.clone().json();
        detail = body?.detail ?? body?.message ?? '';
      } else {
        detail = (await res.clone().text()).slice(0, 300);
      }
    } catch {
      /* ignore — we have status */
    }
    throw new ApiError('http', `HTTP ${res.status}`, { status: res.status, detail });
  }

  return res;
}

/** Typed JSON convenience wrapper. */
export async function apiFetchJson<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new ApiError('parse', 'invalid JSON', { cause: e });
  }
}

// -----------------------------------------------------------------------------
// Health probe
// -----------------------------------------------------------------------------

/** Single-shot liveness check. Short timeout so the UI stays responsive. */
export async function pingBackend(timeoutMs = 2000): Promise<boolean> {
  try {
    await apiFetch('/api/health', { timeoutMs });
    return true;
  } catch {
    return false;
  }
}

export type BackendStatus = 'online' | 'offline' | 'unknown';

/**
 * React hook: backend liveness, polled on an interval. Defaults to 15s.
 * On window focus, re-checks immediately so users who just started the
 * backend see a green light without waiting for the next tick.
 */
export function useBackendHealth(intervalMs = 15_000): {
  status: BackendStatus;
  lastChecked: number | null;
  recheck: () => void;
} {
  const [status, setStatus] = useState<BackendStatus>('unknown');
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const probe = async () => {
      const ok = await pingBackend();
      if (!mountedRef.current) return;
      setStatus(ok ? 'online' : 'offline');
      setLastChecked(Date.now());
    };

    probe();
    timer = setInterval(probe, intervalMs);

    const onFocus = () => { probe(); };
    window.addEventListener('focus', onFocus);

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs]);

  const recheck = () => {
    pingBackend().then((ok) => {
      if (!mountedRef.current) return;
      setStatus(ok ? 'online' : 'offline');
      setLastChecked(Date.now());
    });
  };

  return { status, lastChecked, recheck };
}
