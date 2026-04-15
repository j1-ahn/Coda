'use client';

import { useState } from 'react';

// ── Mock data — will be replaced with YouTube API / Coda export ──────────────

interface Release {
  id: string;
  catalog: string;        // e.g. "CODA-001"
  title: string;
  artist: string;
  duration: string;       // e.g. "4:32"
  coverUrl: string;       // placeholder for now
  youtubeUrl?: string;
  tags: string[];
}

const RELEASES: Release[] = [
  {
    id: '1', catalog: 'CODA-001', title: 'Midnight Drive', artist: 'j1',
    duration: '3:45', coverUrl: '', youtubeUrl: '#', tags: ['lofi', 'cinematic'],
  },
  {
    id: '2', catalog: 'CODA-002', title: 'Neon Rain', artist: 'j1',
    duration: '4:12', coverUrl: '', youtubeUrl: '#', tags: ['synthwave', 'dark'],
  },
  {
    id: '3', catalog: 'CODA-003', title: 'Dawn Chorus', artist: 'j1',
    duration: '5:01', coverUrl: '', youtubeUrl: '#', tags: ['ambient', 'organic'],
  },
  {
    id: '4', catalog: 'CODA-004', title: 'Static Memory', artist: 'j1',
    duration: '3:28', coverUrl: '', youtubeUrl: '#', tags: ['glitch', 'experimental'],
  },
  {
    id: '5', catalog: 'CODA-005', title: 'Velvet Hour', artist: 'j1',
    duration: '4:55', coverUrl: '', youtubeUrl: '#', tags: ['jazz', 'warm'],
  },
  {
    id: '6', catalog: 'CODA-006', title: 'Ghost Signal', artist: 'j1',
    duration: '3:15', coverUrl: '', youtubeUrl: '#', tags: ['industrial', 'minimal'],
  },
];

// ── Generative cover placeholder ─────────────────────────────────────────────

function PlaceholderCover({ seed, title }: { seed: number; title: string }) {
  // Generate a unique color from seed
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

function ReleaseCard({ release, index }: { release: Release; index: number }) {
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
        {release.youtubeUrl && (
          <a
            href={release.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label"
            style={{
              marginTop: 8,
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
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [filter, setFilter] = useState<string | null>(null);

  const allTags = Array.from(new Set(RELEASES.flatMap((r) => r.tags)));
  const filtered = filter
    ? RELEASES.filter((r) => r.tags.includes(filter))
    : RELEASES;

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
          <ReleaseCard key={r.id} release={r} index={i} />
        ))}
      </main>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <span className="text-label">CODA STUDIO</span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '0%' }} />
        </div>
        <a
          href="https://youtube.com/@j1-ahn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-label"
          style={{ color: 'var(--fg)', textDecoration: 'none' }}
        >
          YOUTUBE &rarr;
        </a>
      </div>
    </>
  );
}
