/**
 * Scores tab: a podium for the top 3, a "best player" banner and colourful
 * ranked rows. Today (best try in today's game) or the week (points).
 */
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GAMES } from "@/components/ArcadeGames";
import { friendById, meView } from "@/lib/social";
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
  chips: string[];
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
  const [view, setView] = useState<"today" | "week" | "last">("today");
  const day = today();
  const g = GAMES[gameFor(day)];

  const rows: Row[] =
    view === "today"
      ? dayRanking(d, day).map((r) => ({
          id: r.id,
          rank: r.rank,
          value: r.best,
          unit: g.unit,
          chips: [`↻ ${r.tries.length}`, `+${r.points} pts`],
        }))
      : weekStandings(d, view === "week" ? thisWeek() : lastWeek()).map((r, i, all) => ({
          id: r.id,
          rank: i > 0 && all[i - 1].points === r.points ? i : i + 1,
          value: r.points,
          unit: "pts",
          chips: [...(r.wins ? [`👑 ×${r.wins}`] : []), `${r.days}d played`],
        }));

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const best = rows[0];
  const streak = playStreak(d.board);
  const title =
    view === "today" ? `${g.emoji} ${g.name}` : view === "week" ? "🏆 This week" : "🏆 Last week";

  return (
    <section className="px-5 mt-5 pb-4">
      <div className="segmented w-full" role="group" aria-label="Which scores">
        {(
          [
            ["today", "Today"],
            ["week", "This week"],
            ["last", "Last week"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className="flex-1" aria-pressed={view === k} onClick={() => setView(k)}>
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
            : "Daily points: 1st 10 · 2nd 8 · 3rd 6 · 4th 5 · 5th 4 · played 2"}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6 text-center">
          <p className="text-5xl">🏁</p>
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
                    <span className="text-4xl -mb-2 float" aria-hidden="true">
                      👑
                    </span>
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
              <span className="text-3xl" style={{ transform: "scaleX(-1)" }} aria-hidden="true">
                🌿
              </span>
              <div>
                <p className="meta font-bold">
                  {view === "today" ? "Best player today" : "Player of the week"}
                </p>
                <p className="display uppercase" style={{ fontSize: 30, lineHeight: 1 }}>
                  {person(best.id).name}
                </p>
                <p className="font-extrabold tabular-nums mt-1">
                  {best.value} {best.unit}
                </p>
              </div>
              <span className="text-3xl" aria-hidden="true">
                🌿
              </span>
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
            🔥 DAY {streak} of playing in a row
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
            key={c}
            className="px-2 py-0.5 rounded-full text-[12px] font-extrabold whitespace-nowrap"
            style={{ background: "var(--edge)", color: "#fff" }}
          >
            {c}
          </span>
        ))}
      </span>
    </li>
  );
}
