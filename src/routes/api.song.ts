/**
 * Name That Tune's song server.
 *   /api/song?game=bollywood|punjabi|english&n=5&skip=… — songs for one game:
 *     random big artists from the category, a random hit from each.
 *   /api/song?q=<text> — type-ahead song search for guessing.
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
    const r = await fetch(`https://api.deezer.com/search?limit=10&q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(7000),
    });
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
    { signal: AbortSignal.timeout(7000) },
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
const searches = new Map<string, { at: number; songs: PoolSong[] }>();

// ---------- Songs for a game ----------
export type PoolSong = { id: string; title: string; artist: string };
/** Hand-picked big artists for each category (Deezer artist ids). */
const ARTISTS: Record<string, number[]> = {
  // Arijit Singh, Shreya Ghoshal, Sonu Nigam, Atif Aslam, Neha Kakkar, Jubin Nautiyal…
  bollywood: [
    3830821, 98371, 70075, 405736, 129846, 8419888, 7760, 290619, 491, 498, 70758, 71798, 76645,
    10587, 97141, 136941, 492, 14779, 5017623, 6048770, 14114495, 516768, 269921, 291752, 4056595,
    133646, 1212166, 5561521, 4717745, 106752, 126453, 5301812, 4485080, 1452924, 1393198, 129840,
    1680753, 70024, 7269486, 124682, 2630, 8033, 73805, 10984, 111054, 71797, 106729, 71794,
    1532482, 4694401, 4661688, 12788789, 56237412,
  ],
  // Diljit Dosanjh, AP Dhillon, Sidhu Moose Wala, Karan Aujla, Shubh, Guru Randhawa…
  punjabi: [
    1199677, 76708242, 12423322, 6555107, 14499793, 5956602, 11649473, 4550961, 10851328, 116467,
    96512, 96441, 93746, 113572, 16023, 1511979, 1093616, 1092615, 891590, 987126, 4059801,
    50094692, 5368682, 9941124, 9466614, 5027880, 6207326, 1196073, 543560, 71525972, 1197473,
    5834324, 14555677, 5368627, 5851900, 1811, 107177, 1711258, 59454682, 14393879, 65370542,
    15287739, 5196512, 4759264, 4121038, 9948046, 49267072,
  ],
  // Taylor Swift, Ed Sheeran, The Weeknd, Ariana Grande, Justin Bieber, Dua Lipa…
  english: [
    12246, 384236, 4050205, 1562681, 288166, 8706544, 9635624, 429675, 564, 75798, 892, 416239,
    1188, 144227, 75491, 145, 246791, 7543848, 5313805, 1007876, 5962948, 292185, 3469, 11152580,
    12436, 1176900, 1362735, 1097709, 13, 12178, 542, 4104927, 293585, 4999707, 74398, 12088868,
    5578942, 5531258, 92, 259, 330, 483, 103, 5062414, 1182, 1424821, 5292512, 362326, 5259966,
    146543992, 64927672, 12945219, 126335112, 249599, 776, 160, 88, 17, 102, 4768753, 7890702,
    4331004, 15888, 647650, 16398, 873890, 313, 4492087, 311820,
  ],
};
/** Not the song people know: remixes, reprises, live, lo-fi and the like. */
const ALT_VERSION =
  /\b(remix|reprise|live|acoustic|unplugged|lofi|lo-fi|slowed|reverb|sped up|instrumental|karaoke|mashup|version|female|male|cover|edit|mix|remake|recreated|8d|demo)\b/i;

async function dz<T>(path: string, tries = 3): Promise<T | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const r = await fetch(`https://api.deezer.com${path}`, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) return null;
      const body = (await r.json()) as T & { error?: { code?: number } };
      if (!body.error) return body;
      // Deezer's rate limit (~50 requests / 5 s): wait a moment and ask again.
      if (body.error.code !== 4) return null;
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  return null;
}

