/**
 * Name That Tune: name the song from a tiny clip. Each skip (or wrong guess) plays a
 * longer clip. Bollywood, Punjabi or English; popular songs only (the server
 * builds big pools from Deezer's hit playlists; the lists here are a backup).
 */
import { supabase } from "@/integrations/supabase/client";
import { shuffle } from "@/lib/utils";

export type EarCat = "bollywood" | "punjabi" | "english";
export type EarLevel = "easy" | "medium" | "hard" | "mix";
/** How hard one song is. Mix mode climbs through all five. */
export type EarTier = "easy" | "medium" | "hard" | "insane" | "impossible";
export type EarSong = {
  id: string;
  title: string;
  artist: string;
  /** In the phone's big list: a good game pick (their own popular hit). */
  g?: 1;
};
export type EarResult = {
  score: number;
  /** Per song: the clip it was named on (0 = shortest), or -1 if missed. */
  got: number[];
  at: number;
};
export type EarState = {
  cat: EarCat;
  level: EarLevel;
  songs: EarSong[];
  /** Final scores (written when everyone's done / the live game ends). */
  results: Record<string, EarResult>;
  /** "live": everyone hears the same song at the same time, on a timer. */
  mode?: "live";
  /** Live: who's in (opened the game), and who quit. */
  joined?: string[];
  left?: string[];
  /** Live: when song 1 starts (server time, ms). Unset while in the waiting room. */
  startAt?: number;
  /** Live: songs that ended early because everyone had answered (server ms). */
  ends?: Record<number, number>;
  /** Live: each player's answer per song (clip index, -1 missed, -2 didn't load). */
  picks?: Record<string, (number | null)[]>;
};

export const CATS: { id: EarCat; name: string; emoji: string; tone: string }[] = [
  { id: "bollywood", name: "Bollywood", emoji: "🎬", tone: "#F2507B" },
  { id: "punjabi", name: "Punjabi", emoji: "🥁", tone: "#F2A93B" },
  { id: "english", name: "English", emoji: "🎧", tone: "#5B8CFF" },
];

/** Clip lengths (seconds) for each try, by difficulty. */
export const STAGES: Record<EarTier, number[]> = {
  easy: [1, 2, 4, 7, 11, 16],
  medium: [0.5, 1, 2, 4, 8, 15],
  hard: [0.1, 0.5, 1, 2, 4, 8],
  insane: [0.1, 0.3, 0.6, 1, 2, 4],
  impossible: [0.1, 0.2, 0.3, 0.5, 1, 2],
};
/** Mix mode: song 1 is easy, song 5 is impossible. */
export const MIX_TIERS: EarTier[] = ["easy", "medium", "hard", "insane", "impossible"];
export const TIER_NAME: Record<EarTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  insane: "Insane",
  impossible: "Impossible",
};
/** The difficulty of song number k (0-based) in a game. */
export const tierOf = (level: EarLevel, k: number): EarTier =>
  level === "mix" ? MIX_TIERS[Math.min(k, MIX_TIERS.length - 1)] : level;
/** Live games: seconds to name each song. Harder = shorter clips, so more time to think. */
export const SONG_SECS: Record<EarTier, number> = {
  easy: 60,
  medium: 65,
  hard: 75,
  insane: 85,
  impossible: 90,
};
/** Live games: the answer is shown to everyone for this long between songs. */
export const REVEAL_MS = 7000;
/** Live games: 3-2-1 before song 1. */
export const COUNTDOWN_MS = 4000;

export type LiveAt =
  | { phase: "lobby" }
  | { phase: "countdown"; endsAt: number }
  | { phase: "song" | "reveal"; k: number; endsAt: number }
  | { phase: "over" };
/** Where a live game is right now: which song, and when this part ends. */
export function liveAt(st: EarState, now: number): LiveAt {
  if (!st.startAt) return { phase: "lobby" };
  if (now < st.startAt) return { phase: "countdown", endsAt: st.startAt };
  let t = st.startAt;
  for (let k = 0; k < st.songs.length; k++) {
    const full = t + SONG_SECS[tierOf(st.level, k)] * 1000;
    const early = st.ends?.[k];
    const end = early && early < full ? Math.max(t, early) : full;
    if (now < end) return { phase: "song", k, endsAt: end };
    if (now < end + REVEAL_MS) return { phase: "reveal", k, endsAt: end + REVEAL_MS };
    t = end + REVEAL_MS;
  }
  return { phase: "over" };
}
/** Who's still playing a live game. */
export const liveActive = (st: EarState) =>
  (st.joined ?? []).filter((p) => !(st.left ?? []).includes(p));
