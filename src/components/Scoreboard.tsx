/**
 * The season on the Games page: a summary card (top 3, your place, the gap)
 * and the full board. Points come from the three daily games only; live games
 * with your 25 don't count.
 */
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Ico } from "@/components/Ico";
import { Leaderboard, withRanks, type LeaderRow } from "@/components/Leaderboard";
import { wordDay } from "@/components/DayResults";
import { friendById, meView, useSocial } from "@/lib/social";
import {
  SEASON_DAYS,
  addDays,
  dayRanking,
  seasonOf,
  today,
  tuneRanking,
  useDaily,
} from "@/lib/daily";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/SocialUI";
import { Crown } from "lucide-react";


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

/** Last season's champion(s) among you and your 25. */
function useLastChamps(season: number) {
  const s = useSocial();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (season < 2 || s.mode !== "live" || !s.me) return;
    let alive = true;
    const me = s.me.id;
    void supabase
      .from("season_winners" as never)
      .select("user_id")
      .eq("season" as never, (season - 1) as never)
      .then(({ data }) => {
        if (!alive) return;
        const mine = new Set([me, ...s.people.filter((p) => p.mutual !== false).map((p) => p.id)]);
        setIds(
          ((data as { user_id: string }[] | null) ?? [])
            .map((r) => r.user_id)
            .filter((id) => mine.has(id))
            .map((id) => (id === me ? "me" : id)),
        );
      });
    return () => {
      alive = false;
    };
  }, [season, s.mode, s.me?.id, s.people.length]);
  return ids;
}

/** Season header: which season, how far in, and last season's champ. */
function SeasonBanner({
  season,
  champs,
}: {
  season: ReturnType<typeof seasonOf>;
  champs: string[];
}) {
  const pct = Math.round((season.dayNo / SEASON_DAYS) * 100);
  return (
    <div
      className="mt-5 rounded-[24px] p-4 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 85% 10%, rgba(247,201,72,0.35), transparent 50%), linear-gradient(150deg, #3A2A6E, #1B1730)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <p className="label-caps" style={{ color: "#F7C948" }}>
        Season {season.n}
      </p>
      <p className="display mt-1" style={{ fontSize: 26, lineHeight: 1.05 }}>
        Day {season.dayNo} of {SEASON_DAYS}
      </p>
      <div
        className="mt-3 h-2.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.12)" }}
        role="progressbar"
        aria-valuenow={season.dayNo}
        aria-valuemin={1}
        aria-valuemax={SEASON_DAYS}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #F7C948, #F27DA6)" }}
        />
      </div>
      <p className="meta mt-2.5" style={{ fontSize: 13 }}>
        {season.left === 0
          ? "Last day. Whoever's on top at midnight takes the title."
          : `${season.left} day${season.left === 1 ? "" : "s"} left. Top of your 25 wins the Season ${season.n} title.`}
      </p>
      {champs.length > 0 && (
        <div className="mt-3 flex items-center gap-2.5">
          <span className="flex -space-x-2">
            {champs.slice(0, 3).map((id) => {
              const p = person(id);
              return (
                <span key={id} className="rounded-full" style={{ border: "2px solid #F7C948" }}>
                  <Avatar src={p.avatar} initials={p.initials} color={p.color} size={28} />
                </span>
              );
            })}
          </span>
          <span className="font-semibold" style={{ fontSize: 13.5 }}>
            <Crown
              size={14}
              aria-hidden="true"
              className="inline -mt-0.5 mr-1"
              style={{ color: "#F7C948", fill: "#F7C948" }}
            />
            Season {season.n - 1} champ: {champs.map((id) => person(id).name).join(" & ")}
          </span>
        </div>
      )}
    </div>
  );
}