/** How well-known a song must be (Deezer rank) to be asked; Punjabi charts run smaller. */
/** Devotional and holiday songs aren't what people mean by popular. */
const OFF_TOPIC = /\b(chalisa|aarti|bhajan|mantra|maa|mata|christmas|xmas|santa|holiday)\b/i;
const FLOOR: Record<string, number> = { bollywood: 170_000, punjabi: 100_000, english: 300_000 };
/** "Kesariya (From \"Brahmastra\")" → "Kesariya"; "Closer (feat. Halsey)" → "Closer". */
const tidy = (t: string) =>
  t
    .replace(/\s*[([](from|feat\.?|ft\.?|with)\b.*$/i, "")
    .replace(/\s+-\s+(from|feat).*$/i, "")
    .replace(/\s*[([]bonus track[)\]]/gi, "")
    .trim() || t;

const tops = new Map<
  number,
  { at: number; songs: (PoolSong & { rank: number; own: boolean })[] }
>();
/** An artist's most popular songs (their Deezer top tracks), cached for a day. */
async function artistTop(id: number) {
  const c = tops.get(id);
  if (c && Date.now() - c.at < 24 * 3_600_000) return c.songs;
  const body = await dz<{
    data?: {
      id: number;
      title: string;
      title_short?: string;
      rank?: number;
      preview?: string;
      artist?: { id: number; name: string };
    }[];
  }>(`/artist/${id}/top?limit=100`);
  const songs = (body?.data ?? [])
    .filter(
      (t) =>
        t.preview &&
        !ALT_VERSION.test(`${t.title} ${t.title_short ?? ""}`) &&
        !OFF_TOPIC.test(t.title),
    )
    .map((t) => ({
      id: String(t.id),
      title: tidy(t.title_short || t.title),
      artist: t.artist?.name ?? "",
      rank: t.rank ?? 0,
      // Their own song, not one they only feature on.
      own: t.artist?.id === id,
    }));
  if (songs.length) tops.set(id, { at: Date.now(), songs });
  return songs;
}

/**
 * Songs for one game: random artists from the category, and from each a
 * random song among their most popular (top 12). No artist twice; skips
 * songs the player had recently.
 */
export async function gameSongs(cat: string, n: number, skip: Set<string>): Promise<PoolSong[]> {
  const list = [...(ARTISTS[cat] ?? [])].sort(() => Math.random() - 0.5);
  const out: PoolSong[] = [];
  const seenTitles = new Set<string>();
  const floor = FLOOR[cat] ?? 0;
  for (let i = 0; i < list.length && out.length < n; i += n) {
    // A few artists at a time (Deezer allows ~50 requests per 5 seconds).
    const batch = await Promise.all(
      list.slice(i, i + n + 1).map((id) => artistTop(id).catch(() => [])),
    );
    for (const songs of batch) {
      if (out.length >= n) break;
      const pool = songs
        .filter((s) => s.own)
        .slice(0, 12)
        .filter((s) => s.rank >= floor && !skip.has(s.id) && !seenTitles.has(norm(s.title)));
      if (!pool.length) continue;
      const s = pool[Math.floor(Math.random() * pool.length)];
      seenTitles.add(norm(s.title));
      out.push({ id: s.id, title: s.title, artist: s.artist });
    }
  }
  return out;
}

/**
 * Everything worth guessing in a category: the top songs of all its artists
 * (~1,000 hits). The app keeps this on the phone and searches it as you type,
 * so suggestions are instant and the answer is always in there.
 */
const names = new Map<string, { at: number; songs: PoolSong[] }>();
const namesRun = new Map<string, Promise<PoolSong[]>>();
async function buildNames(cat: string): Promise<PoolSong[]> {
  const ids = ARTISTS[cat] ?? [];
  const out: (PoolSong & { rank: number })[] = [];
  const seen = new Set<string>();
  // Gently: 5 artists every 1.5 s, leaving room under Deezer's limit for games.
  for (let i = 0; i < ids.length; i += 5) {
    const lists = await Promise.all(
      ids.slice(i, i + 5).map((id) => artistTop(id).catch(() => [])),
    );
    for (const songs of lists)
      for (const s of songs) {
        const k = norm(s.title);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
    if (i + 5 < ids.length) await new Promise((r) => setTimeout(r, 1500));
  }
  // Most popular first, so the songs people mean come up top.
  return out
    .sort((a, b) => b.rank - a.rank)
    .map(({ id, title, artist }) => ({ id, title, artist }));
}
/** Build the guess lists in the background soon after the server starts. */
let warmed = false;
function warmUp() {
  if (warmed) return;
  warmed = true;
  void (async () => {
    for (const cat of Object.keys(ARTISTS)) await categoryNames(cat).catch(() => []);
  })();
}
export async function categoryNames(cat: string): Promise<PoolSong[]> {
  const c = names.get(cat);
  if (c && Date.now() - c.at < 24 * 3_600_000) return c.songs;
  let run = namesRun.get(cat);
  if (!run) {
    run = buildNames(cat)
      .then((songs) => {
        if (songs.length > 50) names.set(cat, { at: Date.now(), songs });
        return songs;
      })
      .finally(() => namesRun.delete(cat));
    namesRun.set(cat, run);
  }
  // Answer with yesterday's list right away if we have one; otherwise wait.
  return c?.songs ?? run;
}

/**
 * Type-ahead: songs matching what's been typed (Deezer search), best matches
 * first. Null if Deezer couldn't be reached (so nothing empty gets cached).
 */
export async function searchSongs(q: string): Promise<PoolSong[] | null> {
  const body = await dz<{
    data?: { id: number; title: string; title_short?: string; artist?: { name: string } }[];
  }>(`/search?limit=25&q=${encodeURIComponent(q)}`);
  if (!body) return null;
  const want = norm(q);
  const words = want.split(" ").filter(Boolean);
  // How well a song matches: the title starts with it, then every typed word
  // starts a word of the title, then the artist matches. Anything else goes.
  const fit = (title: string, artist: string) => {
    const t = norm(title);
    const tw = t.split(" ");
    if (t.startsWith(want)) return 0;
    if (words.every((w) => tw.some((x) => x.startsWith(w)))) return 1;
    const both = `${t} ${norm(artist)}`.split(" ");
    if (words.every((w) => both.some((x) => x.startsWith(w)))) return 2;
    return -1;
  };
  const seen = new Set<string>();
  const out: (PoolSong & { fit: number; i: number })[] = [];
  (body.data ?? []).forEach((t, i) => {
    const title = tidy(t.title_short || t.title);
    const artist = t.artist?.name ?? "";
    const k = `${norm(title)}|${norm(artist)}`;
    const f = fit(title, artist);
    if (f < 0 || seen.has(k) || ALT_VERSION.test(t.title)) return;
    seen.add(k);
    out.push({ id: String(t.id), title, artist, fit: f, i });
  });
  return out
    .sort((a, b) => a.fit - b.fit || a.i - b.i)
    .slice(0, 7)
    .map(({ id, title, artist }) => ({ id, title, artist }));
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
        const game = u.searchParams.get("game");
        if (game) {
          if (!ARTISTS[game]) return json({ error: "Unknown category." }, 400, "no-store");
          const n = Math.min(10, Math.max(1, Number(u.searchParams.get("n")) || 5));
          const skip = new Set(
            (u.searchParams.get("skip") ?? "").split(",").filter(Boolean).slice(0, 300),
          );
          const songs = await gameSongs(game, n, skip);
          return json(songs, 200, "no-store");
        }
        warmUp();
        const namesOf = u.searchParams.get("names");
        if (namesOf) {
          if (!ARTISTS[namesOf]) return json({ error: "Unknown category." }, 400, "no-store");
          const songs = await categoryNames(namesOf);
          return songs.length
            ? json(songs, 200, "private, max-age=21600")
            : json({ error: "Not ready." }, 503, "no-store");
        }
        const search = (u.searchParams.get("q") ?? "").trim().slice(0, 60);
        if (search) {
          if (search.length < 2) return json([]);
          const k = `q:${search.toLowerCase()}`;
          const c = searches.get(k);
          if (c && Date.now() - c.at < 6 * 3_600_000) return json(c.songs);
          const songs = await searchSongs(search);
          // Deezer didn't answer: say so (the app falls back to its own list).
          if (!songs) return json({ error: "Search is down." }, 502, "no-store");
          if (songs.length) {
            if (searches.size > 5000) searches.clear();
            searches.set(k, { at: Date.now(), songs });
          }
          return json(songs);
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