/** Final results from everyone's answers (songs with no answer count as missed). */
export function liveResults(st: EarState, players: string[]): Record<string, EarResult> {
  const out: Record<string, EarResult> = {};
  for (const p of players) {
    if (!(st.joined ?? []).includes(p)) continue;
    const picks = st.picks?.[p] ?? [];
    const got = st.songs.map((_, k) => {
      const g = picks[k];
      return g == null || g < 0 ? -1 : g;
    });
    out[p] = { score: got.reduce((a, g) => a + (g >= 0 ? POINTS[g] : 0), 0), got, at: 0 };
  }
  return out;
}

/** Server time (ms), so everyone's song changes at the same moment. */
let offset = 0;
let synced: Promise<void> | null = null;
export function syncClock() {
  synced ??= (async () => {
    const tries: { off: number; rtt: number }[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const t0 = Date.now();
        const r = await fetch("/api/now", { cache: "no-store" });
        const { now } = (await r.json()) as { now: number };
        const t1 = Date.now();
        tries.push({ off: now - (t0 + t1) / 2, rtt: t1 - t0 });
      } catch {
        // keep the phone's clock
      }
    }
    if (tries.length) offset = tries.sort((a, b) => a.rtt - b.rtt)[0].off;
  })();
  return synced;
}
export const serverNow = () => Date.now() + offset;

