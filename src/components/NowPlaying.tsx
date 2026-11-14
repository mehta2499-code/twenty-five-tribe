/**
 * "Listening now" UI: the Spotify player, the song picker sheet, and the
 * headphones + floating notes worn by a face at the Table.
 */
import { useEffect, useState } from "react";
import { ExternalLink, Headphones, Search, X } from "lucide-react";
import { Sheet } from "@/components/SocialUI";
import { Glyph3D } from "@/components/Glyph3D";
import {
  cleanTitle,
  hoursLeft,
  mainArtist,
  searchSpotify,
  setNowPlaying,
  spotifyEmbed,
  type Track,
} from "@/lib/music";
import { useSocial, type NowPlaying } from "@/lib/social";

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
      <Glyph3D name="headphones" size={Math.round(size * 0.7)} />
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

/** Search Spotify and share a song with your 25 for 24 hours. */
export function NowPlayingPicker({ onClose }: { onClose: () => void }) {
  const s = useSocial();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const mine = s.me?.np;
  return (
    <Sheet title="Listening now" onClose={onClose} center>
      {mine ? (
        <div className="card p-3 flex items-center gap-3">
          <Art src={mine.image} size={48} />
          <span className="flex-1 min-w-0">
            <span
              className="block text-[11px] font-bold uppercase"
              style={{ color: "var(--lime)", letterSpacing: "0.08em" }}
            >
              Sharing now · {hoursLeft({ np: mine })}h left
            </span>
            <span className="block font-semibold truncate">{cleanTitle(mine.title)}</span>
            <span className="block meta truncate">{mainArtist(mine.artist)}</span>
          </span>
          <button
            onClick={() => void pick(null)}
            disabled={!!busy}
            className="btn-secondary px-3 min-h-[34px] text-[13px]"
          >
            <X size={14} aria-hidden="true" /> Stop
          </button>
        </div>
      ) : (
        <p className="meta">
          Share a song with your 25. It shows on your face at the Table for 24 hours.
        </p>
      )}
      <label className="field mt-3" htmlFor="np-search">
        <Search size={18} className="text-faint shrink-0" aria-hidden="true" />
        <input
          id="np-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={mine ? "Change song…" : "Search a song or artist"}
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
      <div className="mt-2 max-h-[40dvh] overflow-y-auto -mx-1 px-1" data-noswipe>
        {err && <p className="meta text-center mt-6">{err}</p>}
        {!err && list === null && (
          <div className="flex flex-col items-center text-center mt-6 mb-2">
            <Glyph3D name="headphones" size={56} animate fps={2} />
            <p className="meta mt-2">What's on repeat today?</p>
          </div>
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
