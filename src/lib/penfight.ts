/**
 * Pen fight, 2 to 6 players: pens on a desk. Take turns flicking your pen
 * (swipe from a point on it; the harder the swipe, the harder the push; push
 * near an end and it spins). A pen that tips off the desk is out: it only
 * falls once its middle (where it balances) goes past the edge, so a pen
 * hanging half over the edge is still in. Last pen on the desk wins.
 *
 * A small 2D rigid-body sim: each pen is a capsule (a line with a radius) that
 * slides with friction, spins, and bounces off the other pens.
 */
/** The table used before tables came in different shapes and sizes. */
export const DESK = { w: 360, h: 520 };
export const PEN = { len: 128, r: 7 };
const MASS = 1;
const INERTIA = (MASS * PEN.len * PEN.len) / 12;
const SLIDE = 650; // friction: how fast a sliding pen slows (units/s²)
const SPIN_DRAG = 3.2; // how fast spin dies away (1/s)
const BOUNCE = 0.45;
const MAX_PUSH = 800; // fastest a pen can be sent (units/s)
const DT = 1 / 120;
/** Frames (at 60 a second) a pen takes to drop off the desk on screen. */
export const FALL_FRAMES = 26;
export const MAX_PLAYERS = 6;

/** The tables (one is picked at random each game). */
export type TableKind = "wood" | "school" | "round" | "marble";
export type Table = { kind: TableKind; w: number; h: number };
export const TABLES: Record<TableKind, { name: string; w: number; h: number }> = {
  wood: { name: "Teacher's desk", w: 360, h: 520 },
  school: { name: "School bench", w: 320, h: 560 },
  round: { name: "Café table", w: 430, h: 430 },
  marble: { name: "Marble slab", w: 410, h: 470 },
};
/** A table for n players: more players, a bigger table. */
export function makeTable(n: number, kind?: TableKind): Table {
  const kinds = Object.keys(TABLES) as TableKind[];
  const k = kind ?? kinds[Math.floor(Math.random() * kinds.length)];
  const scale = n <= 2 ? 1 : n <= 4 ? 1.1 : 1.2;
  return { kind: k, w: Math.round(TABLES[k].w * scale), h: Math.round(TABLES[k].h * scale) };
}
export const tableOf = (s: { table?: Table }): Table => s.table ?? { kind: "wood", ...DESK };

/** How far a pen sent at this speed slides on its own (for the aiming dots). */
export const slideDistance = (speed: number) => Math.min(speed, MAX_PUSH) ** 2 / (2 * SLIDE);
export const MAX_SPEED = MAX_PUSH;

export type Pen = { x: number; y: number; a: number; vx: number; vy: number; w: number };
export type PenPose = { x: number; y: number; a: number };
/** One flick: where on the desk it pushed, and the push (velocity at that point). */
export type Shot = { px: number; py: number; ix: number; iy: number };
/** A frame of a shot playing out: every pen's pose, and how far into its fall (0 = on the desk). */
export type Frame = { poses: PenPose[]; fall: number[] };

export type PenState = {
  /** Who plays which pen (user ids; "me"/"bot1".. in bot games), in turn order. */
  players: string[];
  pens: PenPose[];
  /** Pens that have fallen off. */
  out?: boolean[];
  /** Seats in the order their pens fell (for places at the end). */
  fellOrder?: number[];
  turn: number;
  shots: number;
  /** When the current turn started (to skip someone who's gone quiet). */
  turnAt?: number;
  /** The last flick and the pens just before it (so other phones can watch it). */
  last?: { seat: number; shot: Shot; from: PenPose[]; outBefore?: boolean[] };
  winner?: number;
  /** Why it ended (2-player wording). */
  how?: "knocked" | "fell";
  level?: 1 | 2 | 3;
  /** Online: who has opened it. */
  joined?: string[];
  /** Online: still in the waiting room. */
  lobby?: boolean;
  /** Each player's pen (looks only). */
  skins?: string[];
  /** The table (shape and size); old games used the plain desk. */
  table?: Table;
};

/** Where n pens start: spread round the middle of the desk, each at an angle. */
function startPoses(n: number, t: Table): PenPose[] {
  const round = t.kind === "round";
  if (n === 2)
    return [
      { x: t.w * 0.5, y: t.h * (round ? 0.68 : 0.72), a: 0.18 },
      { x: t.w * 0.5, y: t.h * (round ? 0.32 : 0.28), a: -0.18 },
    ];
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: t.w / 2 + Math.cos(a) * t.w * (round ? 0.24 : 0.27),
      y: t.h / 2 + Math.sin(a) * t.h * (round ? 0.24 : 0.3),
      a: a + Math.PI / 2 + (Math.random() - 0.5) * 0.4,
    };
  });
}