/** Points for naming it on each clip. */
export const POINTS = [100, 80, 60, 40, 25, 10];
export const SONGS_PER_GAME = 5;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]|- .*$/g, " ")
    .replace(/feat\..*$/g, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** Does a typed or picked guess match the song? (Ignores "(From …)", feat., punctuation.) */
export const isRight = (guess: string, s: EarSong) => {
  const g = norm(guess);
  const t = norm(s.title);
  // Exact, or the first whole words of a long title ("blinding" for "Blinding Lights").
  return !!g && (g === t || (g.length >= 4 && (t.startsWith(`${g} `) || g.startsWith(`${t} `))));
};
export const cleanTitle = (t: string) =>
  t
    .replace(/\s*\((from|feat|ft)[^)]*\)/gi, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .trim();

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * A signal that gives up after `ms`. (AbortSignal.timeout isn't on iPhones
 * before iOS 16; there it broke loading songs.)
 */
export function within(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal)
    return (AbortSignal as unknown as { timeout: (n: number) => AbortSignal }).timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

const backupFor = (cat: EarCat): EarSong[] =>
  BACKUP[cat].map(([title, artist]) => ({ id: `q:${title}|${artist}`, title, artist }));

/**
 * Songs you've had recently, per category (the last 400), so a game doesn't
 * bring back ones you just heard. Older phones kept one shared list of 150.
 */
const recentKey = (cat: EarCat) => `tf.earworm.recent.${cat}`;
function recentIds(cat: EarCat): string[] {
  try {
    const mine = JSON.parse(localStorage.getItem(recentKey(cat)) ?? "[]");
    const old = JSON.parse(localStorage.getItem("tf.earworm.recent") ?? "[]");
    return [...(Array.isArray(mine) ? mine : []), ...(Array.isArray(old) ? old : [])];
  } catch {
    return [];
  }
}
/** Remember a game's songs on this phone (also for games a friend picked). */
export function rememberSongs(cat: EarCat, songs: EarSong[]) {
  remember(cat, songs);
}
function remember(cat: EarCat, songs: EarSong[]) {
  try {
    const mine = JSON.parse(localStorage.getItem(recentKey(cat)) ?? "[]");
    const ids = songs.map((s) => s.id);
    const rest = (Array.isArray(mine) ? mine : []).filter((id: string) => !ids.includes(id));
    localStorage.setItem(recentKey(cat), JSON.stringify([...ids, ...rest].slice(0, 400)));
  } catch {
    // ignore
  }
}

/**
 * Songs for one game, picked fresh each time: random big artists from the
 * category and a random hit from each, skipping ones you had recently.
 * Falls back to the backup list if Deezer can't be reached.
 */
/**
 * Start picking a game's songs early (when a category is chosen on the setup
 * screen), so they're often ready by the time Play is tapped.
 */
const early = new Map<EarCat, { at: number; run: Promise<EarSong[]> }>();
export function prefetchGameSongs(cat: EarCat) {
  // Have the big list ready on the phone for next time.
  void loadNames(cat).catch(() => []);
  if (savedPicks(cat).length) return; // picking is instant: nothing to wait for
  const e = early.get(cat);
  if (e && Date.now() - e.at < 5 * 60_000) return;
  const run = fetchGameSongs(cat);
  early.set(cat, { at: Date.now(), run });
  run.catch(() => early.delete(cat));
}
export async function pickGameSongs(cat: EarCat, n = SONGS_PER_GAME): Promise<EarSong[]> {
  const quick = pickOnPhone(cat, n);
  if (quick) return quick;
  const e = early.get(cat);
  if (e && n === SONGS_PER_GAME && Date.now() - e.at < 5 * 60_000) {
    // Anyone asking at the same moment shares it; it's used up once it lands.
    const songs = await e.run.catch(() => [] as EarSong[]);
    setTimeout(() => early.get(cat) === e && early.delete(cat), 1000);
    if (songs.length >= n) return songs;
  }
  return fetchGameSongs(cat, n);
}
/** The game picks in the big list saved on the phone (none if not saved yet). */
function savedPicks(cat: EarCat): EarSong[] {
  try {
    const saved = JSON.parse(localStorage.getItem(`tf.ntt.names.${cat}`) ?? "null");
    const all = asSongs(saved?.songs);
    const marked = all.filter((s) => s.g === 1);
    // A list saved before picks were marked: its most popular part (it's sorted).
    return marked.length ? marked : all.slice(0, Math.floor(all.length * 0.4));
  } catch {
    return [];
  }
}
/**
 * Pick a game's songs right here from the big list on the phone: no waiting
 * on the server. One song per artist, never a song you had recently.
 */
function pickOnPhone(cat: EarCat, n: number): EarSong[] | null {
  const picks = savedPicks(cat);
  if (picks.length < n * 6) return null;
  const recent = new Set(recentIds(cat));
  const fresh = picks.filter((s) => !recent.has(s.id));
  const from = shuffle(fresh.length >= n * 3 ? fresh : picks);
  const titles = new Set<string>();
  const artists = new Set<string>();
  const out: EarSong[] = [];
  for (const s of from) {
    const t = norm(s.title);
    const a = norm(s.artist);
    if (titles.has(t) || artists.has(a)) continue;
    titles.add(t);
    artists.add(a);
    out.push({ id: s.id, title: s.title, artist: s.artist });
    if (out.length >= n) break;
  }
  if (out.length < n) return null;
  remember(cat, out);
  return out;
}
async function fetchGameSongs(cat: EarCat, n = SONGS_PER_GAME): Promise<EarSong[]> {
  const recent = recentIds(cat);
  // Fresh hits from the server (asked twice if it's slow).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const skip = recent
        .filter((id) => /^\d+$/.test(id))
        .slice(0, 300)
        .join(",");
      const r = await fetch(`/api/song?game=${cat}&n=${n}&skip=${skip}`, {
        headers: await authHeader(),
        signal: within(attempt ? 15000 : 9000),
      });
      if (r.ok) {
        const songs = asSongs(await r.json());
        if (songs.length >= n) {
          remember(cat, songs);
          return songs;
        }
      }
    } catch {
      // try again, then the lists below
    }
  }
  // Server slow or down: the category's big list kept on the phone (~1,000
  // hits), then the small built-in one. Never the songs you had recently.
  const big = await loadNames(cat).catch(() => [] as EarSong[]);
  for (const pool of [big, backupFor(cat)]) {
    const fresh = pool.filter((s) => !recent.includes(s.id));
    const from = shuffle(fresh.length >= n * 3 ? fresh : pool);
    const seen = new Set<string>();
    const out: EarSong[] = [];
    for (const s of from) {
      const k = norm(s.title);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
      if (out.length >= n) break;
    }
    if (out.length >= n) {
      remember(cat, out);
      return out;
    }
  }
  return [];
}

/** Only well-formed songs (a bad or old answer never breaks the game). */
const asSongs = (x: unknown): EarSong[] =>
  Array.isArray(x)
    ? x.filter(
        (s): s is EarSong =>
          !!s &&
          typeof s.id === "string" &&
          typeof s.title === "string" &&
          typeof s.artist === "string",
      )
    : [];

