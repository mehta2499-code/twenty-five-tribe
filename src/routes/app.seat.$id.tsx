import { NowPlayingCard } from "@/components/NowPlaying";
import { loadStreaks } from "@/lib/drop";
import { loadRivalry, type Rivalry } from "@/lib/rivalry";
import { GameArt, type ArtKind } from "@/components/GameArt";
import { isListening } from "@/lib/music";
import { KnowsBest, QuizBadge } from "@/components/QuizBadges";
import { SeasonBadge } from "@/components/SeasonBadge";
import { badgeOf, useQuizBadges } from "@/lib/quiz";
import { Ico, TONE } from "@/components/Ico";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Cake, ChevronDown, Eye, Handshake, MoreHorizontal } from "lucide-react";
import { Misses } from "@/components/KnowThemQuiz";
import { myQuizMisses, type QuizMiss } from "@/lib/vibes";
import { PersonMenu } from "@/components/Safety";
import { bdayLabel, daysUntil, useBirthdays } from "@/lib/birthdays";
import { Avatar } from "@/components/Avatar";
import { clientOnly } from "@/components/SocialUI";
import { friendById, isMutual, meView, useSocial } from "@/lib/social";
import { GAMES } from "@/components/ArcadeGames";
import { dayRanking, gameFor, thisWeek, today, useDaily, weekStandings } from "@/lib/daily";

export const Route = createFileRoute("/app/seat/$id")({
  component: clientOnly(LiveSeat),
});

