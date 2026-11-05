/**
 * The daily game: one quick game a day (India time), the same for everyone.
 * 3 tries; your score for the day is your best try. Each day you
 * get points for where you placed at your table, and points add up over the week.
 * Also holds Word Up daily results.
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { _get, dayKey, mutualFriends, useSocial, weekKey } from "@/lib/social";

export type DailyId =
  | "tap-rush"
  | "quick-math"
  | "colour-clash"
  | "pair-up"
  | "odd-one-out"
  | "pattern"
  | "reflex";

/** Monday to Sunday. Keep in sync with public.daily_game() in the database. */
export const LINEUP: DailyId[] = [
  "tap-rush",
  "quick-math",
  "colour-clash",
  "pair-up",
  "odd-one-out",
  "pattern",
  "reflex",
];
export const TRIES = 3;
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Points for 1st, 2nd, 3rd… at your table each day. Everyone else who played gets 2. */
export const POINTS = [10, 8, 6, 5, 4];
const PLAYED_POINTS = 2;

const DAY = 86_400_000;
const toDate = (k: string) => new Date(`${k}T00:00:00Z`);
const toKey = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (k: string, n: number) => toKey(new Date(toDate(k).getTime() + n * DAY));
/** 0 = Monday … 6 = Sunday */
export const weekdayOf = (k: string) => (toDate(k).getUTCDay() + 6) % 7;
export const gameFor = (k: string) => LINEUP[weekdayOf(k)];
export const today = () => dayKey();
export const thisWeek = () => weekKey();
export const lastWeek = () => addDays(weekKey(), -7);
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/** Time until the next game (midnight India time). */
export function untilMidnight() {
  const now = Date.now();
  const ist = now + 5.5 * 3_600_000;
  const left = DAY - (ist % DAY);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Your score for the day: your best try. -1 (started, not finished) counts as 0. */
export const best = (tries: number[]) => (tries.length ? Math.max(0, ...tries) : 0);

export type WordResult = { guesses: number; grid: string };
type DailyState = {
  /** day -> person id ("me" for you) -> tries */
  board: Record<string, Record<string, number[]>>;
  words: Record<string, Record<string, WordResult>>;
  loaded: boolean;
};

let store: DailyState = { board: {}, words: {}, loaded: false };
const listeners = new Set<() => void>();
function setStore(fn: (s: DailyState) => DailyState) {
  store = fn(store);
  listeners.forEach((l) => l());
  if (_get().mode === "demo") saveDemo();
}

// ---------- Demo: sample friends play too ----------
const DEMO_KEY = "tf.daily.v1";
const SCALE: Record<DailyId, [number, number]> = {
  "tap-rush": [14, 40],
  "quick-math": [8, 24],
  "colour-clash": [12, 34],
  "pair-up": [40, 120],
  "odd-one-out": [8, 28],
  pattern: [3, 11],
  reflex: [180, 420],
};
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}
function demoBoard() {
  const board: DailyState["board"] = {};
  const words: DailyState["words"] = {};
  const t = today();
  const people = mutualFriends().slice(0, 12);
  for (const day of [...weekDays(lastWeek()), ...weekDays(thisWeek())]) {
    if (day > t) break;
    const [lo, hi] = SCALE[gameFor(day)];
    board[day] = {};
    words[day] = {};
    for (const f of people) {
      const h = hash(f.id + day);
      // Not everyone plays every day; today, fewer have played yet.
      if (h % (day === t ? 3 : 5) === 0) continue;
      const n = 1 + (h % TRIES);
      board[day][f.id] = Array.from(
        { length: n },
        (_, i) => lo + (hash(f.id + day + i) % (hi - lo + 1)),
      );
      if (h % 4 !== 0) {
        const g = 2 + (h % 6);
        words[day][f.id] = { guesses: g, grid: "" };
      }
    }
  }
  return { board, words };
}
function loadDemo() {
  const { board, words } = demoBoard();
  try {
    const mine = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}") as {
      board?: Record<string, number[]>;
      words?: Record<string, WordResult>;
    };
    for (const [day, tries] of Object.entries(mine.board ?? {})) (board[day] ??= {}).me = tries;
    for (const [day, w] of Object.entries(mine.words ?? {})) (words[day] ??= {}).me = w;
  } catch {
    // Unreadable; start fresh.
  }
  store = { board, words, loaded: true };
  listeners.forEach((l) => l());
}
function saveDemo() {
  try {
    const board: Record<string, number[]> = {};
    const words: Record<string, WordResult> = {};
    for (const [d, r] of Object.entries(store.board)) if (r.me) board[d] = r.me;
    for (const [d, r] of Object.entries(store.words)) if (r.me) words[d] = r.me;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ board, words }));
  } catch {
    // ignore
  }
}

// ---------- Live ----------
let liveFor: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

