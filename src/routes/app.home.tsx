import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ChevronRight,
  Dices,
  Gamepad2,
  ImagePlus,
  MessageCircle,
  Plus,
  Shuffle,
  Trophy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AddMomentSheet } from "@/components/AddMomentSheet";
import { FRIENDS, ME, RELATIONSHIP_MOMENTS } from "@/lib/data";
import {
  friendById,
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

export const Route = createFileRoute("/app/home")({
  component: clientOnly(Home),
});

const SEATS = 8;

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
  "Main character energy today.",
  "Your table misses you a normal amount.",
  "Low battery, high gossip.",
  "Somebody here owes you chai.",
  "Plot twist: you text first.",
  "Vibes: immaculate. Replies: pending.",
  "No thoughts, just your 25.",
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
  const open = Math.max(0, Math.min(SEATS - seated.length, 25 - people.length));
  const chairs: (Person | null)[] = [...seated, ...Array.from({ length: open }, () => null)];
  const n = Math.max(chairs.length, 1);

  return (
    <section className="px-5 pt-6" aria-label="Your table">
      <div className="relative mx-auto" style={{ width: "100%", maxWidth: 360, aspectRatio: "1" }}>
        {/* Table top */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "19%",
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
          <span className="absolute text-xl float" style={{ left: "16%", top: "18%" }}>
            ☕
          </span>
          <span
            className="absolute text-lg float"
            style={{ right: "15%", bottom: "17%", animationDelay: "1.4s" }}
          >
            🍟
          </span>
          <span
            className="absolute text-lg float"
            style={{ right: "18%", top: "16%", animationDelay: "0.7s" }}
          >
            🃏
          </span>
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
                width: 64,
                height: 64,
                background: "var(--lime)",
                color: "var(--on-accent)",
                border: "2px solid var(--edge)",
                boxShadow: "3px 3px 0 var(--edge)",
              }}
            >
              <Dices size={34} strokeWidth={2.2} aria-hidden="true" />
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
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const r = 41;
          const x = 50 + r * Math.cos(angle);
          const y = 50 + r * Math.sin(angle);
          const pos = {
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%)",
          } as const;
          if (!f) {
            return (
              <Link
                key={`open-${i}`}
                to="/app/people"
                aria-label="Open seat. Add someone"
                className="absolute flex items-center justify-center rounded-full text-[var(--ink-3)] hover:text-[var(--lime)]"
                style={{
                  ...pos,
                  width: 52,
                  height: 52,
                  border: "2px dashed rgba(255,255,255,0.28)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <Plus size={20} aria-hidden="true" />
              </Link>
            );
          }
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
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={54} />
              </span>
              {st.count > 0 ? (
                <span
                  className={`sticker whitespace-nowrap ${st.atRisk ? "sun" : ""} -mt-2.5 !text-[11px] !px-1.5 !py-0`}
                  style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}
                >
                  <span className="flame">🔥</span>
                  {st.count}
                  {st.atRisk && "⏳"}
                </span>
              ) : f.mutual === false ? (
                <span
                  className="sticker sky -mt-2.5 !text-[11px] !px-1.5 !py-0 whitespace-nowrap"
                  style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}
                  title="One-way: they haven't seated you back"
                >
                  👀 {f.name.split(" ")[0].slice(0, 7)}
                </span>
              ) : f.postedToday ? (
                <span
                  className="sticker pink -mt-2.5 !text-[11px] !px-1.5 !py-0"
                  style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}
                >
                  new
                </span>
              ) : (
                <span
                  className="-mt-1 text-[11px] font-bold px-1.5 rounded-full max-w-[64px] truncate"
                  style={{ background: "var(--edge)", color: "var(--ink-2)" }}
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
          🔥 streak
        </span>
        {s.mode === "live" && (
          <span className="chip" style={{ minHeight: 28 }}>
            👀 one-way
          </span>
        )}
        <Link to="/app/my25" className="chip" style={{ minHeight: 28, background: "var(--lime)", color: "var(--on-accent)" }}>
          all {people.length} seats →
        </Link>
      </div>
    </section>
  );
}

