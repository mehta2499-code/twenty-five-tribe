import { Ico, TONE } from "@/components/Ico";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useEffect, useMemo, useRef, useState } from "react";
import { Armchair, Bell, Cake, Camera, ChevronRight, CircleHelp, Dices, Eye, Flame, Gamepad2, Hourglass, ImagePlus, MessageCircle, PartyPopper, Shuffle, Trophy, UserPlus, Vote, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt } from "@/components/GameArt";
import { AddMomentSheet } from "@/components/AddMomentSheet";
import { FRIENDS, ME, RELATIONSHIP_MOMENTS } from "@/lib/data";
import {
  friendById,
  mutualFriends,
  seatedFriends,
  streakStatus,
  useSocial,
  type Person,
  type SocialState,
} from "@/lib/social";
import { GAMES } from "@/components/ArcadeGames";
import { TRIES, dayRanking, gameFor, thisWeek, today, useDaily, weekStandings } from "@/lib/daily";
import { Confetti, buzz, clientOnly } from "@/components/SocialUI";
import { VOICE } from "@/lib/copy";
import { PushPrompt } from "@/components/PushPrompt";
import { SuggestionCards } from "@/components/Suggestions";
import { unreadCount, useActivity } from "@/lib/activity";
import { daysUntil, upcoming, useBirthdays } from "@/lib/birthdays";
import { dropTime, loadDrops, phaseOf } from "@/lib/drop";
import { myVotesToday } from "@/lib/polls";

export const Route = createFileRoute("/app/home")({
  component: clientOnly(Home),
});

/** All 25 seats: an inner ring of 8 (your closest, by streak) and an outer ring of 17. */
const SEATS = 25;
const INNER = 8;
const OUTER = SEATS - INNER;
function seatPos(i: number) {
  const inner = i < INNER;
  const n = inner ? INNER : OUTER;
  const k = inner ? i : i - INNER;
  const angle = (k / n) * Math.PI * 2 - Math.PI / 2 + (inner ? 0 : Math.PI / OUTER);
  const r = inner ? 31 : 46;
  return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle), inner };
}

/** Friends worth showing at the table first: streaks, then who posted today. */
function tableOrder(s: SocialState): Person[] {
  return [...seatedFriends()].sort((a, b) => {
    const sa = s.streaks[a.id]?.count ?? 0;
    const sb = s.streaks[b.id]?.count ?? 0;
    if (sb !== sa) return sb - sa;
    return Number(b.postedToday) - Number(a.postedToday);
  });
}

const dayIndex = () => Math.floor((Date.now() + 5.5 * 3600_000) / 86_400_000);

const MOODS = [
  "Your 25 is online. Your excuses aren't.",
  "Someone here has gossip. It might be you.",
  "Hydrate. Then text someone back.",
  "Respectfully, check on your 25.",
  "Seen-zoning is not a personality.",
  "Ek chai, 25 log, zero chill ☕",
  "Certified yapping hours are open.",
  "Your streaks called. They miss you.",
  "Kya scene hai aaj? 👀",
  "Delulu is the solulu. Your 25 is real.",
  "Main character, supporting cast of 25.",
  "Touch grass. Then post the grass.",
  "The group chat is plotting. Probably.",
  "Low battery, high gossip 🔋",
];
/** Lines that name one of your people. */
const NAMED_MOODS = [
  (n: string) => `${n} hasn't heard from you today. Suspicious 🤨`,
  (n: string) => `${n} would 100% pick you in a poll. Return the favour.`,
  (n: string) => `Plot twist: you text ${n} first.`,
  (n: string) => `${n} owes you chai. Collect.`,
  (n: string) => `Rumour has it ${n} is bored. Fix that.`,
];

// ---------- The table ----------

