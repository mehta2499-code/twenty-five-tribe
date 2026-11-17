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
import { Crown } from "lucide-react";
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

type View = "daily" | "season";
const VIEWS: [View, string][] = [
  ["daily", "Daily"],
  ["season", "Season"],
];

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

export function Scoreboard({
  onPlayDaily,
  onPlayWord,
  onPlayTune,
}: {
  onPlayDaily?: () => void;
  onPlayWord?: () => void;
  onPlayTune?: () => void;
} = {}) {
  const d = useDaily();
  useEffect(() => track("leaderboard_viewed"), []);
  const [view, setView] = useState<View>("daily");
  const day = today();
  const season = seasonOf(day);
  const champs = useLastChamps(season.n);

  // Points per person for the chosen period.
  const totals: Record<string, number> = {};
  const add = (id: string, n: number) => (totals[id] = (totals[id] ?? 0) + n);
  // Season: every day so far this season.
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
  const streak = playStreak(d.board);

  return (
    <section className="px-5 mt-5 pb-4" aria-label="Daily games">
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
      {view === "season" && <SeasonBanner season={season} champs={champs} />}

      {view === "daily" ? (
        <div className="mt-5">
          <DayResults onPlayDaily={onPlayDaily} onPlayWord={onPlayWord} onPlayTune={onPlayTune} />
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