export function newPenFight(
  players: string[],
  level?: 1 | 2 | 3,
  skins?: string[],
  kind?: TableKind,
): PenState {
  const n = players.length;
  const table = makeTable(n, kind);
  return {
    players,
    table,
    pens: startPoses(n, table),
    out: players.map(() => false),
    fellOrder: [],
    turn: Math.floor(Math.random() * n),
    shots: 0,
    turnAt: Date.now(),
    level,
    skins,
  };
}
export const penStarted = (s: PenState) => !s.lobby && (!s.joined || s.joined.length >= 2);
export const outOf = (s: PenState) => s.out ?? s.pens.map(() => false);

/** Start the game from the waiting room with whoever is in (2 or more). */
export function beginPenFight(s: PenState): PenState {
  const keep = s.players.map((_, i) => i).filter((i) => (s.joined ?? []).includes(s.players[i]));
  const players = keep.map((i) => s.players[i]);
  const table = makeTable(players.length, s.table?.kind);
  return {
    ...s,
    players,
    table,
    skins: keep.map((i) => s.skins?.[i] ?? "classic"),
    pens: startPoses(players.length, table),
    out: players.map(() => false),
    fellOrder: [],
    lobby: false,
    turn: Math.floor(Math.random() * players.length),
    turnAt: Date.now(),
  };
}

const tip = (p: Pen | PenPose, s: 1 | -1) => ({
  x: p.x + (s * Math.cos(p.a) * PEN.len) / 2,
  y: p.y + (s * Math.sin(p.a) * PEN.len) / 2,
});

/** Is this desk point on the pen (within a finger's reach)? */
export function onPen(p: PenPose, x: number, y: number, slack = 30) {
  const a = tip(p, -1);
  const b = tip(p, 1);
  return segDist(x, y, a.x, a.y, b.x, b.y).d <= PEN.r + slack;
}

/** It tips off once its middle (where it balances) has gone past the edge. */
export const offDesk = (p: PenPose, t: Table = tableOf({})) =>
  t.kind === "round"
    ? Math.hypot(p.x - t.w / 2, p.y - t.h / 2) > t.w / 2
    : p.x < 0 || p.x > t.w || p.y < 0 || p.y > t.h;

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return { d: Math.hypot(px - cx, py - cy), cx, cy };
}

/** Closest points between two pen axes. */
function closest(a: Pen, b: Pen) {
  const a1 = tip(a, -1);
  const a2 = tip(a, 1);
  const b1 = tip(b, -1);
  const b2 = tip(b, 1);
  let best = { d: Infinity, pa: { x: 0, y: 0 }, pb: { x: 0, y: 0 } };
  const consider = (p: { x: number; y: number }, s1: typeof a1, s2: typeof a1, pIsA: boolean) => {
    const r = segDist(p.x, p.y, s1.x, s1.y, s2.x, s2.y);
    if (r.d < best.d)
      best = pIsA
        ? { d: r.d, pa: p, pb: { x: r.cx, y: r.cy } }
        : { d: r.d, pa: { x: r.cx, y: r.cy }, pb: p };
  };
  consider(a1, b1, b2, true);
  consider(a2, b1, b2, true);
  consider(b1, a1, a2, false);
  consider(b2, a1, a2, false);
  return best;
}

/** Apply a flick: a push at a point on the pen. */
export function flick(p: Pen, shot: Shot) {
  let { ix, iy } = shot;
  const sp = Math.hypot(ix, iy);
  if (sp > MAX_PUSH) {
    ix = (ix / sp) * MAX_PUSH;
    iy = (iy / sp) * MAX_PUSH;
  }
  p.vx += ix;
  p.vy += iy;
  const rx = shot.px - p.x;
  const ry = shot.py - p.y;
  // Spin from pushing off-centre (scaled down: a real flick mostly slides).
  p.w += ((rx * iy - ry * ix) * MASS * 0.55) / INERTIA;
}

