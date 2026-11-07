import { Ico, TONE } from "@/components/Ico";
/**
 * Scores tab: a podium for the top 3, a "best player" banner and colourful
 * ranked rows. Today (best try in today's game) or the week (points).
 */
import { useEffect, useState } from "react";
import { Crown, Flag, Flame, RotateCw, Sparkles, Trophy, Type, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { GAMES } from "@/components/ArcadeGames";
import { friendById, meView, useSocial } from "@/lib/social";
import {
  DAY_NAMES,
  addDays,
  dayRanking,
  gameFor,
  lastWeek,
  thisWeek,
  today,
  useDaily,
  weekDays,
  weekStandings,
} from "@/lib/daily";

type Row = {
  id: string;
  rank: number;
  value: number | string;
  unit: string;
  chips: { k: string; node: React.ReactNode }[];
};

const ROW_TONES = ["var(--pink)", "var(--lime)", "var(--sky)"];

function person(id: string) {
  if (id === "me") {
    const v = meView();
    return {
      name: "You",
      avatar: v.avatar,
      initials: v.initials,
      color: undefined as string | undefined,
    };
  }
  const f = friendById(id);
  return {
    name: f?.name.split(" ")[0] ?? "Someone",
    avatar: f?.avatar || undefined,
    initials: f?.initials ?? "?",
    color: f?.color,
  };
}

type Lifetime = {
  user_id: string;
  points: number;
  daily_points: number;
  daily_days: number;
  daily_crowns: number;
  live_played: number;
  live_wins: number;
  trivia_wins: number;
  ludo_wins: number;
  kachuful_wins: number;
  word_wins: number;
  word_points?: number;
  word_days?: number;
};

/** All-time scores for you and your mutual 25 (worked out on the server). */
function useLifetime(on: boolean) {
  const s = useSocial();
  const [rows, setRows] = useState<Lifetime[] | null>(null);
  useEffect(() => {
    if (!on || s.mode !== "live") return;
    let alive = true;
    void supabase.rpc("lifetime_scores" as never).then(({ data }) => {
      if (alive) setRows(((data as Lifetime[] | null) ?? []).filter((r) => r.points > 0));
    });
    return () => {
      alive = false;
    };
  }, [on, s.mode]);
  const myId = s.me?.id;
  return (rows ?? []).map((r) => ({ ...r, user_id: r.user_id === myId ? "me" : r.user_id }));
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

type Board = "overall" | "daily" | "word" | "trivia";
type View = "today" | "week" | "last" | "all";
const VIEWS: Record<Board, [View, string][]> = {
  overall: [
    ["week", "This week"],
    ["last", "Last week"],
    ["all", "All-time"],
  ],
  daily: [["today", "Today"]],
  word: [
    ["today", "Today"],
    ["week", "This week"],
    ["all", "All-time"],
  ],
  trivia: [["all", "All-time"]],
};
const BOARDS: [Board, string][] = [
  ["overall", "Overall"],
  ["daily", "Daily game"],
  ["word", "Word Up"],
  ["trivia", "Trivia"],
];
const RANK_PTS = (rank: number) => [10, 8, 6, 5, 4][rank - 1] ?? 2;
const rankOf = <T,>(rows: T[], key: (r: T) => number | string) =>
  rows.map((r, i) => {
    let k = i;
    while (k > 0 && key(rows[k - 1]) === key(r)) k--;
    return k + 1;
  });

type WordRow = { user_id: string; day: string; guesses: number };

/** Daily Word Up results for you and your mutual 25 (straight from the table). */
function useWordResults(on: boolean) {
  const s = useSocial();
  const [rows, setRows] = useState<WordRow[] | null>(null);
  useEffect(() => {
    if (!on || s.mode !== "live") return;
    let alive = true;
    void supabase
      .from("word_results")
      .select("user_id,day,guesses")
      .order("day", { ascending: false })
      .limit(5000)
      .then(({ data }) => {
        if (alive) setRows((data as WordRow[] | null) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [on, s.mode]);
  const myId = s.me?.id;
  return (rows ?? []).map((r) => ({ ...r, user_id: r.user_id === myId ? "me" : r.user_id }));
}

/** Word Up points per person over some days: fewest guesses ranks first (missed = played). */
function wordPoints(rows: WordRow[], days: Set<string>) {
  const out: Record<string, { points: number; days: number; solved: number }> = {};
  const byDay: Record<string, WordRow[]> = {};
  for (const r of rows) if (days.has(r.day)) (byDay[r.day] ??= []).push(r);
  for (const list of Object.values(byDay)) {
    list.sort((a, b) => a.guesses - b.guesses);
    const ranks = rankOf(list, (r) => r.guesses);
    list.forEach((r, i) => {
      const o = (out[r.user_id] ??= { points: 0, days: 0, solved: 0 });
      o.points += r.guesses > 6 ? 2 : RANK_PTS(ranks[i]);
      o.days += 1;
      if (r.guesses <= 6) o.solved += 1;
    });
  }
  return out;
}

/** Days in a row someone has played Word Up, ending today or yesterday. */
function wordStreak(rows: WordRow[], id: string) {
  const played = new Set(rows.filter((r) => r.user_id === id).map((r) => r.day));
  let day = today();
  if (!played.has(day)) day = addDays(day, -1);
  let n = 0;
  while (played.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

type WeekExtra = { user_id: string; word: number; trivia: number };
function useWeekExtra(start: string, on: boolean) {
  const s = useSocial();
  const [rows, setRows] = useState<Record<string, WeekExtra>>({});
  useEffect(() => {
    if (!on || s.mode !== "live") return;
    let alive = true;
    void supabase.rpc("week_extra" as never, { p_start: start } as never).then(({ data }) => {
      if (!alive) return;
      const map: Record<string, WeekExtra> = {};
      for (const r of (data as WeekExtra[] | null) ?? [])
        map[r.user_id === s.me?.id ? "me" : r.user_id] = r;
      setRows(map);
    });
    return () => {
      alive = false;
    };
  }, [start, on, s.mode, s.me?.id]);
  return rows;
}

type TriviaRow = {
  user_id: string;
  duels: number;
  wins: number;
  vs_me: number;
  vs_me_wins: number;
  vs_me_losses: number;
};
function useTriviaBoard(on: boolean) {
  const s = useSocial();
  const [rows, setRows] = useState<TriviaRow[]>([]);
  useEffect(() => {
    if (!on || s.mode !== "live") return;
    let alive = true;
    void supabase.rpc("trivia_board" as never).then(({ data }) => {
      if (!alive) return;
      setRows(
        ((data as TriviaRow[] | null) ?? [])
          .filter((r) => r.duels > 0)
          .map((r) => ({ ...r, user_id: r.user_id === s.me?.id ? "me" : r.user_id })),
      );
    });
    return () => {
      alive = false;
    };
  }, [on, s.mode, s.me?.id]);
  return rows;
}

const chip = (k: string, node: React.ReactNode) => ({ k, node });

export function Scoreboard() {
  const d = useDaily();
  const [board, setBoard] = useState<Board>("overall");
  const [views, setViews] = useState<Record<Board, View>>({
    overall: "week",
    daily: "today",
    word: "today",
    trivia: "all",
  });
  const view = views[board];
  const setView = (v: View) => setViews((x) => ({ ...x, [board]: v }));
  const day = today();
  const g = GAMES[gameFor(day)];
  const weekStart = view === "last" ? lastWeek() : thisWeek();

  const lifetime = useLifetime(board === "overall" && view === "all");
  const extra = useWeekExtra(weekStart, board === "overall" && view !== "all");
  const words = useWordResults(board === "word");
  const trivia = useTriviaBoard(board === "trivia");

  const ranked = <T,>(list: T[], value: (r: T) => number | string) =>
    rankOf(list, value);

  let rows: Row[] = [];
  if (board === "overall" && view === "all") {
    const list = [...lifetime].sort((a, b) => b.points - a.points || b.live_wins - a.live_wins);
    const rk = ranked(list, (r) => r.points);
    rows = list.map((r, i) => ({
      id: r.user_id,
      rank: rk[i],
      value: r.points,
      unit: "pts",
      chips: [
        ...(r.live_wins
          ? [chip("w", <><Ico i={Trophy} c={TONE.win} size={12} /> {r.live_wins} win{r.live_wins === 1 ? "" : "s"}</>)]
          : []),
        ...(r.daily_crowns ? [chip("c", <><Ico i={Crown} c={TONE.win} size={12} /> ×{r.daily_crowns}</>)] : []),
      ],
    }));
  } else if (board === "overall") {
    // Daily game + Word Up + Trivia for the week.
    const arcade = weekStandings(d, weekStart);
    const ids = new Set([...arcade.map((r) => r.id), ...Object.keys(extra)]);
    const list = [...ids]
      .map((id) => {
        const a = arcade.find((r) => r.id === id);
        const e = extra[id];
        return {
          id,
          arcade: a?.points ?? 0,
          crowns: a?.wins ?? 0,
          word: e?.word ?? 0,
          trivia: e?.trivia ?? 0,
          total: (a?.points ?? 0) + (e?.word ?? 0) + (e?.trivia ?? 0),
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || b.crowns - a.crowns);
    const rk = ranked(list, (r) => r.total);
    rows = list.map((r, i) => ({
      id: r.id,
      rank: rk[i],
      value: r.total,
      unit: "pts",
      chips: [
        ...(r.crowns ? [chip("c", <><Ico i={Crown} c={TONE.win} size={12} /> ×{r.crowns}</>)] : []),
        ...(r.word ? [chip("w", `Word ${r.word}`)] : []),
        ...(r.trivia ? [chip("t", `Trivia ${r.trivia}`)] : []),
      ],
    }));
  } else if (board === "daily") {
    rows = dayRanking(d, day).map((r) => ({
      id: r.id,
      rank: r.rank,
      value: r.best,
      unit: g.unit,
      chips: [chip("t", <><Ico i={RotateCw} size={12} /> {r.tries.length}</>), chip("p", `+${r.points} pts`)],
    }));
  } else if (board === "word" && view === "today") {
    const list = words.filter((r) => r.day === day).sort((a, b) => a.guesses - b.guesses);
    const rk = ranked(list, (r) => r.guesses);
    rows = list.map((r, i) => ({
      id: r.user_id,
      rank: rk[i],
      value: r.guesses > 6 ? "X" : r.guesses,
      unit: "/6",
      chips: [chip("p", `+${r.guesses > 6 ? 2 : RANK_PTS(rk[i])} pts`)],
    }));
  } else if (board === "word" && view === "week") {
    const pts = wordPoints(words, new Set(weekDays(thisWeek())));
    const list = Object.entries(pts)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.points - a.points || b.solved - a.solved);
    const rk = ranked(list, (r) => r.points);
    rows = list.map((r, i) => ({
      id: r.id,
      rank: rk[i],
      value: r.points,
      unit: "pts",
      chips: [chip("s", `${r.solved}/${r.days} solved`)],
    }));
  } else if (board === "word") {
    const by: Record<string, WordRow[]> = {};
    for (const r of words) (by[r.user_id] ??= []).push(r);
    const list = Object.entries(by)
      .map(([id, rs]) => {
        const solved = rs.filter((r) => r.guesses <= 6);
        const avg = solved.length ? solved.reduce((a, r) => a + r.guesses, 0) / solved.length : 9;
        return { id, avg, days: rs.length, solved: solved.length, streak: wordStreak(words, id) };
      })
      .sort((a, b) => a.avg - b.avg || b.solved - a.solved);
    const rk = ranked(list, (r) => r.avg.toFixed(2));
    rows = list.map((r, i) => ({
      id: r.id,
      rank: rk[i],
      value: r.solved ? r.avg.toFixed(1) : "–",
      unit: "avg",
      chips: [
        chip("s", `${r.solved}/${r.days} solved`),
        ...(r.streak > 1 ? [chip("k", <><Ico i={Flame} c={TONE.streak} size={12} /> {r.streak}</>)] : []),
      ],
    }));
  } else {
    const list = [...trivia].sort((a, b) => b.wins - a.wins || a.duels - b.duels);
    const rk = ranked(list, (r) => r.wins);
    rows = list.map((r, i) => ({
      id: r.user_id,
      rank: rk[i],
      value: r.wins,
      unit: r.wins === 1 ? "win" : "wins",
      chips: [
        chip("d", `${Math.round((r.wins / r.duels) * 100)}% of ${r.duels}`),
        // Head to head against you.
        ...(r.user_id !== "me" && r.vs_me
          ? [chip("h", `You ${r.vs_me_losses}–${r.vs_me_wins}`)]
          : []),
      ],
    }));
  }

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const best = rows[0];
  const streak = playStreak(d.board);
  const title =
    board === "daily" ? (
      <><g.Icon size={14} strokeWidth={2.25} aria-hidden="true" /> {g.name}</>
    ) : board === "word" ? (
      <><Ico i={Type} size={14} /> Word Up · {VIEWS.word.find(([k]) => k === view)?.[1]}</>
    ) : board === "trivia" ? (
      <><Ico i={Zap} size={14} /> Trivia duels</>
    ) : (
      <><Ico i={Trophy} size={14} /> {VIEWS.overall.find(([k]) => k === view)?.[1]}</>
    );
  // Only a short hint where it's needed; no scoring maths on screen.
  const sub =
    board === "daily"
      ? `${DAY_NAMES[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} · best try counts`
      : board === "word" && view === "all"
        ? "Average guesses"
        : "";
  const champ =
    board === "daily"
      ? "Best player today"
      : board === "word"
        ? view === "today"
          ? "Sharpest today"
          : view === "week"
            ? "Word Up of the week"
            : "Word Up legend"
        : board === "trivia"
          ? "Trivia champ"
          : view === "all"
            ? "All-time champ"
            : view === "last"
              ? "Last week's champ"
              : "Player of the week";
  const mine = lifetime.find((r) => r.user_id === "me");

  return (
    <section className="px-5 mt-5 pb-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5" role="group" aria-label="Which game">
        {BOARDS.map(([k, label]) => (
          <button
            key={k}
            className="chip shrink-0"
            aria-pressed={board === k}
            onClick={() => setBoard(k)}
            style={
              board === k
                ? { background: "var(--ink)", color: "var(--on-dark-fill)", borderColor: "var(--ink)" }
                : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>

      {VIEWS[board].length > 1 && (
        <div className="segmented w-full mt-3" role="group" aria-label="Which scores">
          {VIEWS[board].map(([k, label]) => (
            <button
              key={k}
              className="flex-1"
              style={{ paddingInline: 6, fontSize: 13 }}
              aria-pressed={view === k}
              onClick={() => setView(k)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 text-center">
        <span className="sticker" style={{ transform: "rotate(-2deg)" }}>
          {title}
        </span>
        {sub && <p className="meta mt-2 px-2">{sub}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6 text-center">
          <Flag size={44} strokeWidth={2} aria-hidden="true" className="mx-auto" style={{ color: "var(--lime)" }} />
          <p className="heading mt-3">No scores yet</p>
          <p className="meta mt-1">Play first. Set the bar. Make them sweat.</p>
        </div>
      ) : (
        <>
          {/* Podium: 2nd, 1st, 3rd */}
          <div className="mt-7 flex items-end justify-center gap-4">
            {[top[1], top[0], top[2]].map((r, slot) => {
              if (!r) return <span key={slot} className="w-20" />;
              const p = person(r.id);
              const first = slot === 1;
              return (
                <div key={r.id} className="flex flex-col items-center">
                  {first && (
                    <Crown
                      size={36}
                      strokeWidth={2.25}
                      aria-hidden="true"
                      className="-mb-1.5"
                      style={{ color: "var(--sun)", fill: "var(--sun)", stroke: "var(--edge)" }}
                    />
                  )}
                  <span
                    className="rounded-full"
                    style={{
                      border: "var(--bd)",
                      boxShadow: first
                        ? "0 0 0 4px var(--sun), var(--pop-lg)"
                        : "var(--pop)",
                    }}
                  >
                    <Avatar
                      src={p.avatar}
                      initials={p.initials}
                      color={p.color}
                      size={first ? 96 : 70}
                    />
                  </span>
                  <span
                    className="-mt-3 px-2.5 py-0.5 rounded-full font-extrabold tabular-nums text-[14px] relative"
                    style={{ background: "var(--surface)", border: "var(--bd)" }}
                  >
                    {r.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Best player */}
          {best && (
            <div className="mt-7 flex items-center justify-center gap-3 text-center">
              <Sparkles size={26} aria-hidden="true" style={{ color: "var(--sun)" }} />
              <div>
                <p className="meta font-bold">
                  {champ}
                </p>
                <p className="display uppercase" style={{ fontSize: 30, lineHeight: 1 }}>
                  {person(best.id).name}
                </p>
                <p className="font-extrabold tabular-nums mt-1">
                  {best.value} {best.unit}
                </p>
              </div>
              <Sparkles size={26} aria-hidden="true" style={{ color: "var(--sun)", transform: "scaleX(-1)" }} />
            </div>
          )}

          {/* Ranked rows */}
          <ol className="mt-7 grid gap-4">
            {top.map((r, i) => (
              <RankRow key={r.id} row={r} tone={ROW_TONES[i]} />
            ))}
          </ol>
          {rest.length > 0 && (
            <>
              <hr className="hairline my-6 mx-10" />
              <ol className="grid gap-4">
                {rest.map((r) => (
                  <RankRow key={r.id} row={r} tone="var(--surface)" light />
                ))}
              </ol>
            </>
          )}
        </>
      )}

      {board === "overall" && view === "all" && mine && (
        <div className="card mt-8 p-4">
          <p className="font-bold text-cream">Your all-time</p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              ["Daily pts", mine.daily_points],
              ["Word Up pts", mine.word_points ?? 0],
              ["Days played", mine.daily_days + (mine.word_days ?? 0)],
              ["Daily wins", mine.daily_crowns],
              ["Live games", mine.live_played],
              ["Live wins", mine.live_wins],
              [
                "Win rate",
                mine.live_played ? `${Math.round((mine.live_wins / mine.live_played) * 100)}%` : "–",
              ],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl py-2" style={{ background: "var(--fill)" }}>
                <dd className="display tabular-nums" style={{ fontSize: 22 }}>
                  {v}
                </dd>
                <dt className="meta" style={{ fontSize: 12 }}>
                  {k}
                </dt>
              </div>
            ))}
          </dl>
          <p className="meta mt-4 mb-2">Wins by game</p>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["Trivia", mine.trivia_wins],
              ["Ludo", mine.ludo_wins],
              ["Judgement", mine.kachuful_wins],
              ["Word Up", mine.word_wins],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl py-2" style={{ background: "var(--fill)" }}>
                <dd className="font-extrabold tabular-nums text-cream">{v}</dd>
                <dt className="meta" style={{ fontSize: 11.5 }}>
                  {k}
                </dt>
              </div>
            ))}
          </dl>
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

function RankRow({ row, tone, light }: { row: Row; tone: string; light?: boolean }) {
  const p = person(row.id);
  const me = row.id === "me";
  return (
    <li
      className="relative flex items-center rounded-[24px] overflow-visible"
      style={{
        background: tone,
        color: light ? "var(--ink)" : "var(--on-accent)",
        border: me ? "3px solid var(--ink)" : "var(--bd)",
        boxShadow: "var(--pop-lg)",
      }}
    >
      <span
        className="w-16 self-stretch flex items-center justify-center display rounded-l-[20px]"
        style={{ background: "rgba(0,0,0,0.18)", fontSize: 22 }}
      >
        #{row.rank}
      </span>
      <span className="py-2.5 pl-3">
        <span className="block rounded-full" style={{ border: "var(--bd)" }}>
          <Avatar src={p.avatar} initials={p.initials} color={p.color} size={52} />
        </span>
      </span>
      <span className="flex-1 min-w-0 pl-3 pr-4 py-2.5">
        <span className="block display tabular-nums" style={{ fontSize: 26, lineHeight: 1 }}>
          {row.value}
          <span className="text-[14px] font-bold ml-1 opacity-80">{row.unit}</span>
        </span>
        <span className="block font-bold text-[16px] truncate mt-0.5">{p.name}</span>
      </span>
      <span className="absolute -bottom-3 right-3 flex gap-1.5">
        {row.chips.map((c) => (
          <span
            key={c.k}
            className="px-2 py-0.5 rounded-full text-[12px] font-extrabold whitespace-nowrap"
            style={{ background: "var(--edge)", color: "#fff" }}
          >
            {c.node}
          </span>
        ))}
      </span>
    </li>
  );
}
