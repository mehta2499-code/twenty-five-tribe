/**
 * Seven more daily games for the rotation, each full screen with its own look:
 * Tile Dash, Stack Up, Arrow Swipe, 1 to 25, Rickshaw Run, Chai Catch and
 * Hot or Cold. Every round reports one score (higher is better, at most 1000).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { GameArt, type ArtKind } from "@/components/GameArt";
import { SoundToggle } from "@/components/SoundToggle";
import { buzz } from "@/components/SocialUI";
import { sfx, useGameMusic } from "@/lib/sfx";

type RoundProps = { onFinish: (score: number) => void; onClose: () => void };
const LIME = "#B8F25C";
const PINK = "#FF5470";
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rand(a.length)];

// ---------- Shared pieces ----------

/** The full-screen stage: dark, with a glow in the game's colour. */
function Stage({
  title,
  tone,
  onClose,
  canClose,
  children,
}: {
  title: string;
  tone: string;
  onClose: () => void;
  canClose: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 select-none flex flex-col overflow-hidden"
      style={{
        background: `radial-gradient(120% 60% at 50% -10%, ${tone}55 0%, transparent 60%), linear-gradient(180deg, #121019 0%, #09080D 100%)`,
        color: "#fff",
        touchAction: "none",
      }}
    >
      <div className="mx-auto w-full max-w-md flex flex-col h-full px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between h-10 shrink-0">
          <span className="label-caps" style={{ color: "rgba(255,255,255,0.7)" }}>
            {title}
          </span>
          <span className="flex items-center gap-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            <SoundToggle />
            {canClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center"
              >
                <X size={22} />
              </button>
            )}
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Before a round: the art, how to play, and a big Start. */
function Intro({
  art,
  title,
  how,
  onStart,
}: {
  art: ArtKind;
  title: string;
  how: string;
  onStart: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <span className="pop">
        <GameArt kind={art} size={104} />
      </span>
      <p className="font-black mt-5" style={{ fontSize: 30 }}>
        {title}
      </p>
      <p
        className="mt-3 max-w-[310px]"
        style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.5, fontSize: 15.5 }}
      >
        {how}
      </p>
      <button
        onClick={() => {
          buzz(20);
          sfx.tick(0);
          onStart();
        }}
        className="mt-9 w-full rounded-2xl font-black"
        style={{ background: LIME, color: "#14200A", minHeight: 58, fontSize: 18 }}
      >
        Start
      </button>
    </div>
  );
}

