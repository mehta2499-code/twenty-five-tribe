import { createFileRoute } from "@tanstack/react-router";

/** The server's clock, so live games change songs at the same moment on every phone. */
export const Route = createFileRoute("/api/now")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ now: Date.now() }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        }),
    },
  },
});
