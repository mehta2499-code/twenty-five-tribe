/**
 * The Drop's state for the tab bar: is it Drop time (and you haven't posted),
 * or did you miss it (post late)? Checked on open, every minute, and on page change.
 */
import { useEffect, useState } from "react";
import { dropTime, loadDrops, phaseOf } from "@/lib/drop";

export type DropBadge = "now" | "missed" | null;

let at: number | null = null;
let dropped: boolean | null = null;

async function check() {
  try {
    at = await dropTime();
    const d = await loadDrops();
    dropped = !!d.mine;
  } catch {
    // keep what we had
  }
}

export function useDropBadge(pathname: string): DropBadge {
  const [, tick] = useState(0);
  useEffect(() => {
    let alive = true;
    void check().then(() => alive && tick((n) => n + 1));
    const t = setInterval(() => {
      void check().then(() => alive && tick((n) => n + 1));
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);
  if (at === null || dropped !== false) return null;
  const phase = phaseOf(at);
  return phase === "now" ? "now" : phase === "after" ? "missed" : null;
}