/** A real person at your table: who they are and what you can do together. */
function LiveSeat() {
  const { id } = Route.useParams();
  const s = useSocial();
  const navigate = useNavigate();
  const f = friendById(id);
  const daily = useDaily();
  const [menu, setMenu] = useState(false);
  const bday = useBirthdays().find((b) => b.id === id);
  const quiz = useQuizBadges();
  if (!f) {
    return (
      <div className="px-6 pt-24 text-center">
        <p className="font-semibold text-cream">That seat is empty.</p>
        <Link to="/app/people" className="btn-bronze inline-block mt-5 px-6 py-3">
          Your 25
        </Link>
      </div>
    );
  }
  const inMine = s.mode !== "live" || s.people.some((p) => p.id === id);
  const mutual = isMutual(f) && inMine;
  const posts =
    s.posts.filter((p) => p.by === id).length + s.reels.filter((r) => r.by === id).length;
  const week = weekStandings(daily, thisWeek());
  const pts = (who: string) => week.find((r) => r.id === who);
  const todayRows = dayRanking(daily, today());
  const avg = (who: string) => todayRows.find((r) => r.id === who)?.best;
  const rivalry = [
    { label: "Daily games · this week's points", you: pts("me")?.points, them: pts(id)?.points },
    { label: "Days won", you: pts("me")?.wins, them: pts(id)?.wins },
    { label: `Today · ${GAMES[gameFor(today())].name}`, you: avg("me"), them: avg(id) },
  ];
  return (
    <div className="pb-10">
      <header className="band px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 text-center">
        <div className="flex justify-between">
          <button
            onClick={() => navigate({ to: "/app/home" })}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={() => setMenu(true)}
            aria-label={`More options for ${f.name}`}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className="flex justify-center -mt-2">
          <span className="rounded-full" style={{ boxShadow: "0 0 0 4px rgba(255,255,255,0.7)" }}>
            <Avatar src={f.avatar || undefined} initials={f.initials} color={f.color} size={104} />
          </span>
        </div>
        <h1 className="font-display mt-4" style={{ fontSize: 34 }}>
          {f.name}
        </h1>
        {f.username && <p className="sub mt-1">@{f.username}</p>}
        {bday && (
          <Link to="/app/card/$id" params={{ id }} className="sub mt-1 inline-block">
            <Ico i={Cake} c={TONE.birthday} size={14} /> {bdayLabel(bday)}
            {daysUntil(bday) === 0
              ? " · today! Sign the card"
              : daysUntil(bday) <= 7
                ? ` · in ${daysUntil(bday)}d`
                : ""}
          </Link>
        )}
        {bday && daysUntil(bday) <= 7 && (
          <div className="mt-2 flex justify-center">
            <Link
              to="/app/card/$id"
              params={{ id }}
              className="btn-primary btn-pink px-4 gap-1.5"
              style={{ minHeight: 34, fontSize: 13.5 }}
            >
              <Cake size={15} aria-hidden="true" /> Wish {f.name.split(" ")[0]}
              <span className="font-semibold opacity-80 text-[12px]">
                {daysUntil(bday) === 0
                  ? "· it's today!"
                  : `· in ${daysUntil(bday)} day${daysUntil(bday) === 1 ? "" : "s"}`}
              </span>
            </Link>
          </div>
        )}
        {isListening(f) && f.np && (
          <div className="mt-4 max-w-sm mx-auto">
            <NowPlayingCard np={f.np} who={f.name.split(" ")[0]} />
          </div>
        )}
        <p className="mt-3">
          <span
            className={`sticker ${mutual ? "" : inMine ? "sun" : "pink"}`}
            style={{ transform: "rotate(-3deg)" }}
          >
            <Ico i={mutual ? Handshake : Eye} size={13} />{" "}
            {mutual
              ? "in each other's 25"
              : inMine
                ? "in your 25 · not seated you back"
                : "has you in their 25"}
          </span>
        </p>
        <div className="mt-3 flex justify-center empty:hidden">
          <SeasonBadge userId={id} />
        </div>
        {(badgeOf(quiz.knowsMe[id]) || badgeOf(quiz.iKnow[id])) && (
          <div className="mt-3 grid gap-1.5 justify-items-start">
            {badgeOf(quiz.knowsMe[id]) && (
              <p className="flex items-center gap-2 text-sm text-cool">
                <QuizBadge badge={badgeOf(quiz.knowsMe[id])} small />
                knows you {quiz.knowsMe[id].score}/{quiz.knowsMe[id].total}
              </p>
            )}
            {badgeOf(quiz.iKnow[id]) && (
              <p className="flex items-center gap-2 text-sm text-cool">
                <QuizBadge badge={badgeOf(quiz.iKnow[id])} small />
                you know them {quiz.iKnow[id].score}/{quiz.iKnow[id].total}
              </p>
            )}
          </div>
        )}
        <p className="sub mt-2 text-sm">
          {inMine ? "In your 25 for " : "You've been in theirs for "}
          {f.joinedDaysAgo <= 0
            ? "less than a day"
            : `${f.joinedDaysAgo} day${f.joinedDaysAgo > 1 ? "s" : ""}`}
          .
        </p>
      </header>

      <div className="px-5 -mt-5 relative grid grid-cols-2 gap-3">
        {[
          { n: String((s.chats[id] ?? []).length), l: "messages" },
          { n: String(posts), l: "scenes" },
        ].map((x) => (
          <div key={x.l} className="card-editorial py-3 text-center">
            <p className="font-bold text-cream tabular-nums" style={{ fontSize: 20 }}>
              {x.n}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {x.l}
            </p>
          </div>
        ))}
      </div>

      {!mutual && (
        <div className="mx-5 mt-6 card p-4">
          <p className="font-bold text-cream">{inMine ? "Waiting on them" : "Your move"}</p>
          <p className="meta mt-1">
            {inMine
              ? `${f.name.split(" ")[0]} can see your posts. Chats and games unlock when they seat you back.`
              : `You can see ${f.name.split(" ")[0]}'s posts. Seat them back to unlock chats and games.`}
          </p>
          {!inMine && (
            <Link to="/app/people" className="btn-primary mt-3 px-5">
              Seat them back
            </Link>
          )}
        </div>
      )}

      <div className={`px-5 mt-6 grid gap-3 ${mutual ? "" : "hidden"}`}>
        <Link to="/app/chat/$id" params={{ id }} className="btn-bronze py-3.5 text-center">
          Message
        </Link>
      </div>

      <DropStreak id={id} name={f.name.split(" ")[0]} />
      <HeadToHead
        id={id}
        name={f.name.split(" ")[0]}
        them={{ avatar: f.avatar || undefined, initials: f.initials, color: f.color }}
        week={rivalry}
      />
      <MyProveIt id={id} name={f.name.split(" ")[0]} />
      {mutual && <KnowsBest userId={id} title={`Knows ${f.name.split(" ")[0]} best`} />}
      {menu && <PersonMenu person={f} onClose={() => setMenu(false)} />}
    </div>
  );
}

