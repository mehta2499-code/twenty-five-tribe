/**
 * No-Limit Texas Hold'em: dealing, blinds, betting rounds, all-ins with side
 * pots and showdown. Friends only, no bots. Plain JSON state so a game can be saved and
 * played across phones. Cards are "As", "Td", "9h" (rank + suit).
 * Hole cards and the deck are stored scrambled so they aren't readable at a
 * glance (friends' games; not casino-grade secrecy).
 */

export type Card = string;
export type PSeat = {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
  stack: number;
  /** Chips put in on this street. */
  bet: number;
  /** Chips put in this hand (all streets). */
  inHand: number;
  folded: boolean;
  allIn: boolean;
  /** Has acted since the last full raise. */
  acted: boolean;
  /** Out of the game (no chips left, or left the table). */
  out: boolean;
  /** Scrambled hole cards ("" when not dealt). */
  cards: string;
  /** What they did last (for the seat label). */
  last?: string;
};
export type PokerResult = {
  winners: { seat: number; amount: number; hand: string }[];
  /** Cards turned face up at showdown, by seat. */
  shown: Record<number, Card[]>;
  /** Everyone else folded. */
  uncontested: boolean;
};
export type PokerState = {
  phase: "lobby" | "betting" | "showdown" | "over";
  seats: PSeat[];
  /** Online lobby: who has opened the game. */
  joined?: string[];
  dealer: number;
  sb: number;
  bb: number;
  handNo: number;
  street: 0 | 1 | 2 | 3; // preflop, flop, turn, river
  board: Card[];
  deck: string;
  toAct: number;
  currentBet: number;
  minRaise: number;
  result?: PokerResult;
  /** Last few things that happened. */
  log: string[];
  turnAt: number;
  startStack: number;
  /** Table size the host picked (2–9). */
  maxSeats: number;
  /** Blinds double every 10 hands. */
  rise: boolean;
};

const RANKS = "23456789TJQKA";
const SUITS = "shdc";

// ---------- Scrambling ----------
const hide = (cards: Card[]) => btoa(cards.join(",").split("").reverse().join(""));
const unhide = (h: string): Card[] =>
  h ? atob(h).split("").reverse().join("").split(",").filter(Boolean) : [];
export const holeCards = (s: PokerState, seat: number) => unhide(s.seats[seat]?.cards ?? "");

// ---------- Setup ----------
export type PokerPlayer = { id: string; name: string; avatar?: string; initials: string; color?: string };
const seatOf = (p: PokerPlayer, stack: number): PSeat => ({
  ...p,
  stack,
  bet: 0,
  inHand: 0,
  folded: false,
  allIn: false,
  acted: false,
  out: false,
  cards: "",
});

/** A new table. The host sets the size, buy-in and blinds; friends take seats in the lobby. */
export function newPoker(
  players: PokerPlayer[],
  opts: {
    stack?: number;
    sb?: number;
    bb?: number;
    maxSeats?: number;
    rise?: boolean;
    lobby?: boolean;
  } = {},
): PokerState {
  const stack = opts.stack ?? 1000;
  const sb = opts.sb ?? 10;
  const bb = opts.bb ?? sb * 2;
  const s: PokerState = {
    phase: "lobby",
    seats: players.map((p) => seatOf(p, stack)),
    joined: players.map((p) => p.id),
    dealer: Math.floor(Math.random() * players.length),
    sb,
    bb,
    handNo: 0,
    street: 0,
    board: [],
    deck: "",
    toAct: 0,
    currentBet: 0,
    minRaise: bb,
    log: [],
    turnAt: Date.now(),
    startStack: stack,
    maxSeats: Math.min(9, Math.max(2, opts.maxSeats ?? 6)),
    rise: opts.rise ?? true,
  };
  return opts.lobby ? s : startHand(s);
}

const live = (s: PokerState) => s.seats.map((_, i) => i).filter((i) => !s.seats[i].out);
const nextFrom = (s: PokerState, from: number, ok: (i: number) => boolean) => {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (ok(i)) return i;
  }
  return -1;
};
const pot = (s: PokerState) => s.seats.reduce((a, p) => a + p.inHand, 0);
export const potSize = pot;

