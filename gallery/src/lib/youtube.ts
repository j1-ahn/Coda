/**
 * YouTube Data API v3 — playlist items fetcher.
 *
 * Two modes:
 *  1. API key mode: full metadata, pagination, up to 50 per page
 *  2. RSS fallback: no key needed, last ~15 items, limited metadata
 */

export interface PlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  duration?: string;  // only from API, not RSS
}

// ── API key mode ─────────────────────────────────────────────────────────────

export async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string,
  maxResults = 50,
): Promise<PlaylistItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data = await res.json();

  return (data.items ?? []).map((item: any) => ({
    videoId: item.snippet?.resourceId?.videoId ?? '',
    title: item.snippet?.title ?? '',
    thumbnail: item.snippet?.thumbnails?.medium?.url
      ?? item.snippet?.thumbnails?.default?.url
      ?? '',
    publishedAt: item.snippet?.publishedAt ?? '',
  }));
}

// ── RSS fallback (no API key) ────────────────────────────────────────────────

export async function fetchPlaylistRSS(
  playlistId: string,
): Promise<PlaylistItem[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`YouTube RSS error: ${res.status}`);

  const xml = await res.text();

  // Simple XML parsing — extract <entry> blocks
  const entries: PlaylistItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] ?? '';
    const title = entry.match(/<media:title>(.*?)<\/media:title>/)?.[1]
      ?? entry.match(/<title>(.*?)<\/title>/)?.[1]
      ?? '';
    const published = entry.match(/<published>(.*?)<\/published>/)?.[1] ?? '';
    const thumb = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1]
      ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

    if (videoId) {
      entries.push({
        videoId,
        title: decodeXMLEntities(title),
        thumbnail: thumb,
        publishedAt: published,
      });
    }
  }

  return entries;
}

function decodeXMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
