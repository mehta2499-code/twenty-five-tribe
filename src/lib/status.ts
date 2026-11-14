/**
 * Live status at the Table: what you're doing right now in 25 (playing a game,
 * taking your Drop), and what everyone at your Table is doing (friends_now()
 * in the database returns only people you've seated).
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { _get } from "@/lib/social";

export type Doing = { doing: "game" | "drop"; detail: string; ref?: string };
export type FriendNow = { doing: Doing["doing"] | null; detail: string | null; ref: string | null };

// ---------- What I'm doing ----------
let mine: Doing | null = null;
const mineSubs = new Set<() => void>();

/** Screens call this while they're open: useDoing({ doing: "game", detail: "Ludo" }). */
export function useDoing(d: Doing | null) {
  const key = d ? `${d.doing}|${d.detail}|${d.ref ?? ""}` : "";
  useEffect(() => {
    if (!d) return;
    mine = d;
    mineSubs.forEach((f) => f());
    return () => {
      if (mine && `${mine.doing}|${mine.detail}|${mine.ref ?? ""}` === key) {
        mine = null;
        mineSubs.forEach((f) => f());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Tell the server we're here (and what we're doing). */
export function sendStatus() {
  if (_get().mode !== "live" || document.visibilityState !== "visible") return;
  void supabase
    .rpc(
      "set_status" as never,
      {
        p_doing: mine?.doing ?? null,
        p_detail: mine?.detail ?? null,
        p_ref: mine?.ref ?? null,
      } as never,
    )
    .then(() => undefined);
}

/** Send right away whenever what I'm doing changes. */
export function onMyStatusChange(f: () => void) {
  mineSubs.add(f);
  return () => mineSubs.delete(f);
}

// ---------- What my 25 are doing ----------
let friends = new Map<string, FriendNow>();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let users = 0;

async function refresh() {
  if (_get().mode !== "live" || document.visibilityState !== "visible") return;
  const { data } = await supabase.rpc("friends_now" as never);
  const next = new Map<string, FriendNow>();
  for (const r of (data ?? []) as {
    user_id: string;
    doing: FriendNow["doing"];
    detail: string | null;
    ref: string | null;
  }[])
    next.set(r.user_id, { doing: r.doing, detail: r.detail, ref: r.ref });
  friends = next;
  subs.forEach((f) => f());
}

/** Who in your 25 is in the app right now, and doing what (refreshes every 5s). */
export function useFriendsNow() {
  const snap = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => friends,
    () => friends,
  );
  useEffect(() => {
    users += 1;
    if (users === 1) {
      void refresh();
      timer = setInterval(() => void refresh(), 5_000);
    }
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      users -= 1;
      if (users === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return snap;
}

const GAME_NAMES: Record<string, string> = {
  ludo: "Ludo",
  kachuful: "Judgement",
  trivia: "Trivia",
  word: "Word Up",
  imposter: "Imposter",
};
export const gameLabel = (kind: string) => GAME_NAMES[kind] ?? "a game";
