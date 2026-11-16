/**
 * Name That Tune: name the song from a tiny clip. Each skip (or wrong guess) plays a
 * longer clip. Bollywood, Punjabi or English; popular songs only (the server
 * builds big pools from Deezer's hit playlists; the lists here are a backup).
 */
import { supabase } from "@/integrations/supabase/client";

export type EarCat = "bollywood" | "punjabi" | "english";
export type EarLevel = "easy" | "medium" | "hard";
export type EarSong = { id: string; title: string; artist: string };
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
  results: Record<string, EarResult>;
};

export const CATS: { id: EarCat; name: string; emoji: string; tone: string }[] = [
  { id: "bollywood", name: "Bollywood", emoji: "🎬", tone: "#F2507B" },
  { id: "punjabi", name: "Punjabi", emoji: "🥁", tone: "#F2A93B" },
  { id: "english", name: "English", emoji: "🎧", tone: "#5B8CFF" },
];

/** Clip lengths (seconds) for each try, by difficulty. */
export const STAGES: Record<EarLevel, number[]> = {
  easy: [1, 2, 4, 7, 11, 16],
  medium: [0.5, 1, 2, 4, 8, 15],
  hard: [0.1, 0.5, 1, 2, 4, 8],
};
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

/** The big list for a category (falls back to the backup list). */
const poolCache = new Map<EarCat, EarSong[]>();
export async function loadPool(cat: EarCat): Promise<EarSong[]> {
  const hit = poolCache.get(cat);
  if (hit) return hit;
  try {
    const r = await fetch(`/api/song?pool=${cat}`, {
      headers: await authHeader(),
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const songs = (await r.json()) as EarSong[];
      if (songs.length >= 50) {
        poolCache.set(cat, songs);
        return songs;
      }
    }
  } catch {
    // backup below
  }
  const backup = BACKUP[cat].map(([title, artist]) => ({
    id: `q:${title}|${artist}`,
    title,
    artist,
  }));
  // The big list isn't ready yet: play from the backup now (and ask again next game).
  return backup;
}

/** Pick songs for a game, avoiding ones you've had recently on this phone. */
export function pickSongs(pool: EarSong[], n = SONGS_PER_GAME): EarSong[] {
  let recent: string[] = [];
  try {
    recent = JSON.parse(localStorage.getItem("tf.earworm.recent") ?? "[]");
  } catch {
    // ignore
  }
  const fresh = pool.filter((s) => !recent.includes(s.id));
  const from = fresh.length >= n * 2 ? fresh : pool;
  const out: EarSong[] = [];
  const used = new Set<string>();
  while (out.length < n && used.size < from.length) {
    const s = from[Math.floor(Math.random() * from.length)];
    if (used.has(s.id)) continue;
    used.add(s.id);
    out.push(s);
  }
  try {
    localStorage.setItem(
      "tf.earworm.recent",
      JSON.stringify([...out.map((s) => s.id), ...recent].slice(0, 150)),
    );
  } catch {
    // ignore
  }
  return out;
}

export type Preview = {
  url: string;
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
      signal: AbortSignal.timeout(8000),
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
