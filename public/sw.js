/* 25 — service worker: shows push notifications and opens the right screen. */
const ASSETS = "25-assets-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      // Drop old asset caches from earlier versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("25-assets-") && k !== ASSETS).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  ),
);

// Built files have a content hash in their name, so they never change:
// serve them from the phone after the first load (fast app start).
// Pages and data always come from the network, so updates show immediately.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const cacheable =
    url.pathname.startsWith("/assets/") ||
    /^\/(icon-\d+|apple-touch-icon)\.png$/.test(url.pathname) ||
    url.pathname === "/words5.txt";
  if (!cacheable) return;
  event.respondWith(
    caches.open(ASSETS).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "25", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "25", {
      body: data.body || "",
      icon: "/apple-touch-icon.png",
      badge: "/apple-touch-icon.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/app/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
