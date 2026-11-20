/**
 * Pen fight: two pens on a desk. Take turns flicking your pen (swipe from a
 * point on it; the harder the swipe, the harder the push; push near an end and
 * it spins). Knock the other pen off the desk to win. If your own pen goes
 * off on your shot, you lose.
 *
 * A small 2D rigid-body sim: each pen is a capsule (a line with a radius) that
 * slides with friction, spins, and bounces off the other pen.
 */
export const DESK = { w: 360, h: 520 };
export const PEN = { len: 128, r: 7 };
const MASS = 1;
const INERTIA = (MASS * PEN.len * PEN.len) / 12;
const SLIDE = 650; // friction: how fast a sliding pen slows (units/s²)
const SPIN_DRAG = 3.2; // how fast spin dies away (1/s)
const BOUNCE = 0.45;
const MAX_PUSH = 800; // fastest a pen can be sent (units/s)
const DT = 1 / 120;

export type Pen = { x: number; y: number; a: number; vx: number; vy: number; w: number };
export type PenPose = { x: number; y: number; a: number };
/** One flick: where on the desk it pushed, and the push (velocity at that point). */
export type Shot = { px: number; py: number; ix: number; iy: number };

export type PenState = {
  /** Who plays which pen (user ids; "me"/"bot" in bot games). */
  players: [string, string];
  pens: [PenPose, PenPose];
  turn: 0 | 1;
  shots: number;
  /** The last flick and the pens just before it (so the other phone can watch it). */
  last?: { seat: 0 | 1; shot: Shot; from: [PenPose, PenPose] };
  winner?: 0 | 1;
  /** Why it ended. */
  how?: "knocked" | "fell";
  level?: 1 | 2 | 3;
  /** Online: who has opened it (starts once both are in). */
  joined?: string[];
  /** Each player's pen (looks only). */
  skins?: [string, string];
};

export function newPenFight(
  a: string,
  b: string,
  level?: 1 | 2 | 3,
  skins?: [string, string],
): PenState {
  return {
    skins,
    players: [a, b],
    pens: [
      { x: DESK.w * 0.5, y: DESK.h * 0.72, a: 0.18 },
      { x: DESK.w * 0.5, y: DESK.h * 0.28, a: -0.18 },
    ],
    turn: Math.random() < 0.5 ? 0 : 1,
    shots: 0,
    level,
  };
}
export const penStarted = (s: PenState) => !s.joined || s.joined.length >= 2;

const tip = (p: Pen | PenPose, s: 1 | -1) => ({
  x: p.x + (s * Math.cos(p.a) * PEN.len) / 2,
  y: p.y + (s * Math.sin(p.a) * PEN.len) / 2,
});

/** Is this desk point on the pen (within a finger's reach)? */
export function onPen(p: PenPose, x: number, y: number, slack = 22) {
  const a = tip(p, -1);
  const b = tip(p, 1);
  return segDist(x, y, a.x, a.y, b.x, b.y).d <= PEN.r + slack;
}

/** Off the desk: its middle (where it balances) has left the edge. */
export const offDesk = (p: PenPose) => p.x < 0 || p.x > DESK.w || p.y < 0 || p.y > DESK.h;

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
  // Crossing segments: push apart along the shorter way.
  if (best.d < 1e-6) best.d = 0;
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

