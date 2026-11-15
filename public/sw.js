/* 25 — service worker: shows push notifications and opens the right screen. */
const ASSETS = "25-assets-v3";
// Photos from Supabase storage, kept on the phone (see below).
const PHOTOS = "25-photos-v1";
const PHOTO_LIMIT = 800;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      // Drop old asset caches from earlier versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => (k.startsWith("25-assets-") && k !== ASSETS) || (k.startsWith("25-photos-") && k !== PHOTOS))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);

// Built files have a content hash in their name, so they never change:
// serve them from the phone after the first load (fast app start).
// Pages and data always come from the network, so updates show immediately.
// Photos and voice notes in Supabase storage. Every file has a unique name and
// never changes, but the app gets a freshly signed link for it on each open
// (?token=...). Without this, the phone downloads every photo again each time,
// which is what used up the Supabase egress quota. Here the file is kept by
// its path (ignoring the token), so it's downloaded once.
// Not cached: Blinks (they must vanish), videos (streamed in ranges).
const STORAGE_PHOTO = /\/storage\/v1\/object\/sign\/(media|avatars)\//;
async function photo(req, url) {
  const key = url.origin + url.pathname;
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
  const type = res.headers.get("content-type") || "";
  if (res.ok && res.status === 200 && /^(image|audio)\//.test(type)) {
    await cache.put(key, res.clone());
    // Keep the cache to a sensible size: drop the oldest photos.
    const keys = await cache.keys();
    if (keys.length > PHOTO_LIMIT)
      await Promise.all(keys.slice(0, keys.length - PHOTO_LIMIT).map((k) => cache.delete(k)));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith(".supabase.co") && STORAGE_PHOTO.test(url.pathname)) {
    if (req.headers.has("range")) return; // video/audio streaming
    event.respondWith(photo(req, url).catch(() => fetch(req)));
    return;
  }
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
  const path = event.notification.data?.url || "/app/home";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const w = wins.find((c) => "focus" in c);
      if (w) {
        // iPhone home-screen apps can't navigate() from here: ask the open app to go there.
        w.postMessage({ type: "open", url: path });
        try {
          await w.focus();
        } catch {
          // ignore
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
