/**
 * "Listening now": search Spotify, share a song with your 25 for 24 hours.
 * Search goes through our server (/api/spotify) so the Spotify keys stay private.
 */
import { supabase } from "@/integrations/supabase/client";
import { _get, _set, type NowPlaying, type Person } from "@/lib/social";

export type Track = {
  id: string;
  name: string;
  artists: string;
  album: string;
  image: string | null;
};

export const NP_HOURS = 24;

export function isListening(p?: { np?: NowPlaying } | null) {
  return !!p?.np && Date.now() - p.np.at < NP_HOURS * 3600_000;
}

export async function searchSpotify(q: string): Promise<Track[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(`/api/spotify?q=${encodeURIComponent(q)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await r.json().catch(() => null)) as Track[] | { error?: string } | null;
  if (!r.ok || !Array.isArray(body))
    throw new Error((body as { error?: string } | null)?.error ?? "Song search isn't available.");
  return body;
}

/** Share a song for 24h (or stop sharing with null). */
export async function setNowPlaying(t: Track | null) {
  const s = _get();
  if (!s.me) throw new Error("Sign in first.");
  const np: NowPlaying | undefined = t
    ? { id: t.id, title: t.name, artist: t.artists, image: t.image, at: Date.now() }
    : undefined;
  _set((st) => (st.me ? { ...st, me: { ...st.me, np } } : st));
  if (s.mode !== "live") return;
  const { error } = await supabase
    .from("profiles")
    .update({
      np_track_id: t?.id ?? null,
      np_title: t?.name ?? null,
      np_artist: t?.artists ?? null,
      np_image: t?.image ?? null,
      np_at: t ? new Date().toISOString() : null,
    } as never)
    .eq("id", s.me.id);
  if (error) throw new Error(error.message);
}

export const spotifyEmbed = (id: string) =>
  `https://open.spotify.com/embed/track/${encodeURIComponent(id)}?utm_source=generator&theme=0`;

export const hoursLeft = (p: Person | { np?: NowPlaying }) =>
  p.np ? Math.max(1, Math.ceil(NP_HOURS - (Date.now() - p.np.at) / 3600_000)) : 0;
