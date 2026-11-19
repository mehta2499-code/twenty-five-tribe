/**
 * Scores → Daily: one day at a time (flip back through the last 2 weeks).
 * A big card per daily game, like a game show: the game's art, a mini podium,
 * "Best player" (only when there's one winner), then the top 3 and your own
 * spot in bright ranked pills. Three daily games: the mini game, Word Up and
 * Name That Tune.
 */
import { Fragment, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Crown, Play, RotateCw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt } from "@/components/GameArt";
import { PersonLink } from "@/components/PersonLink";
import { GAMES } from "@/components/ArcadeGames";
import { withRanks } from "@/components/Leaderboard";
import { Sheet } from "@/components/SocialUI";
import { friendById, meView } from "@/lib/social";
import { tuneOf } from "@/lib/earworm";
import {
  TRIES,
  tuneRanking,
  secRanking,
  addDays,
  dayRanking,
  gameFor,
  lastWeek,
  seasonOf,
  today,
  untilMidnight,
  useDaily,
  type WordResult,
} from "@/lib/daily";

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

/** Word Up points for one day: fewest guesses first; didn't solve it = 2 for playing. */
export function wordDay(results: Record<string, WordResult> | undefined) {
  const out: Record<string, { points: number; rank: number; guesses: number; grid: string }> = {};
  const list = Object.entries(results ?? {}).sort((a, b) => a[1].guesses - b[1].guesses);
  for (const { r, rank } of withRanks(list, ([, w]) => w.guesses))
    out[r[0]] = {
      rank,
      points: r[1].guesses > 6 ? 2 : RANK_PTS(rank),
      guesses: r[1].guesses,
      grid: r[1].grid,
    };
  return out;
}

const dayTitle = (k: string) => {
  const t = today();
  if (k === t) return "Today";
  if (k === addDays(t, -1)) return "Yesterday";
  return new Date(`${k}T00:00:00Z`).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

type Row = {
  id: string;
  rank: number;
  score: string;
  tries?: number;
  points: number;
  grid?: string;
};

const PILL: { bg: string; dark: string }[] = [
  { bg: "#EE6A6A", dark: "#C94B4B" },
  { bg: "#178A6E", dark: "#0F6B55" },
  { bg: "#8C6CF0", dark: "#6E4FD6" },
];

/** A game's board for a day: podium, best player (if one), top 3 + you. */
function BoardBody({ rows, unit }: { rows: Row[]; unit: string }) {
  const [a, b, c] = rows;
  const best = rows.filter((r) => r.rank === 1);
  const [all, setAll] = useState(false);
  const mineRow = rows.find((r) => r.id === "me");
  const shortList =
    mineRow && rows.indexOf(mineRow) >= 3 ? [...rows.slice(0, 3), mineRow] : rows.slice(0, 3);
  return (
    <>
      {/* Mini podium: 2nd · 1st (crowned) · 3rd */}
      <div className="mt-6 flex items-end justify-center gap-4">
        {[b, a, c].map((r, slot) =>
          r ? (
            <MiniFace key={r.id} r={r} unit={unit} top={slot === 1} />
          ) : (
            <span key={slot} className="w-14" />
          ),
        )}
      </div>

      {/* Best player */}
      {best.length === 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Branch />
          <div className="text-center">
            <p className="font-bold" style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Best Player
            </p>
            <p className="display uppercase" style={{ fontSize: 26, lineHeight: 1 }}>
              {best.map((r) => person(r.id).name).join(" & ")}
            </p>
            <p className="font-extrabold tabular-nums" style={{ fontSize: 14 }}>
              {best[0].score} {unit}
            </p>
          </div>
          <Branch flip />
        </div>
      )}

      {/* Everyone, in bright ranked pills. */}
      {/* Top 3, plus your own spot if you're further down. */}
      <ol className="mt-5 grid gap-3.5">
        {(all ? rows : shortList).map((r, i, list) => (
          <Fragment key={r.id}>
            {i > 0 && rows.indexOf(r) > rows.indexOf(list[i - 1]) + 1 && !all && (
              <li aria-hidden="true" className="text-center meta leading-none -my-1.5">
                ···
              </li>
            )}
            <RankPill r={r} unit={unit} />
          </Fragment>
        ))}
      </ol>
      {rows.length > shortList.length && (
        <button
          onClick={() => setAll((v) => !v)}
          className="mt-4 mx-auto block meta font-semibold"
          style={{ fontSize: 13 }}
        >
          {all ? "Show less" : `See all ${rows.length}`}
        </button>
      )}
    </>
  );
}

