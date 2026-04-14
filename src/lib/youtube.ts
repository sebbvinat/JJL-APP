/**
 * YouTube Data API client (server-only).
 *
 * Security:
 * - All envs required at call time; throws if missing so we never silently
 *   degrade to broken behavior.
 * - Refresh token stays in this module. Never logged, never returned.
 * - Access token cached in memory only (serverless-invocation scoped).
 * - Only uses scope=youtube.readonly (set when the refresh token was minted
 *   in jjl-manager). Upload / mutation is out of scope.
 */

import 'server-only';

type Json = Record<string, unknown>;

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

function envs() {
  const client_id = process.env.YOUTUBE_CLIENT_ID;
  const client_secret = process.env.YOUTUBE_CLIENT_SECRET;
  const refresh_token = process.env.YOUTUBE_REFRESH_TOKEN;
  const channel_id = process.env.YOUTUBE_CHANNEL_ID;
  if (!client_id || !client_secret || !refresh_token || !channel_id) {
    throw new Error(
      '[youtube] Missing env: need YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, YOUTUBE_CHANNEL_ID'
    );
  }
  return { client_id, client_secret, refresh_token, channel_id };
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 30_000) {
    return cached.token;
  }

  const { client_id, client_secret, refresh_token } = envs();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    // Avoid leaking any token material. Only status + short error.
    throw new Error(`[youtube] Token refresh failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error('[youtube] Token refresh returned no access_token');
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  cached = {
    token: data.access_token,
    expiresAt: now + expiresIn * 1000,
  };
  return cached.token;
}

async function ytFetch(path: string, params: Record<string, string | number>): Promise<Json> {
  const token = await getAccessToken();
  const url = new URL(`https://www.googleapis.com/youtube/v3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`[youtube] ${path} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as Json;
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  embeddable: boolean;
  thumbnailUrl: string | null;
  channelTitle: string;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Fetch metadata for up to 50 ids in one shot. Invalid ids are filtered. */
export async function fetchVideoMetadata(ids: string[]): Promise<Record<string, VideoMetadata>> {
  const clean = ids.filter((id) => ID_RE.test(id)).slice(0, 50);
  if (clean.length === 0) return {};

  interface YtItem {
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      channelTitle?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    status?: { privacyStatus?: string; embeddable?: boolean };
  }

  const data = (await ytFetch('/videos', {
    part: 'snippet,status',
    id: clean.join(','),
    maxResults: 50,
  })) as { items?: YtItem[] };

  const out: Record<string, VideoMetadata> = {};
  for (const item of data.items || []) {
    const snippet = item.snippet || {};
    const thumb =
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      snippet.thumbnails?.high?.url ||
      null;
    out[item.id] = {
      id: item.id,
      title: snippet.title || '',
      description: snippet.description || '',
      publishedAt: snippet.publishedAt || '',
      privacyStatus: (item.status?.privacyStatus as VideoMetadata['privacyStatus']) || 'public',
      embeddable: item.status?.embeddable !== false,
      thumbnailUrl: thumb,
      channelTitle: snippet.channelTitle || '',
    };
  }
  return out;
}

export interface SearchResult {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  description: string;
}

/**
 * Search the configured channel for videos matching `q`. Returns up to
 * `maxResults` hits (capped at 25 by the API). Unlisted videos from the
 * channel are included because we're authenticated as the channel owner.
 */
export async function searchChannelVideos(q: string, maxResults = 10): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const { channel_id } = envs();

  interface YtSearchItem {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
  }

  const data = (await ytFetch('/search', {
    part: 'snippet',
    channelId: channel_id,
    q: query,
    type: 'video',
    maxResults: Math.min(Math.max(maxResults, 1), 25),
    order: 'relevance',
  })) as { items?: YtSearchItem[] };

  return (data.items || [])
    .map((item) => {
      const id = item.id?.videoId;
      if (!id) return null;
      const s = item.snippet || {};
      const thumb =
        s.thumbnails?.medium?.url ||
        s.thumbnails?.default?.url ||
        s.thumbnails?.high?.url ||
        null;
      return {
        id,
        title: s.title || '',
        description: s.description || '',
        publishedAt: s.publishedAt || '',
        thumbnailUrl: thumb,
      } satisfies SearchResult;
    })
    .filter((x): x is SearchResult => x !== null);
}
