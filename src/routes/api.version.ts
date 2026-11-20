import { createFileRoute } from "@tanstack/react-router";

/** Which build the server is running, so phones on an older copy reload. */
export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ build: __BUILD_ID__ }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        }),
    },
  },
});
