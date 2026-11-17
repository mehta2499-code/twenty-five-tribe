/**
 * Scores → Daily: one day at a time (flip back through the last 2 weeks).
 * A big card per daily game, like a game show: the game's art, a mini podium,
 * "Best player" (only when there's one winner), then the top 3 and your own
 * spot in bright ranked pills. Three daily games: the mini game, Word Up and
 * Name That Tune.
 */
import { Fragment, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Hourglass,
  Play,
  RotateCw,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt } from "@/components/GameArt";
import { PersonLink } from "@/components/PersonLink";
import { GAMES } from "@/components/ArcadeGames";
import { withRanks } from "@/components/Leaderboard";
import { friendById, meView } from "@/lib/social";
import { tuneOf } from "@/lib/earworm";
import {
  TRIES,
  tuneRanking,
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

export function DayResults({
  onPlayDaily,
  onPlayWord,
  onPlayTune,
}: {
  onPlayDaily?: () => void;
  onPlayWord?: () => void;
  onPlayTune?: () => void;
}) {
  const d = useDaily();
  const [day, setDay] = useState(today());
  const isToday = day === today();
  // As far back as scores are loaded: last week or the start of the season.
  const first = [lastWeek(), seasonOf().start].sort()[0];
  // A countdown to the next game, while looking at today.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Today's game is a surprise until you reveal it (Games tab) or play it.
  const myTries = d.board[day]?.me ?? [];
  let revealed = !isToday || myTries.length > 0;
  try {
    revealed ||= localStorage.getItem(`tf.reveal.${day}`) === "1";
  } catch {
    // ignore
  }
  const id = gameFor(day);
  const g = GAMES[id];

  const game: Row[] = dayRanking(d, day).map((r) => ({
    id: r.id,
    rank: r.rank,
    score: `${r.best}`,
    tries: r.tries.filter((t) => t >= 0).length,
    points: r.points,
  }));
  const words = wordDay(d.words[day]);
  const word: Row[] = Object.entries(words)
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([pid, w]) => ({
      id: pid,
      rank: w.rank,
      score: w.guesses > 6 ? "X/6" : `${w.guesses}/6`,
      points: w.points,
      grid: w.grid,
    }));

  // Name That Tune: quickest first.
  const tune: Row[] = tuneRanking(d, day).map((r) => ({
    id: r.id,
    rank: r.rank,
    score: r.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : "✗",
    points: r.points,
  }));
  const playedTune = !!d.tunes[day]?.me;
  const tuneDay = tuneOf(day);
  const tuneCat = { bollywood: "Bollywood", punjabi: "Punjabi", english: "English" }[tuneDay.cat];

  const left = TRIES - myTries.length;
  const playedWord = !!d.words[day]?.me;

  return (
    <div>
      {/* Day picker */}
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
        <h3
          className="display uppercase text-center"
          style={{ fontSize: 26, lineHeight: 1, letterSpacing: "-0.01em" }}
        >
          {dayTitle(day)}
        </h3>
        <button
          onClick={() => setDay((k) => addDays(k, 1))}
          disabled={isToday}
          aria-label="Next day"
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-25"
          style={{ background: "var(--fill)" }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <GameCard
        art={revealed ? id : "mystery"}
        name={revealed ? g.name : "Today's game"}
        bg={
          revealed
            ? `radial-gradient(circle at 50% 40%, rgba(255,255,255,0.28), transparent 55%), linear-gradient(160deg, ${g.tone}, #2B2350 120%)`
            : "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.25), transparent 55%), linear-gradient(160deg, #F06292, #3A2366 120%)"
        }
        play={
          isToday && left > 0 && onPlayDaily
            ? {
                label: myTries.length ? `Try again · ${myTries.length}/${TRIES}` : "Play",
                onClick: onPlayDaily,
              }
            : undefined
        }
        done={isToday && left <= 0 ? `${TRIES}/${TRIES} done` : undefined}
        timer={isToday ? untilMidnight() : undefined}
        rows={game}
        unit={revealed ? g.unit : "pts"}
        empty={isToday ? "Nobody has played yet. Go first." : "Nobody played this day."}
      />

      <GameCard
        art="word"
        name="Word Up"
        bg="radial-gradient(circle at 50% 40%, rgba(255,255,255,0.3), transparent 55%), linear-gradient(160deg, #2FBF71, #173D3A 120%)"
        play={
          isToday && !playedWord && onPlayWord ? { label: "Play", onClick: onPlayWord } : undefined
        }
        done={isToday && playedWord ? "Played" : undefined}
        timer={isToday ? untilMidnight() : undefined}
        rows={word}
        unit=""
        empty={isToday ? "No one has cracked today's word yet." : "Nobody played Word Up this day."}
      />

      <GameCard
        art="earworm"
        name={`Name That Tune · ${tuneCat}`}
        bg="radial-gradient(circle at 50% 40%, rgba(255,255,255,0.28), transparent 55%), linear-gradient(160deg, #F2507B, #3A1A6B 120%)"
        play={
          isToday && !playedTune && onPlayTune ? { label: "Play", onClick: onPlayTune } : undefined
        }
        done={isToday && playedTune ? "Played" : undefined}
        timer={isToday ? untilMidnight() : undefined}
        rows={tune}
        unit=""
        empty={
          isToday
            ? `Today's song is ${tuneCat}. Name it fastest.`
            : "Nobody played Name That Tune this day."
        }
      />
    </div>
  );
}

const PILL: { bg: string; dark: string }[] = [
  { bg: "#EE6A6A", dark: "#C94B4B" },
  { bg: "#178A6E", dark: "#0F6B55" },
  { bg: "#8C6CF0", dark: "#6E4FD6" },
];

/** One game's results for the day. */
function GameCard({
  art,
  name,
  bg,
  play,
  done,
  timer,
  rows,
  unit,
  empty,
}: {
  art: Parameters<typeof GameArt>[0]["kind"];
  name: string;
  bg: string;
  play?: { label: string; onClick: () => void };
  /** You've used all your goes today ("3/3 tries done", "Played"). */
  done?: string;
  timer?: string;
  rows: Row[];
  unit: string;
  empty: string;
}) {
  const [a, b, c] = rows;
  const best = rows.filter((r) => r.rank === 1);
  const [all, setAll] = useState(false);
  // The board is folded away, so all three games fit on screen.
  const [open, setOpen] = useState(false);
  const mineRow = rows.find((r) => r.id === "me");
  const shortList =
    mineRow && rows.indexOf(mineRow) >= 3 ? [...rows.slice(0, 3), mineRow] : rows.slice(0, 3);
  return (
    <section className="mt-3">
      {/* The game: art on a bright card, name on a sticker. */}
      <div
        {...(play
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `${play.label} ${name}`,
              onClick: play.onClick,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  play.onClick();
                }
              },
            }
          : {})}
        className={`relative rounded-[28px] overflow-hidden ${
          play ? "cursor-pointer active:scale-[0.98] transition-transform" : ""
        }`}
        style={{
          height: 112,
          background: bg,
          border: "3px solid rgba(255,255,255,0.18)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        {/* Confetti-ish shapes for life. */}
        <span
          aria-hidden="true"
          className="absolute -left-6 top-8 w-24 h-24 rounded-[22px] rotate-12"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <span
          aria-hidden="true"
          className="absolute right-4 bottom-10 w-16 h-16 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <span
          aria-hidden="true"
          className="absolute right-16 top-6 w-6 h-6 rotate-45 rounded-[4px]"
          style={{ background: "rgba(255,255,255,0.18)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center pb-7">
          <span className="day-art-float">
            <GameArt kind={art} size={60} />
          </span>
        </div>
        {play && (
          <span
            aria-hidden="true"
            className="absolute left-3 top-3 flex items-center gap-1 rounded-full pl-1.5 pr-3 py-1 font-extrabold"
            style={{
              background: "rgba(10,10,16,0.55)",
              color: "#fff",
              fontSize: 13,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "#fff", color: "#111" }}
            >
              <Play size={11} fill="currentColor" aria-hidden="true" />
            </span>
            {play.label}
          </span>
        )}
        {!play && done && (
          <span
            className="absolute left-3 top-3 flex items-center gap-1 rounded-full pl-1.5 pr-3 py-1 font-extrabold"
            style={{
              background: "rgba(10,10,16,0.55)",
              color: "#fff",
              fontSize: 13,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label={done}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "var(--lime)", color: "#14200A" }}
            >
              <Check size={12} strokeWidth={3.5} aria-hidden="true" />
            </span>
            {done}
          </span>
        )}
        {timer && (
          <span
            className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 font-extrabold tabular-nums"
            style={{
              background: "rgba(10,10,16,0.55)",
              color: "#fff",
              fontSize: 12.5,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label={`Next game in ${timer}`}
          >
            <Hourglass size={13} aria-hidden="true" /> {timer}
          </span>
        )}
        <span
          className="absolute left-1/2 bottom-2.5 -translate-x-1/2 rounded-[12px] px-3.5 py-1 font-black uppercase whitespace-nowrap"
          style={{
            background: "#fff",
            color: "#14121C",
            fontSize: 14,
            letterSpacing: "0.02em",
            border: "3px solid #14121C",
            boxShadow: "0 4px 0 #14121C",
          }}
        >
          {name}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="meta text-center mt-2" style={{ fontSize: 12.5 }}>
          {empty}
        </p>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-full py-2 font-bold"
          style={{ background: "var(--fill)", fontSize: 13.5, color: "var(--ink)" }}
        >
          {open ? "Hide leaderboard" : "View leaderboard"}
          <span className="meta font-semibold" style={{ fontSize: 12.5 }}>
            · {rows.length} played
            {mineRow ? ` · you're #${mineRow.rank}` : ""}
          </span>
          <ChevronDown
            size={17}
            aria-hidden="true"
            style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
          />
        </button>
      )}
      {rows.length > 0 && open && (
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
      )}
    </section>
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