function shuffled(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const su of SUITS) deck.push(r + su);
  const rnd = new Uint32Array(deck.length);
  crypto.getRandomValues(rnd);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Post a forced bet (blind). */
function post(seat: PSeat, amount: number) {
  const a = Math.min(amount, seat.stack);
  seat.stack -= a;
  seat.bet += a;
  seat.inHand += a;
  if (seat.stack === 0) seat.allIn = true;
  return a;
}

/** Deal a new hand: move the button, post blinds, deal two cards each. */
export function startHand(prev: PokerState): PokerState {
  const s: PokerState = structuredClone(prev);
  for (const p of s.seats) if (p.stack <= 0) p.out = true;
  const players = live(s);
  if (players.length < 2) return { ...s, phase: "over" };
  s.handNo += 1;
  // Blinds double every 10 hands (if the host chose that) so games end.
  if (s.rise && s.handNo > 1 && (s.handNo - 1) % 10 === 0) {
    s.bb = prev.bb * 2;
    s.sb = prev.sb * 2;
  }
  s.dealer = s.handNo === 1 && !s.seats[s.dealer].out ? s.dealer : nextFrom(s, s.dealer, (i) => !s.seats[i].out);
  for (const p of s.seats)
    Object.assign(p, {
      bet: 0,
      inHand: 0,
      folded: p.out,
      allIn: false,
      acted: false,
      cards: "",
      last: undefined,
    });
  const deck = shuffled();
  for (const i of players) s.seats[i].cards = hide([deck.pop()!, deck.pop()!]);
  s.board = [];
  s.street = 0;
  s.result = undefined;
  const headsUp = players.length === 2;
  const sbSeat = headsUp ? s.dealer : nextFrom(s, s.dealer, (i) => !s.seats[i].out);
  const bbSeat = nextFrom(s, sbSeat, (i) => !s.seats[i].out);
  post(s.seats[sbSeat], s.sb);
  s.seats[sbSeat].last = `SB ${s.sb}`;
  post(s.seats[bbSeat], s.bb);
  s.seats[bbSeat].last = `BB ${s.bb}`;
  s.currentBet = s.bb;
  s.minRaise = s.bb;
  s.deck = hide(deck);
  s.phase = "betting";
  s.log = [`Hand ${s.handNo} · blinds ${s.sb}/${s.bb}`];
  s.toAct = nextFrom(s, bbSeat, (i) => canAct(s, i));
  s.turnAt = Date.now();
  if (s.toAct < 0) return runOut(s);
  return s;
}

const canAct = (s: PokerState, i: number) => {
  const p = s.seats[i];
  return !p.out && !p.folded && !p.allIn;
};
const needsAction = (s: PokerState, i: number) =>
  canAct(s, i) && (!s.seats[i].acted || s.seats[i].bet < s.currentBet);

// ---------- Actions ----------
export type Action =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  /** Raise (or bet) to this total on the street. */
  | { type: "raise"; to: number };

/** What the player to act can do right now. */
export function options(s: PokerState, i = s.toAct) {
  const p = s.seats[i];
  const toCall = Math.min(s.currentBet - p.bet, p.stack);
  const maxTo = p.bet + p.stack;
  const minTo = Math.min(s.currentBet + s.minRaise, maxTo);
  return {
    toCall,
    canCheck: toCall === 0,
    canRaise: maxTo > s.currentBet,
    minTo,
    maxTo,
    pot: pot(s),
  };
}