// ---------- Right now ----------

type Nudge = { emoji: string; text: string; to: string; search?: { to: string }; tone: string };

function useNudges(s: SocialState, people: Person[]): Nudge[] {
  const d = useDaily();
  return useMemo(() => {
    const out: Nudge[] = [];
    const day = today();
    const used = (d.board[day]?.me ?? []).length;
    if (used < TRIES) {
      const g = GAMES[gameFor(day)];
      const leader = dayRanking(d, day)[0];
      out.push({
        emoji: g.emoji,
        text:
          leader && leader.id !== "me"
            ? `${friendById(leader.id)?.name.split(" ")[0] ?? "Someone"} leads ${g.name} with ${leader.avg}. ${TRIES - used} tries left.`
            : `Today's game: ${g.name}. ${TRIES - used} tries waiting.`,
        to: "/app/games",
        tone: "var(--lime)",
      });
    }
    const snaps = s.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me")).length;
    if (snaps)
      out.push({
        emoji: "📸",
        text: `${snaps} snap${snaps > 1 ? "s" : ""} waiting. Open before they vanish.`,
        to: "/app/snap",
        tone: "var(--pink)",
      });
    const incoming = s.requests.filter((r) => r.direction === "incoming").length;
    if (incoming)
      out.push({
        emoji: "👀",
        text: `${incoming} ${incoming > 1 ? "people" : "person"} put you in their 25. Seat them back?`,
        to: "/app/people",
        tone: "var(--lime)",
      });
    for (const f of people) {
      const st = streakStatus(s.streaks[f.id]);
      if (st.count && st.atRisk) {
        out.push({
          emoji: "⏳",
          text: `Your ${st.count}-day streak with ${f.name.split(" ")[0]} ends tonight.`,
          to: "/app/snap",
          search: { to: f.id },
          tone: "var(--sun)",
        });
        if (out.length > 4) break;
      }
    }
    const unread = Object.values(s.unread).reduce((a, b) => a + b, 0);
    if (unread)
      out.push({
        emoji: "💬",
        text: `${unread} unread message${unread > 1 ? "s" : ""}. Someone's waiting.`,
        to: "/app/chats",
        tone: "var(--sky)",
      });
    const posted = people.filter((f) => f.postedToday);
    if (posted.length)
      out.push({
        emoji: "🖼️",
        text:
          posted.length === 1
            ? `${posted[0].name.split(" ")[0]} posted today. Go hype it.`
            : `${posted[0].name.split(" ")[0]} and ${posted.length - 1} more posted today.`,
        to: "/app/feed",
        tone: "var(--pink)",
      });
    return out;
  }, [s.snaps, s.requests, s.streaks, s.unread, people, d]);
}

