/**
 * /api/spotify?q=… — song search for "Listening now", via Spotify's Web API.
 *
 * Uses Spotify's app-only login (client credentials): no Spotify account needed
 * for people using 25. Keys stay on the server (SPOTIFY_CLIENT_ID /
 * SPOTIFY_CLIENT_SECRET in /etc/twentyfive/app.env). Only signed-in people can
 * search. Returns only what the picker needs.
 */
import { createFileRoute } from "@tanstack/react-router";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string;
  album: string;
  image: string | null;
};

const json = (data: unknown, status = 200, cache = "private, max-age=600") =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cache },
  });

// Who's signed in: checked against Supabase, cached for a few minutes per token.
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

/** Keys from the environment, or straight from /etc/twentyfive/app.env as a backup. */
let fileKeys: { at: number; id: string | null; secret: string | null } | null = null;
async function keys() {
  const envId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const envSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (envId && envSecret) return { id: envId, secret: envSecret };
  if (!fileKeys || Date.now() - fileKeys.at > 60_000) {
    let id: string | null = null;
    let secret: string | null = null;
    try {
      const { readFile } = await import("node:fs/promises");
      const text = await readFile("/etc/twentyfive/app.env", "utf8");
      const read = (k: string) =>
        new RegExp(`^\\s*(?:export\\s+)?${k}\\s*=\\s*["']?([^"'\\s#]+)`, "m").exec(text)?.[1] ??
        null;
      id = read("SPOTIFY_CLIENT_ID");
      secret = read("SPOTIFY_CLIENT_SECRET");
    } catch {
      // no file
    }
    fileKeys = { at: Date.now(), id, secret };
  }
  return fileKeys.id && fileKeys.secret ? { id: fileKeys.id, secret: fileKeys.secret } : null;
}

// Spotify app token, reused until it expires (about an hour).
let appToken: { value: string; until: number } | null = null;
async function spotifyToken(id: string, secret: string) {
  if (appToken && appToken.until > Date.now() + 30_000) return appToken.value;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    console.error("[spotify] token request failed", r.status, detail.slice(0, 300));
    throw new Error(
      r.status === 400 || r.status === 401
        ? "Spotify didn't accept the keys. Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET."
        : `Spotify login failed (${r.status}).`,
    );
  }
  const body = (await r.json()) as { access_token: string; expires_in: number };
  appToken = { value: body.access_token, until: Date.now() + body.expires_in * 1000 };
  return appToken.value;
}

const cache = new Map<string, { at: number; tracks: SpotifyTrack[] }>();

export const Route = createFileRoute("/api/spotify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const k = await keys();
        if (!k) return json({ error: "Music isn't set up yet." }, 503, "no-store");
        if (!(await signedIn(request))) return json({ error: "Sign in first." }, 401, "no-store");
        const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
        if (q.length < 2) return json([]);
        const hit = cache.get(q.toLowerCase());
        if (hit && Date.now() - hit.at < 10 * 60_000) return json(hit.tracks);
        try {
          const token = await spotifyToken(k.id, k.secret);
          const url = new URL("https://api.spotify.com/v1/search");
          url.searchParams.set("q", q);
          url.searchParams.set("type", "track");
          url.searchParams.set("limit", "10");
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (r.status === 401) appToken = null;
          if (!r.ok) {
            const detail = await r.text().catch(() => "");
            console.error("[spotify] search failed", r.status, detail.slice(0, 300));
            const msg =
              r.status === 429
                ? "Too many searches right now. Try again in a minute."
                : r.status === 403
                  ? "Spotify blocked search for this app. Check the app's settings on developer.spotify.com."
                  : `Spotify search failed (${r.status}).`;
            return json({ error: msg }, 502, "no-store");
          }
          const body = (await r.json()) as {
            tracks?: {
              items?: {
                id: string;
                name: string;
                artists?: { name: string }[];
                album?: { name: string; images?: { url: string; width: number }[] };
              }[];
            };
          };
          const tracks: SpotifyTrack[] = (body.tracks?.items ?? []).map((t) => {
            const imgs = (t.album?.images ?? []).slice().sort((a, b) => a.width - b.width);
            const img = imgs.find((i) => i.width >= 64) ?? imgs[0];
            return {
              id: t.id,
              name: t.name.slice(0, 120),
              artists: (t.artists ?? [])
                .map((a) => a.name)
                .join(", ")
                .slice(0, 120),
              album: t.album?.name ?? "",
              image:
                img && /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/.test(img.url)
                  ? img.url
                  : null,
            };
          });
          if (cache.size > 500) cache.clear();
          cache.set(q.toLowerCase(), { at: Date.now(), tracks });
          return json(tracks);
        } catch (e) {
          console.error("[spotify]", e);
          const msg = e instanceof Error && e.message ? e.message : "Couldn't reach Spotify.";
          return json({ error: msg }, 502, "no-store");
        }
      },
    },
  },
});
