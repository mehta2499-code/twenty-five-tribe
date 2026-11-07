/**
 * Quiz badges: how well people know each other, from "Are you in my 25?" quiz scores.
 *   All right (7/7)  → Ride or Die
 *   One wrong (6/7)  → Real One
 * You can see quizzes you took and quizzes taken on you, so both directions
 * load straight from the table; "knows best" for someone else uses an RPC.
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Best = { score: number; total: number };
export type Badge = "ride" | "real" | null;

export function badgeOf(b?: Best | null): Badge {
  if (!b || b.total < 6) return null;
  if (b.score >= b.total) return "ride";
  if (b.score === b.total - 1) return "real";
  return null;
}

type State = {
  loaded: boolean;
  /** Their best score on my quiz. */
  knowsMe: Record<string, Best>;
  /** My best score on their quiz. */
  iKnow: Record<string, Best>;
};
let state: State = { loaded: false, knowsMe: {}, iKnow: {} };
const subs = new Set<() => void>();
const set = (s: State) => {
  state = s;
  subs.forEach((f) => f());
};
let loading = false;

export async function refreshQuiz() {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me || loading) return;
  loading = true;
  try {
    const { data } = await supabase
      .from("quiz_attempts")
      .select("guesser,target,score,total")
      .not("score", "is", null)
      .or(`guesser.eq.${me},target.eq.${me}`)
      .limit(2000);
    const knowsMe: Record<string, Best> = {};
    const iKnow: Record<string, Best> = {};
    const keep = (map: Record<string, Best>, id: string, b: Best) => {
      const cur = map[id];
      if (!cur || b.score / b.total > cur.score / cur.total) map[id] = b;
    };
    for (const r of (data ?? []) as { guesser: string; target: string; score: number; total: number }[]) {
      if (r.target === me) keep(knowsMe, r.guesser, { score: r.score, total: r.total });
      if (r.guesser === me) keep(iKnow, r.target, { score: r.score, total: r.total });
    }
    set({ loaded: true, knowsMe, iKnow });
  } finally {
    loading = false;
  }
}

export function useQuizBadges() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!state.loaded) void refreshQuiz();
  }, []);
  return s;
}

/** Top 3 people who know someone best (you, or someone in your mutual 25). */
export async function knowsBest(userId: string) {
  const { data } = await supabase.rpc("knows_best" as never, { p_user: userId } as never);
  return ((data as { guesser: string; score: number; total: number }[] | null) ?? []).filter(
    (r) => r.score / r.total >= 0.5,
  );
}