function MiniFace({ r, unit, top }: { r: Row; unit: string; top: boolean }) {
  const p = person(r.id);
  const size = top ? 62 : 48;
  return (
    <div className="flex flex-col items-center">
      {top && (
        <Crown
          size={24}
          aria-hidden="true"
          className="-mb-1.5 relative z-[1]"
          style={{ color: "#F7C948", fill: "#F7C948", stroke: "#9C6F14" }}
        />
      )}
      <span
        className="rounded-full"
        style={{
          border: `3px solid ${top ? "#F7C948" : "rgba(255,255,255,0.25)"}`,
          boxShadow: top ? "0 0 18px rgba(247,201,72,0.45)" : undefined,
        }}
      >
        <Avatar src={p.avatar} initials={p.initials} color={p.color} size={size} />
      </span>
      <span
        className="-mt-2 relative rounded-full px-2 py-0.5 font-extrabold tabular-nums"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          fontSize: 11.5,
        }}
      >
        {r.score} {unit}
      </span>
    </div>
  );
}

/** A laurel branch beside "Best Player". */
function Branch({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="26"
      height="52"
      viewBox="0 0 26 52"
      aria-hidden="true"
      style={{ transform: flip ? "scaleX(-1)" : undefined, color: "var(--ink)" }}
    >
      <path d="M20 4 Q6 24 18 48" fill="none" stroke="currentColor" strokeWidth="2" />
      {[8, 16, 24, 32, 40].map((y, i) => (
        <ellipse
          key={y}
          cx={i % 2 ? 17 : 9}
          cy={y}
          rx="3.4"
          ry="6.5"
          fill="currentColor"
          transform={`rotate(${i % 2 ? 35 : -35} ${i % 2 ? 17 : 9} ${y})`}
        />
      ))}
    </svg>
  );
}

/** Word Up tiles, tiny (colours only, never the letters). */
function MiniGrid({ grid }: { grid: string }) {
  const lines = grid.split("\n").filter(Boolean).slice(0, 6);
  if (!lines.length) return null;
  const tone = (ch: string) =>
    ch === "🟩" ? "#B8F25C" : ch === "🟨" ? "#F7C948" : "rgba(255,255,255,0.25)";
  return (
    <span className="grid gap-[2px]" aria-hidden="true">
      {lines.map((l, i) => (
        <span key={i} className="flex gap-[2px]">
          {Array.from(l)
            .slice(0, 5)
            .map((ch, k) => (
              <span
                key={k}
                className="block rounded-[2px]"
                style={{ width: 7, height: 7, background: tone(ch) }}
              />
            ))}
        </span>
      ))}
    </span>
  );
}

function RankPill({ r, unit }: { r: Row; unit: string }) {
  const p = person(r.id);
  const tone = PILL[r.rank - 1] ?? { bg: "var(--surface)", dark: "rgba(0,0,0,0.25)" };
  const me = r.id === "me";
  return (
    <li
      className="relative flex items-center rounded-[22px]"
      style={{
        background: tone.bg,
        color: r.rank <= 3 ? "#fff" : "var(--ink)",
        boxShadow: `0 5px 0 ${tone.dark}, 0 12px 22px rgba(0,0,0,0.3)`,
        outline: me ? "2px solid var(--lime)" : undefined,
        outlineOffset: 2,
      }}
    >
      <span
        className="w-14 self-stretch flex items-center justify-center font-black rounded-l-[22px]"
        style={{ background: "rgba(0,0,0,0.16)", fontSize: 20 }}
      >
        #{r.rank}
      </span>
      <span className="py-2 pl-2.5">
        <PersonLink id={r.id} label={p.name} className="block rounded-[14px]">
          <span
            className="block rounded-[14px] overflow-hidden"
            style={{ border: "2px solid rgba(255,255,255,0.7)" }}
          >
            <Avatar src={p.avatar} initials={p.initials} color={p.color} size={46} />
          </span>
        </PersonLink>
      </span>
      <span className="flex-1 min-w-0 pl-3 pr-3 py-2">
        <span className="block font-black tabular-nums" style={{ fontSize: 22, lineHeight: 1.05 }}>
          {r.score}
          {unit && (
            <span className="ml-1 font-extrabold opacity-85" style={{ fontSize: 13 }}>
              {unit}
            </span>
          )}
        </span>
        <span className="block font-bold truncate opacity-90" style={{ fontSize: 14 }}>
          {p.name}
        </span>
      </span>
      {r.grid && (
        <span className="pr-4 py-2">
          <MiniGrid grid={r.grid} />
        </span>
      )}
      {/* Chips: tries used and points earned. */}
      <span className="absolute -bottom-2.5 right-3 flex gap-1.5">
        {r.tries !== undefined && (
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 font-extrabold tabular-nums"
            style={{ background: "#14121C", color: "#fff", fontSize: 11.5 }}
            aria-label={`${r.tries} of ${TRIES} tries`}
          >
            {r.tries} <RotateCw size={11} aria-hidden="true" style={{ color: "#F7C948" }} />
          </span>
        )}
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 font-extrabold tabular-nums"
          style={{ background: "#14121C", color: "#fff", fontSize: 11.5 }}
        >
          +{r.points}
          <svg width="11" height="11" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 1 L18 10 L10 19 L2 10 Z" fill="#2FBF71" />
            <path d="M10 1 L18 10 L10 10 Z" fill="#7BE3A6" />
          </svg>
        </span>
      </span>
    </li>
  );
}

