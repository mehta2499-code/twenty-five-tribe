/**
 * /api/gif?q=… — GIF search for chats, powered by GIPHY.
 *
 * The GIPHY key stays on the server (GIPHY_API_KEY in /etc/twentyfive/app.env).
 * Only signed-in people can search. Empty q → trending.
 * Returns only what the picker needs: [{ id, url, w, h }].
 */
import { createFileRoute } from "@tanstack/react-router";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

type Gif = { id: string; url: string; w: number; h: number };

const json = (data: unknown, status = 200, cache = "private, max-age=300") =>
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

let trending: { at: number; gifs: Gif[] } | null = null;

export const Route = createFileRoute("/api/gif")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.GIPHY_API_KEY;
        if (!key) return json({ error: "GIFs aren't set up yet." }, 503, "no-store");
        if (!(await signedIn(request))) return json({ error: "Sign in first." }, 401, "no-store");

        const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 50);
        if (!q && trending && Date.now() - trending.at < 10 * 60_000) return json(trending.gifs);

        const api = new URL(
          q ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending",
        );
        api.searchParams.set("api_key", key);
        api.searchParams.set("limit", "30");
        api.searchParams.set("rating", "pg-13");
        if (q) api.searchParams.set("q", q);
        try {
          const r = await fetch(api);
          if (!r.ok) return json({ error: "GIF search is busy. Try again." }, 502, "no-store");
          const body = (await r.json()) as {
            data?: {
              id: string;
              images?: {
                fixed_width?: { url?: string; webp?: string; width?: string; height?: string };
              };
            }[];
          };
          const gifs: Gif[] = (body.data ?? [])
            .map((g) => {
              const im = g.images?.fixed_width;
              const url = im?.webp || im?.url || "";
              return { id: g.id, url, w: Number(im?.width) || 200, h: Number(im?.height) || 200 };
            })
            .filter((g) => /^https:\/\/media\d*\.giphy\.com\//.test(g.url));
          if (!q) trending = { at: Date.now(), gifs };
          return json(gifs);
        } catch {
          return json({ error: "GIF search is busy. Try again." }, 502, "no-store");
        }
      },
    },
  },
});
