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

  // A living table: every few seconds something small happens between friends.
  const [scene, setScene] = useState<Scene | null>(null);
  // Tap the empty table: a Mexican wave runs around it.
  const [wave, setWave] = useState(0);
  const spriteRef = useRef<HTMLSpanElement>(null);
  const placesKey = places.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|");
  const angle = (i: number) => Math.atan2(places[i].y - 50, places[i].x - 50);
  const aroundOrder = new Map(
    places
      .map((_, i) => i)
      .sort((a, b) => angle(a) - angle(b))
      .map((i, k) => [i, k] as const),
  );
  useEffect(() => {
    if (seated.length < 2) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const pick = (): Scene | null => {
      const rnd = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
      // Neighbours: same ring, next to each other around the table.
      const near: [number, number][] = [];
      for (const ring of [0, 1, 2]) {
        const ids = places
          .map((p, i) => ({ p, i }))
          .filter((o) => o.p.ring === ring)
          .sort((x, y) => angle(x.i) - angle(y.i))
          .map((o) => o.i);
        for (let k = 0; k < ids.length && ids.length >= 2; k++) {
          const next = ids[(k + 1) % ids.length];
          if (next !== ids[k] && !(ids.length === 2 && k === 1)) near.push([ids[k], next]);
        }
      }
      // Opposite: about 180° apart.
      const across: [number, number][] = [];
      for (let x = 0; x < places.length; x++)
        for (let y = x + 1; y < places.length; y++) {
          const d = Math.abs(angle(x) - angle(y));
          if (Math.abs(d - Math.PI) < 0.45) across.push([x, y]);
        }
      const anyTwo = (): [number, number] => {
        const x = Math.floor(Math.random() * places.length);
        let y = Math.floor(Math.random() * (places.length - 1));
        if (y >= x) y++;
        return [x, y];
      };
      const bday = seated.map((f, i) => (bdayIn.has(f.id) ? i : -1)).filter((i) => i >= 0);
      const fire = seated
        .map((f, i) => ((s.streaks[f.id]?.count ?? 0) > 0 ? i : -1))
        .filter((i) => i >= 0);
      const choices: (() => Scene)[] = [];
      const key = Date.now();
      if (near.length)
        for (const kind of ["cheers", "highfive", "chai", "whisper"] as const)
          choices.push(() => {
            const [x, y] = rnd(near);
            return { kind, a: x, b: y, key };
          });
      if (across.length)
        for (const kind of ["pong", "wave"] as const)
          choices.push(() => {
            const [x, y] = rnd(across);
            return { kind, a: x, b: y, key };
          });
      choices.push(() => {
        const [x, y] = anyTwo();
        return { kind: "plane", a: x, b: y, key };
      });
      if (bday.length)
        choices.push(() => {
          const x = rnd(bday);
          const n = near.find((p) => p[0] === x || p[1] === x);
          return { kind: "bday", a: x, b: n ? (n[0] === x ? n[1] : n[0]) : -1, key };
        });
      if (fire.length) choices.push(() => ({ kind: "fire", a: rnd(fire), b: -1, key }));
      return choices.length ? rnd(choices)() : null;
    };
    const play = () => {
      if (!alive || rolling || document.visibilityState !== "visible") return;
      const sc = pick();
      if (!sc) return;
      setScene(sc);
      setTimeout(() => alive && setScene((cur) => (cur?.key === sc.key ? null : cur)), 3400);
    };
    const loop = (ms: number) => {
      t = setTimeout(() => {
        play();
        loop(5000 + Math.random() * 3000);
      }, ms);
    };
    loop(2200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, rolling]);
  useEffect(() => {
    if (rolling) setScene(null);
  }, [rolling]);
  useEffect(() => {
    if (!wave) return;
    const t = setTimeout(() => setWave(0), 600 + seated.length * 70);
    return () => clearTimeout(t);
  }, [wave, seated.length]);

  const px = (i: number) => ({ x: (places[i].x / 100) * W, y: (places[i].y / 100) * H });
  // Things that travel: the pong ball, the paper plane, the chai.
  useEffect(() => {
    const el = spriteRef.current;
    if (!scene || !el || !["pong", "plane", "chai"].includes(scene.kind)) return;
    const A = px(scene.a);
    const B = px(scene.b);
    const at = (p: { x: number; y: number }, extra = "") =>
      `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) ${extra}`;
    let anim: Animation;
    if (scene.kind === "pong") {
      const ends = [A, B];
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 4; k++) {
        const p = ends[k % 2];
        const q = ends[(k + 1) % 2];
        const from = { x: p.x + (q.x - p.x) * 0.18, y: p.y + (q.y - p.y) * 0.18 };
        frames.push({ transform: at(from), offset: k / 4 });
        if (k < 4) {
          const to = { x: q.x + (p.x - q.x) * 0.18, y: q.y + (p.y - q.y) * 0.18 };
          frames.push({
            transform: at({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 26 }, "scale(1.3)"),
            offset: (k + 0.5) / 4,
          });
        }
      }
      anim = el.animate(frames, { duration: 2900, easing: "linear", fill: "forwards" });
    } else if (scene.kind === "plane") {
      // A curve: lift off sideways, glide over, land.
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      const nx = -(B.y - A.y);
      const ny = B.x - A.x;
      const len = Math.hypot(nx, ny) || 1;
      const mid = { x: mx + (nx / len) * 45, y: my + (ny / len) * 45 };
      const deg = (p: { x: number; y: number }, q: { x: number; y: number }) =>
        (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 45;
      anim = el.animate(
        [
          { transform: at(A, `rotate(${deg(A, mid)}deg) scale(0.6)`), opacity: 0 },
          { transform: at(A, `rotate(${deg(A, mid)}deg) scale(1)`), opacity: 1, offset: 0.12 },
          { transform: at(mid, `rotate(${deg(A, B)}deg) scale(1.15)`), offset: 0.55 },
          { transform: at(B, `rotate(${deg(mid, B)}deg) scale(0.9)`), opacity: 1, offset: 0.92 },
          { transform: at(B, `rotate(${deg(mid, B)}deg) scale(0.5)`), opacity: 0 },
        ],
        { duration: 2600, easing: "ease-in-out", fill: "forwards" },
      );
    } else {
      // Chai slides across the table to the neighbour.
      anim = el.animate(
        [
          { transform: at(A, "scale(0.4)"), opacity: 0 },
          { transform: at(A, "scale(1)"), opacity: 1, offset: 0.15 },
          { transform: at(A, "scale(1) rotate(-8deg)"), offset: 0.3 },
          { transform: at(B, "scale(1) rotate(6deg)"), offset: 0.75 },
          { transform: at(B, "scale(1.2)"), opacity: 1, offset: 0.88 },
          { transform: at(B, "scale(0.6)"), opacity: 0 },
        ],
        { duration: 2800, easing: "ease-in-out", fill: "forwards" },
      );
    }
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.key]);

  return (
    <section
      ref={boxRef}
      className="flex-1 min-h-[260px] flex items-center justify-center px-4 py-3"
      aria-label="Your table"
      onPointerDown={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("a, button")) return setScene(null);
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setWave(Date.now());
      }}
    >
      <div className="relative" style={{ width: W, height: H }}>
        {/* The table itself: a big glass oval the closest ring sits around. */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "31%",
            background:
              "radial-gradient(circle at 35% 28%, rgba(193,239,98,0.16), transparent 60%), var(--glass-bg), #211E2B",
            border: "1px solid rgba(193,239,98,0.22)",
            boxShadow:
              "0 18px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 30px rgba(0,0,0,0.25)",
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
          // Cheers / high five: both lean in. Whisper: the whisperer leans in.
          const inScene =
            !!scene &&
            (((scene.kind === "cheers" || scene.kind === "highfive") &&
              (scene.a === i || scene.b === i)) ||
              (scene.kind === "whisper" && scene.a === i));
          const other = inScene ? (scene!.a === i ? scene!.b : scene!.a) : -1;
          const lean = wave
            ? ({
                animation: `face-bob 0.55s ease ${(aroundOrder.get(i) ?? 0) * 0.06}s both`,
              } as React.CSSProperties)
            : inScene
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
            <SceneArt scene={scene} px={px} spriteRef={spriteRef} />
          </div>
        )}
      </div>
    </section>
  );
}