/** This season's standings among you and your 25 (all three daily games). */
function useSeasonRows() {
  const d = useDaily();
  const day = today();
  const season = seasonOf(day);
  const totals: Record<string, number> = {};
  const add = (id: string, n: number) => (totals[id] = (totals[id] ?? 0) + n);
  for (let k = season.start; k <= day; k = addDays(k, 1)) {
    for (const r of dayRanking(d, k)) add(r.id, r.points);
    for (const [id, w] of Object.entries(wordDay(d.words[k]))) add(id, w.points);
    for (const r of tuneRanking(d, k)) add(r.id, r.points);
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
  return { season, rows, streak: playStreak(d.board) };
}

/**
 * Games home: the season at a glance (top 3, your place, the gap). Tap for
 * the full board.
 */
export function SeasonCard() {
  const { season, rows, streak } = useSeasonRows();
  const champs = useLastChamps(season.n);
  const [open, setOpen] = useState(false);
  const me = rows.find((r) => r.me);
  const ahead = me ? [...rows].reverse().find((r) => r.rank < me.rank) : undefined;
  const gap = me && ahead ? Number(ahead.value) - Number(me.value) : 0;
  const pct = Math.round((season.dayNo / SEASON_DAYS) * 100);
  const [a, b, c] = rows;
  const tile = (r: LeaderRow | undefined, medal: string, tone: string, top?: boolean) =>
    r ? (
      <div
        className="flex-1 min-w-0 rounded-[16px] flex flex-col items-center gap-1 py-2.5 px-1"
        style={{
          background: tone,
          boxShadow: r.me ? "inset 0 0 0 2px var(--lime)" : undefined,
          marginTop: top ? 0 : 10,
        }}
      >
        <Avatar src={r.avatar} initials={r.initials} color={r.color} size={top ? 48 : 40} />
        <span className="font-extrabold truncate max-w-full" style={{ fontSize: 12.5 }}>
          {medal} {r.name}
        </span>
        <span className="font-black tabular-nums" style={{ fontSize: 13, color: "var(--lime)" }}>
          ♦ {r.value}
        </span>
      </div>
    ) : (
      <div className="flex-1" />
    );
  return (
    <section className="px-5 mt-7" aria-label="Season">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="label-caps">Season {season.n}</h2>
        <span className="meta font-semibold" style={{ fontSize: 12.5 }}>
          Day {season.dayNo} of {SEASON_DAYS}
        </span>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-[22px] p-3.5"
        style={{
          background:
            "radial-gradient(circle at 85% 10%, rgba(247,201,72,0.25), transparent 50%), linear-gradient(150deg, #3A2A6E, #1B1730)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
        aria-label="Season board"
      >
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #F7C948, #F27DA6)" }}
          />
        </div>
        {rows.length ? (
          <>
            <div className="mt-3 flex items-start gap-2">
              {tile(b, "🥈", "rgba(70,110,230,0.35)")}
              {tile(a, "🥇", "rgba(244,201,107,0.3)", true)}
              {tile(c, "🥉", "rgba(241,120,70,0.3)")}
            </div>
            <div
              className="mt-3 rounded-[14px] px-3 py-2 flex items-center justify-between gap-2"
              style={{ background: "rgba(0,0,0,0.25)", fontSize: 13 }}
            >
              <span className="min-w-0 truncate">
                {!me
                  ? "Play today's games to get on the board."
                  : me.rank === 1
                    ? "You're 1st. Hold on to it."
                    : `You're ${ordinalOf(me.rank)}${ahead ? ` · ${gap} behind ${ahead.name}` : ""}`}
              </span>
              <span className="shrink-0 font-bold" style={{ color: "var(--ink-2)" }}>
                Full board ›
              </span>
            </div>
          </>
        ) : (
          <p className="meta mt-3" style={{ fontSize: 13 }}>
            No points yet this season. Play today's games to get on the board.
          </p>
        )}
      </button>
      {open && (
        <div className="relative z-[70]">
          <Sheet title={`Season ${season.n}`} onClose={() => setOpen(false)}>
            <div className="-mt-5">
              <SeasonBanner season={season} champs={champs} />
            </div>
            {rows.length > 0 && (
              <div className="mt-6">
                <Leaderboard rows={rows} />
              </div>
            )}
            {streak > 0 && (
              <p className="text-center mt-6 font-extrabold" style={{ fontSize: 14 }}>
                <Ico i={Flame} size={15} /> Day {streak} of playing in a row
              </p>
            )}
            <p className="text-center meta mt-4 pb-4">
              Points from all three daily games. Only your mutual 25 see your scores.
            </p>
          </Sheet>
        </div>
      )}
    </section>
  );
}

const ordinalOf = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