function Table({
  people,
  spot,
  rolling,
  onRoll,
}: {
  people: Person[];
  spot: number | null;
  rolling: boolean;
  onRoll: () => void;
}) {
  const s = useSocial();
  const seated = people.slice(0, SEATS);
  const chairs: (Person | null)[] = [
    ...seated,
    ...Array.from({ length: SEATS - seated.length }, () => null),
  ];

  return (
    <section className="px-5 pt-6" aria-label="Your table">
      <div className="relative mx-auto" style={{ width: "100%", maxWidth: 380, aspectRatio: "1" }}>
        {/* Table top */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "27%",
            background:
              "radial-gradient(circle at 35% 30%, rgba(181,219,94,0.22), transparent 60%), #1F1B2B",
            border: "2px solid var(--edge)",
            boxShadow: "5px 5px 0 var(--edge)",
          }}
        >
          <div
            className="absolute rounded-full"
            style={{ inset: 10, border: "2px dashed rgba(181,219,94,0.35)" }}
          />
          {/* little things on the table */}

        </div>

        {/* You + the dice */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <button
            onClick={onRoll}
            disabled={rolling || !seated.length}
            aria-label="Roll the table: pick a random friend to surprise"
            className="relative flex flex-col items-center"
          >
            <span
              className={`flex items-center justify-center rounded-2xl ${rolling ? "die-rolling" : "wiggle-idle"}`}
              style={{
                width: 52,
                height: 52,
                background: "var(--lime)",
                color: "var(--on-accent)",
                border: "2px solid var(--edge)",
                boxShadow: "3px 3px 0 var(--edge)",
              }}
            >
              <Dices size={28} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span
              className="mt-2 font-display font-extrabold text-[13px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--edge)", color: "var(--lime)" }}
            >
              {rolling ? "rolling…" : "tap to roll"}
            </span>
          </button>
        </div>

        {/* Chairs */}
        {chairs.map((f, i) => {
          const { x, y, inner } = seatPos(i);
          const size = inner ? 46 : 30;
          const pos = {
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%)",
          } as const;
          // Empty seats stay hidden; a bubble appears when someone takes one.
          if (!f) return null;
          const st = streakStatus(s.streaks[f.id]);
          const lit = spot === i;
          return (
            <Link
              key={f.id}
              to="/app/seat/$id"
              params={{ id: f.id }}
              className="absolute flex flex-col items-center"
              style={pos}
              aria-label={`${f.name}${st.count ? `, ${st.count}-day streak` : ""}${f.postedToday ? ", posted today" : ""}`}
            >
              <span
                className="rounded-full transition-transform duration-150"
                style={{
                  border: "2px solid var(--edge)",
                  boxShadow: lit
                    ? "0 0 0 4px var(--lime), 0 0 28px rgba(181,219,94,0.8)"
                    : f.postedToday
                      ? "0 0 0 3px var(--pink)"
                      : "2px 2px 0 var(--edge)",
                  transform: lit ? "scale(1.18)" : "scale(1)",
                }}
              >
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={size} />
              </span>
              {!inner ? (
                st.count > 0 && (
                  <span
                    className="absolute -bottom-1.5 -right-1.5 text-[11px] leading-none"
                    aria-hidden="true"
                  >
                    <Ico i={Flame} c={TONE.streak} size={13} />
                  </span>
                )
              ) : st.count > 0 ? (
                <span
                  className={`sticker relative z-[1] whitespace-nowrap ${st.atRisk ? "sun" : ""} -mt-2.5 !text-[11px] !px-1.5 !py-0`}
                  style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}
                >
                  <Ico i={Flame} size={11} />
                  {st.count}
                  {st.atRisk && <Ico i={Hourglass} size={11} />}
                </span>
              ) : f.mutual === false ? (
                <span
                  className="sticker sky relative z-[1] -mt-2.5 !px-1.5 !py-0 whitespace-nowrap"
                  style={{
                    transform: `rotate(${i % 2 ? 4 : -4}deg)`,
                    fontSize: labelSize(f.name),
                  }}
                  title="One-way: they haven't seated you back"
                >
                  <Ico i={Eye} size={11} /> {f.name.split(" ")[0]}
                </span>
              ) : f.postedToday ? (
                <span
                  className="sticker pink relative z-[1] -mt-2.5 !text-[11px] !px-1.5 !py-0"
                  style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}
                >
                  new
                </span>
              ) : (
                <span
                  className="relative z-[1] -mt-1 font-bold px-1.5 rounded-full whitespace-nowrap"
                  style={{
                    background: "var(--edge)",
                    color: "var(--ink-2)",
                    fontSize: labelSize(f.name),
                  }}
                >
                  {f.name.split(" ")[0]}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
        <span className="chip" style={{ minHeight: 28 }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--pink)" }} />
          posted today
        </span>
        <span className="chip" style={{ minHeight: 28 }}>
          <Ico i={Flame} c={TONE.streak} size={14} /> streak
        </span>
        {s.mode === "live" && (
          <span className="chip" style={{ minHeight: 28 }}>
            <Ico i={Eye} c={TONE.oneWay} size={14} /> one-way
          </span>
        )}
      </div>
      <div className="flex justify-center mt-3">
        <Link to="/app/people" className="btn-primary px-5 gap-2" style={{ minHeight: 44 }}>
          <UserPlus size={18} aria-hidden="true" />
          {people.length >= 25 ? `Your 25 is full · manage` : `Add people · ${25 - people.length} seat${25 - people.length === 1 ? "" : "s"} left`}
        </Link>
      </div>
    </section>
  );
}

// ---------- Today's dare ----------

const DARES: { text: string; cta: string; to: string }[] = [
  {
    text: "Blink your lunch to someone. No caption. Let them wonder.",
    cta: "Send a blink",
    to: "/app/snap",
  },
  {
    text: "Text someone the first song that comes to mind. Nothing else.",
    cta: "Open chats",
    to: "/app/chats",
  },
  {
    text: "Post the 5th photo in your camera roll. No explaining.",
    cta: "Post it",
    to: "/app/feed",
  },
  { text: "Top your table in today's game. Loser buys chai.", cta: "Play", to: "/app/games" },
  {
    text: "Blink the view from where you're sitting right now.",
    cta: "Send a blink",
    to: "/app/snap",
  },
  { text: "Ask someone 'what's the tea?' and nothing else.", cta: "Open chats", to: "/app/chats" },
  { text: "Send an ugly selfie. Streaks were built on less.", cta: "Send a blink", to: "/app/snap" },
  { text: "Finish all 3 tries of today's game before bed.", cta: "Play", to: "/app/games" },
  {
    text: "Tell someone at your table one thing you never told them.",
    cta: "Open chats",
    to: "/app/chats",
  },
  {
    text: "Post a photo from exactly one year ago (or close enough).",
    cta: "Post it",
    to: "/app/feed",
  },
];

function Dare() {
  const [skip, setSkip] = useState(0);
  const d = DARES[(dayIndex() + skip) % DARES.length];
  return (
    <section className="px-5 mt-6">
      <div className="black-card p-5 relative overflow-hidden">
        <span
          className="sticker pink absolute -top-0.5 right-4"
          style={{ transform: "rotate(6deg)" }}
        >
          today's dare
        </span>
        <Dices size={34} strokeWidth={2} aria-hidden="true" style={{ color: "var(--lime)" }} />
        <p
          key={skip}
          className="heading mt-2 animate-soft-in"
          style={{ fontSize: 20, color: "#fff" }}
        >
          {d.text}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Link to={d.to} className="btn-primary px-5 min-h-[44px]">
            {d.cta}
          </Link>
          <button
            onClick={() => {
              buzz();
              setSkip((n) => n + 1);
            }}
            className="btn-quiet min-h-[44px] px-4 inline-flex items-center gap-1.5"
          >
            <Shuffle size={16} aria-hidden="true" /> another
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------- Games ----------

function GameRank() {
  const d = useDaily();
  const day = today();
  const real = GAMES[gameFor(day)];
  // Keep today's game a mystery until it's revealed on the Games tab.
  let revealed = true;
  try {
    revealed = localStorage.getItem(`tf.reveal.${day}`) === "1";
  } catch {
    // ignore
  }
  const g = revealed || (d.board[day]?.me ?? []).length
    ? real
    : { ...real, Icon: CircleHelp, name: "Mystery game", tone: "var(--sun)" };
  const tries = d.board[day]?.me ?? [];
  const left = TRIES - tries.length;
  const todayRank = dayRanking(d, day).find((r) => r.id === "me");
  const week = weekStandings(d, thisWeek());
  const weekRank = week.findIndex((r) => r.id === "me") + 1;

  return (
    <section className="px-5 mt-6">
      <Link to="/app/games" className="card p-4 flex items-center gap-3 hover:bg-[var(--fill)]">
        <span className="shrink-0" aria-hidden="true">
          <GameArt kind={revealed || (d.board[day]?.me ?? []).length ? gameFor(day) : "mystery"} size={48} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-cream text-[15px]">
            Today: {g.name}
            {left > 0 ? ` · ${left} ${left === 1 ? "try" : "tries"} left` : " · done"}
          </span>
          <span className="block meta">
            {todayRank
              ? `#${todayRank.rank} today${weekRank ? ` · #${weekRank} this week` : ""}`
              : weekRank
                ? `#${weekRank} this week. Don't slip.`
                : "New game every day. Best of 3 tries."}
          </span>
        </span>
        <Trophy size={18} className="text-bronze shrink-0" aria-hidden="true" />
      </Link>
    </section>
  );
}

// ---------- Roll result ----------

function RollPanel({ friend, onClose }: { friend: Person; onClose: () => void }) {
  const s = useSocial();
  const st = streakStatus(s.streaks[friend.id]);
  const first = friend.name.split(" ")[0];
  const lines = [
    `Send ${first} something with zero context.`,
    `${first} hasn't heard from you in a bit. Fix that.`,
    `The dice have spoken. ${first} gets a snap.`,
    `Tell ${first} one thing that made you laugh today.`,
  ];
  const line = lines[friend.id.length % lines.length];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-28"
      style={{ background: "rgba(7,6,11,0.6)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card p-6 pop text-center"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`You rolled ${friend.name}`}
      >
        <span className="sticker sun" style={{ transform: "rotate(-5deg)" }}>
          <Ico i={Dices} size={13} /> the table chose
        </span>
        <div className="mt-4 flex justify-center">
          <span
            className="rounded-full"
            style={{ border: "2px solid var(--edge)", boxShadow: "0 0 0 4px var(--lime)" }}
          >
            <Avatar src={friend.avatar} initials={friend.initials} color={friend.color} size={92} />
          </span>
        </div>
        <h3 className="title mt-4" style={{ fontSize: 30 }}>
          {friend.name}
        </h3>
        {st.count > 0 && (
          <p className="meta mt-1">
            <Ico i={Flame} c={TONE.streak} size={14} /> {st.count}-day streak{st.atRisk ? ", ends tonight" : ""}
          </p>
        )}
        <p
          className="text-cool mt-3 mx-auto max-w-[18rem]"
          style={{ fontSize: 15, lineHeight: 1.5 }}
        >
          {line}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link to="/app/snap" search={{ to: friend.id }} className="btn-primary">
            <Camera size={18} aria-hidden="true" /> Blink
          </Link>
          <Link to="/app/chat/$id" params={{ id: friend.id }} className="btn-secondary">
            <MessageCircle size={18} aria-hidden="true" /> Message
          </Link>
        </div>
        <button onClick={onClose} className="mt-4 meta font-semibold underline underline-offset-4">
          nah, maybe later
        </button>
      </div>
    </div>
  );
}

// ---------- Demo extras ----------

function TodayAtTheTable() {
  const items = RELATIONSHIP_MOMENTS.slice(0, 3);
  return (
    <section className="px-5 mt-8">
      <h2 className="heading" style={{ fontSize: 19 }}>
        Overheard at the table
      </h2>
      <ul className="mt-3 grid gap-2.5">
        {items.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          return (
            <li key={m.id}>
              <Link
                to="/app/seat/$id"
                params={{ id: f.id }}
                className="card flex items-center gap-3 p-3 hover:bg-[var(--fill)]"
              >
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={40} />
                <p className="flex-1 min-w-0 text-cream text-[14px] leading-snug">{m.text}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ModeBanner() {
  const s = useSocial();
  if (s.loading) {
    return (
      <div className="mx-5 mt-4 card flex items-center gap-3 px-4 py-3" aria-busy="true">
        <span className="skeleton w-10 h-10" />
        <span className="flex-1 grid gap-2">
          <span className="skeleton h-3.5 w-1/2" />
          <span className="skeleton h-3 w-1/3" />
        </span>
      </div>
    );
  }
  if (s.mode === "live") return null;
  return (
    <div className="mx-5 mt-4 card flex items-center gap-3 px-4 py-3">
      <span className="flex-1 text-cool" style={{ fontSize: 14, lineHeight: 1.4 }}>
        These are demo friends. Sign in to seat your real ones.
      </span>
      <Link to="/login" className="btn-primary shrink-0 min-h-[40px] px-4 text-sm">
        Sign in
      </Link>
    </div>
  );
}

// ---------- Drop + Polls ----------

function TodayTiles() {
  const [at, setAt] = useState<number | null>(null);
  const [dropped, setDropped] = useState<boolean | null>(null);
  const [voted, setVoted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    void dropTime().then(setAt);
    void loadDrops().then((d) => setDropped(!!d.mine));
    void myVotesToday().then((v) => setVoted(Object.keys(v).length));
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const phase = at ? phaseOf(at, now) : "before";
  const live = phase === "now" && dropped === false;
  return (
    <section className="px-5 mt-6 grid grid-cols-2 gap-3">
      <Link
        to="/app/drop"
        className={`rounded-[20px] p-4 flex flex-col gap-1 ${live ? "wiggle" : ""}`}
        style={{
          background: live ? "var(--lime)" : "var(--surface)",
          color: live ? "var(--on-accent)" : "var(--ink)",
          border: "2px solid var(--edge)",
          boxShadow: "var(--pop)",
        }}
      >
        <Camera size={30} strokeWidth={2.25} aria-hidden="true" />
        <span className="font-extrabold text-[15px]">The 25 Drop</span>
        <span className="text-[12.5px] font-semibold opacity-80">
          {dropped
            ? "Dropped. See theirs"
            : phase === "now"
              ? "IT'S DROP TIME. Go!"
              : phase === "after"
                ? "Missed it. Post late"
                : "Surprise time today"}
        </span>
      </Link>
      <Link
        to="/app/polls"
        className="rounded-[20px] p-4 flex flex-col gap-1"
        style={{
          background: voted !== null && voted < 5 ? "var(--pink)" : "var(--surface)",
          color: voted !== null && voted < 5 ? "var(--on-accent)" : "var(--ink)",
          border: "2px solid var(--edge)",
          boxShadow: "var(--pop)",
        }}
      >
        <Vote size={30} strokeWidth={2.25} aria-hidden="true" />
        <span className="font-extrabold text-[15px]">Polls</span>
        <span className="text-[12.5px] font-semibold opacity-80">
          {voted === null
            ? "…"
            : voted < 5
              ? `${5 - voted} anonymous picks left`
              : "Done. See your picks"}
        </span>
      </Link>
    </section>
  );
}

// ---------- Birthdays ----------

function Birthdays() {
  const list = useBirthdays();
  const s = useSocial();
  const mine = list.find((b) => b.id === "me");
  const soon = upcoming(list, 30);
  const todayOnes = soon.filter((b) => b.inDays === 0);
  const later = soon.filter((b) => b.inDays > 0).slice(0, 6);
  const myDay = mine && daysUntil(mine) === 0;
  if (!myDay && !soon.length) return null;
  const name = (id: string) => friendById(id)?.name.split(" ")[0] ?? "Someone";
  return (
    <section className="px-5 mt-6 grid gap-3">
      {myDay && (
        <Link
          to="/app/card/$id"
          params={{ id: "me" }}
          className="rounded-[20px] p-4 flex items-center gap-3"
          style={{
            background: "var(--pink)",
            color: "var(--on-accent)",
            border: "2px solid var(--edge)",
            boxShadow: "var(--pop)",
          }}
        >
          <PartyPopper size={36} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
          <span className="flex-1">
            <span className="block display text-[20px]">
              Happy birthday{s.me ? `, ${s.me.name.split(" ")[0]}` : ""}!
            </span>
            <span className="block font-bold text-[13px]">
              Your 25 has been signing your card. Open it →
            </span>
          </span>
        </Link>
      )}
      {todayOnes.map((b) => (
        <Link
          key={b.id}
          to="/app/card/$id"
          params={{ id: b.id }}
          className="rounded-[20px] p-4 flex items-center gap-3"
          style={{
            background: "var(--sun)",
            color: "var(--on-accent)",
            border: "2px solid var(--edge)",
            boxShadow: "var(--pop)",
          }}
        >
          <Cake size={36} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
          <span className="flex-1">
            <span className="block display text-[19px]">It's {name(b.id)}'s birthday!</span>
            <span className="block font-bold text-[13px]">Sign their card before midnight</span>
          </span>
        </Link>
      ))}
      {later.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {later.map((b) => (
            <Link
              key={b.id}
              to="/app/card/$id"
              params={{ id: b.id }}
              className="chip shrink-0"
              style={{ minHeight: 34 }}
            >
              <Ico i={Cake} c={TONE.birthday} size={14} /> {name(b.id)} · {b.inDays === 1 ? "tomorrow" : `in ${b.inDays}d`}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Activity bell ----------

function ActivityBell() {
  const st = useActivity();
  const n = unreadCount(st);
  return (
    <Link
      to="/app/activity"
      aria-label={n ? `Activity, ${n} new` : "Activity"}
      className="relative w-11 h-11 rounded-full flex items-center justify-center"
      style={{
        background: "var(--fill)",
        border: "2px solid var(--edge)",
        boxShadow: "var(--pop)",
      }}
    >
      <Bell size={20} aria-hidden="true" className={n ? "wiggle" : ""} />
      {n > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold flex items-center justify-center"
          style={{
            background: "var(--pink)",
            color: "var(--on-accent)",
            border: "2px solid var(--edge)",
          }}
        >
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}

// ---------- Screen ----------

function Home() {
  const s = useSocial();
  const people = tableOrder(s);
  const [adding, setAdding] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const [picked, setPicked] = useState<Person | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [rolling, setRolling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Spotlight hops around the table, slows down, lands on someone.
  const onRoll = () => {
    const seated = people.slice(0, SEATS);
    if (!seated.length || rolling) return;
    setRolling(true);
    setPicked(null);
    const target = Math.floor(Math.random() * seated.length);
    const hops = seated.length * 2 + target + 1;
    let t = 0;
    for (let h = 0; h < hops; h++) {
      t += 60 + Math.pow(h / hops, 3) * 320;
      const idx = h % seated.length;
      timers.current.push(
        setTimeout(() => {
          setSpot(idx);
          buzz(6);
        }, t),
      );
    }
    timers.current.push(
      setTimeout(() => {
        setSpot(target);
        setConfetti((c) => c + 1);
        buzz(30);
      }, t + 120),
      setTimeout(() => {
        setRolling(false);
        setPicked(seated[target]);
      }, t + 650),
    );
  };

  const first = s.me?.name.split(" ")[0];
  const filled = people.length;
  const streakCount = people.filter((f) => (s.streaks[f.id]?.count ?? 0) > 0).length;
  const posted = people.filter((f) => f.postedToday).length;
  const [mood] = useState(() => {
    const friends = mutualFriends();
    if (friends.length && Math.random() < 0.4) {
      const f = friends[Math.floor(Math.random() * friends.length)];
      return NAMED_MOODS[Math.floor(Math.random() * NAMED_MOODS.length)](f.name.split(" ")[0]);
    }
    return MOODS[Math.floor(Math.random() * MOODS.length)];
  });

  return (
    <>
      <header className="band px-5 pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] pb-5">
        <div className="flex items-center justify-between">
          <Logo height={44} title={VOICE.brand} />
          <div className="flex items-center gap-2.5">
            <ActivityBell />
            <Link
              to="/app/profile"
              aria-label="Your profile"
              className="rounded-full"
              style={{ border: "2px solid var(--edge)", boxShadow: "var(--pop)" }}
            >
              <Avatar
                src={s.me ? s.me.avatar : ME.avatar}
                initials={s.me?.initials ?? ME.initials}
                size={40}
              />
            </Link>
          </div>
        </div>
        <h1 className="title mt-4" style={{ fontSize: 30 }}>
          {first ? (
            <>
              Hey <span className="mark">{first}</span>
            </>
          ) : (
            <>
              Your <span className="mark">table</span>
            </>
          )}
        </h1>
        <p className="sub mt-1.5" style={{ fontSize: 15 }}>
          {mood}
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link to="/app/people" className="sticker" style={{ transform: "rotate(-3deg)" }}>
            <Ico i={Armchair} size={13} /> {filled}/25 seats
          </Link>
          <span className="sticker pink" style={{ transform: "rotate(-2deg)" }}>
            <Ico i={Eye} size={13} /> in {s.seatedByCount} people's 25
          </span>
        </div>
      </header>

      <ModeBanner />

      <PushPrompt />

      <Birthdays />

      {s.mode === "live" && people.length < 10 && <SuggestionCards title="Find your people" max={12} />}

      <Table people={people} spot={spot} rolling={rolling} onRoll={onRoll} />

      <TodayTiles />

      <p className="text-center meta mt-10 mb-2 px-8">{VOICE.brandLine}</p>

      <Confetti fire={confetti} />
      {picked && <RollPanel friend={picked} onClose={() => setPicked(null)} />}
      {adding && (
        <AddMomentSheet onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} />
      )}
    </>
  );
}

/** Smaller text for longer first names, so the whole name fits under the bubble. */
function labelSize(name: string) {
  const n = name.split(" ")[0].length;
  return n <= 6 ? 11 : n <= 8 ? 10 : n <= 11 ? 9 : 8;
}