function collide(a: Pen, b: Pen) {
  const c = closest(a, b);
  const minD = PEN.r * 2;
  if (c.d >= minD) return;
  let nx = c.pb.x - c.pa.x;
  let ny = c.pb.y - c.pa.y;
  let len = Math.hypot(nx, ny);
  if (len < 1e-6) {
    nx = b.x - a.x;
    ny = b.y - a.y;
    len = Math.hypot(nx, ny) || 1;
  }
  nx /= len;
  ny /= len;
  const push = (minD - c.d) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const cx = (c.pa.x + c.pb.x) / 2;
  const cy = (c.pa.y + c.pb.y) / 2;
  const rax = cx - a.x;
  const ray = cy - a.y;
  const rbx = cx - b.x;
  const rby = cy - b.y;
  const vax = a.vx - a.w * ray;
  const vay = a.vy + a.w * rax;
  const vbx = b.vx - b.w * rby;
  const vby = b.vy + b.w * rbx;
  const vrel = (vbx - vax) * nx + (vby - vay) * ny;
  if (vrel < 0) {
    const raXn = rax * ny - ray * nx;
    const rbXn = rbx * ny - rby * nx;
    const j =
      (-(1 + BOUNCE) * vrel) / (2 / MASS + (raXn * raXn) / INERTIA + (rbXn * rbXn) / INERTIA);
    a.vx -= (j * nx) / MASS;
    a.vy -= (j * ny) / MASS;
    a.w -= (raXn * j) / INERTIA;
    b.vx += (j * nx) / MASS;
    b.vy += (j * ny) / MASS;
    b.w += (rbXn * j) / INERTIA;
  }
}

const moving = (p: Pen) => Math.hypot(p.vx, p.vy) > 2 || Math.abs(p.w) > 0.05;
const toPen = (q: PenPose): Pen => ({ ...q, vx: 0, vy: 0, w: 0 });
const toPose = (p: Pen): PenPose => ({ x: p.x, y: p.y, a: p.a });

/**
 * Run a shot to the end. Pens on the desk slide with friction and bounce off
 * each other; one whose middle goes past the edge tips off: it keeps going,
 * drops (no more friction or bumping) and is out. Returns every frame (for
 * the animation, 60 a second), where the pens stop, and who fell.
 */
export function simulate(
  from: PenPose[],
  outBefore: boolean[],
  seat: number,
  shot: Shot,
  t: Table = tableOf({}),
) {
  const pens = from.map(toPen);
  const fallAt: number[] = from.map(() => -1); // step it went over, or -1
  flick(pens[seat], shot);
  const frames: Frame[] = [];
  const onDesk = (i: number) => !outBefore[i] && fallAt[i] < 0;
  let quiet = 0;
  for (let i = 0; i < 120 * 10; i++) {
    for (let k = 0; k < pens.length; k++) {
      const p = pens[k];
      if (outBefore[k]) continue;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      p.a += p.w * DT;
      if (fallAt[k] >= 0) continue; // falling: it carries on over the edge
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 0) {
        const ns = Math.max(0, sp - SLIDE * DT);
        p.vx *= ns / sp;
        p.vy *= ns / sp;
      }
      p.w *= Math.max(0, 1 - SPIN_DRAG * DT);
      if (Math.abs(p.w) < 0.02) p.w = 0;
      if (offDesk(p, t)) {
        fallAt[k] = i;
        // It tips over the edge and keeps going outwards as it drops (the
        // same on every phone: no randomness).
        let ox = p.x < 0 ? -1 : p.x > t.w ? 1 : 0;
        let oy = p.y < 0 ? -1 : p.y > t.h ? 1 : 0;
        if (t.kind === "round") {
          const d = Math.hypot(p.x - t.w / 2, p.y - t.h / 2) || 1;
          ox = (p.x - t.w / 2) / d;
          oy = (p.y - t.h / 2) / d;
        }
        if (Math.hypot(p.vx, p.vy) < 80) {
          p.vx = ox * 80;
          p.vy = oy * 80;
        }
        p.w += k % 2 ? 0.8 : -0.8;
      }
    }
    for (let a = 0; a < pens.length; a++)
      for (let b = a + 1; b < pens.length; b++)
        if (onDesk(a) && onDesk(b)) collide(pens[a], pens[b]);
    if (i % 2 === 0)
      frames.push({
        poses: pens.map(toPose),
        fall: fallAt.map((f, k) =>
          outBefore[k] ? FALL_FRAMES : f < 0 ? 0 : Math.min(FALL_FRAMES, (i - f) / 2 + 1),
        ),
      });
    const still = pens.every((p, k) => !onDesk(k) || !moving(p));
    const dropped = fallAt.every((f) => f < 0 || i - f > FALL_FRAMES * 2);
    if (still && dropped) {
      if (++quiet > 2) break;
    } else quiet = 0;
  }
  const fell = fallAt.map((f) => f >= 0);
  return { frames, end: pens.map(toPose), fell };
}

/** The next seat still in, after `seat`. */
function nextIn(out: boolean[], seat: number) {
  for (let k = 1; k <= out.length; k++) {
    const i = (seat + k) % out.length;
    if (!out[i]) return i;
  }
  return seat;
}

