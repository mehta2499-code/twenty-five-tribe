/**
 * Analytics: track(eventName, properties).
 *
 * Fire-and-forget: never awaited, never throws, never blocks the UI. Only
 * the event name and small non-personal properties (counts, true/false,
 * game names) are sent. Never message text, images, quiz answers or names.
 */
import { supabase } from "@/integrations/supabase/client";
import { uuid } from "@/lib/uuid";

export type EventName =
  | "app_open"
  | "pwa_installed"
  | "signup_completed"
  | "seat_added"
  | "quiz_started"
  | "quiz_completed"
  | "mutual_seat"
  | "blink_sent"
  | "post_created"
  | "game_started"
  | "leaderboard_viewed";

type Props = Record<string, string | number | boolean | null>;

const ANON_KEY = "tf.anon";
let memoryAnon: string | null = null;

/** A random id for this browser, kept in localStorage, to count visitors before sign-up. */
export function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    memoryAnon ??= uuid();
    return memoryAnon;
  }
}

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

export function track(name: EventName, properties: Props = {}) {
  try {
    if (typeof window === "undefined") return;
    const send = () => {
      try {
        void supabase
          .rpc(
            "track_event" as never,
            { p_anon: anonId(), p_name: name, p_props: properties } as never,
          )
          .then(
            () => undefined,
            () => undefined,
          );
      } catch {
        // ignore
      }
    };
    // Off the critical path: after the current work and paint.
    if ("requestIdleCallback" in window)
      (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(
        send,
      );
    else setTimeout(send, 0);
  } catch {
    // Analytics must never break the app.
  }
}

let opened = false;
/** Once per page load: app_open (with standalone), plus the install listener. */
export function trackAppOpen() {
  try {
    if (opened || typeof window === "undefined") return;
    opened = true;
    track("app_open", { standalone: isStandalone() });
    window.addEventListener("appinstalled", () => track("pwa_installed"));
  } catch {
    // ignore
  }
}
