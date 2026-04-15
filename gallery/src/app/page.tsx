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
  tags: string[];
}

// ── Mock data (replaced by YouTube API / Coda export when connected) ─────────

const RELEASES: Release[] = [
  {
    id: '1', catalog: 'CODA-001', title: 'Midnight Drive', artist: 'j1',
    duration: '3:45', coverUrl: '', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tags: ['lofi', 'cinematic'],
  },
  {
    id: '2', catalog: 'CODA-002', title: 'Neon Rain', artist: 'j1',
    duration: '4:12', coverUrl: '', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tags: ['synthwave', 'dark'],
  },
  {
    id: '3', catalog: 'CODA-003', title: 'Dawn Chorus', artist: 'j1',
    duration: '5:01', coverUrl: '', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tags: ['ambient', 'organic'],
  },
  {
    id: '4', catalog: 'CODA-004', title: 'Static Memory', artist: 'j1',
    duration: '3:28', coverUrl: '', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tags: ['glitch', 'experimental'],
  },
  {
    id: '5', catalog: 'CODA-005', title: 'Velvet Hour', artist: 'j1',
    duration: '4:55', coverUrl: '', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tags: ['jazz', 'warm'],
  },
  {
    id: '6', catalog: 'CODA-006', title: 'Ghost Signal', artist: 'j1',
    duration: '3:15', coverUrl: '', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tags: ['industrial', 'minimal'],
  },
];

// ── Generative cover placeholder ─────────────────────────────────────────────

function PlaceholderCover({ seed, title }: { seed: number; title: string }) {
  const hue = (seed * 137.508) % 360;
  const bg1 = `hsl(${hue}, 8%, 18%)`;
  const bg2 = `hsl(${(hue + 40) % 360}, 12%, 12%)`;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: `hsl(${hue}, 15%, 55%)`,
          fontSize: 'clamp(14px, 3vw, 22px)',
          fontWeight: 300,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-geist-sans)',
        }}
      >
        {title}
      </span>
    </div>
  );
}

// ── Card component ───────────────────────────────────────────────────────────

