/**
 * Earworm's song server.
 *   /api/song?pool=bollywood|punjabi|english — the big list of popular songs for
 *     a category, built from Deezer's public hit playlists (most popular first,
 *     up to 1,000), refreshed daily.
 *   /api/song?id=<deezer id> — one song's 30-second preview (fresh link).
 *   /api/song?t=<title>&a=<artist> — find a song by name (Deezer, then iTunes).
 * Signed-in people only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export type SongHit = {
  preview: string;
  title: string;
  artist: string;
  cover: string | null;
  link: string | null;
  source: "deezer" | "itunes";
};

const json = (data: unknown, status = 200, cache = "private, max-age=600") =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cache },
  });

const okTokens = new Map<string, number>();
async function signedIn(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token === SUPABASE_ANON_KEY) return false;
  const until = okTokens.get(token);
  if (until && until > Date.now()) return true;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return false;
    if (okTokens.size > 2000) okTokens.clear();
    okTokens.set(token, Date.now() + 5 * 60_000);
    return true;
  } catch {
    return false;
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Does a search result look like the song we asked for? */
function same(t: string, wantT: string) {
  const a = norm(t);
  const b = norm(wantT);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

async function deezer(title: string, artist: string): Promise<SongHit | null> {
  for (const q of [`track:"${title}" artist:"${artist}"`, `${title} ${artist}`]) {
    const r = await fetch(`https://api.deezer.com/search?limit=10&q=${encodeURIComponent(q)}`);
    if (!r.ok) continue;
    const body = (await r.json()) as {
      data?: {
        title: string;
        preview: string;
        link: string;
        artist?: { name: string };
        album?: { cover_medium?: string };
      }[];
    };
    const list = (body.data ?? []).filter((d) => d.preview);
    const hit = list.find((d) => same(d.title, title)) ?? (q.startsWith("track:") ? list[0] : null);
    if (hit)
      return {
        preview: hit.preview,
        title: hit.title,
        artist: hit.artist?.name ?? artist,
        cover: hit.album?.cover_medium ?? null,
        link: hit.link ?? null,
        source: "deezer",
      };
  }
  return null;
}

async function itunes(title: string, artist: string): Promise<SongHit | null> {
  const r = await fetch(
    `https://itunes.apple.com/search?media=music&entity=song&limit=10&country=IN&term=${encodeURIComponent(`${title} ${artist}`)}`,
  );
  if (!r.ok) return null;
  const body = (await r.json()) as {
    results?: {
      trackName: string;
      artistName: string;
      previewUrl?: string;
      artworkUrl100?: string;
      trackViewUrl?: string;
    }[];
  };
  const list = (body.results ?? []).filter((d) => d.previewUrl);
  const hit = list.find((d) => same(d.trackName, title)) ?? list[0];
  if (!hit) return null;
  return {
    preview: hit.previewUrl!,
    title: hit.trackName,
    artist: hit.artistName,
    cover: hit.artworkUrl100?.replace("100x100", "300x300") ?? null,
    link: hit.trackViewUrl ?? null,
    source: "itunes",
  };
}

const cache = new Map<string, { at: number; hit: SongHit | null }>();

// ---------- Pools of popular songs ----------
export type PoolSong = { id: string; title: string; artist: string };
const POOL_QUERIES: Record<string, string[]> = {
  bollywood: [
    "bollywood hits",
    "best of bollywood",
    "bollywood top 50",
    "bollywood 90s hits",
    "bollywood 2000s hits",
    "bollywood 2010s hits",
    "bollywood romantic hits",
    "bollywood party songs",
    "arijit singh hits",
    "bollywood dance hits",
  ],
  punjabi: [
    "punjabi hits",
    "best of punjabi",
    "punjabi top 50",
    "punjabi party",
    "bhangra hits",
    "diljit dosanjh hits",
    "ap dhillon",
    "sidhu moose wala hits",
    "punjabi romantic hits",
  ],
  english: [
    "today's hits",
    "pop hits",
    "top hits 2010s",
    "top hits 2000s",
    "throwback hits",
    "global top 50",
    "best pop songs ever",
    "hits of the decade",
    "party hits",
  ],
};
const pools = new Map<string, { at: number; songs: PoolSong[] }>();
const building = new Map<string, Promise<PoolSong[]>>();

async function dz<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`https://api.deezer.com${path}`);
    if (!r.ok) return null;
    const body = (await r.json()) as T & { error?: unknown };
    return body.error ? null : body;
  } catch {
    return null;
  }
}

