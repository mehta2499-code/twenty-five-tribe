/**
 * Scores tab: Daily · Weekly · Overall leaderboards. Only the two daily games
 * count: the daily game (points for your place at your table each day) and
 * Word Up (points for your place by fewest guesses). Live games don't.
 */
import { useEffect, useState } from "react";
import { Flag, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Ico } from "@/components/Ico";
import { Leaderboard, withRanks, type LeaderRow } from "@/components/Leaderboard";
import { DayResults, wordDay } from "@/components/DayResults";
import { friendById, meView, useSocial } from "@/lib/social";
import { addDays, dayRanking, thisWeek, today, useDaily, weekDays } from "@/lib/daily";
import { track } from "@/lib/track";

/** Points for 1st, 2nd, 3rd… each day; everyone else who played gets 2. */
const RANK_PTS = (rank: number) => [10, 8, 6, 5, 4][rank - 1] ?? 2;

function person(id: string) {
  if (id === "me") {
    const v = meView();
    return { name: "You", avatar: v.avatar, initials: v.initials, color: undefined };
  }
  const f = friendById(id);
  return {
    name: f?.name.split(" ")[0] ?? "Someone",
    avatar: f?.avatar || undefined,
    initials: f?.initials ?? "?",
    color: f?.color,
  };
}

type Lifetime = { user_id: string; daily_points: number; word_points?: number };

/** All-time points for you and your mutual 25 (worked out on the server). */
function useLifetime(on: boolean) {
  const s = useSocial();
  const [rows, setRows] = useState<Lifetime[]>([]);
  useEffect(() => {
    if (!on || s.mode !== "live") return;
    let alive = true;
    void supabase.rpc("lifetime_scores" as never).then(({ data }) => {
      if (alive) setRows((data as Lifetime[] | null) ?? []);
    });
    return () => {
      alive = false;
    };
  }, [on, s.mode]);
  const myId = s.me?.id;
  return rows.map((r) => ({ ...r, user_id: r.user_id === myId ? "me" : r.user_id }));
}

/** Days in a row you've played the daily game, counting back from today (or yesterday). */
function playStreak(board: Record<string, Record<string, number[]>>) {
  let day = today();
  if (!board[day]?.me?.length) day = addDays(day, -1);
  let n = 0;
  while (board[day]?.me?.length) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

type View = "daily" | "weekly" | "overall";
const VIEWS: [View, string][] = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["overall", "Overall"],
];

export function Scoreboard({
  onPlayDaily,
  onPlayWord,
}: {
  onPlayDaily?: () => void;
  onPlayWord?: () => void;
} = {}) {
  const d = useDaily();
  useEffect(() => track("leaderboard_viewed"), []);
  const [view, setView] = useState<View>("daily");
  const lifetime = useLifetime(view === "overall");
  const day = today();

  // Points per person for the chosen period.
  const totals: Record<string, number> = {};
  const add = (id: string, n: number) => (totals[id] = (totals[id] ?? 0) + n);
  if (view === "overall") {
    for (const r of lifetime) add(r.user_id, (r.daily_points ?? 0) + (r.word_points ?? 0));
  } else {
    const days = view === "daily" ? [day] : weekDays(thisWeek()).filter((k) => k <= day);
    for (const k of days) {
      for (const r of dayRanking(d, k)) add(r.id, r.points);
      for (const [id, w] of Object.entries(wordDay(d.words[k]))) add(id, w.points);
    }
  }
  const sorted = Object.entries(totals)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const rows: LeaderRow[] = withRanks(sorted, ([, n]) => n).map(({ r: [id, n], rank }) => ({
    id,
    rank,
    value: n,
    link: true,
    me: id === "me",
    ...person(id),
  }));
  const streak = playStreak(d.board);

  return (
    <section className="px-5 mt-5 pb-4">
      {/* Daily · Weekly · Overall */}
      <div
        className="flex rounded-[16px] p-1"
        style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
        role="group"
        aria-label="Which leaderboard"
      >
        {VIEWS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            aria-pressed={view === k}
            className="flex-1 rounded-[12px] py-2 font-bold transition-colors"
            style={{
              fontSize: 14.5,
              background: view === k ? "#E2506A" : "transparent",
              color: view === k ? "#fff" : "var(--ink-2)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p
        className={`meta text-center mt-3 ${view === "daily" ? "hidden" : ""}`}
        style={{ fontSize: 12.5 }}
      >
        Daily game + Word Up
        {view === "daily" ? " · today" : view === "weekly" ? " · this week" : " · all-time"}
      </p>

      {view === "daily" ? (
        <div className="mt-5">
          <DayResults onPlayDaily={onPlayDaily} onPlayWord={onPlayWord} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card mt-6 p-6 text-center">
          <Flag
            size={44}
            strokeWidth={2}
            aria-hidden="true"
            className="mx-auto"
            style={{ color: "var(--lime)" }}
          />
          <p className="heading mt-3">No scores yet</p>
          <p className="meta mt-1">Play first. Set the bar. Make them sweat.</p>
        </div>
      ) : (
        <div className="mt-6">
          <Leaderboard rows={rows} />
        </div>
      )}

      {streak > 0 && (
        <div className="mt-8 flex justify-center">
          <span
            className="px-4 py-1.5 rounded-full font-extrabold text-[14px]"
            style={{
              background: "var(--lime)",
              color: "var(--on-accent)",
              border: "var(--bd)",
              boxShadow: "var(--pop)",
            }}
          >
            <Ico i={Flame} size={15} /> Day {streak} of playing in a row
          </span>
        </div>
      )}
      <p className="text-center meta mt-6">Only your mutual 25 see your scores.</p>
    </section>
  );
}