function ReleaseCard({
  release,
  index,
  isPlaying,
  onPlay,
}: {
  release: Release;
  index: number;
  isPlaying: boolean;
  onPlay: (release: Release) => void;
}) {
  return (
    <div
      className="card fade-in"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {release.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={release.coverUrl} alt={release.title} />
      ) : (
        <PlaceholderCover seed={index + 1} title={release.title} />
      )}

      {/* Playing indicator */}
      {isPlaying && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--fg)',
            animation: 'fadeIn 0.3s ease',
          }}
        />
      )}

      {/* Hover overlay */}
      <div className="card-overlay">
        <span className="text-label">{release.catalog}</span>
        <span className="text-title" style={{ marginTop: 4 }}>
          {release.title}
        </span>
        <span className="text-meta" style={{ color: 'var(--muted)' }}>
          {release.artist} &middot; {release.duration}
        </span>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {release.tags.map((t) => (
            <span
              key={t}
              className="text-label"
              style={{
                padding: '2px 6px',
                border: '1px solid var(--line)',
                fontSize: 'clamp(8px, 1.2vw, 9px)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(release); }}
            className="text-label"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--fg)',
              letterSpacing: '0.12em',
              padding: 0,
            }}
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          {release.youtubeUrl && (
            <a
              href={release.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-label"
              style={{
                color: 'var(--fg)',
                textDecoration: 'none',
                letterSpacing: '0.12em',
              }}
            >
              WATCH &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bottom Player Bar ────────────────────────────────────────────────────────

function BottomPlayer({
  current,
  isPlaying,
  progress,
  onToggle,
  onSeek,
  currentTime,
  totalDuration,
}: {
  current: Release | null;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
  onSeek: (pct: number) => void;
  currentTime: string;
  totalDuration: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  };

  return (
    <div className="bottom-bar">
      {current ? (
        <>
          <button
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              width: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="text-label" style={{ color: 'var(--fg)', fontSize: 10 }}>
              {isPlaying ? '||' : '\u25B6'}
            </span>
          </button>
          <span className="text-meta" style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
            {current.title}
          </span>
          <span className="text-label" style={{ marginLeft: 6 }}>{currentTime}</span>
          <div
            ref={trackRef}
            className="progress-track"
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="text-label">{totalDuration}</span>
        </>
      ) : (
        <>
          <span className="text-label">CODA GALLERY</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: '0%' }} />
          </div>
        </>
      )}
      <a
        href="https://youtube.com/@j1-ahn"
        target="_blank"
        rel="noopener noreferrer"
        className="text-label"
        style={{ color: 'var(--fg)', textDecoration: 'none', marginLeft: 12 }}
      >
        YT &rarr;
      </a>
    </div>
  );
}

// ── Time formatting ──────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const [currentRelease, setCurrentRelease] = useState<Release | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [totalDuration, setTotalDuration] = useState('0:00');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // YouTube IFrame embed for audio playback
  const youtubeVideoId = currentRelease?.youtubeUrl
    ? new URL(currentRelease.youtubeUrl).searchParams.get('v')
    : null;

  const allTags = Array.from(new Set(RELEASES.flatMap((r) => r.tags)));
  const filtered = filter
    ? RELEASES.filter((r) => r.tags.includes(filter))
    : RELEASES;

  const handlePlay = useCallback((release: Release) => {
    if (currentRelease?.id === release.id) {
      // Toggle current
      setIsPlaying((p) => !p);
    } else {
      setCurrentRelease(release);
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime('0:00');

      // Parse duration string "m:ss" to total duration
      const parts = release.duration.split(':').map(Number);
      const totalSec = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
      setTotalDuration(fmtTime(totalSec));
    }
  }, [currentRelease]);

  const handleToggle = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const handleSeek = useCallback((pct: number) => {
    setProgress(pct);
    if (currentRelease) {
      const parts = currentRelease.duration.split(':').map(Number);
      const totalSec = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
      setCurrentTime(fmtTime(pct * totalSec));
    }
  }, [currentRelease]);

  // Simulate progress when playing (since we don't have real audio yet)
  useEffect(() => {
    if (!isPlaying || !currentRelease) return;
    const parts = currentRelease.duration.split(':').map(Number);
    const totalSec = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (totalSec === 0) return;

    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 1 / totalSec;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        setCurrentTime(fmtTime(next * totalSec));
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentRelease]);

  return (
    <>
      {/* Header */}
      <header className="site-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="text-title" style={{ letterSpacing: '0.15em' }}>
            CODA GALLERY
          </span>
          <span className="text-label">{RELEASES.length} releases</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setFilter(null)}
            className="text-label"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: !filter ? 'var(--fg)' : 'var(--muted)',
              transition: 'color 0.2s',
            }}
          >
            ALL
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className="text-label"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: filter === tag ? 'var(--fg)' : 'var(--muted)',
                transition: 'color 0.2s',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </header>

      {/* Grid */}
      <main className="gallery-grid">
        {filtered.map((r, i) => (
          <ReleaseCard
            key={r.id}
            release={r}
            index={i}
            isPlaying={isPlaying && currentRelease?.id === r.id}
            onPlay={handlePlay}
          />
        ))}
      </main>

      {/* Hidden YouTube embed for future real audio */}
      {youtubeVideoId && (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&autoplay=${isPlaying ? 1 : 0}`}
          style={{ position: 'fixed', left: -9999, width: 1, height: 1 }}
          allow="autoplay"
          title="audio"
        />
      )}

      {/* Bottom player bar */}
      <BottomPlayer
        current={currentRelease}
        isPlaying={isPlaying}
        progress={progress}
        onToggle={handleToggle}
        onSeek={handleSeek}
        currentTime={currentTime}
        totalDuration={totalDuration}
      />
    </>
  );
}