async function buildPool(cat: string): Promise<PoolSong[]> {
  type Track = {
    id: number;
    title: string;
    title_short?: string;
    rank?: number;
    preview?: string;
    artist?: { name: string };
  };
  const seen = new Map<string, Track>();
  for (const q of POOL_QUERIES[cat]) {
    const lists = await dz<{ data?: { id: number; nb_tracks?: number; fans?: number }[] }>(
      `/search/playlist?limit=6&q=${encodeURIComponent(q)}`,
    );
    const pick = (lists?.data ?? [])
      .filter((l) => (l.nb_tracks ?? 0) >= 25)
      .sort((a, b) => (b.fans ?? 0) - (a.fans ?? 0))
      .slice(0, 3);
    for (const l of pick) {
      const tracks = await dz<{ data?: Track[] }>(`/playlist/${l.id}/tracks?limit=200`);
      for (const t of tracks?.data ?? []) {
        if (!t.preview || !t.artist?.name) continue;
        const name = t.title_short || t.title;
        const k = `${norm(name)}|${norm(t.artist.name)}`;
        const prev = seen.get(k);
        if (!prev || (t.rank ?? 0) > (prev.rank ?? 0)) seen.set(k, { ...t, title: name });
      }
    }
  }
  // Popular only: highest Deezer rank first, nothing obscure.
  const sorted = [...seen.values()].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  const floor = sorted.length > 300 ? (sorted[Math.min(sorted.length - 1, 999)].rank ?? 0) : 0;
  return sorted
    .filter((t) => (t.rank ?? 0) >= floor && (t.rank ?? 0) >= 150_000)
    .slice(0, 1000)
    .map((t) => ({ id: String(t.id), title: t.title, artist: t.artist!.name }));
}

async function pool(cat: string) {
  const p = pools.get(cat);
  if (p && Date.now() - p.at < 24 * 3_600_000 && p.songs.length) return p.songs;
  let run = building.get(cat);
  if (!run) {
    run = buildPool(cat).finally(() => building.delete(cat));
    building.set(cat, run);
  }
  const songs = await run;
  if (songs.length) pools.set(cat, { at: Date.now(), songs });
  return songs.length ? songs : (p?.songs ?? []);
}

async function byId(id: string): Promise<SongHit | null> {
  const t = await dz<{
    title: string;
    title_short?: string;
    preview?: string;
    link?: string;
    artist?: { name: string };
    album?: { cover_medium?: string };
  }>(`/track/${encodeURIComponent(id)}`);
  if (!t?.preview) return null;
  return {
    preview: t.preview,
    title: t.title_short || t.title,
    artist: t.artist?.name ?? "",
    cover: t.album?.cover_medium ?? null,
    link: t.link ?? null,
    source: "deezer",
  };
}

export const Route = createFileRoute("/api/song")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await signedIn(request))) return json({ error: "Sign in first." }, 401, "no-store");
        const u = new URL(request.url);
        const cat = u.searchParams.get("pool");
        if (cat) {
          if (!POOL_QUERIES[cat]) return json({ error: "Unknown category." }, 400, "no-store");
          const songs = await pool(cat);
          return json(songs, 200, "private, max-age=3600");
        }
        const id = u.searchParams.get("id");
        if (id) {
          if (!/^\d{1,15}$/.test(id)) return json({ error: "Bad id." }, 400, "no-store");
          const hit = await byId(id);
          return hit ? json(hit, 200, "private, max-age=1800") : json({ error: "Not found" }, 404);
        }
        const title = (u.searchParams.get("t") ?? "").trim().slice(0, 120);
        const artist = (u.searchParams.get("a") ?? "").trim().slice(0, 120);
        if (!title) return json({ error: "Which song?" }, 400, "no-store");
        const k = `${title}|${artist}`.toLowerCase();
        const c = cache.get(k);
        // Preview links are signed and expire, so don't keep them too long.
        if (c && Date.now() - c.at < 3 * 3_600_000)
          return c.hit ? json(c.hit) : json({ error: "Not found" }, 404);
        try {
          const hit =
            (await deezer(title, artist).catch(() => null)) ??
            (await itunes(title, artist).catch(() => null));
          if (cache.size > 3000) cache.clear();
          cache.set(k, { at: Date.now(), hit });
          return hit ? json(hit) : json({ error: "Not found" }, 404);
        } catch (e) {
          console.error("[song]", e);
          return json({ error: "Couldn't find that song." }, 502, "no-store");
        }
      },
    },
  },
});