/**
 * The songs worth guessing in a category (~1,000 hits), kept on the phone for a
 * day so suggestions appear instantly as you type.
 */
const namesMem = new Map<EarCat, Promise<EarSong[]>>();
export function loadNames(cat: EarCat): Promise<EarSong[]> {
  let run = namesMem.get(cat);
  if (run) return run;
  const key = `tf.ntt.names.${cat}`;
  let saved: { at: number; songs: EarSong[] } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    // ignore
  }
  const fresh = async () => {
    try {
      const r = await fetch(`/api/song?names=${cat}`, {
        headers: await authHeader(),
        signal: within(20000),
      });
      if (!r.ok) return null;
      const songs = asSongs(await r.json());
      if (!songs.length) return null;
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), songs }));
      } catch {
        // full: fine, we still have it in memory
      }
      return songs;
    } catch {
      return null;
    }
  };
  if (saved && asSongs(saved.songs).length) {
    // Use what's on the phone now; refresh it in the background once a day.
    // (Lists saved before game picks were marked get refreshed straight away.)
    const old = !asSongs(saved.songs).some((x) => x.g === 1);
    if (old || Date.now() - saved.at > 24 * 3_600_000) void fresh();
    run = Promise.resolve(asSongs(saved.songs));
  } else {
    run = fresh().then((s) => {
      if (!s) namesMem.delete(cat);
      return s ?? [];
    });
  }
  namesMem.set(cat, run);
  return run;
}

/** Best matches first: the exact title, then the title starts with it, then every typed word starts a word. */
export function matchSongs(list: EarSong[], q: string, max = 6): EarSong[] {
  const want = norm(q);
  const words = want.split(" ").filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>();
  const hits: { s: EarSong; f: number }[] = [];
  for (const s of list) {
    const t = norm(s.title);
    const k = `${t}|${norm(s.artist)}`;
    if (seen.has(k)) continue;
    const tw = t.split(" ");
    let f = -1;
    if (t === want) f = 0;
    else if (t.startsWith(want)) f = 1;
    else if (words.every((w) => tw.some((x) => x.startsWith(w)))) f = 1.5;
    else {
      const both = [...tw, ...norm(s.artist).split(" ")];
      if (words.every((w) => both.some((x) => x.startsWith(w)))) f = 2;
    }
    if (f < 0) continue;
    seen.add(k);
    hits.push({ s, f });
  }
  return hits
    .sort((a, b) => a.f - b.f)
    .slice(0, max)
    .map((h) => h.s);
}

// ---------- The daily song (third daily game) ----------
/** Hindi, Punjabi, English, round and round; medium and hard take turns. */
export function tuneOf(day: string): { cat: EarCat; level: "medium" | "hard" } {
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const cats: EarCat[] = ["bollywood", "punjabi", "english"];
  // (+1 so the run starts on Bollywood, 17 Nov 2026.)
  return { cat: cats[(((n + 1) % 3) + 3) % 3], level: n % 2 ? "hard" : "medium" };
}

/**
 * Today's song, the same for everyone. The first person to open it picks it
 * (from a handful of hits; the database skips any that were a daily song
 * before), everyone after gets that one.
 */
export async function loadDailyTune(day: string): Promise<EarSong> {
  const { cat, level } = tuneOf(day);
  const { data: s0 } = await supabase.auth.getSession();
  if (!s0.session) {
    // Demo: a song from the built-in list, picked by the date.
    const list = backupFor(cat);
    const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
    return list[n % list.length];
  }
  const { data: have } = await supabase
    .from("daily_tunes" as never)
    .select("song_id,title,artist")
    .eq("day" as never, day as never)
    .maybeSingle();
  const row = have as { song_id: string; title: string; artist: string } | null;
  if (row) return { id: row.song_id, title: row.title, artist: row.artist };
  // A few fresh hits from the server (asked twice if it's slow), then the
  // built-in list as a backup so the day never breaks. The database skips any
  // that were a daily song before.
  let picks: EarSong[] = [];
  for (let attempt = 0; attempt < 2 && !picks.length; attempt++) {
    try {
      const r = await fetch(`/api/song?game=${cat}&n=6`, {
        headers: await authHeader(),
        signal: within(20000),
      });
      if (r.ok) picks = asSongs(await r.json()).filter((x) => /^\d+$/.test(x.id));
    } catch {
      // try again, then the backup list
    }
  }
  picks = [...picks, ...shuffle(backupFor(cat))].slice(0, 40);
  const { data, error } = await supabase.rpc(
    "claim_daily_tune" as never,
    {
      p_cat: cat,
      p_level: level,
      p_ids: picks.map((x) => x.id),
      p_titles: picks.map((x) => x.title),
      p_artists: picks.map((x) => x.artist),
    } as never,
  );
  if (error) throw new Error(error.message);
  const got = data as unknown as { song_id: string; title: string; artist: string };
  return { id: got.song_id, title: got.title, artist: got.artist };
}

