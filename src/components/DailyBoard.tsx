import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GAMES } from "@/components/ArcadeGames";
import { friendById, meView } from "@/lib/social";
import {
  DAY_NAMES,
  POINTS,
  TRIES,
  average,
  dayRanking,
  gameFor,
  lastWeek,
  thisWeek,
  today,
  untilMidnight,
  useDaily,
  weekDays,
  weekStandings,
} from "@/lib/daily";

function useTick(ms = 30_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function Who({ id, size = 34 }: { id: string; size?: number }) {
  const me = id === "me";
  const f = me ? null : friendById(id);
  const v = me ? meView() : f;
  return (
    <>
      <Avatar src={v?.avatar || undefined} initials={v?.initials ?? "?"} color={f?.color} size={size} />
      <span className="flex-1 min-w-0 truncate font-semibold text-cream" style={{ fontSize: 15 }}>
        {me ? "You" : (f?.name ?? "Someone")}
      </span>
    </>
  );
}

/** Big "today's game" card. */
export function DailyHero({ onPlay }: { onPlay: () => void }) {
  useTick();
  const d = useDaily();
  const day = today();
  const id = gameFor(day);
  const g = GAMES[id];
  const tries = d.board[day]?.me ?? [];
  const left = TRIES - tries.length;
  const ranking = dayRanking(d, day);
  const mine = ranking.find((r) => r.id === "me");
  const leader = ranking[0];

  return (
    <section className="px-5 mt-6">
      <button
        onClick={onPlay}
        className="w-full text-left rounded-[24px] p-5 relative overflow-hidden active:scale-[0.99] transition-transform"
        style={{ background: g.tone, color: "var(--on-accent)", border: "2px solid var(--edge)", boxShadow: "5px 5px 0 var(--edge)" }}
      >
        <div className="flex items-start justify-between">
          <span className="sticker" style={{ background: "var(--edge)", color: "#fff", transform: "rotate(-3deg)" }}>
            {DAY_NAMES[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]}'s game
          </span>
          <span className="text-[13px] font-bold opacity-80">new game in {untilMidnight()}</span>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-6xl float" aria-hidden="true">
            {g.emoji}
          </span>
          <div className="min-w-0">
            <h2 className="display" style={{ fontSize: 32, lineHeight: 1 }}>
              {g.name}
            </h2>
            <p className="mt-1.5 font-semibold text-[14px] leading-snug opacity-90">{g.blurb}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <div className="flex gap-1.5" aria-label={`${tries.length} of ${TRIES} tries used`}>
              {Array.from({ length: TRIES }).map((_, i) => (
                <span
                  key={i}
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ border: "2px solid var(--edge)", background: i < tries.length ? "var(--edge)" : "rgba(255,255,255,0.5)" }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[13px] font-bold">
              {tries.length === 0
                ? `${TRIES} tries. Average counts.`
                : `Avg ${average(tries)}${mine ? ` · #${mine.rank} of ${ranking.length}` : ""}`}
            </p>
          </div>
          <span
            className="px-5 py-3 rounded-full font-extrabold text-[15px] whitespace-nowrap"
            style={{ background: "var(--edge)", color: "#fff" }}
          >
            {left === TRIES ? "Play ▶" : left > 0 ? `${left} left ▶` : "See results"}
          </span>
        </div>
        {leader && leader.id !== "me" && (
          <p className="mt-3 text-[13px] font-bold opacity-90">
            👑 {friendById(leader.id)?.name.split(" ")[0] ?? "Someone"} leads with {leader.avg}. Not on your watch.
          </p>
        )}
      </button>
    </section>
  );
}

/** Mon–Sun strip: what's on each day and how you did. */
export function WeekStrip() {
  const d = useDaily();
  const t = today();
  return (
    <section className="mt-5" aria-label="This week's games">
      <div className="flex gap-2 overflow-x-auto px-5 pb-2 no-scrollbar">
        {weekDays(thisWeek()).map((day, i) => {
          const g = GAMES[gameFor(day)];
          const isToday = day === t;
          const past = day < t;
          const mine = dayRanking(d, day).find((r) => r.id === "me");
          return (
            <div
              key={day}
              className="shrink-0 w-[74px] rounded-2xl px-2 py-2.5 text-center"
              style={{
                border: "2px solid var(--edge)",
                background: isToday ? "var(--lime)" : "var(--surface)",
                color: isToday ? "var(--on-accent)" : "var(--ink)",
                opacity: past || isToday ? 1 : 0.55,
                boxShadow: isToday ? "var(--pop)" : "none",
              }}
            >
              <p className="text-[11px] font-extrabold uppercase">{DAY_NAMES[i]}</p>
              <p className="text-2xl mt-0.5">{g.emoji}</p>
              <p className="text-[10.5px] font-bold leading-tight mt-0.5 truncate">{g.name}</p>
              <p className="text-[11px] font-extrabold mt-1">
                {mine ? (mine.rank === 1 ? "👑 1st" : `#${mine.rank}`) : past ? "–" : isToday ? "today" : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Today's table: averages so far. */
export function TodayTable() {
  const d = useDaily();
  const day = today();
  const rows = dayRanking(d, day);
  const g = GAMES[gameFor(day)];
  return (
    <section className="px-5 mt-7">
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="heading" style={{ fontSize: 19 }}>
          Today at the table
        </h2>
        <span className="meta">avg of tries</span>
      </div>
      {rows.length === 0 ? (
        <div className="card px-4 py-5 text-center">
          <p className="font-bold text-cream">Nobody's played {g.name} yet 👀</p>
          <p className="meta mt-1">Go first. Set the bar. Make them sweat.</p>
        </div>
      ) : (
        <ol className="card overflow-hidden divide-y" style={{ borderColor: "var(--line)" }}>
          {rows.slice(0, 10).map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ background: r.id === "me" ? "var(--fill)" : "transparent" }}
            >
              <span className="w-7 text-center font-extrabold tabular-nums" style={{ fontSize: r.rank <= 3 ? 20 : 15 }}>
                {MEDALS[r.rank - 1] ?? r.rank}
              </span>
              <Who id={r.id} />
              <span className="meta tabular-nums">{r.tries.length}/{TRIES}</span>
              <span className="font-extrabold tabular-nums text-cream w-10 text-right" style={{ fontSize: 17 }}>
                {r.avg}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Weekly points, plus last week's champ. */
export function WeekTable() {
  const d = useDaily();
  const [which, setWhich] = useState<"this" | "last">("this");
  const rows = weekStandings(d, which === "this" ? thisWeek() : lastWeek());
  const champ = weekStandings(d, lastWeek())[0];
  return (
    <section className="px-5 mt-7">
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="heading" style={{ fontSize: 19 }}>
          Weekly results
        </h2>
        <span className="meta">resets Monday</span>
      </div>
      {champ && (
        <div className="card p-3.5 mb-3 flex items-center gap-3" style={{ background: "var(--sun)", color: "var(--on-accent)" }}>
          <span className="text-3xl">👑</span>
          <p className="flex-1 font-bold text-[14px] leading-snug">
            Last week's champ:{" "}
            {champ.id === "me" ? "YOU. Act humble." : (friendById(champ.id)?.name ?? "Someone")} · {champ.points} pts
          </p>
        </div>
      )}
      <div className="segmented mb-3" role="group" aria-label="Choose week">
        <button aria-pressed={which === "this"} onClick={() => setWhich("this")}>
          This week
        </button>
        <button aria-pressed={which === "last"} onClick={() => setWhich("last")}>
          Last week
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="card px-4 py-5 text-center">
          <p className="font-bold text-cream">No points yet</p>
          <p className="meta mt-1">Play today's game to get on the board.</p>
        </div>
      ) : (
        <ol className="card overflow-hidden divide-y" style={{ borderColor: "var(--line)" }}>
          {rows.slice(0, 10).map((r, i) => (
            <li
              key={r.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ background: r.id === "me" ? "var(--fill)" : "transparent" }}
            >
              <span className="w-7 text-center font-extrabold tabular-nums" style={{ fontSize: i < 3 ? 20 : 15 }}>
                {MEDALS[i] ?? i + 1}
              </span>
              <Who id={r.id} />
              <span className="meta whitespace-nowrap">
                {r.wins > 0 ? `${r.wins}× 👑 · ` : ""}
                {r.days}d
              </span>
              <span className="font-extrabold tabular-nums text-cream w-12 text-right" style={{ fontSize: 17 }}>
                {r.points}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="meta mt-2 text-center">
        Daily points: {POINTS.map((p, i) => `${["1st", "2nd", "3rd", "4th", "5th"][i]} ${p}`).join(" · ")} · played 2
      </p>
    </section>
  );
}