export function act(prev: PokerState, seat: number, a: Action): PokerState | null {
  if (prev.phase !== "betting" || seat !== prev.toAct) return null;
  const s: PokerState = structuredClone(prev);
  const p = s.seats[seat];
  const o = options(s, seat);
  const name = p.name.split(" ")[0];
  if (a.type === "fold") {
    p.folded = true;
    p.last = "Fold";
    s.log.push(`${name} folds`);
  } else if (a.type === "check") {
    if (!o.canCheck) return null;
    p.last = "Check";
    s.log.push(`${name} checks`);
  } else if (a.type === "call") {
    if (o.toCall <= 0) return act(prev, seat, { type: "check" });
    post(p, o.toCall);
    p.last = p.allIn ? "All in" : `Call ${o.toCall}`;
    s.log.push(`${name} calls ${o.toCall}`);
  } else {
    const to = Math.max(o.minTo, Math.min(a.to, o.maxTo));
    if (!o.canRaise || to <= s.currentBet) return null;
    const raiseBy = to - s.currentBet;
    post(p, to - p.bet);
    const bet = s.currentBet === 0;
    s.currentBet = to;
    // A full raise reopens the betting for everyone.
    if (raiseBy >= s.minRaise) {
      s.minRaise = raiseBy;
      for (const q of s.seats) if (q !== p) q.acted = false;
    }
    p.last = p.allIn ? "All in" : `${bet ? "Bet" : "Raise"} ${to}`;
    s.log.push(`${name} ${p.allIn ? "goes all in" : bet ? "bets" : "raises to"} ${to}`);
  }
  p.acted = true;
  s.log = s.log.slice(-6);
  return advance(s, seat);
}

/** After an action: next player, next street, or the end of the hand. */
function advance(s: PokerState, from: number): PokerState {
  const inPlay = s.seats.map((_, i) => i).filter((i) => !s.seats[i].out && !s.seats[i].folded);
  if (inPlay.length === 1) return award(s, true);
  const next = nextFrom(s, from, (i) => needsAction(s, i));
  if (next >= 0) {
    s.toAct = next;
    s.turnAt = Date.now();
    return s;
  }
  // Street over.
  const deck = unhide(s.deck);
  for (const q of s.seats) {
    q.bet = 0;
    q.acted = false;
  }
  s.currentBet = 0;
  s.minRaise = s.bb;
  if (s.street === 3) return award(s, false);
  s.street = (s.street + 1) as PokerState["street"];
  deck.pop(); // burn
  if (s.street === 1) s.board.push(deck.pop()!, deck.pop()!, deck.pop()!);
  else s.board.push(deck.pop()!);
  s.deck = hide(deck);
  s.log.push(["", "Flop", "Turn", "River"][s.street] + `: ${s.board.join(" ")}`);
  s.log = s.log.slice(-6);
  for (const q of s.seats) if (!q.folded && !q.out) q.last = q.allIn ? "All in" : undefined;
  const first = nextFrom(s, s.dealer, (i) => canAct(s, i));
  // Nobody (or only one player) can still bet: deal it out.
  const actors = s.seats.filter((_, i) => canAct(s, i)).length;
  if (first < 0 || actors < 2) return runOut(s);
  s.toAct = first;
  s.turnAt = Date.now();
  return s;
}

/** Everyone's all in: deal the rest of the board and show down. */
function runOut(s: PokerState): PokerState {
  const deck = unhide(s.deck);
  while (s.board.length < 5) {
    deck.pop();
    if (s.board.length === 0) s.board.push(deck.pop()!, deck.pop()!, deck.pop()!);
    else s.board.push(deck.pop()!);
  }
  s.deck = hide(deck);
  for (const q of s.seats) {
    q.bet = 0;
  }
  s.street = 3;
  return award(s, false);
}

