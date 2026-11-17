/**
 * Head-to-head: every finished game you and a friend played together, and who
 * came out on top in each (between the two of you).
 */
import { supabase } from "@/integrations/supabase/client";
import { _get } from "@/lib/social";
import { revealWord, type GameRow, type TriviaState, type WordState } from "@/lib/games";
import type { ChessState } from "@/lib/chess";
import type { PokerState } from "@/lib/poker";
import type { LudoState } from "@/lib/ludo";
import type { KState } from "@/lib/kachuful";
import type { EarState } from "@/lib/earworm";

export type Rivalry = { kind: string; name: string; you: number; them: number }[];

const NAMES: Record<string, string> = {
  trivia: "Trivia",
  ludo: "Ludo",
  chess: "Chess",
  poker: "Hold'em",
  kachuful: "Judgement",
  earworm: "Name That Tune",
  word: "Word Up",
};

/** 1 = you won, -1 = they won, 0 = a draw / can't tell. */
function winner(g: GameRow, me: string, them: string): number {
  const st = g.state as unknown;
  const cmp = (a?: number, b?: number) =>
    a == null || b == null || a === b ? 0 : a > b ? 1 : -1;
  switch (g.kind) {
    case "trivia": {
      const t = st as TriviaState;
      if (t.forfeit === me) return -1;
      if (t.forfeit === them) return 1;
      const p = (id: string) => t.results?.[id]?.points ?? t.results?.[id]?.score;
      return cmp(p(me), p(them));
    }
    case "earworm": {
      const e = st as EarState;
      return cmp(e.results?.[me]?.score, e.results?.[them]?.score);
    }
    case "chess": {
      const c = st as ChessState & { white?: string; black?: string };
      const w = c.result?.winner;
      if (!w) return 0;
      const winId = w === "w" ? c.white : c.black;
      return winId === me ? 1 : winId === them ? -1 : 0;
    }
    case "ludo": {
      const l = st as LudoState;
      const id = l.winner != null ? l.players[l.winner]?.id : undefined;
      return id === me ? 1 : id === them ? -1 : 0;
    }
    case "kachuful": {
      const k = st as KState;
      const total = (id: string) => {
        const i = k.seats.findIndex((s) => s.id === id);
        return i < 0 ? undefined : k.scores.reduce((a, r) => a + (r[i] ?? 0), 0);
      };
      return cmp(total(me), total(them));
    }
    case "poker": {
      const p = st as PokerState;
      const stack = (id: string) => p.seats.find((s) => s.id === id)?.stack;
      return cmp(stack(me), stack(them));
    }
    case "word": {
      // The guesser wins by cracking the word; the setter wins if they don't.
      const w = st as WordState;
      let solved = false;
      try {
        solved = w.guesses.some((x) => x.toLowerCase() === revealWord(w.hidden).toLowerCase());
      } catch {
        // an old or odd game
      }
      const winId = w.gaveUp ? (w.gaveUp === w.guesser ? w.setter : w.guesser) : solved ? w.guesser : w.setter;
      return winId === me ? 1 : winId === them ? -1 : 0;
    }
    default:
      return 0;
  }
}

export async function loadRivalry(friendId: string): Promise<Rivalry> {
  const me = _get().me?.id;
  if (!me || _get().mode !== "live") return [];
  const { data } = await supabase
    .from("games")
    .select("kind,state,players,status")
    .eq("status", "done")
    .contains("players", [me, friendId])
    .order("updated_at", { ascending: false })
    .limit(500);
  const tally = new Map<string, { you: number; them: number }>();
  for (const g of (data ?? []) as GameRow[]) {
    if (!NAMES[g.kind]) continue;
    const w = winner(g, me, friendId);
    if (!w) continue;
    const t = tally.get(g.kind) ?? { you: 0, them: 0 };
    if (w > 0) t.you++;
    else t.them++;
    tally.set(g.kind, t);
  }
  return [...tally.entries()]
    .map(([kind, t]) => ({ kind, name: NAMES[kind], ...t }))
    .sort((a, b) => b.you + b.them - (a.you + a.them));
}