/** The game after a shot has played out. */
export function applyShot(s: PenState, shot: Shot): PenState {
  const seat = s.turn;
  const outBefore = outOf(s);
  const { end, fell } = simulate(s.pens, outBefore, seat, shot, tableOf(s));
  const out = outBefore.map((o, i) => o || fell[i]);
  // Your own pen going off on your flick counts as falling first.
  const newly = fell.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  newly.sort((a, b) => (b === seat ? 1 : 0) - (a === seat ? 1 : 0));
  const fellOrder = [...(s.fellOrder ?? []), ...newly];
  const alive = out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
  let winner: number | undefined;
  if (alive.length === 1) winner = alive[0];
  else if (alive.length === 0) {
    // Everyone left went off at once: the shooter loses; the last other pen to
    // go wins.
    winner = newly.filter((i) => i !== seat).pop() ?? seat;
  }
  return {
    ...s,
    pens: end,
    out,
    fellOrder: winner === undefined ? fellOrder : fellOrder.filter((i) => i !== winner),
    last: { seat, shot, from: s.pens, outBefore },
    shots: s.shots + 1,
    turn: nextIn(out, seat),
    turnAt: Date.now(),
    winner,
    how: winner === undefined ? undefined : out[seat] && winner !== seat ? "fell" : "knocked",
  };
}

/** Skip whoever's turn it is (gone quiet online). */
export function skipTurn(s: PenState): PenState {
  if (s.winner !== undefined) return s;
  return { ...s, turn: nextIn(outOf(s), s.turn), turnAt: Date.now() };
}

/** Someone leaves or resigns: their pen is taken off the desk. */
export function resignPen(s: PenState, seat: number): PenState {
  if (s.winner !== undefined || outOf(s)[seat]) return s;
  const out = outOf(s).map((o, i) => o || i === seat);
  const alive = out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
  return {
    ...s,
    out,
    fellOrder: [...(s.fellOrder ?? []), seat],
    turn: s.turn === seat ? nextIn(out, seat) : s.turn,
    turnAt: Date.now(),
    winner: alive.length === 1 ? alive[0] : undefined,
    how: "knocked",
  };
}

/** Final places: the winner first, then whoever fell last. */
export function penPlaces(s: PenState): number[] {
  const fell = [...(s.fellOrder ?? [])].reverse().filter((i) => i !== s.winner);
  const rest = s.players.map((_, i) => i).filter((i) => i !== s.winner && !fell.includes(i));
  return [...(s.winner !== undefined ? [s.winner] : []), ...rest, ...fell];
}

// ---------- The bot ----------
/** How close a pen is to falling off (0 = on the edge). */
const edgeRoom = (p: PenPose, t: Table) =>
  t.kind === "round"
    ? t.w / 2 - Math.hypot(p.x - t.w / 2, p.y - t.h / 2)
    : Math.min(p.x, t.w - p.x, p.y, t.h - p.y);

/** The bot's flick: try many, keep the best. Easy tries few and aims loosely. */
export function botShot(s: PenState, level: 1 | 2 | 3): Shot {
  const seat = s.turn;
  const outBefore = outOf(s);
  const table = tableOf(s);
  const me = s.pens[seat];
  const targets = s.pens.map((p, i) => ({ p, i })).filter(({ i }) => i !== seat && !outBefore[i]);
  const tries = level === 1 ? 12 : level === 2 ? 50 : Math.max(60, 160 - targets.length * 15);
  const noise = level === 1 ? 0.35 : level === 2 ? 0.12 : 0.04;
  let best: Shot | null = null;
  let bestScore = -Infinity;
  for (let k = 0; k < tries; k++) {
    // Push from somewhere along my pen, aimed at somewhere along someone's.
    const u = Math.random() - 0.5;
    const px = me.x + Math.cos(me.a) * PEN.len * u * 0.9;
    const py = me.y + Math.sin(me.a) * PEN.len * u * 0.9;
    const t = targets[Math.floor(Math.random() * targets.length)]?.p ?? me;
    const v = Math.random() - 0.5;
    const tx = t.x + Math.cos(t.a) * PEN.len * v;
    const ty = t.y + Math.sin(t.a) * PEN.len * v;
    let ang = Math.atan2(ty - py, tx - px) + (Math.random() - 0.5) * noise * 2;
    if (Math.random() < 0.15) ang += (Math.random() - 0.5) * 1.2; // try something different
    const power = 150 + Math.random() * (MAX_PUSH - 150);
    const shot = { px, py, ix: Math.cos(ang) * power, iy: Math.sin(ang) * power };
    const { end, fell } = simulate(s.pens, outBefore, seat, shot, table);
    let score = 0;
    if (fell[seat]) score -= 2000;
    for (const { i } of targets) {
      if (fell[i]) score += 1000;
      else score -= edgeRoom(end[i], table) / targets.length;
    }
    if (!fell[seat]) score += edgeRoom(end[seat], table) * 0.6;
    if (score > bestScore) {
      bestScore = score;
      best = shot;
    }
  }
  return best!;
}
