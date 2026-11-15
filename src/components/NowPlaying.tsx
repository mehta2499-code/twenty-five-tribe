/**
 * "Listening now" UI: the Spotify player, the song picker sheet, and the
 * headphones + floating notes worn by a face at the Table.
 */
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, Headphones, Music, Search, X } from "lucide-react";
import { Sheet } from "@/components/SocialUI";
import { Glyph3D } from "@/components/Glyph3D";
import {
  cleanTitle,
  isListening,
  hoursLeft,
  mainArtist,
  searchSpotify,
  setNowPlaying,
  spotifyEmbed,
  type Track,
} from "@/lib/music";
import { useSocial, type NowPlaying, type Person } from "@/lib/social";
import { Avatar } from "@/components/Avatar";

/** Spotify's official compact player for one track. */
export function SpotifyPlayer({ id, title }: { id: string; title: string }) {
  return (
    <iframe
      title={`Spotify: ${title}`}
      src={spotifyEmbed(id)}
      width="100%"
      height={80}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      style={{ border: 0, borderRadius: 14, display: "block", background: "rgba(0,0,0,0.25)" }}
    />
  );
}

/** Album art (or a soft placeholder with headphones). */
function Art({ src, size }: { src: string | null; size: number }) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="shrink-0 object-cover"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        boxShadow: "0 6px 14px rgba(0,0,0,0.45)",
      }}
    />
  ) : (
    <span
      className="shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.22, background: "var(--fill)" }}
    >
      <Music size={Math.round(size * 0.42)} style={{ color: "var(--ink-3)" }} aria-hidden="true" />
    </span>
  );
}