/** Type-ahead extra: anything on Deezer (for songs outside the list). */
const searchCache = new Map<string, EarSong[]>();
export async function searchSongs(q: string): Promise<EarSong[]> {
  const key = q.trim().toLowerCase();
  if (key.length < 2) return [];
  const hit = searchCache.get(key);
  if (hit) return hit;
  try {
    const r = await fetch(`/api/song?q=${encodeURIComponent(key)}`, {
      headers: await authHeader(),
      signal: within(5000),
    });
    if (!r.ok) return [];
    const found = asSongs(await r.json());
    if (found.length) searchCache.set(key, found);
    return found;
  } catch {
    return [];
  }
}
/** Every built-in song (all categories), as a last-resort guess list. */
export const allBackup = (): EarSong[] => (Object.keys(BACKUP) as EarCat[]).flatMap(backupFor);

export type Preview = {
  url: string;
  /** The streamed link, kept when `url` is a downloaded copy (fallback). */
  stream?: string;
  title: string;
  artist: string;
  cover: string | null;
  link: string | null;
};
/** A song's 30-second preview, played through our server. */
export async function loadPreview(s: EarSong): Promise<Preview | null> {
  const q = s.id.startsWith("q:")
    ? `t=${encodeURIComponent(s.title)}&a=${encodeURIComponent(s.artist)}`
    : `id=${encodeURIComponent(s.id)}`;
  try {
    const r = await fetch(`/api/song?${q}`, {
      headers: await authHeader(),
      signal: within(8000),
    });
    if (!r.ok) return null;
    const h = (await r.json()) as {
      preview: string;
      title: string;
      artist: string;
      cover: string | null;
      link: string | null;
    };
    return {
      url: `/api/song-audio?u=${encodeURIComponent(h.preview)}`,
      title: h.title,
      artist: h.artist,
      cover: h.cover,
      link: h.link,
    };
  } catch {
    return null;
  }
}

/**
 * A song's clip, downloaded whole onto the phone (a 30s preview is ~0.5 MB) so
 * every play starts instantly: no buffering when you skip and hear more.
 * Falls back to streaming if the download doesn't finish in time.
 * Kept per song, so the next song can be fetched while you play this one.
 */