/** Score and a second number (time left, best…), big and readable. */
function Hud({
  score,
  label,
  value,
  warn,
}: {
  score: number | string;
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-end justify-between mt-1 shrink-0">
      <div>
        <p className="label-caps" style={{ color: "rgba(255,255,255,0.55)" }}>
          score
        </p>
        <p className="font-black tabular-nums" style={{ fontSize: 40, lineHeight: 1 }}>
          {score}
        </p>
      </div>
      <div className="text-right">
        <p className="label-caps" style={{ color: "rgba(255,255,255,0.55)" }}>
          {label}
        </p>
        <p
          className="font-black tabular-nums"
          style={{ fontSize: 40, lineHeight: 1, color: warn ? PINK : "#fff" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/** The round is over: a big word over everything, then the score is sent. */
function Over({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
      <p className="display pop" style={{ fontSize: 54, textShadow: "0 6px 30px rgba(0,0,0,0.6)" }}>
        {text}
      </p>
      {sub && (
        <p className="mt-2 font-extrabold" style={{ fontSize: 18 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Calls onFinish once, a moment after the round ends. */
function useEnd(over: boolean, score: number, onFinish: (n: number) => void, delay = 1400) {
  const done = useRef(false);
  useEffect(() => {
    if (!over || done.current) return;
    done.current = true;
    const t = setTimeout(() => onFinish(Math.max(0, Math.min(1000, Math.round(score)))), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);
}

/** A frame loop while running: fn(seconds since last frame). */
function useLoop(running: boolean, fn: (dt: number) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/** Seconds left on a timed round (counts down while running). */
function useClock(seconds: number, running: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(seconds);
  const end = useRef<number | null>(null);
  const ended = useRef(false);
  useLoop(running, () => {
    if (end.current === null) end.current = performance.now() + seconds * 1000;
    const l = Math.max(0, (end.current - performance.now()) / 1000);
    setLeft(l);
    if (l <= 0 && !ended.current) {
      ended.current = true;
      onEnd();
    }
  });
  return left;
}

/** The size of an element (kept up to date). Use the returned setter as its ref. */
function useSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size, el] as const;
}

/** Swipes on an element: calls back with 0 up, 1 right, 2 down, 3 left (or a tap). */
function useSwipe(onSwipe: (dir: number) => void, onTap?: (x: number, y: number) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const fns = useRef({ onSwipe, onTap });
  fns.current = { onSwipe, onTap };
  return useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent) => {
        start.current = { x: e.clientX, y: e.clientY };
      },
      onPointerUp: (e: React.PointerEvent) => {
        const st = start.current;
        start.current = null;
        if (!st) return;
        const dx = e.clientX - st.x;
        const dy = e.clientY - st.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) {
          fns.current.onTap?.(e.clientX, e.clientY);
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) fns.current.onSwipe(dx > 0 ? 1 : 3);
        else fns.current.onSwipe(dy > 0 ? 2 : 0);
      },
    }),
    [],
  );
}

/** Arrow keys too (for anyone on a laptop). */
function useArrowKeys(active: boolean, fn: (dir: number) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
      if (d !== undefined) {
        e.preventDefault();
        ref.current(d);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [active]);
}

const shake = (el: HTMLElement | null) =>
  el?.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-10px)" },
      { transform: "translateX(9px)" },
      { transform: "translateX(-5px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 300 },
  );

// =====================================================================
// Tile Dash: tap the dark tiles as they scroll down. Each one plays the
// next note of a tune. Miss one, or tap an empty spot, and it's over.
// =====================================================================

const NOTE: Record<string, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};
// Two old public-domain tunes, one after the other.
const TUNE = (
  "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 " +
  "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4 " +
  "C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4 " +
  "G4 G4 F4 F4 E4 E4 D4 G4 G4 F4 F4 E4 E4 D4"
)
  .split(" ")
  .map((n) => NOTE[n]);
const TILE_TONE = "#5BE0E8";

export function TileDash({ onFinish, onClose }: RoundProps) {
  const [phase, setPhase] = useState<"intro" | "ready" | "play" | "over">("intro");
  const lanes = useRef<number[]>([]);
  const lane = (k: number) => {
    while (lanes.current.length <= k) {
      const prev = lanes.current[lanes.current.length - 1] ?? -1;
      let l = rand(4);
      if (l === prev) l = (l + 1 + rand(3)) % 4; // never the same lane twice running
      lanes.current.push(l);
    }
    return lanes.current[k];
  };
  const pos = useRef(0);
  const [next, setNext] = useState(0);
  const nextRef = useRef(0);
  const [miss, setMiss] = useState<{ row: number; lane: number } | null>(null);
  const [, setFrame] = useState(0);
  const [boardRef, size] = useSize<HTMLDivElement>();
  const rowH = size.h / 4;

  const end = (m: { row: number; lane: number }) => {
    setMiss(m);
    setPhase("over");
    sfx.bad();
    buzz(80);
    // Bring the missed tile back into view.
    pos.current = Math.max(0, Math.min(pos.current, m.row - 0.4));
    setFrame((f) => f + 1);
  };

  useLoop(phase === "play", (dt) => {
    const speed = Math.min(7.2, 2.3 + nextRef.current * 0.055);
    pos.current += speed * dt;
    if (pos.current > nextRef.current + 1)
      end({ row: nextRef.current, lane: lane(nextRef.current) });
    setFrame((f) => f + 1);
  });
  useEnd(phase === "over", next, onFinish);

  const tap = (e: React.PointerEvent) => {
    if (phase !== "ready" && phase !== "play") return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const l = Math.floor(((e.clientX - r.left) / r.width) * 4);
    const row = Math.floor(pos.current + (r.bottom - e.clientY) / rowH);
    const n = nextRef.current;
    if (row === n && l === lane(n)) {
      sfx.note(TUNE[n % TUNE.length]);
      nextRef.current = n + 1;
      setNext(n + 1);
      if (phase === "ready") setPhase("play");
    } else if (row >= n) end({ row, lane: l });
  };

  const first = Math.max(0, Math.floor(pos.current) - 1);
  const rows = Array.from({ length: 6 }, (_, i) => first + i);
  return (
    <Stage title="Tile Dash" tone={TILE_TONE} onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="tile-dash"
          title="Tile Dash"
          how="Tap the dark tiles as they slide down, and play the tune. Miss one or tap an empty spot and it's over. It speeds up."
          onStart={() => setPhase("ready")}
        />
      ) : (
        <>
          <p
            className="text-center font-black tabular-nums mt-1 shrink-0"
            style={{ fontSize: 46, lineHeight: 1, color: phase === "over" ? PINK : LIME }}
          >
            {next}
          </p>
          <div
            ref={boardRef}
            onPointerDown={tap}
            className="relative flex-1 mt-3 rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #F6F3FF 0%, #E9E4FA 100%)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
            aria-label="The tiles. Tap the dark ones."
          >
            {[1, 2, 3].map((k) => (
              <span
                key={k}
                className="absolute top-0 bottom-0"
                style={{ left: `${k * 25}%`, width: 1, background: "rgba(40,30,80,0.12)" }}
              />
            ))}
            {rowH > 0 &&
              rows.map((k) => {
                const bottom = (k - pos.current) * rowH;
                const l = lane(k);
                const done = k < next;
                return (
                  <div
                    key={k}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: `${l * 25}%`,
                      width: "25%",
                      bottom,
                      height: rowH,
                      padding: 3,
                    }}
                  >
                    <div
                      className="w-full h-full rounded-xl flex items-end justify-center pb-3"
                      style={{
                        background: done
                          ? "rgba(91,224,232,0.25)"
                          : "linear-gradient(180deg, #2A2147 0%, #0F0B1E 100%)",
                        boxShadow: done
                          ? undefined
                          : `inset 0 -4px 0 ${TILE_TONE}, 0 6px 14px rgba(20,10,50,0.35)`,
                        transition: "background 120ms",
                      }}
                    >
                      {k === 0 && phase === "ready" && (
                        <span className="font-black" style={{ color: LIME, fontSize: 15 }}>
                          TAP
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            {miss && rowH > 0 && (
              <div
                className="absolute animate-pulse"
                style={{
                  left: `${miss.lane * 25}%`,
                  width: "25%",
                  bottom: (miss.row - pos.current) * rowH,
                  height: rowH,
                  padding: 3,
                }}
              >
                <div
                  className="w-full h-full rounded-xl"
                  style={{ background: PINK, opacity: 0.85 }}
                />
              </div>
            )}
            {phase === "over" && <Over text="Missed!" sub={`${next} tiles`} />}
          </div>
        </>
      )}
    </Stage>
  );
}

// =====================================================================
// Stack Up: a block slides side to side; tap to drop it on the tower.
// Whatever hangs over is sliced off. Land it exactly for a perfect.
// =====================================================================

const BLOCK_H = 28;

export function StackUp({ onFinish, onClose }: RoundProps) {
  useGameMusic();
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [boardRef, size] = useSize<HTMLDivElement>();
  const tower = useRef<{ x: number; w: number }[]>([]);
  const mover = useRef({ x: 0, w: 0, dir: 1 });
  const cuts = useRef<{ x: number; w: number; level: number; t: number; dir: number }[]>([]);
  const [score, setScore] = useState(0);
  const [perfect, setPerfect] = useState(0);
  const combo = useRef(0);
  const [, setFrame] = useState(0);

  const start = () => setPhase("play");
  // The board exists once the round starts: lay the base then.
  useEffect(() => {
    if (phase !== "play" || tower.current.length || !size.w) return;
    const w = size.w * 0.62;
    tower.current = [{ x: (size.w - w) / 2, w }];
    mover.current = { x: -w * 0.4, w, dir: 1 };
  }, [phase, size.w]);

  useLoop(phase !== "intro", (dt) => {
    if (phase === "play" && tower.current.length) {
      const m = mover.current;
      const speed = size.w * Math.min(1.7, 0.6 + tower.current.length * 0.035);
      m.x += m.dir * speed * dt;
      const lo = -m.w * 0.45;
      const hi = size.w - m.w * 0.55;
      if (m.x > hi) {
        m.x = hi;
        m.dir = -1;
      } else if (m.x < lo) {
        m.x = lo;
        m.dir = 1;
      }
    }
    cuts.current = cuts.current.filter((c) => (c.t += dt) < 1.2);
    setFrame((f) => f + 1);
  });
  useEnd(phase === "over", score, onFinish);

  const drop = () => {
    if (phase !== "play" || !tower.current.length) return;
    const m = mover.current;
    const top = tower.current[tower.current.length - 1];
    const level = tower.current.length;
    const left = Math.max(m.x, top.x);
    const right = Math.min(m.x + m.w, top.x + top.w);
    const overlap = right - left;
    if (overlap <= 0) {
      cuts.current.push({ x: m.x, w: m.w, level, t: 0, dir: m.x < top.x ? -1 : 1 });
      setPhase("over");
      sfx.bad();
      buzz(80);
      return;
    }
    let placed: { x: number; w: number };
    if (Math.abs(m.x - top.x) <= 5) {
      // Perfect: no slice, and three in a row grows it back a little.
      combo.current += 1;
      const grow = combo.current >= 3 ? Math.min(12, size.w * 0.62 - top.w) : 0;
      placed = { x: top.x - grow / 2, w: top.w + grow };
      setPerfect((p) => p + 1);
      sfx.good();
      buzz(25);
    } else {
      combo.current = 0;
      placed = { x: left, w: overlap };
      const cutX = m.x < top.x ? m.x : right;
      cuts.current.push({ x: cutX, w: m.w - overlap, level, t: 0, dir: m.x < top.x ? -1 : 1 });
      sfx.land();
      buzz(12);
    }
    tower.current.push(placed);
    setScore(tower.current.length - 1);
    const fromLeft = tower.current.length % 2 === 0;
    mover.current = {
      x: fromLeft ? -placed.w * 0.4 : size.w - placed.w * 0.6,
      w: placed.w,
      dir: fromLeft ? 1 : -1,
    };
  };

  // Keep the top of the tower around the middle of the screen.
  const n = tower.current.length;
  const lift = Math.max(0, (n + 1) * BLOCK_H - size.h * 0.55);
  const hue = (i: number) => `hsl(${(250 + i * 14) % 360} 85% 62%)`;
  return (
    <Stage title="Stack Up" tone="#9B7BFF" onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="stack-up"
          title="Stack Up"
          how="A block slides across. Tap to drop it on the tower. Whatever hangs over gets sliced off. Land it exactly for a perfect."
          onStart={start}
        />
      ) : (
        <>
          <Hud score={score} label="perfects" value={perfect} />
          <div
            ref={boardRef}
            onPointerDown={drop}
            className="relative flex-1 mt-3 overflow-hidden rounded-3xl"
            style={{
              background: "linear-gradient(180deg, rgba(155,123,255,0.08), rgba(155,123,255,0.02))",
            }}
            aria-label="Tap to drop the block"
          >
            {tower.current.map((b, i) => {
              const y = i * BLOCK_H - lift;
              if (y < -BLOCK_H || y > size.h) return null;
              return (
                <div
                  key={i}
                  className="absolute rounded-md"
                  style={{
                    left: b.x,
                    width: b.w,
                    bottom: y,
                    height: BLOCK_H - 2,
                    background: hue(i),
                    boxShadow:
                      "inset 0 -5px 0 rgba(0,0,0,0.22), inset 0 3px 0 rgba(255,255,255,0.3)",
                  }}
                />
              );
            })}
            {phase === "play" && (
              <div
                className="absolute rounded-md"
                style={{
                  left: mover.current.x,
                  width: mover.current.w,
                  bottom: n * BLOCK_H - lift,
                  height: BLOCK_H - 2,
                  background: hue(n),
                  boxShadow:
                    "inset 0 -5px 0 rgba(0,0,0,0.22), inset 0 3px 0 rgba(255,255,255,0.3), 0 0 24px rgba(155,123,255,0.5)",
                }}
              />
            )}
            {cuts.current.map((c, i) => (
              <div
                key={i}
                className="absolute rounded-md"
                style={{
                  left: c.x + c.dir * c.t * 40,
                  width: c.w,
                  bottom: c.level * BLOCK_H - lift - c.t * c.t * 600,
                  height: BLOCK_H - 2,
                  background: hue(c.level),
                  opacity: Math.max(0, 1 - c.t),
                  transform: `rotate(${c.dir * c.t * 50}deg)`,
                }}
              />
            ))}
            {phase === "over" && <Over text="Toppled!" sub={`${score} high`} />}
          </div>
        </>
      )}
    </Stage>
  );
}

// =====================================================================
// Arrow Swipe: swipe the way a green arrow points, the OTHER way for a
// red one. 30 seconds.
// =====================================================================

export function ArrowSwipe({ onFinish, onClose }: RoundProps) {
  useGameMusic();
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [score, setScore] = useState(0);
  const [card, setCard] = useState({ dir: 0, flip: false, id: 0 });
  const [fly, setFly] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const left = useClock(30, phase === "play", () => setPhase("over"));
  useEnd(phase === "over", score, onFinish);

  const deal = (s: number) => {
    const redOdds = Math.min(0.5, 0.18 + s * 0.012);
    setCard((c) => ({ dir: rand(4), flip: Math.random() < redOdds, id: c.id + 1 }));
  };
  const answer = (d: number) => {
    if (phase !== "play" || fly !== null) return;
    const want = card.flip ? (card.dir + 2) % 4 : card.dir;
    if (d === want) {
      sfx.good();
      buzz(10);
      setScore((s) => s + 1);
      setFly(d);
      setTimeout(() => {
        setFly(null);
        deal(score + 1);
      }, 130);
    } else {
      sfx.bad();
      buzz(60);
      setScore((s) => Math.max(0, s - 1));
      shake(cardRef.current);
    }
  };
  useArrowKeys(phase === "play", answer);
  const swipeArrow = useSwipe(answer);
  const off = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ][fly ?? 0];
  const tone = card.flip ? PINK : "#2FD08A";
  return (
    <Stage title="Arrow Swipe" tone="#2FD08A" onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="arrow-swipe"
          title="Arrow Swipe"
          how="Green arrow: swipe the way it points. Red arrow: swipe the OTHER way. Wrong swipes cost a point. 30 seconds."
          onStart={() => {
            deal(0);
            setPhase("play");
          }}
        />
      ) : (
        <>
          <Hud score={score} label="seconds" value={Math.ceil(left)} warn={left <= 5} />
          <div
            className="relative flex-1 flex flex-col items-center justify-center"
            {...swipeArrow}
          >
            <div
              ref={cardRef}
              key={card.id}
              className="pop rounded-[36px] flex items-center justify-center"
              style={{
                width: 220,
                height: 220,
                background: `radial-gradient(circle at 35% 30%, ${tone}EE, ${tone}AA)`,
                boxShadow: `0 0 0 10px ${tone}26, 0 24px 60px ${tone}55`,
                transform:
                  fly !== null ? `translate(${off[0] * 320}px, ${off[1] * 420}px)` : undefined,
                transition: "transform 130ms ease-in",
              }}
            >
              <ArrowUp
                size={130}
                strokeWidth={3}
                color="#fff"
                style={{ transform: `rotate(${card.dir * 90}deg)` }}
                aria-label={`${card.flip ? "Red" : "Green"} arrow pointing ${["up", "right", "down", "left"][card.dir]}`}
              />
            </div>
            <p className="mt-8 font-extrabold" style={{ fontSize: 18, color: tone }}>
              {card.flip ? "Swipe the OTHER way" : "Swipe this way"}
            </p>
            <div
              className="absolute bottom-2 inset-x-0 h-2 rounded-full overflow-hidden mx-6"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${(left / 30) * 100}%`, background: left <= 5 ? PINK : LIME }}
              />
            </div>
            {phase === "over" && <Over text="Time! ⏰" sub={`${score} right`} />}
          </div>
        </>
      )}
    </Stage>
  );
}

// =====================================================================
// 1 to 25: tap the numbers in order, as fast as you can. A wrong tap adds
// a second. Score = 1000 − tenths of a second taken.
// =====================================================================

export const oneTo25Time = (score: number) => `${((1000 - score) / 10).toFixed(1)}s`;

export function OneTo25({ onFinish, onClose }: RoundProps) {
  useGameMusic();
  const [phase, setPhase] = useState<"intro" | "count" | "play" | "over">("intro");
  const [count, setCount] = useState(3);
  const [grid, setGrid] = useState<number[]>([]);
  const [next, setNext] = useState(1);
  const [bad, setBad] = useState<number | null>(null);
  const t0 = useRef(0);
  const penalty = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [final, setFinal] = useState(0);

  useEffect(() => {
    if (phase !== "count") return;
    if (count === 0) {
      t0.current = performance.now();
      setPhase("play");
      return;
    }
    sfx.tick(3 - count);
    const t = setTimeout(() => setCount((c) => c - 1), 650);
    return () => clearTimeout(t);
  }, [phase, count]);
  useLoop(phase === "play", () =>
    setElapsed((performance.now() - t0.current) / 1000 + penalty.current),
  );
  useEnd(phase === "over", final, onFinish, 1800);

  const tap = (n: number) => {
    if (phase !== "play") return;
    if (n === next) {
      sfx.pop(Math.min(8, Math.floor(n / 3)));
      buzz(8);
      if (n === 25) {
        const t = (performance.now() - t0.current) / 1000 + penalty.current;
        setElapsed(t);
        setFinal(Math.max(1, 1000 - Math.round(t * 10)));
        setPhase("over");
        sfx.win();
        return;
      }
      setNext(n + 1);
    } else if (n > next) {
      penalty.current += 1;
      sfx.bad();
      buzz(50);
      setBad(n);
      setTimeout(() => setBad(null), 300);
    }
  };
  return (
    <Stage title="1 to 25" tone="#FFB547" onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="one-to-25"
          title="1 to 25"
          how="Tap 1, then 2, then 3… all the way to 25, as fast as you can. A wrong tap adds a second."
          onStart={() => {
            setGrid(Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5));
            setPhase("count");
          }}
        />
      ) : (
        <>
          <Hud
            score={phase === "over" ? final : `→ ${next}`}
            label="time"
            value={`${elapsed.toFixed(1)}s`}
          />
          <div className="relative flex-1 flex items-center justify-center">
            {phase === "count" ? (
              <span key={count} className="display pop" style={{ fontSize: 110 }}>
                {count || "Go!"}
              </span>
            ) : (
              <div className="grid grid-cols-5 gap-2 w-full" style={{ maxWidth: 380 }}>
                {grid.map((n) => {
                  const done = n < next || (phase === "over" && n === 25);
                  return (
                    <button
                      key={n}
                      onPointerDown={() => tap(n)}
                      className="aspect-square rounded-2xl font-black tabular-nums"
                      style={{
                        fontSize: 24,
                        background:
                          bad === n
                            ? PINK
                            : done
                              ? "rgba(255,181,71,0.12)"
                              : "linear-gradient(180deg, #FFCB6B 0%, #F29A2E 100%)",
                        color: done ? "rgba(255,181,71,0.45)" : "#2B1600",
                        boxShadow: done
                          ? undefined
                          : "inset 0 -4px 0 rgba(0,0,0,0.2), 0 6px 14px rgba(0,0,0,0.3)",
                        transform: done ? "scale(0.92)" : undefined,
                        transition: "all 120ms",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            )}
            {phase === "over" && <Over text={`${elapsed.toFixed(1)}s`} sub="All 25! 🎉" />}
          </div>
        </>
      )}
    </Stage>
  );
}

// =====================================================================
// Rickshaw Run: dodge what's on the road. Tap left or right (or swipe) to
// change lanes. It gets faster. Score = obstacles passed.
// =====================================================================

const ROAD_STUFF = ["🐄", "🚧", "🛵", "🐐", "📦", "🚌"];

export function RickshawRun({ onFinish, onClose }: RoundProps) {
  useGameMusic();
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [boardRef, size, boardEl] = useSize<HTMLDivElement>();
  const [laneNow, setLane] = useState(1);
  const laneRef = useRef(1);
  const obs = useRef<{ id: number; lane: number; y: number; e: string; row: number }[]>([]);
  const rows = useRef({ next: 0, gap: 0, passed: new Set<number>() });
  const road = useRef(0);
  const [score, setScore] = useState(0);
  const [crash, setCrash] = useState<{ lane: number; y: number } | null>(null);
  const [, setFrame] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  const S = size.w / 3; // lane width
  const item = Math.min(64, S * 0.62);
  const playerY = size.h * 0.8;

  useLoop(phase === "play" && size.h > 0, (dt) => {
    const passed = rows.current.passed.size;
    const speed = size.h * Math.min(1.7, 0.55 + passed * 0.022);
    road.current = (road.current + speed * dt) % 80;
    for (const o of obs.current) o.y += speed * dt;
    // New rows of traffic.
    rows.current.gap -= speed * dt;
    if (rows.current.gap <= 0) {
      const row = rows.current.next++;
      const two = passed > 6 && Math.random() < Math.min(0.45, 0.15 + passed * 0.01);
      const free = rand(3);
      const blocked = [0, 1, 2].filter((l) => l !== free);
      const lanesHit = two ? blocked : [pick(blocked)];
      for (const l of lanesHit)
        obs.current.push({ id: Math.random(), lane: l, y: -item, e: pick(ROAD_STUFF), row });
      rows.current.gap = Math.max(size.h * 0.34, size.h * 0.62 - passed * size.h * 0.007);
    }
    // Hit something?
    for (const o of obs.current) {
      if (o.lane === laneRef.current && Math.abs(o.y - playerY) < item * 0.72) {
        setCrash({ lane: o.lane, y: playerY });
        setPhase("over");
        sfx.bad();
        buzz(120);
        stage.current?.animate(
          [
            { transform: "translate(0,0)" },
            { transform: "translate(-8px,4px)" },
            { transform: "translate(6px,-3px)" },
            { transform: "translate(0,0)" },
          ],
          { duration: 320 },
        );
        return;
      }
      if (o.y > playerY + item && !rows.current.passed.has(o.row)) {
        rows.current.passed.add(o.row);
        setScore(rows.current.passed.size);
        sfx.tick(1);
      }
    }
    obs.current = obs.current.filter((o) => o.y < size.h + item);
    setFrame((f) => f + 1);
  });
  useEnd(phase === "over", score, onFinish);

  const move = (d: number) => {
    if (phase !== "play") return;
    const l = Math.max(0, Math.min(2, laneRef.current + d));
    if (l === laneRef.current) return;
    laneRef.current = l;
    setLane(l);
    buzz(8);
  };
  useArrowKeys(phase === "play", (d) => (d === 1 ? move(1) : d === 3 ? move(-1) : undefined));
  const handlers = useSwipe(
    (d) => (d === 1 ? move(1) : d === 3 ? move(-1) : undefined),
    (x) => {
      const r = boardEl?.getBoundingClientRect();
      if (r) move(x < r.left + r.width / 2 ? -1 : 1);
    },
  );
  return (
    <Stage title="Rickshaw Run" tone="#F7C948" onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="rickshaw"
          title="Rickshaw Run"
          how="Dodge the cows, scooters and roadblocks. Tap the left or right side (or swipe) to change lanes. It keeps getting faster."
          onStart={() => {
            rows.current = { next: 0, gap: 0, passed: new Set() };
            obs.current = [];
            setPhase("play");
          }}
        />
      ) : (
        <>
          <Hud score={score} label="dodged" value={score} />
          <div ref={stage} className="relative flex-1 mt-3">
            <div
              ref={boardRef}
              {...handlers}
              className="absolute inset-0 rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(180deg, #34323D 0%, #26242E 100%)",
                boxShadow: "inset 6px 0 0 #F7C948, inset -6px 0 0 #F7C948",
              }}
              aria-label="The road. Tap left or right to change lanes."
            >
              {[1, 2].map((k) => (
                <span
                  key={k}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `calc(${(k * 100) / 3}% - 2px)`,
                    width: 4,
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.55) 0 50%, transparent 50% 100%)",
                    backgroundSize: "4px 80px",
                    backgroundPositionY: road.current,
                  }}
                />
              ))}
              {obs.current.map((o) => (
                <span
                  key={o.id}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: o.lane * S + S / 2 - item / 2,
                    top: o.y - item / 2,
                    width: item,
                    height: item,
                    fontSize: item * 0.82,
                    lineHeight: 1,
                  }}
                >
                  {o.e}
                </span>
              ))}
              {size.h > 0 && (
                <span
                  className="absolute flex items-center justify-center"
                  style={{
                    left: laneNow * S + S / 2 - item / 2,
                    top: playerY - item / 2,
                    width: item,
                    height: item,
                    fontSize: item * 0.9,
                    lineHeight: 1,
                    transition: "left 110ms ease-out",
                    filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.5))",
                    transform: "scaleX(-1)",
                  }}
                  aria-label="Your rickshaw"
                >
                  🛺
                </span>
              )}
              {crash && (
                <span
                  className="absolute pop"
                  style={{
                    left: crash.lane * S + S / 2 - item * 0.6,
                    top: crash.y - item * 1.1,
                    fontSize: item * 1.1,
                  }}
                >
                  💥
                </span>
              )}
            </div>
            {phase === "over" && <Over text="Crash!" sub={`${score} dodged`} />}
          </div>
        </>
      )}
    </Stage>
  );
}

// =====================================================================
// Chai Catch: slide the cup to catch snacks falling into your chai. Skip
// the chillies. 30 seconds.
// =====================================================================

const SNACKS = ["🍪", "🥟", "🍩", "🥐", "🍘"];

export function ChaiCatch({ onFinish, onClose }: RoundProps) {
  useGameMusic();
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [boardRef, size] = useSize<HTMLDivElement>();
  const cup = useRef(0.5); // 0-1 across the board
  const items = useRef<{ id: number; x: number; y: number; e: string; pts: number; v: number }[]>(
    [],
  );
  const pops = useRef<
    { id: number; x: number; y: number; text: string; t: number; good: boolean }[]
  >([]);
  const spawnIn = useRef(0);
  const elapsed = useRef(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [, setFrame] = useState(0);
  const left = useClock(30, phase === "play", () => setPhase("over"));
  useEnd(phase === "over", score, onFinish);

  const cupY = size.h - 58;
  useLoop(phase === "play" && size.h > 0, (dt) => {
    elapsed.current += dt;
    spawnIn.current -= dt;
    if (spawnIn.current <= 0) {
      spawnIn.current = Math.max(0.3, 0.6 - elapsed.current * 0.01);
      const r = Math.random();
      const kind =
        r < 0.2
          ? { e: "🌶️", pts: -2 }
          : r < 0.27
            ? { e: "⭐", pts: 3 }
            : { e: pick(SNACKS), pts: 1 };
      items.current.push({
        id: Math.random(),
        x: 0.08 + Math.random() * 0.84,
        y: -30,
        v: size.h * (0.34 + elapsed.current * 0.012 + Math.random() * 0.12),
        ...kind,
      });
    }
    const cx = cup.current * size.w;
    for (const it of items.current) {
      const was = it.y;
      it.y += it.v * dt;
      // Lands in the cup as it crosses the rim.
      if (was < cupY - 10 && it.y >= cupY - 10 && Math.abs(it.x * size.w - cx) < 44) {
        it.y = size.h * 2; // gone
        scoreRef.current = Math.max(0, scoreRef.current + it.pts);
        setScore(scoreRef.current);
        pops.current.push({
          id: Math.random(),
          x: cx,
          y: cupY - 40,
          text: it.pts > 0 ? `+${it.pts}` : `${it.pts}`,
          t: 0,
          good: it.pts > 0,
        });
        if (it.pts > 0) {
          sfx.pop(it.pts > 1 ? 6 : 2);
          buzz(8);
        } else {
          sfx.bad();
          buzz(60);
        }
      }
    }
    items.current = items.current.filter((it) => it.y < size.h + 40);
    pops.current = pops.current.filter((p) => (p.t += dt) < 0.7);
    setFrame((f) => f + 1);
  });
  const follow = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    cup.current = Math.max(0.06, Math.min(0.94, (e.clientX - r.left) / r.width));
  };
  useArrowKeys(phase === "play", (d) => {
    if (d === 1) cup.current = Math.min(0.94, cup.current + 0.12);
    if (d === 3) cup.current = Math.max(0.06, cup.current - 0.12);
  });
  return (
    <Stage title="Chai Catch" tone="#E08A4B" onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="chai-catch"
          title="Chai Catch"
          how="Slide your cup to catch the snacks for your chai. ⭐ is worth 3. Chillies 🌶️ take 2 away. 30 seconds."
          onStart={() => setPhase("play")}
        />
      ) : (
        <>
          <Hud score={score} label="seconds" value={Math.ceil(left)} warn={left <= 5} />
          <div
            ref={boardRef}
            onPointerDown={follow}
            onPointerMove={follow}
            className="relative flex-1 mt-3 rounded-3xl overflow-hidden"
            style={{
              background:
                "radial-gradient(90% 50% at 50% 100%, rgba(224,138,75,0.35), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            }}
            aria-label="Slide to move your cup"
          >
            {items.current.map((it) => (
              <span
                key={it.id}
                className="absolute"
                style={{
                  left: it.x * size.w - 20,
                  top: it.y - 20,
                  fontSize: 36,
                  lineHeight: 1,
                  filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.4))",
                }}
              >
                {it.e}
              </span>
            ))}
            {pops.current.map((p) => (
              <span
                key={p.id}
                className="absolute font-black"
                style={{
                  left: p.x - 16,
                  top: p.y - p.t * 60,
                  opacity: 1 - p.t / 0.7,
                  color: p.good ? LIME : PINK,
                  fontSize: 22,
                }}
              >
                {p.text}
              </span>
            ))}
            {size.h > 0 && (
              <span
                className="absolute"
                style={{
                  left: cup.current * size.w - 34,
                  top: cupY - 30,
                  fontSize: 62,
                  lineHeight: 1,
                  filter: "drop-shadow(0 10px 12px rgba(0,0,0,0.5))",
                }}
                aria-label="Your cup"
              >
                ☕
              </span>
            )}
            {phase === "over" && <Over text="Time! ⏰" sub={`${score} points`} />}
          </div>
        </>
      )}
    </Stage>
  );
}

// =====================================================================
// Hot or Cold: is it hot or cold? Tap (or swipe) the right side, fast.
// 30 seconds. Wrong answers cost a point.
// =====================================================================

const HOT = ["☕", "🌶️", "🔥", "🍜", "🌋", "☀️", "🥵", "🫖", "🍲", "♨️", "🏜️", "🍕", "🧯", "🌞"];
const COLD = ["🧊", "🍦", "❄️", "⛄", "🥶", "🍧", "🐧", "🏔️", "🥤", "🌨️", "🐻‍❄️", "🧤", "🍨", "🎿"];

export function HotOrCold({ onFinish, onClose }: RoundProps) {
  useGameMusic();
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [card, setCard] = useState({ e: "☕", hot: true, id: 0 });
  const [fly, setFly] = useState<"hot" | "cold" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const left = useClock(30, phase === "play", () => setPhase("over"));
  useEnd(phase === "over", score, onFinish);

  const deal = () =>
    setCard((c) => {
      let hot = Math.random() < 0.5;
      let e = pick(hot ? HOT : COLD);
      if (e === c.e) {
        hot = !hot;
        e = pick(hot ? HOT : COLD);
      }
      return { e, hot, id: c.id + 1 };
    });
  const answer = (saysHot: boolean) => {
    if (phase !== "play" || fly) return;
    if (saysHot === card.hot) {
      sfx.good();
      buzz(10);
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      setFly(saysHot ? "hot" : "cold");
      setTimeout(() => {
        setFly(null);
        deal();
      }, 140);
    } else {
      sfx.bad();
      buzz(60);
      setScore((s) => Math.max(0, s - 1));
      setStreak(0);
      shake(cardRef.current);
    }
  };
  useArrowKeys(phase === "play", (d) =>
    d === 3 ? answer(true) : d === 1 ? answer(false) : undefined,
  );
  const swipeHot = useSwipe((d) => (d === 3 ? answer(true) : d === 1 ? answer(false) : undefined));
  return (
    <Stage title="Hot or Cold" tone="#FF7A45" onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="hot-cold"
          title="Hot or Cold"
          how="Is it hot or cold? Tap 🔥 or ❄️ (or swipe left for hot, right for cold). As many as you can in 30 seconds."
          onStart={() => {
            deal();
            setPhase("play");
          }}
        />
      ) : (
        <>
          <Hud score={score} label="seconds" value={Math.ceil(left)} warn={left <= 5} />
          <div className="relative flex-1 flex flex-col items-center justify-center" {...swipeHot}>
            <div
              ref={cardRef}
              key={card.id}
              className="pop rounded-[36px] flex items-center justify-center"
              style={{
                width: 210,
                height: 250,
                background: "linear-gradient(180deg, #2A2733 0%, #1A1821 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                transform:
                  fly === "hot"
                    ? "translateX(-340px) rotate(-20deg)"
                    : fly === "cold"
                      ? "translateX(340px) rotate(20deg)"
                      : undefined,
                transition: "transform 140ms ease-in",
              }}
            >
              <span style={{ fontSize: 110, lineHeight: 1 }}>{card.e}</span>
            </div>
            <p className="mt-5 font-extrabold h-6" style={{ fontSize: 16, color: LIME }}>
              {streak >= 5 ? `🔥 ${streak} in a row` : ""}
            </p>
            {phase === "over" && <Over text="Time! ⏰" sub={`${score} right`} />}
          </div>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            {[
              { hot: true, label: "🔥 Hot", bg: "linear-gradient(180deg, #FF8A4C, #E5482E)" },
              { hot: false, label: "❄️ Cold", bg: "linear-gradient(180deg, #6EC8FF, #2F7FE0)" },
            ].map((b) => (
              <button
                key={b.label}
                onPointerDown={() => answer(b.hot)}
                className="rounded-3xl font-black"
                style={{
                  minHeight: 76,
                  fontSize: 22,
                  background: b.bg,
                  boxShadow: "inset 0 -5px 0 rgba(0,0,0,0.2), 0 10px 24px rgba(0,0,0,0.35)",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}
    </Stage>
  );
}

// =====================================================================
// Perfect Pitch: hear one tone, then slide to find it again. Score is how
// close you got (pitch, measured in cents: 100 cents = one semitone).
// =====================================================================

const PITCH_TONE = "#B28BFF";
const LOW = 200; // Hz at the bottom of the slider
const HIGH = 1000; // Hz at the top
/** Slider position (0 bottom … 1 top) to frequency, on a musical (log) scale. */
const freqAt = (p: number) => LOW * Math.pow(HIGH / LOW, Math.min(1, Math.max(0, p)));
const posOf = (f: number) => Math.log(f / LOW) / Math.log(HIGH / LOW);
const centsOff = (a: number, b: number) => 1200 * Math.log2(a / b);
/** 1000 when spot on, about 780 a quarter-tone off, 600 a semitone off. */
export const pitchScore = (cents: number) => Math.round(1000 * Math.exp(-Math.abs(cents) / 200));
/** How a Perfect Pitch score reads: "94.2% match". */
export const pitchShow = (score: number) => `${(score / 10).toFixed(1)}% match`;

/** One soft, steady tone you can move while it plays. */
function useTone() {
  const ctx = useRef<AudioContext | null>(null);
  const osc = useRef<{ o: OscillatorNode; g: GainNode } | null>(null);
  const ensure = () => {
    if (!ctx.current) {
      try {
        // Play through the silent switch on iPhone (where supported).
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = "playback";
      } catch {
        // ignore
      }
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current = new AC();
    }
    if (ctx.current.state === "suspended") void ctx.current.resume();
    return ctx.current;
  };
  const start = (f: number) => {
    const c = ensure();
    stop(true);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f, c.currentTime);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.04);
    o.connect(g).connect(c.destination);
    o.start();
    osc.current = { o, g };
  };
  const set = (f: number) => {
    const c = ctx.current;
    if (c && osc.current) osc.current.o.frequency.setTargetAtTime(f, c.currentTime, 0.015);
  };
  const stop = (now = false) => {
    const c = ctx.current;
    const cur = osc.current;
    if (!c || !cur) return;
    osc.current = null;
    const t = c.currentTime + (now ? 0.01 : 0.08);
    cur.g.gain.cancelScheduledValues(c.currentTime);
    cur.g.gain.setValueAtTime(cur.g.gain.value, c.currentTime);
    cur.g.gain.exponentialRampToValueAtTime(0.0001, t);
    cur.o.stop(t + 0.02);
  };
  useEffect(
    () => () => {
      stop(true);
      void ctx.current?.close();
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return { ensure, start, set, stop };
}

export function PerfectPitch({ onFinish, onClose }: RoundProps) {
  const [phase, setPhase] = useState<"intro" | "listen" | "match" | "reveal">("intro");
  const target = useRef(freqAt(0.12 + Math.random() * 0.76)); // never right at the ends
  const [pos, setPos] = useState(0.5);
  const [touched, setTouched] = useState(false);
  const [holding, setHolding] = useState(false);
  const tone = useTone();
  const colRef = useRef<HTMLDivElement>(null);
  const cents = centsOff(freqAt(pos), target.current);
  const score = pitchScore(cents);
  useEnd(phase === "reveal", score, onFinish, 3200);

  // Listen: the tone plays once, for two seconds.
  useEffect(() => {
    if (phase !== "listen") return;
    const a = setTimeout(() => tone.start(target.current), 500);
    const b = setTimeout(() => tone.stop(), 2500);
    const c = setTimeout(() => setPhase("match"), 3000);
    return () => [a, b, c].forEach(clearTimeout);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (clientY: number) => {
    const r = colRef.current?.getBoundingClientRect();
    if (!r) return pos;
    return Math.min(1, Math.max(0, (r.bottom - clientY) / r.height));
  };
  const down = (e: React.PointerEvent) => {
    if (phase !== "match") return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = at(e.clientY);
    setPos(p);
    setTouched(true);
    setHolding(true);
    tone.start(freqAt(p));
  };
  const move = (e: React.PointerEvent) => {
    if (!holding) return;
    const p = at(e.clientY);
    setPos(p);
    tone.set(freqAt(p));
  };
  const up = () => {
    if (!holding) return;
    setHolding(false);
    tone.stop();
  };
  const lockIn = () => {
    tone.stop(true);
    setPhase("reveal");
    buzz(35);
    if (score >= 900) sfx.win();
    else sfx.land();
  };

  const off = Math.abs(Math.round(cents));
  const verdict =
    off <= 10
      ? "Perfect pitch. Who are you? 🤯"
      : off <= 30
        ? "Spot on 🔥"
        : off <= 100
          ? `Close · ${cents > 0 ? "a bit high" : "a bit low"}`
          : off <= 300
            ? `${cents > 0 ? "Too high" : "Too low"} · not bad`
            : `Way ${cents > 0 ? "too high" : "too low"} 🙉`;
  const showMine = phase === "match" ? touched : phase === "reveal";
  return (
    <Stage title="Perfect Pitch" tone={PITCH_TONE} onClose={onClose} canClose={phase === "intro"}>
      {phase === "intro" ? (
        <Intro
          art="pitch"
          title="Perfect Pitch"
          how="You'll hear one tone, once. Then slide up and down to find it again, and lock it in. Turn your sound on 🔊"
          onStart={() => {
            tone.ensure(); // unlock audio on this tap
            setPhase("listen");
          }}
        />
      ) : (
        <>
          <p
            className="text-center font-black mt-2 shrink-0"
            style={{ fontSize: 22, color: phase === "reveal" ? LIME : "#fff" }}
          >
            {phase === "listen"
              ? "Listen… 👂"
              : phase === "match"
                ? touched
                  ? "Find it, then lock it in"
                  : "Hold and slide to play your tone"
                : `${(score / 10).toFixed(1)}% match`}
          </p>
          <p className="text-center mt-1 shrink-0" style={{ color: "rgba(255,255,255,0.65)" }}>
            {phase === "reveal"
              ? verdict
              : phase === "listen"
                ? "Remember it"
                : "Higher ↑ · Lower ↓"}
          </p>
          <div className="relative flex-1 flex justify-center mt-4 mb-4 min-h-0">
            <div
              ref={colRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              className="relative h-full rounded-[40px] overflow-hidden"
              style={{
                width: 150,
                touchAction: "none",
                background: `linear-gradient(0deg, rgba(178,139,255,0.08), rgba(178,139,255,0.22))`,
                border: "1px solid rgba(178,139,255,0.35)",
                boxShadow: holding ? `0 0 50px ${PITCH_TONE}66` : `0 0 24px ${PITCH_TONE}22`,
                transition: "box-shadow 150ms",
              }}
              role="slider"
              aria-label="Your tone. Slide up for higher, down for lower."
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos * 100)}
            >
              {/* Faint steps, like keys */}
              {Array.from({ length: 12 }, (_, k) => (
                <span
                  key={k}
                  className="absolute inset-x-6"
                  style={{
                    bottom: `${((k + 1) / 13) * 100}%`,
                    height: 1,
                    background: "rgba(255,255,255,0.07)",
                  }}
                />
              ))}
              {/* While the target plays: a pulse */}
              {phase === "listen" && (
                <span
                  className="absolute inset-0 animate-pulse"
                  style={{
                    background: `radial-gradient(circle, ${PITCH_TONE}55, transparent 70%)`,
                  }}
                />
              )}
              {/* Your tone */}
              {showMine && (
                <span
                  className="absolute inset-x-3 rounded-full"
                  style={{
                    bottom: `calc(${pos * 100}% - 7px)`,
                    height: 14,
                    background: "#fff",
                    boxShadow: `0 0 18px ${PITCH_TONE}`,
                  }}
                />
              )}
              {/* The answer, once you've locked in */}
              {phase === "reveal" && (
                <span
                  className="absolute inset-x-1 rounded-full pop"
                  style={{
                    bottom: `calc(${posOf(target.current) * 100}% - 4px)`,
                    height: 8,
                    background: LIME,
                    boxShadow: `0 0 16px ${LIME}`,
                  }}
                />
              )}
            </div>
            {phase === "reveal" && (
              <div className="absolute right-0 top-2 text-right text-[12.5px] font-bold">
                <p style={{ color: LIME }}>━ the tone</p>
                <p style={{ color: "#fff" }}>━ yours</p>
              </div>
            )}
          </div>
          <div className="shrink-0">
            {phase === "match" ? (
              <button
                onClick={lockIn}
                disabled={!touched}
                className="w-full rounded-2xl font-black disabled:opacity-40"
                style={{ background: LIME, color: "#14200A", minHeight: 58, fontSize: 18 }}
              >
                Lock it in
              </button>
            ) : (
              <div style={{ minHeight: 58 }} />
            )}
          </div>
        </>
      )}
    </Stage>
  );
}
