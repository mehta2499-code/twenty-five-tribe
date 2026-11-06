/** Push notifications on this device: turn on, keep in sync, turn off. */
import { supabase } from "@/integrations/supabase/client";
import { _get } from "@/lib/social";

export type PushStatus = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isIos = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

export function pushStatus(): PushStatus {
  if (typeof window === "undefined") return "unsupported";
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iPhones only allow notifications for apps added to the Home Screen.
  // Inside the native app shell, web push isn't available (native push comes later).
  if ((window as unknown as { Capacitor?: unknown }).Capacitor) return "unsupported";
  if (isIos() && !standalone()) return "needs-install";
  if (!supported || !window.isSecureContext) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function save(sub: PushSubscription) {
  const me = _get().me;
  if (!me) return;
  const j = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.keys?.p256dh || !j.keys.auth) return;
  await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: me.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
      { onConflict: "endpoint" },
    );
}

async function subscribe() {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const res = await fetch("/api/push");
    const { publicKey } = (await res.json()) as { publicKey: string | null };
    if (!publicKey) throw new Error("Notifications aren't set up on the server yet.");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    });
  }
  await save(sub);
}

/** Ask permission (must come from a tap) and subscribe. */
export async function enablePush(): Promise<PushStatus> {
  const st = pushStatus();
  if (st === "unsupported" || st === "needs-install") return st;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  await subscribe();
  return "on";
}

/** On app start: if notifications are already allowed, make sure this device is saved. */
export async function syncPush() {
  try {
    if (pushStatus() === "on") await subscribe();
  } catch {
    // Best effort.
  }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
