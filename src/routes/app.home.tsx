import { Tour } from "@/components/Tour";
import { Ico, TONE } from "@/components/Ico";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SeatLogo } from "@/components/Logo";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  Bell,
  Cake,
  Camera,
  ChevronRight,
  CircleHelp,
  Dices,
  Eye,
  Flame,
  Gamepad2,
  Hourglass,
  ImagePlus,
  MessageCircle,
  PartyPopper,
  Shuffle,
  Trophy,
  UserPlus,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt } from "@/components/GameArt";
import { useQuizBadges, type Best } from "@/lib/quiz";
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
import { DropGlyph } from "@/components/Brand";
import {
  TRIES,
  dayRanking,
  gameFor,
  thisWeek,
  today,
  useDaily,
  weekStandings,
  dayGameName,
} from "@/lib/daily";
import { Confetti, buzz, clientOnly } from "@/components/SocialUI";
import { PushPrompt } from "@/components/PushPrompt";
import { unreadCount, useActivity } from "@/lib/activity";
import { daysUntil, upcoming, useBirthdays } from "@/lib/birthdays";
import { dropTime, loadDrops, phaseOf } from "@/lib/drop";
import { PER_DAY, myVotesToday } from "@/lib/polls";

export const Route = createFileRoute("/app/home")({
  component: clientOnly(Home),
});

/**
 * The table has three rings, set by how well each friend did on YOUR quiz:
 * inner = 7/7, middle = 5–6 of 7, outer = everyone else (or no quiz yet).
 * A ring that's full spills over into the next one out.
 */
const SEATS = 25;
const RINGS = [
  { r: 23.5, cap: 6, size: 50 },
  { r: 36, cap: 11, size: 42 },
  { r: 46.5, cap: SEATS, size: 34 },
] as const;

function ringFor(b?: Best): 0 | 1 | 2 {
  if (!b || !b.total) return 2;
  if (b.score >= b.total) return 0;
  if (b.total >= 6 && b.score >= b.total - 2) return 1;
  return 2;
}

/** Demo table: sample quiz scores so the rings show what they mean. */
function demoScores(people: Person[]): Record<string, Best> {
  const out: Record<string, Best> = {};
  people.forEach((p, i) => {
    out[p.id] = { score: [7, 6, 7, 5, 3, 6, 4, 7, 2, 6][i % 10], total: 7 };
  });
  return out;
}