// ---------- Games home: Today (three compact rows) + each game's board ----------
type DailyKind = "daily" | "word" | "tune" | "sec";
const TUNE_CATS: Record<string, string> = {
  bollywood: "Bollywood",
  punjabi: "Punjabi",
  english: "English",
};

/** Every daily game's rows for one day, plus what's needed to show them. */
function dayBoards(d: ReturnType<typeof useDaily>, day: string) {
  const isToday = day === today();
  const myTries = d.board[day]?.me ?? [];
  let revealed = !isToday || myTries.length > 0;
  try {
    revealed ||= localStorage.getItem(`tf.reveal.${day}`) === "1";
  } catch {
    // ignore
  }
  const g = GAMES[gameFor(day)];
  const game: Row[] = dayRanking(d, day).map((r) => ({
    id: r.id,
    rank: r.rank,
    score: `${r.best}`,
    tries: r.tries.filter((t) => t >= 0).length,
    points: r.points,
  }));
  const word: Row[] = Object.entries(wordDay(d.words[day]))
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([pid, w]) => ({
      id: pid,
      rank: w.rank,
      score: w.guesses > 6 ? "X/6" : `${w.guesses}/6`,
      points: w.points,
      grid: w.grid,
    }));
  const tune: Row[] = tuneRanking(d, day).map((r) => ({
    id: r.id,
    rank: r.rank,
    score:
      r.skips == null
        ? "✗"
        : r.skips === 0
          ? "No skips"
          : `${r.skips} skip${r.skips > 1 ? "s" : ""}`,
    points: r.points,
  }));
  const tuneCat = TUNE_CATS[tuneOf(day).cat];
  const sec: Row[] = secRanking(d, day).map((r) => ({
    id: r.id,
    rank: r.rank,
    score: (r.best / 1000).toFixed(3),
    tries: r.tries.filter((t) => t >= 0).length,
    points: r.points,
  }));
  return {
    daily: {
      art: (revealed ? gameFor(day) : "mystery") as Parameters<typeof GameArt>[0]["kind"],
      name: revealed ? g.name : "Today's game",
      bg: revealed
        ? `linear-gradient(140deg, ${g.tone}, #2B2350 130%)`
        : "linear-gradient(140deg, #F06292, #3A2366 130%)",
      rows: game,
      unit: revealed ? g.unit : "pts",
      tries: myTries.length,
      extra: "",
    },
    word: {
      art: "word" as const,
      name: "Word Up",
      bg: "linear-gradient(140deg, #2FBF71, #173D3A 130%)",
      rows: word,
      unit: "",
      tries: d.words[day]?.me ? 1 : 0,
      extra: "",
    },
    tune: {
      art: "earworm" as const,
      name: "Name That Tune",
      bg: "linear-gradient(140deg, #F2507B, #3A1A6B 130%)",
      rows: tune,
      unit: "",
      tries: d.tunes[day]?.me ? 1 : 0,
      extra: tuneCat,
    },
    sec: {
      art: "sec25" as const,
      name: "25 Sec",
      bg: "linear-gradient(140deg, #8C6CF0, #2B1A5C 130%)",
      rows: sec,
      unit: "s off",
      tries: d.secs[day]?.me?.length ?? 0,
      extra: "Count to 25",
    },
  };
}

/**
 * Today: the four daily games as compact rows. Tap a row to play (or, once
 * you've played, to see its board); your rank on the right opens the board too.
 */
