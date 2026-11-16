/**
 * /api/song-audio?u=<preview url> — plays a song preview through our server.
 * Only Deezer / Apple preview hosts. Passes Range requests through, which
 * iPhones need to play audio.
 */
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED =
  /^https:\/\/(cdn[a-z0-9-]*-preview(-[a-z0-9]+)?\.dzcdn\.net|audio-ssl\.itunes\.apple\.com)\//;

export const Route = createFileRoute("/api/song-audio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("u") ?? "";
        if (!ALLOWED.test(target)) return new Response("Not allowed", { status: 400 });
        const headers: Record<string, string> = {};
        const range = request.headers.get("range");
        if (range) headers.Range = range;
        const r = await fetch(target, { headers });
        if (!r.ok && r.status !== 206) return new Response("Not found", { status: 404 });
        const out = new Headers();
        for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const v = r.headers.get(h);
          if (v) out.set(h, v);
        }
        if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");
        out.set("Cache-Control", "private, max-age=3600");
        return new Response(r.body, { status: r.status, headers: out });
      },
    },
  },
});