/** The song: art, clean name, artist, time left, and Spotify's player. */
export function NowPlayingCard({
  np,
  who,
  bare = false,
}: {
  np: NowPlaying;
  who?: string;
  /** No card frame (inside a sheet). */
  bare?: boolean;
}) {
  const left = hoursLeft({ np });
  return (
    <div className={bare ? "text-left" : "card p-3.5 text-left"}>
      <div className="flex items-center gap-3">
        <Art src={np.image} size={56} />
        <span className="flex-1 min-w-0">
          <span
            className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase"
            style={{ color: "var(--lime)", letterSpacing: "0.08em" }}
          >
            <Headphones size={13} aria-hidden="true" />
            {who ? `${who} is listening` : "Listening now"}
          </span>
          <span className="block font-bold text-[16px] truncate mt-0.5">
            {cleanTitle(np.title)}
          </span>
          <span className="block meta truncate">
            {mainArtist(np.artist)}
            {left ? ` · ${left}h left` : ""}
          </span>
        </span>
      </div>
      <div className="mt-3">
        <SpotifyPlayer id={np.id} title={np.title} />
      </div>
      <a
        href={`https://open.spotify.com/track/${np.id}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 meta text-[12.5px]"
      >
        <SpotifyDot /> Open in Spotify <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}

/** A small Spotify-green dot, for attribution. */
function SpotifyDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ background: "#1DB954", boxShadow: "0 0 6px rgba(29,185,84,0.6)" }}
    />
  );
}

// ---------- New songs badge (no push notifications) ----------
const SEEN_KEY = "tf.music.seen";
const seenAt = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0);
  } catch {
    return 0;
  }
};
/** Songs your 25 shared since you last opened Listening now. */
export function useNewSongs() {
  const s = useSocial();
  const since = seenAt();
  return s.people.filter((p) => isListening(p) && p.np!.at > since).length;
}
function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Listening now: what everyone in your 25 is playing (tap to play it here),
 * your own song, and search to share a new one for 24 hours.
 */
export function NowPlayingPicker({
  onClose,
  start = "list",
}: {
  onClose: () => void;
  /** Open on everyone's songs, or straight on search. */
  start?: "list" | "search";
}) {
  const s = useSocial();
  const [view, setView] = useState<"list" | "search">(start);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [fresh] = useState(seenAt);
  useEffect(() => markSeen(), []);

  useEffect(() => {
    setErr(null);
    if (q.trim().length < 2) {
      setList(null);
      return;
    }
    const t = setTimeout(() => {
      searchSpotify(q.trim()).then(setList, (e) => {
        setList([]);
        setErr((e as Error).message);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (t: Track | null) => {
    setBusy(t?.id ?? "stop");
    try {
      await setNowPlaying(t);
      setQ("");
      setView("list");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const mine = s.me?.np;
  const friends: Person[] = s.people
    .filter((p) => isListening(p))
    .sort((a, b) => b.np!.at - a.np!.at);

  if (view === "search")
    return (
      <Sheet title="Share a song" onClose={onClose} center>
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-1.5 meta -mt-1 mb-2"
          style={{ fontSize: 13.5 }}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Listening now
        </button>
        <label className="field" htmlFor="np-search">
          <Search size={18} className="text-faint shrink-0" aria-hidden="true" />
          <input
            id="np-search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a song or artist"
            autoComplete="off"
            enterKeyHint="search"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="text-faint"
            >
              <X size={16} />
            </button>
          )}
        </label>
        <div className="mt-2 max-h-[42dvh] overflow-y-auto -mx-1 px-1" data-noswipe>
          {err && <p className="meta text-center mt-6">{err}</p>}
          {!err && list === null && (
            <p className="meta text-center mt-6 mb-2">
              Find a song to share. It stays on your face at the Table for 24 hours.
            </p>
          )}
          {!err && list?.length === 0 && <p className="meta text-center mt-6">No songs found.</p>}
          <ul className="grid gap-1">
            {(list ?? []).map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => void pick(t)}
                  disabled={!!busy}
                  className="menu-row w-full flex items-center gap-3 rounded-[16px] p-2 text-left"
                >
                  <Art src={t.image} size={46} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{cleanTitle(t.name)}</span>
                    <span className="block meta truncate">{mainArtist(t.artists)}</span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold"
                    style={{
                      background: "rgba(193,239,98,0.16)",
                      color: "var(--lime)",
                      border: "1px solid rgba(193,239,98,0.35)",
                    }}
                  >
                    {busy === t.id ? "…" : mine?.id === t.id ? "Sharing" : "Share"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p
          className="meta text-center mt-3 flex items-center justify-center gap-1.5"
          style={{ fontSize: 11.5 }}
        >
          <SpotifyDot /> Songs from Spotify
        </p>
      </Sheet>
    );

  return (
    <Sheet title="Listening now" onClose={onClose} center>
      <div className="max-h-[62dvh] overflow-y-auto -mx-1 px-1" data-noswipe>
        {/* You */}
        {mine ? (
          <div className="card p-3 flex items-center gap-3">
            <Art src={mine.image} size={48} />
            <span className="flex-1 min-w-0">
              <span
                className="block text-[11px] font-bold uppercase"
                style={{ color: "var(--lime)", letterSpacing: "0.08em" }}
              >
                You · {hoursLeft({ np: mine })}h left
              </span>
              <span className="block font-semibold truncate">{cleanTitle(mine.title)}</span>
              <span className="block meta truncate">{mainArtist(mine.artist)}</span>
            </span>
            <span className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => setView("search")}
                className="btn-secondary px-3 min-h-[32px] text-[12.5px]"
              >
                Change
              </button>
              <button
                onClick={() => void pick(null)}
                disabled={!!busy}
                className="btn-quiet px-3 min-h-[28px] text-[12.5px]"
              >
                Stop
              </button>
            </span>
          </div>
        ) : (
          <button onClick={() => setView("search")} className="btn-primary w-full">
            <Search size={17} aria-hidden="true" /> Share what you're listening to
          </button>
        )}

        {/* Your 25 */}
        <p
          className="text-[11.5px] font-bold uppercase mt-5 mb-2"
          style={{ color: "var(--ink-3)", letterSpacing: "0.08em" }}
        >
          Your 25 · {friends.length} listening
        </p>
        {friends.length === 0 ? (
          <p className="meta py-4 text-center">Nobody's sharing a song right now.</p>
        ) : (
          <ul className="grid gap-1.5">
            {friends.map((f) => {
              const np = f.np!;
              const open = playing === f.id;
              const isNew = np.at > fresh;
              return (
                <li
                  key={f.id}
                  className="rounded-[18px] overflow-hidden"
                  style={{ background: open ? "var(--fill)" : undefined }}
                >
                  <button
                    onClick={() => setPlaying(open ? null : f.id)}
                    aria-expanded={open}
                    aria-label={`${f.name} is listening to ${cleanTitle(np.title)}. ${open ? "Hide player" : "Play"}`}
                    className="menu-row w-full flex items-center gap-3 p-2 text-left rounded-[18px]"
                  >
                    <span className="relative shrink-0">
                      <Art src={np.image} size={46} />
                      <span className="absolute -bottom-1 -right-1">
                        <Avatar src={f.avatar} initials={f.initials} color={f.color} size={22} />
                      </span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 meta" style={{ fontSize: 12 }}>
                        {f.name.split(" ")[0]}
                        {isNew && (
                          <span
                            className="rounded-full px-1.5 font-bold"
                            style={{
                              background: "var(--lime)",
                              color: "var(--on-accent)",
                              fontSize: 10,
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </span>
                      <span className="block font-semibold truncate">{cleanTitle(np.title)}</span>
                      <span className="block meta truncate">{mainArtist(np.artist)}</span>
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 transition-transform"
                      style={{
                        color: "var(--ink-3)",
                        transform: open ? "rotate(180deg)" : undefined,
                      }}
                    />
                  </button>
                  {open && (
                    <div className="px-2 pb-2">
                      <SpotifyPlayer id={np.id} title={np.title} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p
        className="meta text-center mt-3 flex items-center justify-center gap-1.5"
        style={{ fontSize: 11.5 }}
      >
        <SpotifyDot /> Songs from Spotify
      </p>
    </Sheet>
  );
}

/** Headphones on a face, with little notes floating out (Table). */
export function ListeningBadge({ size }: { size: number }) {
  const w = Math.round(size * 1.3);
  return (
    <span
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{ inset: 0, zIndex: 2 }}
    >
      <span
        className="absolute"
        style={{
          left: "50%",
          top: -size * 0.36,
          transform: "translateX(-50%)",
          lineHeight: 0,
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
        }}
      >
        <Glyph3D name="headphones" size={w} animate fps={2} />
      </span>
      {[0, 1].map((k) => (
        <span
          key={k}
          className="absolute"
          style={{
            right: -size * 0.32 - k * 5,
            top: -size * 0.12,
            lineHeight: 0,
            animation: `note-float 2.4s ease-out ${k * 1.2}s infinite both`,
          }}
        >
          <Glyph3D name="notes" size={Math.round(size * 0.72)} animate fps={3} />
        </span>
      ))}
    </span>
  );
}