const clips = new Map<string, Promise<Preview | null>>();
export function loadClip(s: EarSong): Promise<Preview | null> {
  let run = clips.get(s.id);
  if (!run) {
    run = loadPreview(s).then(async (p) => {
      if (!p) return null;
      try {
        const r = await fetch(p.url, { signal: within(12000) });
        if (!r.ok) return p;
        const blob = await r.blob();
        // Only keep it if it's really audio (an error page would never play).
        if (!/^audio\//.test(blob.type) || blob.size < 1000) return p;
        return { ...p, url: URL.createObjectURL(blob), stream: p.url };
      } catch {
        return p;
      }
    });
    // A failed lookup can be tried again later.
    run.then((p) => !p && clips.delete(s.id));
    if (clips.size > 40) {
      const [old] = clips.keys();
      void clips.get(old)?.then((p) => p?.url.startsWith("blob:") && URL.revokeObjectURL(p.url));
      clips.delete(old);
    }
    clips.set(s.id, run);
  }
  return run;
}

// ---------- Backup lists (big, safe hits) ----------
const BACKUP: Record<EarCat, [string, string][]> = {
  bollywood: [
    ["Kesariya", "Arijit Singh"],
    ["Tum Hi Ho", "Arijit Singh"],
    ["Channa Mereya", "Arijit Singh"],
    ["Raabta", "Arijit Singh"],
    ["Agar Tum Saath Ho", "Arijit Singh"],
    ["Apna Bana Le", "Arijit Singh"],
    ["Tere Vaaste", "Varun Jain"],
    ["Satranga", "Arijit Singh"],
    ["Chaleya", "Arijit Singh"],
    ["Jhoome Jo Pathaan", "Arijit Singh"],
    ["Besharam Rang", "Shilpa Rao"],
    ["Kala Chashma", "Badshah"],
    ["Gallan Goodiyaan", "Yashita Sharma"],
    ["London Thumakda", "Labh Janjua"],
    ["Badtameez Dil", "Benny Dayal"],
    ["Balam Pichkari", "Vishal Dadlani"],
    ["Kabira", "Tochi Raina"],
    ["Ilahi", "Arijit Singh"],
    ["Ae Dil Hai Mushkil", "Arijit Singh"],
    ["Bulleya", "Amit Mishra"],
    ["Galliyan", "Ankit Tiwari"],
    ["Tera Ban Jaunga", "Akhil Sachdeva"],
    ["Bekhayali", "Sachet Tandon"],
    ["Shayad", "Arijit Singh"],
    ["Pehla Nasha", "Udit Narayan"],
    ["Tujhe Dekha To", "Kumar Sanu"],
    ["Kal Ho Naa Ho", "Sonu Nigam"],
    ["Chaiyya Chaiyya", "Sukhwinder Singh"],
    ["Dil To Pagal Hai", "Lata Mangeshkar"],
    ["Kuch Kuch Hota Hai", "Udit Narayan"],
    ["Tum Se Hi", "Mohit Chauhan"],
    ["Kun Faya Kun", "A.R. Rahman"],
    ["Jai Ho", "A.R. Rahman"],
    ["Munni Badnaam Hui", "Mamta Sharma"],
    ["Sheila Ki Jawani", "Sunidhi Chauhan"],
    ["Chammak Challo", "Akon"],
    ["Desi Girl", "Shankar Mahadevan"],
    ["Nashe Si Chadh Gayi", "Arijit Singh"],
    ["Ghungroo", "Arijit Singh"],
    ["Malhari", "Vishal Dadlani"],
    ["Tum Jo Aaye", "Rahat Fateh Ali Khan"],
    ["Pee Loon", "Mohit Chauhan"],
    ["Zaalima", "Arijit Singh"],
    ["Hawayein", "Arijit Singh"],
    ["Phir Bhi Tumko Chaahunga", "Arijit Singh"],
    ["Tum Kya Mile", "Arijit Singh"],
    ["Heeriye", "Arijit Singh"],
    ["O Maahi", "Arijit Singh"],
    ["Ranjha", "B Praak"],
    ["Raataan Lambiyan", "Jubin Nautiyal"],
    ["Lut Gaye", "Jubin Nautiyal"],
    ["Dilbar", "Neha Kakkar"],
    ["Aankh Marey", "Neha Kakkar"],
    ["Senorita", "Farhan Akhtar"],
    ["Matargashti", "Mohit Chauhan"],
    ["Ude Dil Befikre", "Benny Dayal"],
    ["Nagada Sang Dhol", "Shreya Ghoshal"],
    ["Deewani Mastani", "Shreya Ghoshal"],
    ["Teri Meri", "Rahat Fateh Ali Khan"],
    ["Tujh Mein Rab Dikhta Hai", "Roop Kumar Rathod"],
  ],
  punjabi: [
    ["Lover", "Diljit Dosanjh"],
    ["Born to Shine", "Diljit Dosanjh"],
    ["G.O.A.T.", "Diljit Dosanjh"],
    ["Do You Know", "Diljit Dosanjh"],
    ["Proper Patola", "Diljit Dosanjh"],
    ["Laembadgini", "Diljit Dosanjh"],
    ["Brown Munde", "AP Dhillon"],
    ["Excuses", "AP Dhillon"],
    ["With You", "AP Dhillon"],
    ["Summer High", "AP Dhillon"],
    ["Insane", "AP Dhillon"],
    ["Daku", "Inderpal Moga"],
    ["So High", "Sidhu Moose Wala"],
    ["295", "Sidhu Moose Wala"],
    ["The Last Ride", "Sidhu Moose Wala"],
    ["Same Beef", "Sidhu Moose Wala"],
    ["Legend", "Sidhu Moose Wala"],
    ["Elevated", "Shubh"],
    ["Cheques", "Shubh"],
    ["Baller", "Shubh"],
    ["One Love", "Shubh"],
    ["Softly", "Karan Aujla"],
    ["Tauba Tauba", "Karan Aujla"],
    ["Admirin' You", "Karan Aujla"],
    ["Players", "Badshah"],
    ["Lahore", "Guru Randhawa"],
    ["High Rated Gabru", "Guru Randhawa"],
    ["Suit Suit", "Guru Randhawa"],
    ["Made in India", "Guru Randhawa"],
    ["Ishare Tere", "Guru Randhawa"],
    ["Mundian To Bach Ke", "Panjabi MC"],
    ["Tunak Tunak Tun", "Daler Mehndi"],
    ["Bolo Ta Ra Ra", "Daler Mehndi"],
    ["Lak 28 Kudi Da", "Diljit Dosanjh"],
    ["Patiala Peg", "Diljit Dosanjh"],
    ["Qismat", "Ammy Virk"],
    ["Filhall", "B Praak"],
    ["Mann Bharrya", "B Praak"],
    ["Teeje Week", "Jordan Sandhu"],
    ["Kya Baat Ay", "Harrdy Sandhu"],
    ["Naah", "Harrdy Sandhu"],
    ["Backbone", "Harrdy Sandhu"],
    ["Ik Vaari Aa", "Arijit Singh"],
    ["Yaar Ni Milyaa", "Harrdy Sandhu"],
    ["Peaches", "Diljit Dosanjh"],
    ["Bachke Bachke", "Karan Aujla"],
    ["Jee Ni Lagda", "Karan Aujla"],
    ["Don't Look", "Karan Aujla"],
    ["Bad", "Karan Aujla"],
    ["Hass Hass", "Diljit Dosanjh"],
  ],
  english: [
    ["Blinding Lights", "The Weeknd"],
    ["Shape of You", "Ed Sheeran"],
    ["Perfect", "Ed Sheeran"],
    ["Someone Like You", "Adele"],
    ["Rolling in the Deep", "Adele"],
    ["Uptown Funk", "Mark Ronson"],
    ["Happy", "Pharrell Williams"],
    ["Bad Guy", "Billie Eilish"],
    ["Levitating", "Dua Lipa"],
    ["Don't Start Now", "Dua Lipa"],
    ["As It Was", "Harry Styles"],
    ["Watermelon Sugar", "Harry Styles"],
    ["Flowers", "Miley Cyrus"],
    ["Anti-Hero", "Taylor Swift"],
    ["Shake It Off", "Taylor Swift"],
    ["Blank Space", "Taylor Swift"],
    ["Love Story", "Taylor Swift"],
    ["Stay", "The Kid LAROI"],
    ["Peaches", "Justin Bieber"],
    ["Sorry", "Justin Bieber"],
    ["Baby", "Justin Bieber"],
    ["Despacito", "Luis Fonsi"],
    ["Closer", "The Chainsmokers"],
    ["Something Just Like This", "The Chainsmokers"],
    ["Faded", "Alan Walker"],
    ["Believer", "Imagine Dragons"],
    ["Thunder", "Imagine Dragons"],
    ["Counting Stars", "OneRepublic"],
    ["See You Again", "Wiz Khalifa"],
    ["Let Her Go", "Passenger"],
    ["Photograph", "Ed Sheeran"],
    ["Thinking Out Loud", "Ed Sheeran"],
    ["All of Me", "John Legend"],
    ["Stay With Me", "Sam Smith"],
    ["Starboy", "The Weeknd"],
    ["Save Your Tears", "The Weeknd"],
    ["Señorita", "Shawn Mendes"],
    ["Treat You Better", "Shawn Mendes"],
    ["Cheap Thrills", "Sia"],
    ["Chandelier", "Sia"],
    ["Titanium", "David Guetta"],
    ["Wake Me Up", "Avicii"],
    ["Rather Be", "Clean Bandit"],
    ["Firework", "Katy Perry"],
    ["Roar", "Katy Perry"],
    ["Umbrella", "Rihanna"],
    ["Diamonds", "Rihanna"],
    ["Single Ladies", "Beyoncé"],
    ["Halo", "Beyoncé"],
    ["Toxic", "Britney Spears"],
    ["Mr. Brightside", "The Killers"],
    ["Viva La Vida", "Coldplay"],
    ["Yellow", "Coldplay"],
    ["Fix You", "Coldplay"],
    ["Hymn for the Weekend", "Coldplay"],
    ["Cruel Summer", "Taylor Swift"],
    ["Espresso", "Sabrina Carpenter"],
    ["Die With A Smile", "Lady Gaga"],
    ["Poker Face", "Lady Gaga"],
    ["Shallow", "Lady Gaga"],
  ],
};