function step(pens: [Pen, Pen]) {
  for (const p of pens) {
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    p.a += p.w * DT;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 0) {
      const ns = Math.max(0, sp - SLIDE * DT);
      p.vx *= ns / sp;
      p.vy *= ns / sp;
    }
    p.w *= Math.max(0, 1 - SPIN_DRAG * DT);
    if (Math.abs(p.w) < 0.02) p.w = 0;
  }
  // Pen against pen.
  const [a, b] = pens;
  const c = closest(a, b);
  const minD = PEN.r * 2;
  if (c.d < minD) {
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
    // Separate them.
    const push = (minD - c.d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    // Bounce, with spin.
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
}

const moving = (p: Pen) => Math.hypot(p.vx, p.vy) > 2 || Math.abs(p.w) > 0.05;
const toPen = (q: PenPose): Pen => ({ ...q, vx: 0, vy: 0, w: 0 });
const toPose = (p: Pen): PenPose => ({ x: p.x, y: p.y, a: p.a });

/**
 * Run a shot to the end. Returns every frame (for the animation, 60 a second)
 * and where the pens stop. A pen that leaves the desk stops there.
 */
export function simulate(from: [PenPose, PenPose], seat: 0 | 1, shot: Shot) {
  const pens: [Pen, Pen] = [toPen(from[0]), toPen(from[1])];
  flick(pens[seat], shot);
  const frames: [PenPose, PenPose][] = [];
  for (let i = 0; i < 120 * 8; i++) {
    step(pens);
    for (const p of pens)
      if (offDesk(p)) {
        // It goes over the edge: it slows hard and stops just beyond.
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.w *= 0.9;
      }
    if (i % 2 === 0) frames.push([toPose(pens[0]), toPose(pens[1])]);
    if (!moving(pens[0]) && !moving(pens[1])) break;
  }
  return { frames, end: [toPose(pens[0]), toPose(pens[1])] as [PenPose, PenPose] };
}

/** The game after a shot has played out. */
export function applyShot(s: PenState, shot: Shot): PenState {
  const seat = s.turn;
  const { end } = simulate(s.pens, seat, shot);
  const other = (seat === 0 ? 1 : 0) as 0 | 1;
  const mineOff = offDesk(end[seat]);
  const theirsOff = offDesk(end[other]);
  return {
    ...s,
    pens: end,
    last: { seat, shot, from: s.pens },
    shots: s.shots + 1,
    turn: other,
    winner: mineOff ? other : theirsOff ? seat : undefined,
    how: mineOff ? "fell" : theirsOff ? "knocked" : undefined,
  };
}

export function resignPen(s: PenState, seat: 0 | 1): PenState {
  if (s.winner !== undefined) return s;
  return { ...s, winner: seat === 0 ? 1 : 0, how: "knocked" };
}

// ---------- The bot ----------
/** How close a pen is to falling off (0 = on the edge). */
const edgeRoom = (p: PenPose) => Math.min(p.x, DESK.w - p.x, p.y, DESK.h - p.y);

/** The bot's flick: try many, keep the best. Easy tries few and aims loosely. */
export function botShot(s: PenState, level: 1 | 2 | 3): Shot {
  const seat = s.turn;
  const other = (seat === 0 ? 1 : 0) as 0 | 1;
  const me = s.pens[seat];
  const them = s.pens[other];
  const tries = level === 1 ? 12 : level === 2 ? 60 : 180;
  const noise = level === 1 ? 0.35 : level === 2 ? 0.12 : 0.04;
  let best: Shot | null = null;
  let bestScore = -Infinity;
  for (let k = 0; k < tries; k++) {
    // Push from somewhere along my pen, aimed at somewhere along theirs.
    const u = Math.random() - 0.5;
    const px = me.x + Math.cos(me.a) * PEN.len * u * 0.9;
    const py = me.y + Math.sin(me.a) * PEN.len * u * 0.9;
    const v = Math.random() - 0.5;
    const tx = them.x + Math.cos(them.a) * PEN.len * v;
    const ty = them.y + Math.sin(them.a) * PEN.len * v;
    let ang = Math.atan2(ty - py, tx - px) + (Math.random() - 0.5) * noise * 2;
    if (Math.random() < 0.15) ang += (Math.random() - 0.5) * 1.2; // try something different
    const power = 150 + Math.random() * (MAX_PUSH - 150);
    const shot = { px, py, ix: Math.cos(ang) * power, iy: Math.sin(ang) * power };
    const { end } = simulate(s.pens, seat, shot);
    let score = 0;
    if (offDesk(end[seat])) score -= 1000;
    else if (offDesk(end[other])) score += 1000;
    score += edgeRoom(end[seat]) * 0.6 - edgeRoom(end[other]);
    if (score > bestScore) {
      bestScore = score;
      best = shot;
    }
  }
  return best!;
}