/** Pay out the pot (with side pots) and end the hand. */
function award(s: PokerState, uncontested: boolean): PokerState {
  const contenders = s.seats.map((_, i) => i).filter((i) => !s.seats[i].out && !s.seats[i].folded);
  const winners: PokerResult["winners"] = [];
  const shown: PokerResult["shown"] = {};
  const total = pot(s);
  if (uncontested || contenders.length === 1) {
    const w = contenders[0];
    s.seats[w].stack += total;
    winners.push({ seat: w, amount: total, hand: "" });
  } else {
    const ranks = new Map<number, Ranked>();
    for (const i of contenders) {
      const cards = holeCards(s, i);
      shown[i] = cards;
      ranks.set(i, rank7([...cards, ...s.board]));
    }
    // Side pots: each level of contribution is its own pot.
    const levels = [...new Set(s.seats.map((p) => p.inHand).filter((x) => x > 0))].sort((a, b) => a - b);
    let prev = 0;
    const paid = new Map<number, number>();
    for (const level of levels) {
      const amount = s.seats.reduce(
        (a, p) => a + Math.max(0, Math.min(p.inHand, level) - Math.min(p.inHand, prev)),
        0,
      );
      let eligible = contenders.filter((i) => s.seats[i].inHand >= level);
      // Chips put in by someone who later folded, above what anyone left put in:
      // they go to whoever put in the most of those still in.
      if (!eligible.length) {
        const most = Math.max(...contenders.map((i) => s.seats[i].inHand));
        eligible = contenders.filter((i) => s.seats[i].inHand === most);
      }
      prev = level;
      if (!amount || !eligible.length) continue;
      let best: number[] = [];
      for (const i of eligible) {
        if (!best.length) best = [i];
        else {
          const c = compare(ranks.get(i)!.score, ranks.get(best[0])!.score);
          if (c > 0) best = [i];
          else if (c === 0) best.push(i);
        }
      }
      // Split evenly; odd chips go to the first winner after the button.
      const share = Math.floor(amount / best.length);
      let odd = amount - share * best.length;
      const order = [...best].sort(
        (a, b) => ((a - s.dealer + s.seats.length) % s.seats.length) - ((b - s.dealer + s.seats.length) % s.seats.length),
      );
      for (const i of order) {
        const win = share + (odd > 0 ? 1 : 0);
        if (odd > 0) odd--;
        paid.set(i, (paid.get(i) ?? 0) + win);
      }
    }
    for (const [i, amount] of paid) {
      s.seats[i].stack += amount;
      winners.push({ seat: i, amount, hand: ranks.get(i)!.name });
    }
  }
  for (const p of s.seats) {
    p.bet = 0;
  }
  s.result = { winners, shown, uncontested: uncontested || contenders.length === 1 };
  const names = winners.map((w) => s.seats[w.seat].name.split(" ")[0]).join(" & ");
  const hand = winners[0]?.hand;
  s.log.push(`${names} win${winners.length > 1 ? "" : "s"} ${total}${hand ? ` with ${hand}` : ""}`);
  s.log = s.log.slice(-6);
  s.phase = s.seats.filter((p) => !p.out && p.stack > 0).length < 2 ? "over" : "showdown";
  s.toAct = -1;
  s.turnAt = Date.now();
  return s;
}

/** Someone leaves: they fold now and sit out for good. */
export function leave(prev: PokerState, id: string): PokerState {
  const i = prev.seats.findIndex((p) => p.id === id);
  if (i < 0) return prev;
  let s: PokerState = structuredClone(prev);
  if (s.phase === "betting" && !s.seats[i].folded) {
    if (s.toAct === i) s = act(s, i, { type: "fold" }) ?? s;
    else s.seats[i].folded = true;
  }
  s.seats[i].out = true;
  s.seats[i].last = "Left";
  const left = s.seats.filter((p) => !p.out);
  if (left.length < 2) s.phase = "over";
  else if (s.phase === "betting" && s.toAct === i) return advance(s, i);
  return s;
}

/** Places at the end: most chips first. */
export function standings(s: PokerState) {
  return s.seats
    .map((p, i) => ({ i, chips: p.stack }))
    .sort((a, b) => b.chips - a.chips);
}

// ---------- Hand ranking ----------
export type Ranked = { score: number[]; name: string };
const NAMES = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];
const RANK_NAME: Record<number, string> = {
  14: "Aces",
  13: "Kings",
  12: "Queens",
  11: "Jacks",
  10: "Tens",
  9: "Nines",
  8: "Eights",
  7: "Sevens",
  6: "Sixes",
  5: "Fives",
  4: "Fours",
  3: "Threes",
  2: "Twos",
};
const val = (c: Card) => RANKS.indexOf(c[0]) + 2;