function RightNow({ nudges }: { nudges: Nudge[] }) {
  return (
    <section className="mt-8" aria-labelledby="now-title">
      <div className="px-5 flex items-baseline justify-between">
        <h2 id="now-title" className="heading" style={{ fontSize: 19 }}>
          Right now
        </h2>
        {nudges.length > 0 && <span className="meta">{nudges.length} things</span>}
      </div>
      {nudges.length ? (
        <div className="mt-3 flex gap-3 overflow-x-auto px-5 pb-3 pt-1 snap-x no-scrollbar">
          {nudges.map((nu, i) => (
            <Link
              key={i}
              to={nu.to}
              search={nu.search}
              className="snap-start shrink-0 w-[150px] rounded-[18px] p-3.5 flex flex-col gap-2 active:scale-95 transition-transform"
              style={{
                background: nu.tone,
                color: "var(--on-accent)",
                border: "2px solid var(--edge)",
                boxShadow: "3px 3px 0 var(--edge)",
                transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`,
              }}
            >
              <span className="text-[28px] leading-none">{nu.emoji}</span>
              <span className="font-bold text-[14px] leading-snug">{nu.text}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mx-5 mt-3 card p-4 flex items-center gap-3">
          <span className="text-3xl">😴</span>
          <p className="text-cool text-[14px] leading-snug">
            All caught up. Suspiciously quiet. Be the chaos: roll the table.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------- Today's dare ----------

const DARES: { text: string; cta: string; to: string }[] = [
  { text: "Snap your lunch to someone. No caption. Let them wonder.", cta: "Send a snap", to: "/app/snap" },
  { text: "Text someone the first song that comes to mind. Nothing else.", cta: "Open chats", to: "/app/chats" },
  { text: "Post the 5th photo in your camera roll. No explaining.", cta: "Post it", to: "/app/feed" },
  { text: "Top your table in today's game. Loser buys chai.", cta: "Play", to: "/app/games" },
  { text: "Snap the view from where you're sitting right now.", cta: "Send a snap", to: "/app/snap" },
  { text: "Ask someone 'what's the tea?' and nothing else.", cta: "Open chats", to: "/app/chats" },
  { text: "Send an ugly selfie. Streaks were built on less.", cta: "Send a snap", to: "/app/snap" },
  { text: "Finish all 3 tries of today's game before bed.", cta: "Play", to: "/app/games" },
  { text: "Tell someone at your table one thing you never told them.", cta: "Open chats", to: "/app/chats" },
  { text: "Post a photo from exactly one year ago (or close enough).", cta: "Post it", to: "/app/feed" },
];

function Dare() {
  const [skip, setSkip] = useState(0);
  const d = DARES[(dayIndex() + skip) % DARES.length];
  return (
    <section className="px-5 mt-6">
      <div className="black-card p-5 relative overflow-hidden">
        <span className="sticker pink absolute -top-0.5 right-4" style={{ transform: "rotate(6deg)" }}>
          today's dare
        </span>
        <p className="text-[34px] leading-none">🎲</p>
        <p key={skip} className="heading mt-2 animate-soft-in" style={{ fontSize: 20, color: "#fff" }}>
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
  const g = GAMES[gameFor(day)];
  const tries = d.board[day]?.me ?? [];
  const left = TRIES - tries.length;
  const todayRank = dayRanking(d, day).find((r) => r.id === "me");
  const week = weekStandings(d, thisWeek());
  const weekRank = week.findIndex((r) => r.id === "me") + 1;

  return (
    <section className="px-5 mt-6">
      <Link to="/app/games" className="card p-4 flex items-center gap-3 hover:bg-[var(--fill)]">
        <span
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: g.tone, border: "2px solid var(--edge)", transform: "rotate(-4deg)" }}
        >
          {g.emoji}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-cream text-[15px]">
            Today: {g.name}
            {left > 0 ? ` · ${left} ${left === 1 ? "try" : "tries"} left` : " · done ✅"}
          </span>
          <span className="block meta">
            {todayRank
              ? `#${todayRank.rank} today${weekRank ? ` · #${weekRank} this week` : ""}`
              : weekRank
                ? `#${weekRank} this week. Don't slip.`
                : "New game every day. Average of 3 tries."}
          </span>
        </span>
        <Trophy size={18} className="text-bronze shrink-0" aria-hidden="true" />
      </Link>
    </section>
  );
}

// ---------- Quick actions ----------

function QuickActions({ onAddMoment }: { onAddMoment: () => void }) {
  const s = useSocial();
  const items: {
    icon: LucideIcon;
    label: string;
    tone: string;
    to?: string;
    onClick?: () => void;
  }[] = [
    s.mode === "live"
      ? { icon: ImagePlus, label: "Post", tone: "var(--pink)", to: "/app/feed" }
      : { icon: ImagePlus, label: "Moment", tone: "var(--pink)", onClick: onAddMoment },
    { icon: Camera, label: "Snap", tone: "var(--lime)", to: "/app/snap" },
    { icon: Gamepad2, label: "Play", tone: "var(--sky)", to: "/app/games" },
    { icon: UserPlus, label: "Add", tone: "var(--sun)", to: "/app/people" },
  ];
  return (
    <section className="px-5 mt-8" aria-label="Quick actions">
      <div className="grid grid-cols-4 gap-3">
        {items.map((it, i) => {
          const Icon = it.icon;
          const inner = (
            <>
              <span
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-90"
                style={{
                  background: it.tone,
                  color: "var(--on-accent)",
                  border: "2px solid var(--edge)",
                  boxShadow: "3px 3px 0 var(--edge)",
                  transform: `rotate(${[-4, 3, -2, 4][i]}deg)`,
                }}
              >
                <Icon size={24} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="text-[13px] font-bold text-cream">{it.label}</span>
            </>
          );
          const cls = "flex flex-col items-center gap-1.5";
          return it.to ? (
            <Link key={it.label} to={it.to} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={it.label} onClick={it.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
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
          🎲 the table chose
        </span>
        <div className="mt-4 flex justify-center">
          <span className="rounded-full" style={{ border: "2px solid var(--edge)", boxShadow: "0 0 0 4px var(--lime)" }}>
            <Avatar src={friend.avatar} initials={friend.initials} color={friend.color} size={92} />
          </span>
        </div>
        <h3 className="title mt-4" style={{ fontSize: 30 }}>
          {friend.name}
        </h3>
        {st.count > 0 && (
          <p className="meta mt-1">
            🔥 {st.count}-day streak{st.atRisk ? ", ends tonight" : ""}
          </p>
        )}
        <p className="text-cool mt-3 mx-auto max-w-[18rem]" style={{ fontSize: 15, lineHeight: 1.5 }}>
          {line}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link to="/app/snap" search={{ to: friend.id }} className="btn-primary">
            <Camera size={18} aria-hidden="true" /> Snap
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

// ---------- Screen ----------

function Home() {
  const s = useSocial();
  const people = tableOrder(s);
  const nudges = useNudges(s, people);
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
  const mood = MOODS[dayIndex() % MOODS.length];

  return (
    <>
      <header className="band px-5 pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] pb-5">
        <div className="flex items-center justify-between">
          <Logo height={44} title={VOICE.brand} />
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
        <h1 className="title mt-4" style={{ fontSize: 30 }}>
          {first ? (
            <>
              Hey <span className="mark">{first}</span> 👋
            </>
          ) : (
            <>
              Your <span className="mark">table</span> 👋
            </>
          )}
        </h1>
        <p className="sub mt-1.5" style={{ fontSize: 15 }}>
          {mood}
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link to="/app/people" className="sticker" style={{ transform: "rotate(-3deg)" }}>
            🪑 {filled}/25 seats
          </Link>
          <span className="sticker sun" style={{ transform: "rotate(2deg)" }}>
            🔥 {streakCount} streak{streakCount === 1 ? "" : "s"}
          </span>
          <span className="sticker pink" style={{ transform: "rotate(-2deg)" }}>
            👀 in {s.seatedByCount} people's 25
          </span>
          <span className="sticker sky" style={{ transform: "rotate(3deg)" }}>
            ✨ {posted} posted today
          </span>
        </div>
      </header>

      <ModeBanner />

      <Table people={people} spot={spot} rolling={rolling} onRoll={onRoll} />

      <QuickActions onAddMoment={() => setAdding(true)} />

      <RightNow nudges={nudges} />

      <Dare />

      <GameRank />

      {s.mode === "demo" && <TodayAtTheTable />}

      <Link
        to="/app/people"
        className="mx-5 mt-6 card p-4 flex items-center gap-3 hover:bg-[var(--fill)]"
        style={{ display: filled < 25 ? "flex" : "none" }}
      >
        <span className="text-2xl">🪑</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-cream">{25 - filled} seats still open</span>
          <span className="block meta">Only people you'd call at 3 AM.</span>
        </span>
        <ChevronRight size={18} className="text-faint" aria-hidden="true" />
      </Link>

      <p className="text-center meta mt-10 mb-2 px-8">{VOICE.brandLine}</p>

      <Confetti fire={confetti} />
      {picked && <RollPanel friend={picked} onClose={() => setPicked(null)} />}
      {adding && (
        <AddMomentSheet onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} />
      )}
    </>
  );
}
