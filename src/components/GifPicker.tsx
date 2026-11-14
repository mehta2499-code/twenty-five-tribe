/**
 * GIFs and stickers for chats: the picker sheet, the message bubble, and
 * sending to a friend or a group.
 */
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "@/components/SocialUI";
import { supabase } from "@/integrations/supabase/client";
import { STICKERS, parseRich, type Sticker } from "@/lib/stickers";
import { _get, _set } from "@/lib/social";
import { uuid } from "@/lib/uuid";

type Gif = { id: string; url: string; w: number; h: number };

async function searchGifs(q: string): Promise<Gif[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(`/api/gif?q=${encodeURIComponent(q)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await r.json().catch(() => null)) as Gif[] | { error?: string } | null;
  if (!r.ok || !Array.isArray(body))
    throw new Error(
      (body as { error?: string } | null)?.error ?? "GIFs aren't available right now.",
    );
  return body;
}

export function StickerArt({ sticker, size = 1 }: { sticker: Sticker; size?: number }) {
  return (
    <span
      className="inline-block font-extrabold whitespace-nowrap select-none"
      style={{
        background: sticker.bg,
        color: sticker.fg ?? "var(--on-dark-fill, #0B0A0F)",
        border: "var(--bd)",
        boxShadow: "var(--pop)",
        borderRadius: 16 * size,
        padding: `${6 * size}px ${12 * size}px`,
        fontSize: 18 * size,
        transform: `rotate(${sticker.tilt}deg)`,
      }}
    >
      {sticker.text}
    </span>
  );
}

/** Draws a gif:/sticker: message. Returns null for anything else. */
export function RichBubble({ value }: { value?: string | null }) {
  const r = parseRich(value);
  if (!r) return null;
  if (r.kind === "sticker")
    return (
      <span className="inline-block py-2 px-1">
        <StickerArt sticker={r.sticker} size={1.25} />
      </span>
    );
  return (
    <img
      src={r.url}
      alt="GIF"
      loading="lazy"
      decoding="async"
      className="rounded-xl w-56 max-w-full"
      style={{ background: "var(--fill)" }}
    />
  );
}

export const isRich = (ref?: string | null) => !!parseRich(ref);
export const richLabel = (ref?: string | null) =>
  ref?.startsWith("gif:") ? "GIF" : ref?.startsWith("sticker:") ? "Sticker" : null;

/** Send a GIF or sticker to a friend. */
export async function sendRichToFriend(friendId: string, ref: string) {
  const s = _get();
  const id = uuid();
  _set((st) => ({
    ...st,
    chats: {
      ...st.chats,
      [friendId]: [
        ...(st.chats[friendId] ?? []),
        { id, from: "me", sharedPostId: ref, at: Date.now(), status: "sent" },
      ],
    },
  }));
  if (s.mode !== "live" || !s.me) return;
  const { error } = await supabase
    .from("messages")
    .insert({ id, sender: s.me.id, recipient: friendId, body: null, shared_ref: ref });
  if (error) throw new Error(error.message);
}

export function GifPicker({
  onPick,
  onClose,
}: {
  /** Gets "gif:<url>" or "sticker:<id>". */
  onPick: (ref: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"gifs" | "stickers">("gifs");
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "gifs") return;
    setError(null);
    const t = setTimeout(
      () => {
        searchGifs(q).then(setGifs, (e) => {
          setGifs([]);
          setError((e as Error).message);
        });
      },
      q ? 350 : 0,
    );
    return () => clearTimeout(t);
  }, [q, tab]);

  return (
    <Sheet title="Send something" onClose={onClose}>
      <div className="segmented w-full" role="tablist" aria-label="GIFs or stickers">
        <button
          className="flex-1"
          role="tab"
          aria-pressed={tab === "gifs"}
          onClick={() => setTab("gifs")}
        >
          GIFs
        </button>
        <button
          className="flex-1"
          role="tab"
          aria-pressed={tab === "stickers"}
          onClick={() => setTab("stickers")}
        >
          Stickers
        </button>
      </div>

      {tab === "gifs" ? (
        <>
          <label className="field mt-3" htmlFor="gif-search">
            <Search size={18} className="text-faint shrink-0" aria-hidden="true" />
            <input
              id="gif-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search GIFs"
              autoComplete="off"
            />
          </label>
          <div className="mt-3 h-[46vh] overflow-y-auto" data-noswipe>
            {error ? (
              <p className="meta text-center mt-8">{error}</p>
            ) : gifs === null ? (
              <p className="meta text-center mt-8">Loading…</p>
            ) : gifs.length === 0 ? (
              <p className="meta text-center mt-8">No GIFs for that. Try another word.</p>
            ) : (
              <div className="columns-2 gap-2">
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => onPick(`gif:${g.url}`)}
                    className="block w-full mb-2 rounded-xl overflow-hidden"
                    style={{ aspectRatio: `${g.w} / ${g.h}`, background: "var(--fill)" }}
                    aria-label="Send this GIF"
                  >
                    <img
                      src={g.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="meta text-center mt-2" style={{ fontSize: 11 }}>
            Powered by GIPHY
          </p>
        </>
      ) : (
        <div className="mt-4 h-[50vh] overflow-y-auto grid grid-cols-2 gap-x-3 gap-y-5 place-items-center content-start py-2">
          {STICKERS.map((s) => (
            <button key={s.id} onClick={() => onPick(`sticker:${s.id}`)} aria-label={s.text}>
              <StickerArt sticker={s} />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
