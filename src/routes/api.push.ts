/**
 * /api/push — the database posts here to deliver push notifications.
 *
 * GET  → the public push key, so phones can subscribe.
 * POST → { subs, title, body, url, tag } from the database (checked with the
 *        shared secret). Sends to each device; reports dead ones back.
 *
 * Keys live in the server's environment (set up by deploy-on-server.sh):
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET, VAPID_SUBJECT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

type Sub = { endpoint: string; p256dh: string; auth: string };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/push")({
  server: {
    handlers: {
      GET: async () => json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }),

      POST: async ({ request }) => {
        const secret = process.env.PUSH_SECRET;
        const pub = process.env.VAPID_PUBLIC_KEY;
        const priv = process.env.VAPID_PRIVATE_KEY;
        if (!secret || !pub || !priv) return json({ error: "push not configured" }, 503);
        if (request.headers.get("x-push-secret") !== secret)
          return json({ error: "forbidden" }, 403);

        const msg = (await request.json()) as {
          subs: Sub[];
          title?: string;
          body?: string;
          url?: string;
          tag?: string;
        };
        const webpush = (await import("web-push")).default;
        webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@example.com", pub, priv);
        const payload = JSON.stringify({
          title: msg.title || "25",
          body: msg.body || "",
          url: msg.url || "/app/home",
          tag: msg.tag,
        });

        const dead: string[] = [];
        await Promise.all(
          (msg.subs ?? []).map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 60 * 60 * 6, urgency: "high" },
              );
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) dead.push(s.endpoint);
            }
          }),
        );

        if (dead.length) {
          // Forget devices that unsubscribed or uninstalled.
          await fetch(`${SUPABASE_URL}/rest/v1/rpc/remove_dead_push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ p_secret: secret, p_endpoints: dead }),
          }).catch(() => undefined);
        }
        return json({ sent: (msg.subs ?? []).length - dead.length, dead: dead.length });
      },
    },
  },
});