export function TodaySection({
  onPlayDaily,
  onPlayWord,
  onPlayTune,
  onPlaySec,
}: {
  onPlayDaily?: () => void;
  onPlayWord?: () => void;
  onPlayTune?: () => void;
  onPlaySec?: () => void;
}) {
  const d = useDaily();
  const day = today();
  const [board, setBoard] = useState<DailyKind | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const b = dayBoards(d, day);
  const items: { kind: DailyKind; max: number; onPlay?: () => void }[] = [
    { kind: "daily", max: TRIES, onPlay: onPlayDaily },
    { kind: "word", max: 1, onPlay: onPlayWord },
    { kind: "tune", max: 1, onPlay: onPlayTune },
    { kind: "sec", max: TRIES, onPlay: onPlaySec },
  ];
  return (
    <section className="px-5 mt-6" aria-label="Today's games">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="label-caps">Today</h2>
        <span className="meta font-semibold" style={{ fontSize: 12.5 }}>
          resets in {untilMidnight()}
        </span>
      </div>
      <ul className="card overflow-hidden p-0" style={{ borderRadius: 22 }}>
        {items.map(({ kind, max, onPlay }, i) => {
          const x = b[kind];
          const mine = x.rows.find((r) => r.id === "me");
          const left = max - x.tries;
          const canPlay = left > 0 && !!onPlay;
          const status = canPlay
            ? x.tries
              ? `${x.tries}/${max}`
              : "Play"
            : max > 1
              ? `${max}/${max}`
              : "Done";
          return (
            <li
              key={kind}
              className="flex items-center gap-2 pl-2.5 pr-2 py-2.5"
              style={{ borderTop: i ? "1px solid var(--line)" : undefined }}
            >
              <button
                onClick={() => (canPlay ? onPlay!() : setBoard(kind))}
                className="flex-1 min-w-0 flex items-center gap-2.5 text-left active:opacity-80"
                aria-label={canPlay ? `Play ${x.name}` : `${x.name}: see today's board`}
              >
                <span
                  className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0"
                  style={{ background: x.bg, border: "2px solid rgba(255,255,255,0.18)" }}
                >
                  <GameArt kind={x.art} size={32} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block font-extrabold text-cream truncate"
                    style={{ fontSize: 15 }}
                  >
                    {x.name}
                  </span>
                  <span className="block meta truncate" style={{ fontSize: 12.5 }}>
                    {[x.extra, x.rows.length ? `${x.rows.length} played` : "Be the first"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-1 font-extrabold flex items-center gap-0.5"
                  style={
                    canPlay
                      ? {
                          background: "var(--lime)",
                          color: "var(--on-accent)",
                          border: "2px solid var(--edge)",
                          boxShadow: "0 2px 0 var(--edge)",
                          fontSize: 13,
                        }
                      : { background: "var(--fill)", color: "var(--lime)", fontSize: 13 }
                  }
                >
                  {canPlay ? (
                    <Play size={12} fill="currentColor" aria-hidden="true" />
                  ) : (
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  )}
                  {status}
                </span>
              </button>
              <button
                onClick={() => setBoard(kind)}
                className="shrink-0 w-[44px] h-[46px] rounded-[13px] flex flex-col items-center justify-center leading-none"
                style={{ background: "var(--fill)" }}
                aria-label={`${x.name} board${mine ? `, you're number ${mine.rank}` : ""}`}
              >
                <span className="font-black tabular-nums" style={{ fontSize: 16 }}>
                  {mine ? `#${mine.rank}` : "–"}
                </span>
                <span className="meta font-bold mt-1" style={{ fontSize: 9.5 }}>
                  board ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {board && <DailyBoard kind={board} onClose={() => setBoard(null)} />}
    </section>
  );
}

/** One daily game's board, any day back to the start of the season. */
function DailyBoard({ kind, onClose }: { kind: DailyKind; onClose: () => void }) {
  const d = useDaily();
  const [day, setDay] = useState(today());
  const first = [lastWeek(), seasonOf().start].sort()[0];
  const x = dayBoards(d, day)[kind];
  return (
    <div className="relative z-[70]">
      <Sheet title={x.name} onClose={onClose}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDay((k) => addDays(k, -1))}
            disabled={day <= first}
            aria-label="Previous day"
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-25"
            style={{ background: "var(--fill)" }}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="display uppercase" style={{ fontSize: 22 }}>
            {dayTitle(day)}
          </span>
          <button
            onClick={() => setDay((k) => addDays(k, 1))}
            disabled={day === today()}
            aria-label="Next day"
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-25"
            style={{ background: "var(--fill)" }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        {x.rows.length ? (
          <div className="pb-4">
            <BoardBody rows={x.rows} unit={x.unit} />
          </div>
        ) : (
          <p className="meta text-center py-10">
            Nobody played {day === today() ? "yet today" : "this day"}.
          </p>
        )}
      </Sheet>
    </div>
  );
}
