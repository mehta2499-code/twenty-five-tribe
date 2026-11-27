/**
 * The Drop's state for the tab bar: is it Drop time (and you haven't posted),
 * or did you miss it (post late)? Checked on open, every minute, on page
 * change, and right after you post.
 *
 * At Drop time the tab is a camera button: the photo it takes is handed to
 * the Drop page here (takeShot) so you land there ready to post.
 */
import { useEffect, useState } from "react";
import { dropTime, loadDrops, phaseOf, type DropShot } from "@/lib/drop";

export type DropBadge = "now" | "missed" | null;

let at: number | null = null;
let dropped: boolean | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function check() {
  try {
    at = await dropTime();
    const d = await loadDrops();
    dropped = !!d.mine;
  } catch {
    // keep what we had
  }
}

/** Check again now (e.g. you just posted, so the camera button goes back to the Drop tab). */
export async function refreshDropBadge() {
  await check();
  notify();
}

export function useDropBadge(pathname: string): DropBadge {
  const [, tick] = useState(0);
  useEffect(() => {
    let alive = true;
    const re = () => alive && tick((n) => n + 1);
    listeners.add(re);
    void check().then(re);
    const t = setInterval(() => void check().then(re), 60_000);
    // Flip to the camera the moment the Drop starts, not up to a minute later.
    const s = setInterval(re, 5_000);
    return () => {
      alive = false;
      listeners.delete(re);
      clearInterval(t);
      clearInterval(s);
    };
  }, [pathname]);
  if (at === null || dropped !== false) return null;
  const phase = phaseOf(at);
  return phase === "now" ? "now" : phase === "after" ? "missed" : null;
}

// ---- A photo taken with the tab-bar camera, on its way to the Drop page ----
let shot: DropShot | null = null;
const shotListeners = new Set<() => void>();
export function giveShot(f: DropShot) {
  shot = f;
  shotListeners.forEach((l) => l());
}
/** The waiting photo, if any (taken once). */
export function takeShot(): DropShot | null {
  const f = shot;
  shot = null;
  return f;
}
export function onShot(fn: () => void) {
  shotListeners.add(fn);
  return () => void shotListeners.delete(fn);
}