async function loadLive(me: string) {
  const since = lastWeek();
  const [scores, words] = await Promise.all([
    supabase.from("daily_scores").select("user_id,day,tries").gte("day", since),
    supabase.from("word_results").select("user_id,day,guesses,grid").gte("day", since),
  ]);
  const who = (id: string) => (id === me ? "me" : id);
  const board: DailyState["board"] = {};
  const w: DailyState["words"] = {};
  for (const r of (scores.data ?? []) as { user_id: string; day: string; tries: number[] }[])
    (board[r.day] ??= {})[who(r.user_id)] = r.tries;
  for (const r of (words.data ?? []) as {
    user_id: string;
    day: string;
    guesses: number;
    grid: string;
  }[])
    (w[r.day] ??= {})[who(r.user_id)] = { guesses: r.guesses, grid: r.grid };
  if (liveFor !== me) return;
  store = { board, words: w, loaded: true };
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  const s = _get();
  if (s.mode === "live" && s.me) {
    if (liveFor === s.me.id) return;
    liveFor = s.me.id;
    const me = s.me.id;
    void loadLive(me);
    if (channel) void supabase.removeChannel(channel);
    const reload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void loadLive(me), 600);
    };
    channel = supabase
      .channel(`daily:${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_scores" }, reload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "word_results" }, reload)
      .subscribe();
  } else if (s.mode === "demo" && (liveFor !== "demo" || !store.loaded)) {
    liveFor = "demo";
    if (channel) void supabase.removeChannel(channel);
    channel = null;
    loadDemo();
  }
}

export function useDaily() {
  const s = useSocial();
  const d = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => store,
  );
  useEffect(ensureLoaded, [s.mode, s.me?.id]);
  return d;
}

// ---------- Actions ----------
export function myTries(day = today()) {
  return store.board[day]?.me ?? [];
}

/** Uses up one of today's tries. Returns which day and try it was. */
export async function startTry(): Promise<{ day: string; tryNo: number }> {
  const day = today();
  if (myTries(day).length >= TRIES) throw new Error("No tries left today. New game at midnight.");
  if (_get().mode === "live") {
    const { data, error } = await supabase.rpc("start_daily_try");
    if (error) throw new Error(error.message);
    const r = data as { day: string; try: number };
    setStore((s) => ({
      ...s,
      board: { ...s.board, [r.day]: { ...s.board[r.day], me: [...myTries(r.day), -1] } },
    }));
    return { day: r.day, tryNo: r.try };
  }
  const tries = [...myTries(day), -1];
  setStore((s) => ({ ...s, board: { ...s.board, [day]: { ...s.board[day], me: tries } } }));
  return { day, tryNo: tries.length };
}

export async function finishTry(day: string, score: number) {
  const tries = [...myTries(day)];
  const i = tries.lastIndexOf(-1);
  if (i >= 0) tries[i] = score;
  setStore((s) => ({ ...s, board: { ...s.board, [day]: { ...s.board[day], me: tries } } }));
  if (_get().mode === "live") {
    const { error } = await supabase.rpc("finish_daily_try", { p_day: day, p_score: score });
    if (error) throw new Error(error.message);
  }
}

export async function saveWord(day: string, result: WordResult) {
  setStore((s) => ({ ...s, words: { ...s.words, [day]: { ...s.words[day], me: result } } }));
  if (_get().mode === "live") {
    const me = _get().me!.id;
    const { error } = await supabase
      .from("word_results")
      .insert({ user_id: me, day, guesses: result.guesses, grid: result.grid });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
  }
}

// ---------- Standings ----------
export type DayRow = { id: string; best: number; tries: number[]; rank: number; points: number };

/** Who played that day, highest best-try first, with the points each place earns. */
export function dayRanking(d: DailyState, day: string): DayRow[] {
  const rows = Object.entries(d.board[day] ?? {})
    .filter(([, t]) => t.length > 0 && t.some((x) => x >= 0))
    .map(([id, tries]) => ({ id, tries, best: best(tries) }))
    .sort((a, b) => b.best - a.best);
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.best !== rows[i - 1].best) rank = i + 1;
    return { ...r, rank, points: POINTS[rank - 1] ?? PLAYED_POINTS };
  });
}

export type WeekRow = { id: string; points: number; days: number; wins: number };

export function weekStandings(d: DailyState, start: string): WeekRow[] {
  const totals: Record<string, WeekRow> = {};
  const t = today();
  for (const day of weekDays(start)) {
    if (day > t) break;
    for (const r of dayRanking(d, day)) {
      const w = (totals[r.id] ??= { id: r.id, points: 0, days: 0, wins: 0 });
      w.points += r.points;
      w.days += 1;
      if (r.rank === 1) w.wins += 1;
    }
  }
  return Object.values(totals).sort((a, b) => b.points - a.points || b.wins - a.wins);
}