/** Their Drop streak: days in a row they've posted a Drop. */
function DropStreak({ id, name }: { id: string; name: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    loadStreaks([id]).then(
      (r) => alive && setN(r[id] ?? 0),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [id]);
  if (!n) return null;
  return (
    <section className="px-5 mt-6">
      <div className="card-editorial px-4 py-3 flex items-center gap-3">
        <span style={{ fontSize: 26 }} aria-hidden="true">
          🔥
        </span>
        <span className="flex-1">
          <span className="block font-extrabold text-cream">Drop streak · Day {n}</span>
          <span className="block meta text-[12.5px]">
            {name} has posted a Drop {n} day{n === 1 ? "" : "s"} in a row.
          </span>
        </span>
      </div>
    </section>
  );
}

/**
 * You vs them: every game you've finished together (who won how many), and
 * this week's daily games underneath.
 */
function HeadToHead({
  id,
  name,
  them,
  week,
}: {
  id: string;
  name: string;
  them: { avatar?: string; initials: string; color?: string };
  week: { label: string; you?: number; them?: number }[];
}) {
  const [games, setGames] = useState<Rivalry | null>(null);
  useEffect(() => {
    let alive = true;
    setGames(null);
    loadRivalry(id).then(
      (r) => alive && setGames(r),
      () => alive && setGames([]),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  const me = meView();
  const you = games?.reduce((a, g) => a + g.you, 0) ?? 0;
  const they = games?.reduce((a, g) => a + g.them, 0) ?? 0;
  return (
    <section className="px-5 mt-8">
      <p className="label-caps mb-2">head to head</p>
      <div className="card-editorial overflow-hidden">
        {/* The big score */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <Avatar src={me.avatar} initials={me.initials} size={40} />
            <span className="font-bold text-cream">You</span>
          </span>
          <span
            className="display tabular-nums shrink-0"
            style={{ fontSize: 30, lineHeight: 1 }}
            aria-label={`You ${you}, ${name} ${they}`}
          >
            <span style={{ color: you >= they && you ? "var(--lime)" : undefined }}>{you}</span>
            <span className="text-faint mx-1.5">–</span>
            <span style={{ color: they > you ? "var(--pink)" : undefined }}>{they}</span>
          </span>
          <span className="flex items-center gap-2.5 min-w-0 justify-end">
            <span className="font-bold text-cream truncate">{name}</span>
            <Avatar src={them.avatar} initials={them.initials} color={them.color} size={40} />
          </span>
        </div>
        {/* Game by game */}
        {games === null ? (
          <p className="meta px-4 pb-4">Counting…</p>
        ) : games.length === 0 ? (
          <p className="meta px-4 pb-4">
            No games together yet. Challenge {name} from Games → Play with your 25.
          </p>
        ) : (
          <ul className="px-4 pb-3 grid gap-2.5">
            {games.map((g) => {
              const total = g.you + g.them;
              return (
                <li key={g.kind} className="flex items-center gap-3">
                  <GameArt kind={g.kind as ArtKind} size={30} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between">
                      <span className="font-semibold text-cream text-[14px]">{g.name}</span>
                      <span className="font-extrabold tabular-nums text-[14px]">
                        <span style={{ color: g.you > g.them ? "var(--lime)" : undefined }}>
                          {g.you}
                        </span>
                        <span className="text-faint"> – </span>
                        <span style={{ color: g.them > g.you ? "var(--pink)" : undefined }}>
                          {g.them}
                        </span>
                      </span>
                    </span>
                    <span
                      className="mt-1 flex h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--fill)" }}
                      aria-hidden="true"
                    >
                      <span
                        style={{ width: `${(g.you / total) * 100}%`, background: "var(--lime)" }}
                      />
                      <span
                        style={{ width: `${(g.them / total) * 100}%`, background: "var(--pink)" }}
                      />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {/* This week's daily games */}
        <ul
          className="divide-y"
          style={{ borderTop: "1px solid var(--border-cool)", borderColor: "var(--border-cool)" }}
        >
          {week.map(({ label, them: t, you: y }) => (
            <li key={label} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
              <span className="text-cool">{label}</span>
              <span className="tabular-nums font-semibold text-cream">
                {y ?? "–"} – {t ?? "–"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Your Prove it on them: your score, and (tap) what you got wrong. Only after a pass. */
function MyProveIt({ id, name }: { id: string; name: string }) {
  const [res, setRes] = useState<{ score: number; total: number; wrong: QuizMiss[] } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    setRes(null);
    setOpen(false);
    myQuizMisses(id).then(
      (r) => alive && setRes(r),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [id]);
  if (!res || !Array.isArray(res.wrong)) return null;
  const n = res.wrong.length;
  return (
    <section className="px-5 mt-8">
      <p className="label-caps mb-2">your prove it</p>
      <div className="card-editorial px-4 py-3">
        <button
          type="button"
          onClick={() => n && setOpen((o) => !o)}
          aria-expanded={n ? open : undefined}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block font-semibold text-cream">
              You got {res.score}/{res.total} on {name}
            </span>
            <span className="block meta text-sm">
              {n
                ? open
                  ? "Hide what you got wrong"
                  : `See what you got wrong (${n})`
                : "Perfect. Nothing wrong."}
            </span>
          </span>
          {n > 0 && (
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="shrink-0 text-cool transition-transform"
              style={{ transform: open ? "rotate(180deg)" : undefined }}
            />
          )}
        </button>
        {open && n > 0 && (
          <div className="mt-3">
            <Misses wrong={res.wrong} name={name} heading={false} />
          </div>
        )}
      </div>
    </section>
  );
}