/** Where each person sits: ring + position, in the same order as `people`. */
function layout(people: Person[], knowsMe: Record<string, Best>) {
  const rings: number[][] = [[], [], []];
  people.forEach((p, i) => {
    let r = ringFor(knowsMe[p.id]);
    while (r < 2 && rings[r].length >= RINGS[r].cap) r++;
    rings[r].push(i);
  });
  const out: { x: number; y: number; ring: 0 | 1 | 2 }[] = [];
  rings.forEach((list, ri) => {
    const { r } = RINGS[ri];
    const offset = ri === 1 ? Math.PI / Math.max(list.length, 1) : 0;
    list.forEach((idx, k) => {
      const angle = (k / list.length) * Math.PI * 2 - Math.PI / 2 + offset;
      out[idx] = {
        x: 50 + r * Math.cos(angle),
        y: 50 + r * Math.sin(angle),
        ring: ri as 0 | 1 | 2,
      };
    });
  });
  return out;
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
  const quiz = useQuizBadges();
  const seated = people.slice(0, SEATS);
  const scores = useMemo(
    () => (s.mode === "live" ? quiz.knowsMe : demoScores(seated)),
    [s.mode, quiz.knowsMe, seated],
  );
  const places = layout(seated, scores);

  // An oval that fills the space it's given: as wide as it can be (up to 440px),
  // up to 1.4× as tall as it is wide. Faces scale with it, so it fits any screen.
  const boxRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 340, h: 420 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth - 32, h: el.clientHeight - 24 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(200, Math.min(box.w, 440, box.h));
  const H = Math.max(W, Math.min(box.h, W * 1.4));
  // Faces stay smaller than the gap between rings, so neighbours never overlap.
  const scale = Math.min(1.1, Math.max(0.7, (W / 350) * 0.95));

  // Birthdays in the next 7 days get a party hat.
  const bdays = useBirthdays();
  const bdayIn = new Map(
    bdays
      .filter((b) => b.id !== "me")
      .map((b) => [b.id, daysUntil(b)] as const)
      .filter(([, d]) => d <= 7),
  );

  // A living table: now and then two people interact. Opposite each other →
  // table tennis; next to each other → cheers.
  const [scene, setScene] = useState<{
    kind: "pong" | "cheers";
    a: number;
    b: number;
    key: number;
  } | null>(null);
  const ballRef = useRef<HTMLSpanElement>(null);
  const placesKey = places.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|");
  useEffect(() => {
    if (seated.length < 2) return;
    if (typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const angle = (i: number) => Math.atan2(places[i].y - 50, places[i].x - 50);
    const pick = () => {
      // Neighbours: same ring, next to each other by angle.
      const cheers: [number, number][] = [];
      for (const ring of [0, 1, 2]) {
        const ids = places
          .map((p, i) => ({ p, i }))
          .filter((o) => o.p.ring === ring)
          .sort((a, b) => angle(a.i) - angle(b.i))
          .map((o) => o.i);
        if (ids.length >= 2)
          ids.forEach((id, k) => {
            const next = ids[(k + 1) % ids.length];
            if (next !== id && !(ids.length === 2 && k === 1)) cheers.push([id, next]);
          });
      }
      // Opposite: about 180° apart.
      const pong: [number, number][] = [];
      for (let a = 0; a < places.length; a++)
        for (let b = a + 1; b < places.length; b++) {
          const d = Math.abs(angle(a) - angle(b));
          if (Math.abs(d - Math.PI) < 0.45) pong.push([a, b]);
        }
      const usePong = pong.length > 0 && (cheers.length === 0 || Math.random() < 0.5);
      const list = usePong ? pong : cheers;
      if (!list.length) return null;
      const [a, b] = list[Math.floor(Math.random() * list.length)];
      return { kind: (usePong ? "pong" : "cheers") as "pong" | "cheers", a, b, key: Date.now() };
    };
    const loop = () => {
      t = setTimeout(
        () => {
          if (!alive) return;
          if (!rolling && document.visibilityState === "visible") {
            const sc = pick();
            if (sc) {
              setScene(sc);
              setTimeout(
                () => alive && setScene((cur) => (cur?.key === sc.key ? null : cur)),
                3400,
              );
            }
          }
          loop();
        },
        6000 + Math.random() * 3000,
      );
    };
    // First one comes a little sooner.
    t = setTimeout(() => {
      if (!alive) return;
      const sc = pick();
      if (sc && !rolling) {
        setScene(sc);
        setTimeout(() => alive && setScene((cur) => (cur?.key === sc.key ? null : cur)), 3400);
      }
      loop();
    }, 2500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, rolling]);
  useEffect(() => {
    if (rolling) setScene(null);
  }, [rolling]);

  const px = (i: number) => ({ x: (places[i].x / 100) * W, y: (places[i].y / 100) * H });
  // Table tennis: the ball flies between the two players 4 times.
  useEffect(() => {
    if (scene?.kind !== "pong" || !ballRef.current) return;
    const A = px(scene.a);
    const B = px(scene.b);
    const ends = [A, B];
    const frames: Keyframe[] = [];
    for (let k = 0; k <= 4; k++) {
      const p = ends[k % 2];
      // Ball stops a bit short of the face.
      const q = ends[(k + 1) % 2];
      const x = p.x + (q.x - p.x) * 0.18;
      const y = p.y + (q.y - p.y) * 0.18;
      frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`, offset: k / 4 });
      if (k < 4) {
        const nx = q.x + (p.x - q.x) * 0.18;
        const ny = q.y + (p.y - q.y) * 0.18;
        frames.push({
          transform: `translate(${(x + nx) / 2}px, ${(y + ny) / 2 - 26}px) translate(-50%, -50%) scale(1.3)`,
          offset: (k + 0.5) / 4,
        });
      }
    }
    const anim = ballRef.current.animate(frames, {
      duration: 2900,
      easing: "linear",
      fill: "forwards",
    });
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.key]);

  return (
    <section
      ref={boxRef}
      className="flex-1 min-h-[260px] flex items-center justify-center px-4 py-3"
      aria-label="Your table"
      onPointerDown={() => setScene(null)}
    >
      <div className="relative" style={{ width: W, height: H }}>
        {/* Ring lines */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          {RINGS.map((ring, i) => (
            <ellipse
              key={i}
              cx={50}
              cy={50}
              rx={ring.r}
              ry={ring.r}
              fill="none"
              stroke={i === 0 ? "rgba(193,239,98,0.22)" : "rgba(255,255,255,0.08)"}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={i === 0 ? "4 4" : undefined}
            />
          ))}
        </svg>

        {/* Table top: just the dice */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "39.5%",
            background:
              "radial-gradient(circle at 35% 30%, rgba(181,219,94,0.2), transparent 65%), #24212D",
            border: "1px solid var(--line)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <button
            onClick={onRoll}
            disabled={rolling || !seated.length}
            aria-label="Roll the table: pick a random friend to surprise"
            className="relative flex flex-col items-center"
          >
            <span
              className={`flex items-center justify-center rounded-xl ${rolling ? "die-rolling" : "wiggle-idle"}`}
              style={{
                width: 36,
                height: 36,
                background: "var(--lime)",
                color: "var(--on-accent)",
                border: "var(--bd)",
                boxShadow: "var(--pop-sm)",
              }}
            >
              <Dices size={21} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span
              className="mt-1 font-display font-extrabold text-[11px]"
              style={{ color: "var(--lime)" }}
            >
              {rolling ? "rolling…" : "tap to roll"}
            </span>
          </button>
        </div>

        {/* Friends */}
        {seated.map((f, i) => {
          const { x, y, ring } = places[i];
          const size = Math.round(RINGS[ring].size * scale);
          const st = streakStatus(s.streaks[f.id]);
          const lit = spot === i;
          const oneWay = f.mutual === false;
          const score = scores[f.id];
          const small = ring === 2;
          const bdayDays = bdayIn.get(f.id);
          // Cheers: lean toward the other person.
          const inScene = scene?.kind === "cheers" && (scene.a === i || scene.b === i);
          const other = inScene ? (scene!.a === i ? scene!.b : scene!.a) : -1;
          const lean = inScene
            ? (() => {
                const dx = places[other].x - x;
                const dy = places[other].y - y;
                const len = Math.hypot(dx, dy) || 1;
                return {
                  "--dx": `${(dx / len) * 7}px`,
                  "--dy": `${(dy / len) * 7}px`,
                  "--rot": `${dx >= 0 ? 10 : -10}deg`,
                  animation: "lean 3.2s var(--ease, ease) both",
                } as React.CSSProperties;
              })()
            : undefined;
          return (
            <Link
              key={f.id}
              to="/app/seat/$id"
              params={{ id: f.id }}
              className="absolute flex flex-col items-center"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: lit ? 3 : 1,
              }}
              aria-label={`${f.name}${score ? `, got ${score.score}/${score.total} on your quiz` : ""}${st.count ? `, ${st.count}-day streak` : ""}${f.postedToday ? ", posted today" : ""}${oneWay ? ", hasn't seated you back" : ""}${bdayDays !== undefined ? (bdayDays === 0 ? ", birthday today" : `, birthday in ${bdayDays} day${bdayDays === 1 ? "" : "s"}`) : ""}`}
            >
              <span className="flex flex-col items-center" style={lean}>
                {bdayDays !== undefined && <PartyHat size={size} />}
                <span
                  className="relative rounded-full transition-transform duration-150"
                  style={{
                    boxShadow: lit
                      ? "0 0 0 4px var(--lime), 0 0 28px rgba(193,239,98,0.8)"
                      : "0 0 0 2px rgba(255,255,255,0.22), 0 10px 22px rgba(0,0,0,0.6)",
                    transform: lit ? "scale(1.18)" : "scale(1)",
                  }}
                >
                  <span style={{ display: "block", opacity: oneWay ? 0.55 : 1 }}>
                    <Avatar src={f.avatar} initials={f.initials} color={f.color} size={size} />
                  </span>
                  {f.postedToday && (
                    <span
                      className="absolute rounded-full flex items-center justify-center"
                      style={{
                        top: -3,
                        right: -3,
                        width: small ? 14 : 18,
                        height: small ? 14 : 18,
                        background: "var(--pink)",
                        color: "var(--on-accent)",
                        border: "2px solid var(--bg, #14121A)",
                      }}
                      aria-hidden="true"
                    >
                      <Camera size={small ? 8 : 10} strokeWidth={3} />
                    </span>
                  )}
                  {oneWay && (
                    <span
                      className="absolute rounded-full flex items-center justify-center"
                      style={{
                        top: -3,
                        left: -3,
                        width: small ? 14 : 18,
                        height: small ? 14 : 18,
                        background: "var(--edge)",
                        color: "var(--sky)",
                        border: "2px solid var(--bg, #14121A)",
                      }}
                      aria-hidden="true"
                    >
                      <Eye size={small ? 8 : 10} strokeWidth={3} />
                    </span>
                  )}
                </span>
                {st.count > 0 ? (
                  <span
                    className={`sticker relative z-[1] whitespace-nowrap ${st.atRisk ? "sun" : ""} -mt-2 !px-1.5 !py-0`}
                    style={{ fontSize: small ? 10 : 11 }}
                  >
                    <Ico i={Flame} size={small ? 10 : 11} />
                    {st.count}
                    {st.atRisk && <Ico i={Hourglass} size={small ? 10 : 11} />}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}

        {/* Little scenes between friends (decorative). */}
        {scene && (
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{ zIndex: 4 }}
          >
            {scene.kind === "pong" ? (
              <>
                {[scene.a, scene.b].map((i, k) => {
                  const me = px(i);
                  const them = px(k === 0 ? scene.b : scene.a);
                  return (
                    <span
                      key={k}
                      className="absolute text-[20px]"
                      style={{
                        left: me.x + (them.x - me.x) * 0.1,
                        top: me.y + (them.y - me.y) * 0.1,
                        animation: "paddle-in 3.2s ease both",
                      }}
                    >
                      🏓
                    </span>
                  );
                })}
                <span
                  ref={ballRef}
                  className="absolute left-0 top-0 rounded-full"
                  style={{
                    width: 9,
                    height: 9,
                    background: "#fff",
                    boxShadow: "0 0 8px rgba(255,255,255,0.8), 0 4px 6px rgba(0,0,0,0.4)",
                  }}
                />
              </>
            ) : (
              <span
                className="absolute text-[26px]"
                style={{
                  left: (px(scene.a).x + px(scene.b).x) / 2,
                  top: (px(scene.a).y + px(scene.b).y) / 2,
                  animation: "cheers-pop 3.2s ease both",
                }}
              >
                🥂
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** A tilted, striped party hat that sits on a face (birthday this week). */
function PartyHat({ size }: { size: number }) {
  const w = Math.round(size * 0.46);
  return (
    <svg
      width={w}
      height={w * 1.15}
      viewBox="0 0 40 46"
      aria-hidden="true"
      className="absolute"
      style={{
        top: -w * 0.82,
        left: size * 0.08,
        transform: "rotate(-20deg)",
        zIndex: 2,
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
      }}
    >
      <defs>
        <clipPath id="hat">
          <path d="M20 6 L36 42 Q20 46 4 42 Z" />
        </clipPath>
      </defs>
      <path d="M20 6 L36 42 Q20 46 4 42 Z" fill="#F27DA6" />
      <g clipPath="url(#hat)" stroke="#C1EF62" strokeWidth="5">
        <path d="M0 24 L40 14" />
        <path d="M0 36 L40 26" />
        <path d="M0 48 L40 38" />
      </g>
      <circle cx="20" cy="6" r="5" fill="#F5C451" stroke="#0d0b10" strokeWidth="1.5" />
    </svg>
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
  {
    text: "Send an ugly selfie. Streaks were built on less.",
    cta: "Send a blink",
    to: "/app/snap",
  },
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
  const g =
    revealed || (d.board[day]?.me ?? []).length
      ? real
      : { ...real, Icon: CircleHelp, name: dayGameName(day), tone: "var(--sun)" };
  const tries = d.board[day]?.me ?? [];
  const left = TRIES - tries.length;
  const todayRank = dayRanking(d, day).find((r) => r.id === "me");
  const week = weekStandings(d, thisWeek());
  const weekRank = week.findIndex((r) => r.id === "me") + 1;

  return (
    <section className="px-5 mt-6">
      <Link to="/app/games" className="card p-4 flex items-center gap-3 hover:bg-[var(--fill)]">
        <span className="shrink-0" aria-hidden="true">
          <GameArt
            kind={revealed || (d.board[day]?.me ?? []).length ? gameFor(day) : "mystery"}
            size={48}
          />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-cream text-[15px]">
            {g.name === dayGameName(day) ? g.name : `${dayGameName(day)}: ${g.name}`}
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
            style={{ border: "var(--bd)", boxShadow: "0 0 0 4px var(--lime)" }}
          >
            <Avatar src={friend.avatar} initials={friend.initials} color={friend.color} size={92} />
          </span>
        </div>
        <h3 className="title mt-4" style={{ fontSize: 30 }}>
          {friend.name}
        </h3>
        {st.count > 0 && (
          <p className="meta mt-1">
            <Ico i={Flame} c={TONE.streak} size={14} /> {st.count}-day streak
            {st.atRisk ? ", ends tonight" : ""}
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

/** Frosted-glass surface: the shared look from styles.css (--glass-*). */
const GLASS = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-line)",
  boxShadow: "var(--glass-shadow)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
} as const;

/** Has this person opened that screen yet? Shows a "new" sticker until they do. */
function seen(key: string) {
  try {
    return localStorage.getItem(`tf.seen.${key}`) === "1";
  } catch {
    return true;
  }
}

function TodayTiles() {
  const [at, setAt] = useState<number | null>(null);
  const [dropped, setDropped] = useState<boolean | null>(null);
  const [othersDropped, setOthersDropped] = useState(0);
  const [voted, setVoted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [newDrop] = useState(() => !seen("drop"));
  const [newPolls] = useState(() => !seen("polls"));
  useEffect(() => {
    void dropTime()
      .then(setAt)
      .catch(() => undefined);
    void loadDrops()
      .then((d) => {
        setDropped(!!d.mine);
        setOthersDropped(d.others.length);
      })
      .catch(() => setDropped(false));
    void myVotesToday()
      .then((v) => setVoted(Object.keys(v).length))
      .catch(() => setVoted(0));
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const phase = at ? phaseOf(at, now) : "before";
  const live = phase === "now" && dropped === false;
  const picksLeft = voted === null ? null : Math.max(0, PER_DAY - voted);
  const pollsHot = picksLeft !== null && picksLeft > 0;

  const dropStatus = dropped
    ? othersDropped
      ? `${othersDropped} dropped`
      : "Dropped ✓"
    : phase === "now"
      ? "Drop time!"
      : phase === "after"
        ? "Post late"
        : newDrop
          ? "new"
          : "Later today";
  const pollStatus =
    picksLeft === null ? "…" : picksLeft > 0 ? `${picksLeft} left` : newPolls ? "new" : "Done ✓";

  const card = (hot: boolean, tone: string) =>
    hot
      ? {
          background: tone,
          color: "var(--on-accent)",
          border: "var(--bd)",
          boxShadow: "var(--pop-sm)",
        }
      : { ...GLASS, color: "var(--ink)" };
  return (
    <section className="px-5 mt-4 grid grid-cols-2 gap-3" aria-label="Today">
      <Link
        to="/app/drop"
        className={`rounded-[22px] px-3 py-3 flex items-center gap-2.5 ${live ? "wiggle" : ""}`}
        style={card(live, "var(--lime)")}
      >
        <span
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
          style={{
            background: live ? "var(--on-accent)" : "var(--lime)",
            color: live ? "var(--lime)" : "var(--on-accent)",
            boxShadow: live ? undefined : "0 0 16px rgba(193,239,98,0.45)",
            borderRadius: 14,
          }}
        >
          <DropGlyph size={20} />
        </span>
        <span className="min-w-0">
          <span className="block font-extrabold text-[14.5px] leading-tight">The Drop</span>
          <span className="block text-[12px] font-bold opacity-80 truncate">{dropStatus}</span>
        </span>
      </Link>
      <Link
        to="/app/polls"
        className="rounded-[22px] px-3 py-3 flex items-center gap-2.5"
        style={card(pollsHot, "var(--pink)")}
      >
        <span
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
          style={{
            background: pollsHot ? "var(--on-accent)" : "var(--pink)",
            color: pollsHot ? "var(--pink)" : "var(--on-accent)",
            boxShadow: pollsHot ? undefined : "0 0 16px rgba(242,125,166,0.45)",
            borderRadius: 14,
          }}
        >
          <Vote size={19} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-extrabold text-[14.5px] leading-tight">Polls</span>
          <span className="block text-[12px] font-bold opacity-80 truncate">{pollStatus}</span>
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
  const soon = upcoming(list, 7);
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
            border: "var(--bd)",
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
            border: "var(--bd)",
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
              style={{ minHeight: 34, ...GLASS, borderRadius: 999 }}
            >
              <Ico i={Cake} c={TONE.birthday} size={14} /> {name(b.id)} ·{" "}
              {b.inDays === 1 ? "tomorrow" : `in ${b.inDays}d`}
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
        border: "var(--bd)",
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
            border: "var(--bd)",
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

  // The Table page fits the screen: no scrolling and no iPhone rubber-band bounce.
  useEffect(() => {
    const els = [document.documentElement, document.body];
    const prev = els.map((e) => [e.style.overflow, e.style.overscrollBehavior] as const);
    els.forEach((e) => {
      e.style.overflow = "hidden";
      e.style.overscrollBehavior = "none";
    });
    return () =>
      els.forEach((e, i) => {
        e.style.overflow = prev[i][0];
        e.style.overscrollBehavior = prev[i][1];
      });
  }, []);

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

  const streakCount = people.filter((f) => (s.streaks[f.id]?.count ?? 0) > 0).length;
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 8rem)" }}>
      <header className="topband px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))] pb-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link to="/app/home" aria-label="Your Table" className="inline-flex">
              <SeatLogo filled={people.length} height={48} />
            </Link>
            <p
              className="hidden min-[340px]:block leading-tight min-w-0 whitespace-nowrap"
              style={{ fontSize: 12.5, color: "var(--ink-2)" }}
            >
              <span className="block font-bold" style={{ color: "var(--ink)" }}>
                25 seats.
              </span>
              <span className="block">No more, no less.</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/app/people"
              aria-label="Add people"
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                background: "var(--lime)",
                color: "var(--on-accent)",
                border: "var(--bd)",
                boxShadow: "var(--pop)",
              }}
            >
              <UserPlus size={20} strokeWidth={2.4} aria-hidden="true" />
            </Link>
            <ActivityBell />
            <Link
              to="/app/profile"
              aria-label="Your profile"
              className="rounded-full"
              style={{ border: "var(--bd)", boxShadow: "var(--pop)" }}
            >
              <Avatar
                src={s.me ? s.me.avatar : ME.avatar}
                initials={s.me?.initials ?? ME.initials}
                size={40}
              />
            </Link>
          </div>
        </div>
      </header>

      <ModeBanner />

      <Birthdays />

      <Table people={people} spot={spot} rolling={rolling} onRoll={onRoll} />

      <TodayTiles />

      <PushPrompt />
      <Tour
        id="table"
        delay={1200}
        steps={[
          {
            at: 'section[aria-label="Your table"]',
            title: "This is your Table",
            body: "Closest ring: people who got 7/7 on your quiz. Middle: 5 or 6. Outer: everyone else. Tap a face to open them, or the dice to pick someone.",
          },
          {
            at: 'a[aria-label="Add people"]',
            title: "Fill your seats",
            body: "Add people you actually know. When you're in each other's 25, chats, blinks and games unlock.",
          },
          {
            at: 'a[href="/app/drop"]',
            title: "Every day",
            body: "The Drop: everyone posts at the same surprise time. Polls: anonymous picks about your 25.",
          },
          {
            at: 'nav[aria-label="Main"]',
            title: "Everything else",
            body: "Tap the big button to come back to your Table. The Drop, Feed, Chats and Games are around it; Blinks are in Chats. Swipe left and right to move between them.",
          },
        ]}
      />

      <Confetti fire={confetti} />
      {picked && <RollPanel friend={picked} onClose={() => setPicked(null)} />}
      {adding && (
        <AddMomentSheet onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} />
      )}
    </div>
  );
}
