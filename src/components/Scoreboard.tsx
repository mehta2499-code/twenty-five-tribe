import { Ico, TONE } from "@/components/Ico";
/**
 * Scores tab: a podium for the top 3, a "best player" banner and colourful
 * ranked rows. Today (best try in today's game) or the week (points).
 */
import { useEffect, useState } from "react";
import { Crown, Flag, Flame, RotateCw, Sparkles, Trophy } from "lucide-react";
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
  weekStandings,
} from "@/lib/daily";

type Row = {
  id: string;
  rank: number;
  value: number;
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

export function Scoreboard() {
  const d = useDaily();
  const [view, setView] = useState<"today" | "week" | "last" | "all">("today");
  const lifetime = useLifetime(view === "all");
  const day = today();
  const g = GAMES[gameFor(day)];

  const rows: Row[] =
    view === "all"
      ? [...lifetime]
          .sort((a, b) => b.points - a.points || b.live_wins - a.live_wins)
          .map((r, i, all) => ({
            id: r.user_id,
            rank: i > 0 && all[i - 1].points === r.points ? i : i + 1,
            value: r.points,
            unit: "pts",
            chips: [
              ...(r.live_wins
                ? [{ k: "w", node: <><Ico i={Trophy} c={TONE.win} size={12} /> {r.live_wins} win{r.live_wins === 1 ? "" : "s"}</> }]
                : []),
              ...(r.daily_crowns
                ? [{ k: "c", node: <><Ico i={Crown} c={TONE.win} size={12} /> ×{r.daily_crowns}</> }]
                : []),
            ],
          }))
      : view === "today"
      ? dayRanking(d, day).map((r) => ({
          id: r.id,
          rank: r.rank,
          value: r.best,
          unit: g.unit,
          chips: [
            { k: "t", node: <><Ico i={RotateCw} size={12} /> {r.tries.length}</> },
            { k: "p", node: `+${r.points} pts` },
          ],
        }))
      : weekStandings(d, view === "week" ? thisWeek() : lastWeek()).map((r, i, all) => ({
          id: r.id,
          rank: i > 0 && all[i - 1].points === r.points ? i : i + 1,
          value: r.points,
          unit: "pts",
          chips: [
            ...(r.wins ? [{ k: "c", node: <><Ico i={Crown} c={TONE.win} size={12} /> ×{r.wins}</> }] : []),
            { k: "d", node: `${r.days}d played` },
          ],
        }));

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const best = rows[0];
  const streak = playStreak(d.board);
  const title =
    view === "today"
      ? <><g.Icon size={14} strokeWidth={2.25} aria-hidden="true" /> {g.name}</>
      : view === "week"
        ? <><Ico i={Trophy} size={14} /> This week</>
        : view === "last"
          ? <><Ico i={Trophy} size={14} /> Last week</>
          : <><Ico i={Trophy} size={14} /> All-time</>;
  const mine = lifetime.find((r) => r.user_id === "me");

  return (
    <section className="px-5 mt-5 pb-4">
      <div className="segmented w-full" role="group" aria-label="Which scores">
        {(
          [
            ["today", "Today"],
            ["week", "This week"],
            ["last", "Last week"],
            ["all", "All-time"],
          ] as const
        ).map(([k, label]) => (
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

      <div className="mt-5 text-center">
        <span className="sticker" style={{ transform: "rotate(-2deg)" }}>
          {title}
        </span>
        <p className="meta mt-2">
          {view === "today"
            ? `${DAY_NAMES[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} · best try counts`
            : view === "all"
              ? "Every daily point ever, plus live games: win 10 · played 2"
              : "Daily points: 1st 10 · 2nd 8 · 3rd 6 · 4th 5 · 5th 4 · played 2"}
        </p>
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
                      border: "3px solid var(--edge)",
                      boxShadow: first
                        ? "0 0 0 4px var(--sun), 4px 4px 0 var(--edge)"
                        : "3px 3px 0 var(--edge)",
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
                    style={{ background: "var(--surface)", border: "2px solid var(--edge)" }}
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
                  {view === "today"
                    ? "Best player today"
                    : view === "all"
                      ? "All-time champ"
                      : "Player of the week"}
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

      {view === "all" && mine && (
        <div className="card mt-8 p-4">
          <p className="font-bold text-cream">Your all-time</p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              ["Daily pts", mine.daily_points],
              ["Days played", mine.daily_days],
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
              ["Kachuful", mine.kachuful_wins],
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
              border: "2px solid var(--edge)",
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
      className="relative flex items-center rounded-[22px] overflow-visible"
      style={{
        background: tone,
        color: light ? "var(--ink)" : "var(--on-accent)",
        border: me ? "3px solid var(--ink)" : "2px solid var(--edge)",
        boxShadow: "4px 4px 0 var(--edge)",
      }}
    >
      <span
        className="w-16 self-stretch flex items-center justify-center display rounded-l-[20px]"
        style={{ background: "rgba(0,0,0,0.18)", fontSize: 22 }}
      >
        #{row.rank}
      </span>
      <span className="py-2.5 pl-3">
        <span className="block rounded-full" style={{ border: "2px solid var(--edge)" }}>
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
