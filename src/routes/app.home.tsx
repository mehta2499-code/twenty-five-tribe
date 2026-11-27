import { Tour } from "@/components/Tour";
import { sfx } from "@/lib/sfx";
import { Ico, TONE } from "@/components/Ico";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SeatMark } from "@/components/Logo";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  BarChart3,
  Bell,
  Cake,
  Camera,
  ChevronRight,
  CircleHelp,
  Dices,
  Eye,
  Gamepad2,
  Headphones,
  ImagePlus,
  MessageCircle,
  Shuffle,
  Swords,
  Trophy,
  UserPlus,
  Vote,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt } from "@/components/GameArt";
import { useQuizBadges, type Best } from "@/lib/quiz";
import { AddMomentSheet } from "@/components/AddMomentSheet";
import { FRIENDS, ME, RELATIONSHIP_MOMENTS } from "@/lib/data";
import {
  dayKey,
  friendById,
  mutualFriends,
  seatedFriends,
  useSocial,
  type Person,
  type SocialState,
} from "@/lib/social";
import { DailyRunner, GAMES } from "@/components/ArcadeGames";
import { TodaySection } from "@/components/DayResults";
import { WordDaily } from "@/components/WordUp";
import { DailyTune } from "@/components/Earworm";
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
import { Confetti, Sheet, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { friendsLoaded, useFriendsNow, type FriendNow } from "@/lib/status";
import { WaffleMenu } from "@/components/WaffleMenu";
import {
  ListeningBadge,
  NowPlayingCard,
  NowPlayingPicker,
  useNewSongs,
} from "@/components/NowPlaying";
import { cleanTitle, isListening, mainArtist } from "@/lib/music";
import { Glyph3D, preloadSprites } from "@/components/Glyph3D";
import { thisWeeksPacks } from "@/lib/data";
import { inviteToDuel, startLudo, startTriviaChallenge } from "@/lib/games";
import { PushPrompt } from "@/components/PushPrompt";
import { unreadCount, useActivity } from "@/lib/activity";
import { daysUntil, upcoming, useBirthdays } from "@/lib/birthdays";
import { BirthdayPop } from "@/components/BirthdayPop";
import { PollsPop } from "@/components/PollsPop";
import { dropTime, loadDrops, phaseOf } from "@/lib/drop";
import { PER_WEEK, myVotesThisWeek, newPollsWhen } from "@/lib/polls";

export const Route = createFileRoute("/app/home")({
  component: clientOnly(Home),
});

/** Up to 25 people at the table; the quiz decides who sits at its head. */
const SEATS = 25;

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

/** The table top's inset inside the table box (a pill shape: rounded ends). */
const TABLE_INSET = 0.18;

/**
 * Everyone sits the same distance from the table's edge: seats follow the
 * table's own outline (a pill), pushed out by a fixed gap, and are spaced
 * evenly along it, starting at the top. Returns % of the table box.
 */
function seatPath(n: number, W: number, H: number, face: number) {
  const tw = W * (1 - 2 * TABLE_INSET);
  const th = H * (1 - 2 * TABLE_INSET);
  const r = Math.min(tw, th) / 2;
  // The box is always at least as tall as it is wide, so the straight sides are upright.
  const L = Math.max(0, th - tw);
  const R = r + face / 2 + 7;
  const P = 2 * L + 2 * Math.PI * R;
  const cx = W / 2;
  const cy = H / 2;
  const h = L / 2;
  // Walk the outline clockwise from the top centre.
  const at = (d: number) => {
    const qa = (Math.PI * R) / 2;
    let x: number, y: number;
    if (d < qa) {
      const t = -Math.PI / 2 + d / R;
      [x, y] = [cx + R * Math.cos(t), cy - h + R * Math.sin(t)];
    } else if ((d -= qa) < L) {
      [x, y] = [cx + R, cy - h + d];
    } else if ((d -= L) < Math.PI * R) {
      const t = d / R;
      [x, y] = [cx + R * Math.cos(t), cy + h + R * Math.sin(t)];
    } else if ((d -= Math.PI * R) < L) {
      [x, y] = [cx - R, cy + h - d];
    } else {
      d -= L;
      const t = Math.PI + d / R;
      [x, y] = [cx + R * Math.cos(t), cy - h + R * Math.sin(t)];
    }
    return { x: (x / W) * 100, y: (y / H) * 100, ring: 2 as const };
  };
  return Array.from({ length: n }, (_, k) => at((k * P) / Math.max(n, 1)));
}

/** Friends worth showing at the table first: who posted today. */
function tableOrder(s: SocialState): Person[] {
  return [...seatedFriends()].sort((a, b) => {
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
  picked,
  onPickedShown,
  onSpotDone,
  topLeft,
  topRight,
  bottomRight,
}: {
  /** Buttons pinned to the top corners of the table area (music, add people). */
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  bottomRight?: React.ReactNode;
  people: Person[];
  spot: number | null;
  rolling: boolean;
  onRoll: () => void;
  /** The friend the dice landed on: their menu opens next to their face. */
  picked: Person | null;
  onPickedShown: () => void;
  /** The dice's highlight can go (its menu was closed). */
  onSpotDone: () => void;
}) {
  const s = useSocial();
  // Who at your Table is in the app right now, and doing what.
  const live = useFriendsNow();
  const quiz = useQuizBadges();
  // Songs come from the 5-second check, so starting or stopping one moves
  // someone on or off the table right away.
  const seated = people
    .slice(0, SEATS)
    .map((f) => (friendsLoaded && s.mode === "live" ? { ...f, np: live.get(f.id)?.np } : f));
  const scores = useMemo(
    () => (s.mode === "live" ? quiz.knowsMe : demoScores(seated)),
    [s.mode, quiz.knowsMe, seated],
  );
  // An oval that fills the space it's given: as wide as it can be (up to 440px),
  // up to 1.4× as tall as it is wide. Faces scale with it, so it fits any screen.
  const boxRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 340, h: 420 });
  // The props wait for the real size, so they don't jump on every open.
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      setBox({ w: el.clientWidth - 32, h: el.clientHeight - 24 });
      setMeasured(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(200, Math.min(box.w, 440, box.h));
  const H = Math.max(W, Math.min(box.h, W * 1.7));
  // Everyone gets the same size face; smaller only when the table gets full.
  // (Measured along the seat line, which runs a fixed gap outside the table.)
  const seatLine = (() => {
    const tw = W * (1 - 2 * TABLE_INSET);
    const th = H * (1 - 2 * TABLE_INSET);
    return 2 * Math.max(0, th - tw) + 2 * Math.PI * (tw / 2 + 30);
  })();
  const faceSize = Math.round(
    Math.min(46, Math.max(30, (seatLine / Math.max(people.slice(0, SEATS).length, 1)) * 0.8)),
  );
  // Birthdays in the next 7 days get a party hat.
  const bdays = useBirthdays();
  const bdayIn = new Map(
    bdays
      .filter((b) => b.id !== "me")
      .map((b) => [b.id, daysUntil(b)] as const)
      .filter(([, d]) => d <= 7),
  );
  // Birthday today: they take the middle of the table, bigger, hat on.
  const star = seated.findIndex((f) => bdayIn.get(f.id) === 0);
  // Anyone doing something right now (playing, on the Drop, dancing to a song)
  // gets up from their seat and comes onto the table, in a ring around the dice.
  const busy = seated
    .map((f, i) => {
      const n = live.get(f.id);
      return i !== star && ((n?.here && n.doing) || isListening(f)) ? i : -1;
    })
    .filter((i) => i >= 0)
    .slice(0, 8);
  // Everyone still in their seat spreads out evenly, so no seat is left empty.
  const sittingIdx = seated.map((_, i) => i).filter((i) => !busy.includes(i) && i !== star);
  const sittingSeats = seatPath(sittingIdx.length, W, H, faceSize);
  const places = seated.map((_, i) => {
    if (i === star) return { x: 50, y: 40, ring: 0 as const };
    const k = busy.indexOf(i);
    if (k < 0) return sittingSeats[sittingIdx.indexOf(i)];
    const a =
      -Math.PI / 2 + (k * 2 * Math.PI) / busy.length + (busy.length === 2 ? Math.PI / 2 : 0);
    const rx = star >= 0 ? 27 : 19;
    const ry = star >= 0 ? 29 : 23;
    return { x: 50 + Math.cos(a) * rx, y: 50 + Math.sin(a) * ry, ring: 0 as const };
  }); // A birthday cake sits on the table's edge, right in front of that person's seat.
  const cakeAt = (i: number) => {
    if (i === star) return { x: 50, y: 58 };
    const tw = W * (1 - 2 * TABLE_INSET);
    const th = H * (1 - 2 * TABLE_INSET);
    const r = tw / 2;
    const h = Math.max(0, th - tw) / 2;
    const into = r - W * 0.1; // how far from the middle: just inside the rim
    const px = (places[i].x / 100) * W - W / 2;
    const py = (places[i].y / 100) * H - H / 2;
    let x: number, y: number;
    if (Math.abs(py) <= h) [x, y] = [Math.sign(px) * into, py];
    else {
      const oy = Math.sign(py) * h;
      const d = Math.hypot(px, py - oy) || 1;
      [x, y] = [(px / d) * into, oy + ((py - oy) / d) * into];
    }
    return { x: ((x + W / 2) / W) * 100, y: ((y + H / 2) / H) * 100 };
  };

  // Is a prop under someone on the table (or a birthday cake)? Then it's cleared away.
  const blocked = (p: PropDef) => {
    const r = (p.w * W) / 2;
    const near = (x: number, y: number, room: number) =>
      Math.hypot(((p.x - x) / 100) * W, ((p.y - y) / 100) * H) < room + r * 0.8;
    return (
      busy.some((i) => near(places[i].x, places[i].y, faceSize / 2 + 8)) ||
      seated.some((f, i) => bdayIn.get(f.id) === 0 && near(cakeAt(i).x, cakeAt(i).y, W * 0.075))
    );
  };

  useEffect(() => {
    preloadSprites([
      "paddle",
      "ball",
      "cheers",
      "highfive",
      "plane",
      "chai",
      "whisper",
      "laugh",
      "wave",
      "popper",
      "sparkle",
      "cake",
      "partyhat",
      "dice",
      "headphones",
      "notes",
    ]);
  }, []);
  // Tap a face → a menu: view, challenge, message, wish.
  const [menu, setMenu] = useState<{ f: Person; rect: DOMRect; step?: "challenge" } | null>(null);
  const navigate = useNavigate();
  const [menuErr, setMenuErr] = useState<string | null>(null);
  const [listen, setListen] = useState<Person | null>(null);
  // The dice picked someone: open the same menu as tapping their face.
  useEffect(() => {
    if (!picked) return;
    const el = document.querySelector<HTMLElement>(`[data-person="${picked.id}"]`);
    if (el) setMenu({ f: picked, rect: el.getBoundingClientRect() });
    onPickedShown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  // Closing the menu (or picking something in it) turns the dice's highlight off.
  useEffect(() => {
    if (!menu && spot !== null && !rolling) onSpotDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);
  const challenge = async (kind: "trivia" | "ludo", f: Person) => {
    setMenu(null);
    try {
      if (kind === "trivia") {
        // A random topic from this week's trivia.
        const packs = thisWeeksPacks();
        const pack = packs[Math.floor(Math.random() * packs.length)];
        const id = await startTriviaChallenge(pack.id, f);
        void inviteToDuel(id, f.id, pack.name);
        navigate({ to: "/app/play/$id", params: { id } });
      } else {
        const id = await startLudo([f]);
        navigate({ to: "/app/play/$id", params: { id } });
      }
    } catch (e) {
      setMenuErr((e as Error).message);
    }
  };

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
      {
        const ids = places
          .map((p, i) => ({ p, i }))
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
      const choices: (() => Scene)[] = [];
      const key = Date.now();
      if (near.length)
        for (const kind of ["cheers", "highfive", "chai", "whisper"] as const)
          choices.push(() => {
            const [x, y] = rnd(near);
            return { kind, a: x, b: y, key };
          });
      // Table tennis and the paper plane come up about 3× as often as the rest.
      if (across.length)
        for (const kind of ["pong", "pong", "pong", "wave"] as const)
          choices.push(() => {
            const [x, y] = rnd(across);
            return { kind, a: x, b: y, key };
          });
      for (let k = 0; k < 3; k++)
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
      // The streak: each ghost replays the path a few milliseconds later.
      const ghosts = Array.from(
        el.parentElement?.querySelectorAll<HTMLElement>("[data-trail]") ?? [],
      ).map((g) =>
        g.animate(frames, {
          duration: 2900,
          easing: "linear",
          fill: "forwards",
          delay: Number(g.dataset.trail) * 22,
        }),
      );
      const main = anim;
      anim = { cancel: () => (main.cancel(), ghosts.forEach((g) => g.cancel())) } as Animation;
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
      className="relative flex-1 min-h-[260px] flex items-center justify-center px-4 py-3"
      aria-label="Your table"
      onPointerDown={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest(".fixed")) return; // the face menu
        if (el.closest("a, button")) return setScene(null);
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setWave(Date.now());
      }}
    >
      {topLeft && <div className="absolute left-4 top-2 z-[5]">{topLeft}</div>}
      {topRight && <div className="absolute right-4 top-2 z-[5]">{topRight}</div>}
      {bottomRight && <div className="absolute right-4 bottom-2 z-[5]">{bottomRight}</div>}
      <div className="relative" style={{ width: W, height: H }}>
        {/* The table itself: a big glass oval the closest ring sits around. */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "18%",
            background:
              "radial-gradient(circle at 35% 28%, rgba(193,239,98,0.16), transparent 60%), var(--glass-bg), #211E2B",
            border: "1px solid rgba(193,239,98,0.22)",
            boxShadow:
              "0 18px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 30px rgba(0,0,0,0.25)",
          }}
        />
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={star >= 0 ? { transform: `translateY(${H * 0.2}px)` } : undefined}
        >
          <button
            onClick={onRoll}
            disabled={rolling || !seated.length}
            aria-label="Roll the table: pick a random friend to surprise"
            className="relative flex flex-col items-center"
          >
            <span
              className={`flex items-center justify-center ${rolling ? "die-rolling" : "wiggle-idle"}`}
              style={{ lineHeight: 0, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))" }}
            >
              <Glyph3D name="dice" size={46} animate={rolling} fps={12} />
            </span>
          </button>
        </div>

        {/* The spread: pizza slices, red cups, wine (one knocked over). Tap one to jiggle it. */}
        {/* Table-aware: nothing sits under someone who's come onto the table (or a
            birthday cake), and an empty table gets a few more things on it. */}
        {measured &&
          TABLE_PROPS.map((p) => (
            <TableProp
              key={p.id}
              prop={p}
              width={W}
              hidden={(p.extra && busy.length > 0) || blocked(p)}
            />
          ))}

        {/* Birthday today: a cake on the table in front of their seat. */}
        {measured &&
          seated.map((f, i) =>
            bdayIn.get(f.id) === 0 ? (
              <TableProp
                key={`cake-${f.id}`}
                width={W}
                prop={{
                  id: `cake-${f.id}`,
                  sprite: "cake",
                  label: `Birthday cake for ${f.name}`,
                  x: cakeAt(i).x,
                  y: cakeAt(i).y,
                  w: 0.15,
                }}
              />
            ) : null,
          )}

        {/* Friends */}
        {seated.map((f, i) => {
          const { x, y } = places[i];
          const isStar = i === star;
          const size = isStar ? Math.round(Math.min(W * 0.18, faceSize * 1.4)) : faceSize;
          const lit = spot === i;
          const oneWay = f.mutual === false;
          const score = scores[f.id];
          const small = faceSize < 42;
          const bdayDays = bdayIn.get(f.id);
          const raw = live.get(f.id);
          const now = raw?.here ? raw : undefined;
          // Sharing a song: they dance at the table, online or not.
          const dancing = isListening(f);
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
            <button
              key={f.id}
              type="button"
              data-person={f.id}
              aria-haspopup="menu"
              onClick={(e) => {
                setScene(null);
                setMenu({ f, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() });
              }}
              className="absolute flex flex-col items-center"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: lit ? 3 : busy.includes(i) || isStar ? 2 : 1,
                transition: "left 0.9s cubic-bezier(.2,.8,.2,1), top 0.9s cubic-bezier(.2,.8,.2,1)",
              }}
              aria-label={`${f.name}${score ? `, got ${score.score}/${score.total} on your quiz` : ""}${oneWay ? ", hasn't seated you back" : ""}${bdayDays !== undefined ? (bdayDays === 0 ? ", birthday today" : `, birthday in ${bdayDays} day${bdayDays === 1 ? "" : "s"}`) : ""}${now ? `, ${nowText(now)}` : ""}`}
            >
              <span className="flex flex-col items-center" style={lean}>
                {/* Birthday coming up: the party hat. If they're also listening, it sits on
                    top of the headphone band, so both show. */}
                {bdayDays !== undefined && <PartyHat size={size} onPhones={isListening(f)} />}
                <span
                  className="relative rounded-full transition-transform duration-150"
                  style={{
                    boxShadow: lit
                      ? "0 0 0 4px var(--lime), 0 0 28px rgba(193,239,98,0.8)"
                      : isStar
                        ? "0 0 0 3px var(--pink), 0 0 0 7px rgba(242,125,166,0.25), 0 0 46px rgba(242,125,166,0.75)"
                        : "0 0 0 2px rgba(255,255,255,0.22), 0 10px 22px rgba(0,0,0,0.6)",
                    transform: lit ? "scale(1.18)" : "scale(1)",
                  }}
                >
                  {isListening(f) && <ListeningBadge size={size} />}
                  <span
                    className={dancing && !lean ? "dance" : undefined}
                    style={{ display: "block", opacity: oneWay ? 0.55 : 1 }}
                  >
                    <Avatar src={f.avatar} initials={f.initials} color={f.color} size={size} />
                  </span>
                  {now && <LiveBadge now={now} small={small} />}
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
                {isStar && (
                  <span
                    className="mt-2 rounded-full px-2.5 py-1 text-[12px] font-extrabold whitespace-nowrap"
                    style={{
                      background: "linear-gradient(90deg, var(--pink), #F6A6C3)",
                      color: "#1B1724",
                      boxShadow: "0 6px 18px rgba(242,125,166,0.45)",
                      animation: "float 2.4s ease-in-out infinite",
                    }}
                  >
                    Wish 🎂
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {menu && (
          <WaffleMenu
            anchor={menu.rect}
            label={`Options for ${menu.f.name}`}
            onClose={() => setMenu(null)}
            header={
              // Tap the name (or photo) to open their profile.
              <button
                type="button"
                onClick={() => navigate({ to: "/app/seat/$id", params: { id: menu.f.id } })}
                aria-label={`View ${menu.f.name}'s profile`}
                className="menu-row w-full flex items-center gap-2.5 rounded-[14px] -m-1 p-1 text-left"
              >
                <Avatar
                  src={menu.f.avatar}
                  initials={menu.f.initials}
                  color={menu.f.color}
                  size={36}
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{menu.f.name}</span>
                  {menu.step === "challenge" && (
                    <span className="block meta text-[12px]">Pick a game</span>
                  )}
                </span>
                <ChevronRight
                  size={18}
                  className="shrink-0"
                  style={{ color: "var(--ink-3)" }}
                  aria-hidden="true"
                />
              </button>
            }
            items={
              menu.step === "challenge"
                ? [
                    {
                      key: "trivia",
                      icon: <Zap size={20} />,
                      label: "Trivia duel",
                      hint: "Live, 1 vs 1",
                      onSelect: () => void challenge("trivia", menu.f),
                    },
                    {
                      key: "ludo",
                      icon: <Dices size={20} />,
                      label: "Ludo",
                      hint: "Race home",
                      onSelect: () => void challenge("ludo", menu.f),
                    },
                  ]
                : [
                    {
                      key: "challenge",
                      icon: <Swords size={20} />,
                      label: "Challenge",
                      disabled: menu.f.mutual === false,
                      hint: menu.f.mutual === false ? "Not mutual yet" : undefined,
                      onSelect: () => setMenu({ ...menu, step: "challenge" }),
                    },
                    {
                      key: "msg",
                      icon: <MessageCircle size={20} />,
                      label: "Message",
                      disabled: menu.f.mutual === false,
                      hint: menu.f.mutual === false ? "Not mutual yet" : undefined,
                      onSelect: () => navigate({ to: "/app/chat/$id", params: { id: menu.f.id } }),
                    },
                    ...(live.get(menu.f.id)?.here && live.get(menu.f.id)?.doing
                      ? [
                          {
                            key: "now",
                            icon:
                              live.get(menu.f.id)!.doing === "game" ? (
                                <Gamepad2 size={20} />
                              ) : (
                                <Camera size={20} />
                              ),
                            label:
                              live.get(menu.f.id)!.doing === "game"
                                ? `Playing ${live.get(menu.f.id)!.detail ?? "a game"}`
                                : "Taking their Drop",
                            hint:
                              live.get(menu.f.id)!.doing === "game"
                                ? "Right now · play too"
                                : "Right now · take yours",
                            onSelect: () =>
                              navigate({
                                to:
                                  live.get(menu.f.id)!.doing === "game"
                                    ? "/app/games"
                                    : "/app/drop",
                              }),
                          },
                        ]
                      : []),
                    ...(isListening(menu.f) && menu.f.np
                      ? [
                          {
                            key: "listen",
                            icon: <Headphones size={20} />,
                            label: "Listening now",
                            hint: `${cleanTitle(menu.f.np.title)}${menu.f.np.artist ? ` · ${mainArtist(menu.f.np.artist)}` : ""}`,
                            onSelect: () => {
                              setListen(menu.f);
                              setMenu(null);
                            },
                          },
                        ]
                      : []),
                    ...(bdayIn.has(menu.f.id)
                      ? [
                          {
                            key: "wish",
                            icon: <Cake size={20} />,
                            label: "Birthday wish",
                            hint:
                              bdayIn.get(menu.f.id) === 0
                                ? "Today!"
                                : `In ${bdayIn.get(menu.f.id)}d`,
                            onSelect: () =>
                              navigate({ to: "/app/card/$id", params: { id: menu.f.id } }),
                          },
                        ]
                      : []),
                  ]
            }
          />
        )}
        {menuErr && <Toast text={menuErr} onDone={() => setMenuErr(null)} />}
        {listen?.np && (
          <Sheet
            title={`${listen.name.split(" ")[0]}'s song`}
            onClose={() => setListen(null)}
            center
          >
            <NowPlayingCard np={listen.np} bare />
          </Sheet>
        )}

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
  kind: "pong" | "cheers" | "highfive" | "plane" | "chai" | "whisper" | "wave" | "bday";
  a: number;
  b: number;
  key: number;
};

/** What each little table scene looks like (our Blender renders). Positions come from the seats. */
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
  const soft = "drop-shadow(0 4px 6px rgba(0,0,0,0.45))";
  /** A sprite that pops in at a spot, holds, and fades. */
  const pop = (
    node: React.ReactNode,
    at: { x: number; y: number },
    anim: string,
    delay = 0,
    lift = 0,
  ) => (
    <span
      className="absolute"
      style={{
        left: at.x,
        top: at.y - lift,
        lineHeight: 0,
        filter: soft,
        animation: `${anim} ${3.2 - delay}s ease ${delay}s both`,
      }}
    >
      {node}
    </span>
  );
  switch (scene.kind) {
    case "pong":
      return (
        <>
          {pop(
            <Glyph3D name="paddle" size={26} animate fps={6} />,
            { x: A.x + (B.x - A.x) * 0.1, y: A.y + (B.y - A.y) * 0.1 },
            "paddle-in",
          )}
          {pop(
            <Glyph3D name="paddle" size={26} animate fps={6} style={{ transform: "scaleX(-1)" }} />,
            { x: B.x + (A.x - B.x) * 0.1, y: B.y + (A.y - B.y) * 0.1 },
            "paddle-in",
          )}
          {/* The ball's comet streak: fading copies that follow a beat behind. */}
          {Array.from({ length: 7 }, (_, k) => (
            <span
              key={k}
              data-trail={k + 1}
              className="absolute left-0 top-0 rounded-full"
              style={{
                width: 10 - k,
                height: 10 - k,
                background: "rgba(236,255,190,0.9)",
                opacity: 0.55 - k * 0.07,
                filter: `blur(${0.6 + k * 0.35}px)`,
              }}
            />
          ))}
          <span
            ref={spriteRef}
            className="absolute left-0 top-0"
            style={{ lineHeight: 0, filter: soft }}
          >
            <Glyph3D name="ball" size={12} />
          </span>
        </>
      );
    case "cheers":
      return pop(
        <Glyph3D name="cheers" size={34} animate fps={4} loop={false} />,
        mid,
        "cheers-pop",
        0,
        6,
      );
    case "highfive":
      return pop(
        <Glyph3D name="highfive" size={34} animate fps={5} loop={false} />,
        mid,
        "cheers-pop",
        0,
        6,
      );
    case "plane":
      return (
        <span
          ref={spriteRef}
          className="absolute left-0 top-0"
          style={{ lineHeight: 0, filter: soft }}
        >
          <Glyph3D name="plane" size={26} animate fps={4} />
        </span>
      );
    case "chai":
      return (
        <span
          ref={spriteRef}
          className="absolute left-0 top-0"
          style={{ lineHeight: 0, filter: soft }}
        >
          <Glyph3D name="chai" size={26} animate fps={4} />
        </span>
      );
    case "whisper":
      return (
        <>
          {pop(<Glyph3D name="whisper" size={26} animate fps={3} />, A, "bubble-in", 0, 30)}
          {pop(<Glyph3D name="laugh" size={22} animate fps={4} />, B, "bubble-in", 1.3, 30)}
        </>
      );
    case "wave":
      return (
        <>
          {pop(<Glyph3D name="wave" size={26} animate fps={8} />, A, "bubble-in", 0, 32)}
          {pop(
            <Glyph3D name="wave" size={26} animate fps={8} style={{ transform: "scaleX(-1)" }} />,
            B,
            "bubble-in",
            1.1,
            32,
          )}
        </>
      );
    case "bday":
      return (
        <>
          {pop(<Glyph3D name="popper" size={28} animate fps={3} />, A, "bubble-in", 0, 34)}
          <Confetti3D at={{ x: A.x + 6, y: A.y - 44 }} />
          {pop(
            <Glyph3D name="sparkle" size={18} animate fps={5} />,
            { x: A.x - 22, y: A.y },
            "spark",
            0.3,
            20,
          )}
          {scene.b >= 0 &&
            pop(<Glyph3D name="cake" size={22} animate fps={3} />, B, "bubble-in", 1.1, 30)}
        </>
      );
  }
}

/** A small code-drawn confetti burst (crisp at any size, brand colours). */
function Confetti3D({ at }: { at: { x: number; y: number } }) {
  const colours = ["#C1EF62", "#F27DA6", "#7EB8F0", "#F5C451", "#F5F1FA"];
  return (
    <>
      {Array.from({ length: 14 }, (_, k) => {
        const a = (-150 + (k / 13) * 120) * (Math.PI / 180);
        const d = 26 + (k % 4) * 9;
        return (
          <span
            key={k}
            className="absolute rounded-[1px]"
            style={
              {
                left: at.x,
                top: at.y,
                width: 4,
                height: 7,
                background: colours[k % colours.length],
                "--tx": `${Math.cos(a) * d}px`,
                "--ty": `${Math.sin(a) * d}px`,
                "--rot": `${(k % 2 ? 1 : -1) * (180 + k * 25)}deg`,
                animation: `confetti-fly 1.6s cubic-bezier(.2,.7,.3,1) ${0.25 + (k % 3) * 0.05}s both`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </>
  );
}

/** A tilted 3D party hat that sits on a face (birthday this week). */
/** Snacks and drinks on the table (our Blender renders). x/y are % of the table box. */
type PropDef = {
  id: string;
  sprite: "pizzaslice" | "wine" | "winefallen" | "redcup" | "cake";
  label: string;
  x: number;
  y: number;
  /** Width as a share of the table box. */
  w: number;
  rot?: number;
  /** Only out when nobody has come onto the table (more room). */
  extra?: boolean;
};
const TABLE_PROPS: PropDef[] = [
  { id: "slice1", sprite: "pizzaslice", label: "Slice of pizza", x: 37, y: 65, w: 0.15, rot: -18 },
  { id: "slice2", sprite: "pizzaslice", label: "Slice of pizza", x: 31, y: 47, w: 0.13, rot: 32 },
  { id: "cup1", sprite: "redcup", label: "Red cup", x: 50, y: 77, w: 0.1, rot: 3 },
  { id: "cup2", sprite: "redcup", label: "Red cup", x: 47, y: 25, w: 0.09, rot: -4 },
  { id: "cup3", sprite: "redcup", label: "Red cup", x: 75, y: 40, w: 0.09 },
  { id: "wine1", sprite: "wine", label: "Glass of red wine", x: 63, y: 32, w: 0.17 },
  { id: "wine2", sprite: "wine", label: "Glass of red wine", x: 70, y: 56, w: 0.15, rot: 4 },
  {
    id: "spill",
    sprite: "winefallen",
    label: "Knocked-over wine glass",
    x: 31,
    y: 30,
    w: 0.17,
    rot: -6,
  },
  // More on an empty table.
  {
    id: "slice3",
    sprite: "pizzaslice",
    label: "Slice of pizza",
    x: 61,
    y: 71,
    w: 0.13,
    rot: 150,
    extra: true,
  },
  { id: "cup4", sprite: "redcup", label: "Red cup", x: 26, y: 60, w: 0.085, rot: -6, extra: true },
  { id: "cup5", sprite: "redcup", label: "Red cup", x: 78, y: 63, w: 0.08, rot: 5, extra: true },
];

/**
 * A prop you can play with:
 *  wine  → tap: it tips over and spills, gets cleaned up, a fresh full glass arrives
 *          (the knocked-over one: tap and it's cleaned up and replaced)
 *  cup   → tap: someone downs it, crushes the cup, a new one lands
 *  pizza → tap: a bite each time; the third finishes it and a new slice arrives
 *  cake  → tap: the candle lights, gets blown out, confetti
 */
function TableProp({
  prop,
  width,
  hidden = false,
}: {
  prop: PropDef;
  width: number;
  hidden?: boolean;
}) {
  const kind =
    prop.sprite === "wine" || prop.sprite === "winefallen"
      ? "wine"
      : prop.sprite === "redcup"
        ? "cup"
        : prop.sprite === "pizzaslice"
          ? "slice"
          : "cake";
  const [st, setSt] = useState(prop.sprite === "winefallen" ? "fallen" : "idle");
  const [bites, setBites] = useState(0);
  // Knocked over by a tap: liquid splashes out and spreads into a puddle.
  const [spilt, setSpilt] = useState(false);
  const [jig, setJig] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const after = (steps: [string, number][]) => {
    let t = 0;
    for (const [next, ms] of steps) {
      t += ms;
      timers.current.push(setTimeout(() => setSt(next), t));
    }
  };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tap = () => {
    buzz(8);
    if (reduced()) return setJig((n) => n + 1);
    if (kind === "wine") {
      if (st === "idle") {
        setSt("tipping");
        setSpilt(true);
        after([
          ["fallen", 520],
          ["cleaning", 1700],
          ["fresh", 800],
          ["idle", 700],
        ]);
        timers.current.push(setTimeout(() => setSpilt(false), 520 + 1700 + 800));
      } else if (st === "fallen") {
        setSt("cleaning");
        after([
          ["fresh", 800],
          ["idle", 700],
        ]);
      }
    } else if (kind === "cup") {
      if (st !== "idle") return;
      setSt("tipping");
      setSpilt(true);
      after([
        ["spilled", 480],
        ["cleaning", 1700],
        ["fresh", 800],
        ["idle", 700],
      ]);
      timers.current.push(setTimeout(() => setSpilt(false), 480 + 1700 + 800));
    } else if (kind === "slice") {
      if (st !== "idle") return;
      if (bites < 2) {
        setBites((b) => b + 1);
        setJig((n) => n + 1);
      } else {
        setSt("eaten");
        timers.current.push(setTimeout(() => setBites(0), 500));
        after([
          ["gone", 500],
          ["fresh", 600],
          ["idle", 700],
        ]);
      }
    } else {
      if (st !== "idle") return;
      setSt("lit");
      after([
        ["blown", 1300],
        ["idle", 1500],
      ]);
    }
  };
  const base = Math.round(width * prop.w);
  // Cups fall toward the middle of the table, so the spill stays on it.
  const fallLeft = kind === "cup" && prop.x > 50;
  const fallenLook = kind === "wine" && (st === "fallen" || st === "cleaning");
  const size = fallenLook ? Math.round(base * 1.25) : base;
  const sprite = fallenLook ? "winefallen" : prop.sprite === "winefallen" ? "wine" : prop.sprite;
  const anim: Record<string, string> = {
    fallen: "prop-in 0.12s ease-out both",
    cleaning: "prop-clean 0.8s ease-in both",
    fresh: "prop-fresh 0.7s cubic-bezier(.3,1.4,.5,1) both",
    eaten: "slice-eat 0.5s ease-in both",
    gone: "none",
  };
  // Bites out of the tip of the slice.
  const BITES = [
    "radial-gradient(circle at 14% 56%, transparent 13%, #000 13.6%)",
    "radial-gradient(circle at 30% 50%, transparent 15%, #000 15.6%)",
  ];
  const mask =
    kind === "slice" && bites > 0
      ? ({
          maskImage: BITES.slice(0, bites).join(", "),
          WebkitMaskImage: BITES.slice(0, bites).join(", "),
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        } as React.CSSProperties)
      : {};
  return (
    <button
      type="button"
      aria-label={prop.label}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      onClick={tap}
      className="absolute"
      style={{
        left: `${prop.x}%`,
        top: `${prop.y}%`,
        transform: `translate(-50%, -50%) rotate(${prop.rot ?? 0}deg) scale(${hidden ? 0.6 : 1})`,
        lineHeight: 0,
        filter: "drop-shadow(0 4px 5px rgba(0,0,0,0.45))",
        animation: hidden ? undefined : "prop-in 0.35s ease-out both",
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : undefined,
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      {/* The spill: a puddle that spreads out from the glass's mouth, plus a splash. */}
      {spilt && (kind === "cup" || kind === "wine") && st !== "tipping" && st !== "fresh" && (
        <Spill kind={kind} base={base} cleaning={st === "cleaning"} left={fallLeft} />
      )}
      <span
        key={`j${jig}`}
        className={jig && st === "idle" ? "prop-jiggle" : undefined}
        style={{
          display: "block",
          transformOrigin: "50% 80%",
          animation: anim[st],
          opacity: st === "gone" ? 0 : undefined,
          position: "relative",
        }}
      >
        {/* Tipping over: the glass falls onto its side (and stays there for a cup). */}
        <span
          style={{
            display: "block",
            // Wine tips over on its base (the foot stays put), so the knocked-over
            // glass lies exactly where it fell and a fresh one stands where it stood.
            transformOrigin: kind === "wine" ? "49% 82%" : "50% 88%",
            transform:
              kind === "cup" && (st === "tipping" || st === "spilled" || st === "cleaning")
                ? `rotate(${fallLeft ? -92 : 92}deg)`
                : kind === "wine" && st === "tipping"
                  ? "rotate(118deg)"
                  : fallenLook
                    ? `translate(${FALLEN_SHIFT.x * base}px, ${FALLEN_SHIFT.y * base}px)`
                    : undefined,
            transition:
              st === "tipping" ? "transform 0.5s cubic-bezier(0.55, 0, 0.85, 0.4)" : undefined,
            ...mask,
          }}
        >
          <Glyph3D name={sprite} size={size} animate={kind === "cake" && st === "lit"} fps={4} />
        </span>
      </span>
      {/* Cleaning up the spill / crumbs: a little sparkle. */}
      {(st === "cleaning" || st === "eaten" || st === "blown") && (
        <span
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", lineHeight: 0 }}
        >
          <Glyph3D name="sparkle" size={Math.round(base * 1.1)} animate fps={8} />
        </span>
      )}
      {/* Cake: the candle lights up, then it's blown out with confetti. */}
      {kind === "cake" && st === "lit" && (
        <span
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ left: "52%", top: "2%", transform: "translate(-50%, -70%)", lineHeight: 0 }}
        >
          <Glyph3D name="flame" size={Math.round(base * 0.38)} animate fps={10} />
        </span>
      )}
      {kind === "cake" && st === "blown" && (
        <span
          aria-hidden="true"
          className="absolute pointer-events-none prop-pop-up"
          style={{ left: "50%", top: "0%", lineHeight: 0 }}
        >
          <Glyph3D name="popper" size={Math.round(base * 0.8)} animate fps={6} loop={false} />
        </span>
      )}
    </button>
  );
}

/**
 * The knocked-over wine picture is drawn shifted (× the upright glass's size) so
 * its foot sits where the upright glass's foot was.
 */
const FALLEN_SHIFT = { x: 0.44, y: 0.41 };

/**
 * Spilt drink: a puddle spreads out from where the glass's mouth landed, with
 * a few drops splashing out first. Wiped away (fades) while it's cleaned up.
 */
function Spill({
  kind,
  base,
  cleaning,
  left = false,
}: {
  kind: "cup" | "wine";
  base: number;
  cleaning: boolean;
  /** The cup fell to the left. */
  left?: boolean;
}) {
  // Where the mouth ends up, as a share of the prop's box (cup falls to the right;
  // the knocked-over wine glass lies with its mouth bottom-right).
  const box = kind === "wine" ? base * 1.25 : base;
  const at =
    kind === "cup"
      ? { x: left ? -0.28 : 1.28, y: 0.9 }
      : { x: 0.8 + (FALLEN_SHIFT.x * base) / box, y: 0.8 + (FALLEN_SHIFT.y * base) / box };
  const flip = left ? -1 : 1;
  const tone =
    kind === "cup"
      ? { fill: "rgba(240,176,48,0.88)", rim: "rgba(255,244,214,0.95)" }
      : { fill: "rgba(128,10,34,0.92)", rim: "rgba(214,60,80,0.9)" };
  const w = base * (kind === "cup" ? 1.25 : 1.0);
  const h = w * 0.42;
  const drops = [
    { dx: 0.55, dy: -0.35, r: 0.09 },
    { dx: 0.8, dy: -0.1, r: 0.07 },
    { dx: 0.35, dy: -0.55, r: 0.06 },
    { dx: 0.7, dy: 0.25, r: 0.08 },
    { dx: 0.15, dy: 0.35, r: 0.05 },
  ];
  return (
    <span
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{
        left: box * at.x,
        top: box * at.y,
        width: 0,
        height: 0,
        opacity: cleaning ? 0 : 1,
        transition: "opacity 0.7s ease-in",
      }}
    >
      <span
        className="absolute spill-grow"
        style={{
          left: left ? -w * 0.7 : -w * 0.3,
          top: -h / 2,
          width: w,
          height: h,
          borderRadius: "48% 52% 45% 55% / 55% 45% 55% 45%",
          background: `radial-gradient(ellipse at 30% 40%, ${tone.rim}, ${tone.fill} 38%, ${tone.fill})`,
          boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.25)`,
          transformOrigin: left ? "80% 50%" : "20% 50%",
        }}
      />
      {drops.map((d, k) => (
        <span
          key={k}
          className="absolute spill-drop rounded-full"
          style={
            {
              left: 0,
              top: 0,
              width: base * d.r,
              height: base * d.r,
              background: tone.fill,
              "--dx": `${d.dx * base * flip}px`,
              "--dy": `${d.dy * base}px`,
              animationDelay: `${k * 25}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** What someone at your Table is doing right now, in words. */
function nowText(n: FriendNow) {
  if (n.doing === "game") return `playing ${n.detail ?? "a game"}`;
  if (n.doing === "drop") return "taking their Drop";
  return "in 25 now";
}

/** Bottom-right of a face: a lime dot (in the app), a controller (playing) or a camera (Drop). */
function LiveBadge({ now, small }: { now: FriendNow; small: boolean }) {
  if (!now.doing) {
    const d = small ? 11 : 13;
    return (
      <span
        aria-hidden="true"
        className="online-dot absolute rounded-full"
        style={{
          right: 0,
          bottom: 0,
          width: d,
          height: d,
          background: "var(--lime)",
          border: "2px solid var(--bg, #14121A)",
          animation: "online-pulse 2s ease-in-out infinite",
        }}
      />
    );
  }
  const g = small ? 20 : 24;
  return (
    <span
      aria-hidden="true"
      className="absolute badge-bounce"
      style={{
        right: -g * 0.35,
        bottom: -g * 0.3,
        lineHeight: 0,
        zIndex: 3,
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))",
      }}
    >
      {now.doing === "game" ? <Glyph3D emoji="🎮" size={g} /> : <Glyph3D name="camera" size={g} />}
    </span>
  );
}

function PartyHat({ size, onPhones }: { size: number; onPhones?: boolean }) {
  // On its own: tilted on the head. With headphones: a bit smaller, perched on the band.
  const w = Math.round(size * (onPhones ? 0.54 : 0.62));
  return (
    <span
      className="absolute"
      aria-hidden="true"
      style={{
        top: onPhones ? -w * 0.74 - size * 0.1 : -w * 0.78,
        left: onPhones ? size / 2 - w * 0.42 : size * 0.02,
        transform: onPhones ? "rotate(-12deg)" : "rotate(-18deg)",
        zIndex: 4,
        lineHeight: 0,
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
      }}
    >
      <Glyph3D name="partyhat" size={w} animate fps={2} />
    </span>
  );
}

// ---------- Today's dare ----------

const DARES: { text: string; cta: string; to: string }[] = [
  {
    text: "Post a photo of your lunch as a scene. No caption. Let them wonder.",
    cta: "Post it",
    to: "/app/scenes/new",
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
    text: "Share the view from where you're sitting right now.",
    cta: "Post it",
    to: "/app/scenes/new",
  },
  { text: "Ask someone 'what's the tea?' and nothing else.", cta: "Open chats", to: "/app/chats" },
  {
    text: "Send an ugly selfie to someone. Friendships were built on less.",
    cta: "Open chats",
    to: "/app/chats",
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
    void myVotesThisWeek()
      .then((v) => setVoted(Object.keys(v).length))
      .catch(() => setVoted(0));
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const phase = at ? phaseOf(at, now) : "before";
  const live = phase === "now" && dropped === false;
  const picksLeft = voted === null ? null : Math.max(0, PER_WEEK - voted);
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
    picksLeft === null
      ? "…"
      : picksLeft > 0
        ? `${picksLeft} left`
        : newPolls
          ? "new"
          : `New ${newPollsWhen()}`;

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
        className={`rounded-[22px] px-3 py-3 flex items-center gap-2.5 ${live ? "wiggle" : ""} ${phase === "after" && dropped === false ? "pulse-lime" : ""}`}
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
        className={`rounded-[22px] px-3 py-3 flex items-center gap-2.5 ${pollsHot ? "pulse-pink" : ""}`}
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
          <span className="block font-extrabold text-[14.5px] leading-tight">Weekly Polls</span>
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
        className="lg rounded-[22px] p-3.5 flex items-center gap-3 overflow-hidden"
        style={{
          // Dark glass with a soft pink-to-lime glow (not a flat pink block).
          background:
            "radial-gradient(120% 140% at 0% 0%, rgba(242,125,166,0.28), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(193,239,98,0.18), transparent 55%), rgba(14,12,20,0.7)",
          color: "var(--ink)",
        }}
      >
        <span className="shrink-0" style={{ lineHeight: 0 }}>
          <Glyph3D name="cake" size={52} animate fps={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-extrabold text-[18px] leading-tight">
            Happy birthday{s.me ? `, ${s.me.name.split(" ")[0]}` : ""}! 🎉
          </span>
          <span className="block text-[13px] mt-0.5" style={{ color: "var(--ink-2)" }}>
            Your 25 signed your card.{" "}
            <span className="font-bold" style={{ color: "var(--lime)" }}>
              Open it →
            </span>
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
      className="relative w-10 h-10 rounded-full flex items-center justify-center"
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
  const pollsLeft = usePollsLeft();
  const s = useSocial();
  const people = tableOrder(s);
  const [adding, setAdding] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const [picked, setPicked] = useState<Person | null>(null);
  const [pickSong, setPickSong] = useState(false);
  // Today's games, played right here under the table.
  const [playing, setPlaying] = useState<"daily" | "word" | "tune" | null>(null);
  // Songs your 25 shared since you last looked (clears when you open it).
  const newSongs = useNewSongs();
  const [confetti, setConfetti] = useState(0);
  // Birthdays: a pop-up to wish them (or to open your own card) is in <BirthdayPop />.
  const [rolling, setRolling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Spotlight hops around the table, slows down, lands on someone.
  const onRoll = () => {
    const seated = people.slice(0, SEATS);
    if (!seated.length || rolling) return;
    setRolling(true);
    setPicked(null);
    sfx.dice(450);
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
          sfx.tick(h);
        }, t),
      );
    }
    timers.current.push(
      setTimeout(() => {
        setSpot(target);
        setConfetti((c) => c + 1);
        buzz(30);
        sfx.land();
      }, t + 120),
      setTimeout(() => {
        setRolling(false);
        setPicked(seated[target]);
      }, t + 650),
    );
  };

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 8rem)" }}>
      <header className="topband px-4 pt-[max(1.1rem,calc(env(safe-area-inset-top)+0.85rem))] pb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link to="/app/home" aria-label="Your Table" className="inline-flex">
              <SeatMark filled={people.length} size={56} />
            </Link>
            <p className="hidden min-[340px]:block leading-tight min-w-0 whitespace-nowrap">
              <span
                className="block font-bold truncate"
                style={{ color: "var(--ink)", fontSize: 15.5 }}
              >
                Everyone else is noise.
              </span>
              {/* Seat count, kept quiet. */}
              <span className="block mt-0.5" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {Math.min(people.length, 25)} of 25 seats filled
              </span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
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

      <Table
        people={people}
        spot={spot}
        rolling={rolling}
        onRoll={onRoll}
        picked={picked}
        onPickedShown={() => setPicked(null)}
        onSpotDone={() => setSpot(null)}
        topLeft={
          <button
            onClick={() => setPickSong(true)}
            aria-label={`Listening now${newSongs ? `, ${newSongs} new` : ""}`}
            className="w-10 h-10 rounded-full flex items-center justify-center relative"
            style={{
              background: s.me?.np ? "rgba(193,239,98,0.16)" : "var(--fill)",
              border: s.me?.np ? "1px solid rgba(193,239,98,0.5)" : "var(--bd)",
              boxShadow: "var(--pop)",
              color: s.me?.np ? "var(--lime)" : "var(--ink)",
            }}
          >
            <Headphones size={21} aria-hidden="true" />
            {newSongs > 0 && (
              <span
                aria-hidden="true"
                className="pop absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center tabular-nums"
                style={{
                  background: "var(--pink)",
                  color: "var(--on-dark-fill)",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "2px solid var(--surface)",
                }}
              >
                {newSongs > 9 ? "9+" : newSongs}
              </span>
            )}
          </button>
        }
        topRight={
          <Link
            to="/app/people"
            aria-label="Add people"
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: "var(--lime)",
              color: "var(--on-accent)",
              border: "var(--bd)",
              boxShadow: "var(--pop)",
            }}
          >
            <UserPlus size={22} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        }
        bottomRight={pollsLeft === 0 ? <PollsButton /> : undefined}
      />

      {/* Today's games, right under the table, so they're the first thing to play. */}
      <div className="-mt-3">
        <TodaySection
          onPlayDaily={() => setPlaying("daily")}
          onPlayWord={() => setPlaying("word")}
          onPlayTune={() => setPlaying("tune")}
        />
      </div>

      {/* Picks left this week: a full Weekly Polls bar. Done: just the corner button. */}
      {pollsLeft !== null && pollsLeft > 0 && <PollsBar left={pollsLeft} />}

      <PushPrompt />
      <Tour
        id="table"
        delay={1200}
        steps={[
          {
            at: 'section[aria-label="Your table"]',
            title: "This is your Table",
            body: "Everyone at your table. People who got 7/7 on your quiz sit at the head (top). Tap a face for options, or the dice to pick someone.",
          },
          {
            at: 'section[aria-label="Today\'s games"]',
            title: "Three games a day",
            body: "Today's mini game, Word Up and Name That Tune, same for your whole 25. Tap Play; tap your rank for its board.",
          },
          {
            at: 'a[aria-label="Add people"]',
            title: "Fill your seats",
            body: "Add people you actually know. When you're in each other's 25, chats and games unlock.",
          },
          {
            at: 'a[href="/app/drop"]',
            title: "Every day",
            body: "The Drop: everyone posts at the same surprise time. Weekly Polls: anonymous picks about your 25, new every Thursday at 9 PM.",
          },
          {
            at: 'nav[aria-label="Main"]',
            title: "Everything else",
            body: "Your Table is the first tab, then Scenes, the Drop, Chats and Games. Swipe left and right to move between them.",
          },
        ]}
      />

      {playing === "daily" && (
        <DailyRunner game={gameFor(today())} onClose={() => setPlaying(null)} />
      )}
      {playing === "word" && <WordDaily onClose={() => setPlaying(null)} />}
      {playing === "tune" && <DailyTune onClose={() => setPlaying(null)} />}
      <Confetti fire={confetti} />
      <BirthdayPop />
      <PollsPop />
      {pickSong && (
        <NowPlayingPicker
          onClose={() => {
            setPickSong(false);
            setTimeout(() => window.scrollTo(0, 0), 80);
          }}
        />
      )}
      {adding && (
        <AddMomentSheet onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} />
      )}
    </div>
  );
}

/** Picks left in this week's polls (null while loading). */
function usePollsLeft() {
  const [voted, setVoted] = useState<number | null>(null);
  useEffect(() => {
    void myVotesThisWeek()
      .then((v) => setVoted(Object.keys(v).length))
      .catch(() => setVoted(PER_WEEK));
  }, []);
  return voted === null ? null : Math.max(0, PER_WEEK - voted);
}

/** Weekly Polls while you still have picks: a full bar under the table. */
function PollsBar({ left }: { left: number }) {
  return (
    <section className="px-5 mt-1 flex justify-center" aria-label="Weekly Polls">
      <Link
        to="/app/polls"
        className="pulse-pink rounded-full pl-1.5 pr-3.5 py-1.5 inline-flex items-center gap-2"
        style={{
          background: "var(--pink)",
          color: "var(--on-accent)",
          border: "var(--bd)",
          boxShadow: "var(--pop-sm)",
        }}
      >
        <span
          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center"
          style={{ background: "var(--on-accent)", color: "var(--pink)" }}
        >
          <BarChart3 size={15} strokeWidth={2.6} aria-hidden="true" />
        </span>
        <span className="font-extrabold text-[14px] whitespace-nowrap">Weekly Polls</span>
        <span className="text-[12.5px] font-bold opacity-75 whitespace-nowrap">· {left} left</span>
        <ChevronRight size={16} strokeWidth={2.6} aria-hidden="true" />
      </Link>
    </section>
  );
}

/** Weekly Polls, as a round button in the table's corner: picks left as a badge. */
function PollsButton() {
  const [voted, setVoted] = useState<number | null>(null);
  const [newPolls] = useState(() => !seen("polls"));
  useEffect(() => {
    void myVotesThisWeek()
      .then((v) => setVoted(Object.keys(v).length))
      .catch(() => setVoted(0));
  }, []);
  const left = voted === null ? 0 : Math.max(0, PER_WEEK - voted);
  return (
    <Link
      to="/app/polls"
      aria-label={left ? `Weekly Polls, ${left} picks left` : "Weekly Polls"}
      className={`w-10 h-10 rounded-full flex items-center justify-center relative ${left && newPolls ? "pulse-pink" : ""}`}
      style={{
        background: "var(--fill)",
        border: "var(--bd)",
        boxShadow: "var(--pop)",
        color: "var(--ink)",
      }}
    >
      <BarChart3 size={20} strokeWidth={2.2} aria-hidden="true" />
      {left > 0 && (
        <span
          aria-hidden="true"
          className="pop absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center tabular-nums"
          style={{
            background: "var(--pink)",
            color: "var(--on-dark-fill)",
            fontSize: 11,
            fontWeight: 800,
            border: "2px solid var(--surface)",
          }}
        >
          {left}
        </span>
      )}
    </Link>
  );
}