type Scene = {
  kind: "pong" | "cheers" | "highfive" | "plane" | "chai" | "whisper" | "wave" | "bday" | "fire";
  a: number;
  b: number;
  key: number;
};

/** What each little table scene looks like. Positions come from the seats. */
function SceneArt({
  scene,
  px,
  spriteRef,
}: {
  scene: Scene;
  px: (i: number) => { x: number; y: number };
  spriteRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const A = px(scene.a);
  const B = scene.b >= 0 ? px(scene.b) : A;
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const pop = (
    text: string,
    at: { x: number; y: number },
    anim: string,
    size = 24,
    delay = 0,
    lift = 0,
  ) => (
    <span
      className="absolute"
      style={{
        left: at.x,
        top: at.y - lift,
        fontSize: size,
        lineHeight: 1,
        animation: `${anim} ${3.2 - delay}s ease ${delay}s both`,
      }}
    >
      {text}
    </span>
  );
  const sprite = (content: React.ReactNode, style?: React.CSSProperties) => (
    <span ref={spriteRef} className="absolute left-0 top-0" style={{ lineHeight: 1, ...style }}>
      {content}
    </span>
  );
  switch (scene.kind) {
    case "pong":
      return (
        <>
          {pop("🏓", { x: A.x + (B.x - A.x) * 0.1, y: A.y + (B.y - A.y) * 0.1 }, "paddle-in", 20)}
          {pop("🏓", { x: B.x + (A.x - B.x) * 0.1, y: B.y + (A.y - B.y) * 0.1 }, "paddle-in", 20)}
          {sprite(null, {
            width: 9,
            height: 9,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 0 8px rgba(255,255,255,0.8), 0 4px 6px rgba(0,0,0,0.4)",
          })}
        </>
      );
    case "cheers":
      return pop("🥂", mid, "cheers-pop", 26);
    case "highfive":
      return (
        <>
          {pop("🙌", mid, "cheers-pop", 26)}
          {pop("✨", { x: mid.x + 14, y: mid.y - 18 }, "spark", 16, 0.5)}
        </>
      );
    case "plane":
      return sprite("✈️", { fontSize: 22 });
    case "chai":
      return sprite("☕", { fontSize: 22 });
    case "whisper":
      return (
        <>
          {pop("💬", A, "bubble-in", 20, 0, 30)}
          {pop("😂", B, "bubble-in", 20, 1.3, 30)}
        </>
      );
    case "wave":
      return (
        <>
          {pop("👋", A, "hand-wave", 24, 0, 30)}
          {pop("👋", B, "hand-wave", 24, 1.1, 30)}
        </>
      );
    case "bday":
      return (
        <>
          {pop("🎉", A, "confetti-pop", 28, 0, 34)}
          {pop("✨", { x: A.x - 20, y: A.y }, "spark", 16, 0.3, 20)}
          {pop("✨", { x: A.x + 22, y: A.y }, "spark", 14, 0.5, 26)}
          {scene.b >= 0 && pop("🥳", B, "bubble-in", 20, 1.1, 30)}
        </>
      );
    case "fire":
      return pop("🔥", A, "flare", 30, 0, 28);
  }
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
  // Friends' birthdays now show as party hats at the Table (and a Wish button on
  // their page). Only your own birthday gets a banner here, to open your card.
  const list = useBirthdays();
  const s = useSocial();
  const mine = list.find((b) => b.id === "me");
  if (!mine || daysUntil(mine) !== 0) return null;
  return (
    <section className="px-5 mt-2">
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
      className="relative w-12 h-12 rounded-full flex items-center justify-center"
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
      <header className="topband px-4 pt-[max(1.1rem,calc(env(safe-area-inset-top)+0.85rem))] pb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link to="/app/home" aria-label="Your Table" className="inline-flex">
              <SeatLogo filled={people.length} height={64} />
            </Link>
            <p
              className="hidden min-[340px]:block leading-tight min-w-0 whitespace-nowrap"
              style={{ fontSize: 14, color: "var(--ink-2)" }}
            >
              <span className="block font-bold" style={{ color: "var(--ink)", fontSize: 17 }}>
                25 seats.
              </span>
              <span className="block">No more, no less.</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/app/people"
              aria-label="Add people"
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "var(--lime)",
                color: "var(--on-accent)",
                border: "var(--bd)",
                boxShadow: "var(--pop)",
              }}
            >
              <UserPlus size={22} strokeWidth={2.4} aria-hidden="true" />
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
                size={44}
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