function straightHigh(vals: number[]) {
  const set = new Set(vals);
  if (set.has(14)) set.add(1);
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) if (!set.has(hi - k)) ok = false;
    if (ok) return hi;
  }
  return 0;
}

/** Best five of up to seven cards. Higher score array wins. */
export function rank7(cards: Card[]): Ranked {
  const vals = cards.map(val).sort((a, b) => b - a);
  const bySuit: Record<string, number[]> = {};
  for (const c of cards) (bySuit[c[1]] ??= []).push(val(c));
  const flushSuit = Object.keys(bySuit).find((k) => bySuit[k].length >= 5);
  if (flushSuit) {
    const sf = straightHigh(bySuit[flushSuit]);
    if (sf) return { score: [8, sf], name: sf === 14 ? "Royal flush" : "Straight flush" };
  }
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const kick = (exclude: number[], n: number) =>
    vals.filter((v) => !exclude.includes(v)).slice(0, n);
  if (groups[0][1] === 4) {
    const q = groups[0][0];
    return { score: [7, q, ...kick([q], 1)], name: `Four ${RANK_NAME[q]}` };
  }
  if (groups[0][1] === 3 && groups.length > 1 && groups[1][1] >= 2) {
    const t = groups[0][0];
    const pr = groups.filter((g) => g[0] !== t && g[1] >= 2).sort((a, b) => b[0] - a[0])[0][0];
    return { score: [6, t, pr], name: `Full house, ${RANK_NAME[t]} full of ${RANK_NAME[pr]}` };
  }
  if (flushSuit) {
    const top = bySuit[flushSuit].sort((a, b) => b - a).slice(0, 5);
    return { score: [5, ...top], name: "Flush" };
  }
  const st = straightHigh(vals);
  if (st) return { score: [4, st], name: "Straight" };
  if (groups[0][1] === 3) {
    const t = groups[0][0];
    return { score: [3, t, ...kick([t], 2)], name: `Three ${RANK_NAME[t]}` };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const [a, b] = [groups[0][0], groups[1][0]].sort((x, y) => y - x);
    return { score: [2, a, b, ...kick([a, b], 1)], name: `Two pair, ${RANK_NAME[a]} and ${RANK_NAME[b]}` };
  }
  if (groups[0][1] === 2) {
    const pr = groups[0][0];
    return { score: [1, pr, ...kick([pr], 3)], name: `Pair of ${RANK_NAME[pr]}` };
  }
  return { score: [0, ...vals.slice(0, 5)], name: `${NAMES[0]}, ${RANK_NAME[vals[0]].replace(/s$/, "")}` };
}

export function compare(a: number[], b: number[]) {
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Take a seat at a table that hasn't started yet. */
export function joinPoker(prev: PokerState, p: PokerPlayer): PokerState | null {
  if (prev.phase !== "lobby") return null;
  if (prev.seats.some((x) => x.id === p.id)) return null;
  if (prev.seats.length >= prev.maxSeats) return null;
  const s: PokerState = structuredClone(prev);
  s.seats.push(seatOf(p, s.startStack));
  s.joined = [...(s.joined ?? []), p.id];
  return s;
}

/** Leave before the game starts. */
export function standUp(prev: PokerState, id: string): PokerState {
  const s: PokerState = structuredClone(prev);
  s.seats = s.seats.filter((x) => x.id !== id);
  s.joined = (s.joined ?? []).filter((x) => x !== id);
  return s;
}

/** The host deals the first hand (needs 2+ seated). */
export function beginPoker(prev: PokerState): PokerState | null {
  if (prev.phase !== "lobby" || prev.seats.length < 2) return null;
  return startHand({ ...prev, dealer: Math.floor(Math.random() * prev.seats.length) });
}

/** Someone's taking too long: fold them (anyone at the table can do it after a while). */
export const TURN_MS = 60_000;
export function foldAway(prev: PokerState): PokerState | null {
  if (prev.phase !== "betting" || Date.now() - prev.turnAt < TURN_MS) return null;
  const o = options(prev);
  return act(prev, prev.toAct, o.canCheck ? { type: "check" } : { type: "fold" });
}
