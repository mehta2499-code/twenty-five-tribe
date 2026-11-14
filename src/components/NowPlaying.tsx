/**
 * "Listening now" UI: the Spotify player, the song picker sheet, and the
 * headphones + floating notes worn by a face at the Table.
 */
import { useEffect, useState } from "react";
import { Headphones, Search, X } from "lucide-react";
import { Sheet } from "@/components/SocialUI";
import { Glyph3D } from "@/components/Glyph3D";
import { searchSpotify, setNowPlaying, spotifyEmbed, type Track } from "@/lib/music";
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

/** A small card: "Listening now" + song + player. */
export function NowPlayingCard({ np, who }: { np: NowPlaying; who?: string }) {
  return (
    <div className="card p-3 text-left">
      <p className="label-caps flex items-center gap-1.5" style={{ color: "var(--lime)" }}>
        <Headphones size={14} aria-hidden="true" />{" "}
        {who ? `${who} is listening to` : "Listening now"}
      </p>
      <div className="mt-2">
        <SpotifyPlayer id={np.id} title={np.title} />
      </div>
    </div>
  );
}

/** Search Spotify and share a song with your 25 for 24 hours. */
export function NowPlayingPicker({ onClose }: { onClose: () => void }) {
  const s = useSocial();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await setNowPlaying(t);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Listening now" onClose={onClose} center>
      <p className="meta">Pick a song. Your 25 see it (and can play it) for 24 hours.</p>
      {s.me?.np && (
        <div className="mt-3 flex items-center gap-3 card p-2.5">
          {s.me.np.image && (
            <img src={s.me.np.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
          )}
          <span className="flex-1 min-w-0">
            <span className="block font-semibold truncate">{s.me.np.title}</span>
            <span className="block meta truncate">{s.me.np.artist}</span>
          </span>
          <button
            onClick={() => void pick(null)}
            disabled={busy}
            className="btn-secondary px-3 min-h-[36px] text-[13px]"
          >
            <X size={14} aria-hidden="true" /> Stop
          </button>
        </div>
      )}
      <label className="field mt-3" htmlFor="np-search">
        <Search size={18} className="text-faint shrink-0" aria-hidden="true" />
        <input
          id="np-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a song or artist"
          autoComplete="off"
          autoFocus
        />
      </label>
      <div className="mt-2 max-h-[40dvh] overflow-y-auto" data-noswipe>
        {err && <p className="meta text-center mt-6">{err}</p>}
        {!err && list === null && (
          <p className="meta text-center mt-6 flex items-center justify-center gap-2">
            <Glyph3D name="headphones" size={22} /> What's on repeat today?
          </p>
        )}
        {!err && list?.length === 0 && <p className="meta text-center mt-6">No songs found.</p>}
        <ul className="grid gap-1">
          {(list ?? []).map((t) => (
            <li key={t.id}>
              <button
                onClick={() => void pick(t)}
                disabled={busy}
                className="menu-row w-full flex items-center gap-3 rounded-[14px] p-2 text-left"
              >
                {t.image ? (
                  <img
                    src={t.image}
                    alt=""
                    loading="lazy"
                    className="w-11 h-11 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <span
                    className="w-11 h-11 rounded-lg shrink-0"
                    style={{ background: "var(--fill)" }}
                  />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{t.name}</span>
                  <span className="block meta truncate">{t.artists}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="meta text-center mt-2" style={{ fontSize: 11 }}>
        Songs from Spotify
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
