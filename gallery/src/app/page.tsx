'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Release {
  id: string;
  catalog: string;
  title: string;
  artist: string;
  duration: string;
  coverUrl: string;
  youtubeUrl?: string;
}

// ── Releases with real covers ────────────────────────────────────────────────

const RELEASES: Release[] = [
  {
    id: '1', catalog: 'CODA-001',
    title: 'Static Love', artist: 'j1', duration: '3:45',
    coverUrl: '/covers/static-love.jpg', youtubeUrl: '#',
  },
  {
    id: '2', catalog: 'CODA-002',
    title: 'World Rap', artist: 'j1', duration: '4:12',
    coverUrl: '/covers/world-rap.jpg', youtubeUrl: '#',
  },
  {
    id: '3', catalog: 'CODA-003',
    title: 'Pink Room', artist: 'j1', duration: '5:01',
    coverUrl: '/covers/pink-room.jpg', youtubeUrl: '#',
  },
  {
    id: '4', catalog: 'CODA-004',
    title: 'Midnight Thoughts', artist: 'archeraye', duration: '3:28',
    coverUrl: '/covers/midnight-thoughts.jpg', youtubeUrl: '#',
  },
  {
    id: '5', catalog: 'CODA-005',
    title: 'Mind Bloom', artist: 'j1', duration: '4:55',
    coverUrl: '/covers/mind-bloom.jpg', youtubeUrl: '#',
  },
  {
    id: '6', catalog: 'CODA-006',
    title: 'Ghost Signal', artist: 'j1', duration: '3:15',
    coverUrl: '', youtubeUrl: '#',
  },
  {
    id: '7', catalog: 'CODA-007',
    title: 'Paper Moon', artist: 'j1', duration: '3:58',
    coverUrl: '', youtubeUrl: '#',
  },
  {
    id: '8', catalog: 'CODA-008',
    title: 'Soft Collapse', artist: 'j1', duration: '4:33',
    coverUrl: '', youtubeUrl: '#',
  },
  {
    id: '9', catalog: 'CODA-009',
    title: 'Terminal Bloom', artist: 'j1', duration: '3:07',
    coverUrl: '', youtubeUrl: '#',
  },
];

// ── Generative cover fallback ────────────────────────────────────────────────

function GenCover({ seed }: { seed: number }) {
  const h = (seed * 137.508) % 360;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(${seed * 45}deg, hsl(${h}, 5%, 8%), hsl(${(h + 30) % 360}, 8%, 14%))`,
      }}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseDur(dur: string): number {
  const p = dur.split(':').map(Number);
  return (p[0] ?? 0) * 60 + (p[1] ?? 0);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [current, setCurrent] = useState<Release | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [curTime, setCurTime] = useState('0:00');
  const trackRef = useRef<HTMLDivElement>(null);

  const totalDur = current ? fmtTime(parseDur(current.duration)) : '0:00';

  const play = useCallback((r: Release) => {
    if (current?.id === r.id) {
      setPlaying(p => !p);
    } else {
      setCurrent(r);
      setPlaying(true);
      setProgress(0);
      setCurTime('0:00');
    }
  }, [current]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setProgress(pct);
    setCurTime(fmtTime(pct * parseDur(current.duration)));
  }, [current]);

  useEffect(() => {
    if (!playing || !current) return;
    const total = parseDur(current.duration);
    if (!total) return;
    const iv = setInterval(() => {
      setProgress(p => {
        const next = p + 1 / total;
        if (next >= 1) { setPlaying(false); return 1; }
        setCurTime(fmtTime(next * total));
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, current]);

  return (
    <>
      {/* Header */}
      <header className="site-header">
        <span className="t-title" style={{ letterSpacing: '0.1em' }}>
          CODA
        </span>
        <span className="t-cat">{RELEASES.length} releases</span>
      </header>

      {/* Grid */}
      <main className="gallery-grid">
        {RELEASES.map((r, i) => (
          <div
            key={r.id}
            className="card fade-up"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            {/* Square cover */}
            <div className="card-cover">
              {r.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.coverUrl} alt={r.title} loading="lazy" />
              ) : (
                <GenCover seed={i + 1} />
              )}

              {/* Playing indicator */}
              {playing && current?.id === r.id && (
                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                  <div className="playing-dot" />
                </div>
              )}

              {/* Hover */}
              <div className="card-hover">
                <button onClick={() => play(r)}>
                  {playing && current?.id === r.id ? 'pause' : 'play'}
                </button>
                {r.youtubeUrl && (
                  <a
                    href={r.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover-link"
                    onClick={e => e.stopPropagation()}
                  >
                    watch
                  </a>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="card-meta">
              <div className="card-meta-left">
                <span className="t-cat">{r.catalog}</span>
                <span className="t-title">{r.title}</span>
              </div>
              <span className="t-dur">{r.duration}</span>
            </div>
          </div>
        ))}
      </main>

      {/* Bottom bar */}
      <div className="bottom-bar">
        {current ? (
          <>
            <button
              className="nav-link"
              onClick={() => setPlaying(p => !p)}
              style={{ width: 14, textAlign: 'center' }}
            >
              {playing ? '||' : '\u25B6'}
            </button>
            <span className="t-cat" style={{ whiteSpace: 'nowrap' }}>
              {current.catalog}
            </span>
            <span className="t-title" style={{ whiteSpace: 'nowrap' }}>
              {current.title}
            </span>
            <span className="t-dur">{curTime}</span>
            <div ref={trackRef} className="progress-track" onClick={seek}>
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="t-dur">{totalDur}</span>
          </>
        ) : (
          <>
            <span className="t-cat">coda gallery</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '0%' }} />
            </div>
          </>
        )}
        <a
          href="https://youtube.com/@j1-ahn"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link"
          style={{ color: 'var(--fg)' }}
        >
          yt
        </a>
      </div>
    </>
  );
}
