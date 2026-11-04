/**
 * Kachuful (Judgement) — the rules engine. Pure functions, no UI.
 *
 * - 3 to 7 players, one 52-card deck.
 * - Cards per round climb 1, 2, 3 … up to the peak, then come back down to 1.
 * - Trump rotates every round: Spades (Hukum), Diamonds (Eent), Clubs (Chidi), Hearts (Paan).
 * - Bidding starts left of the dealer. The dealer bids last and may not make the
 *   total of all bids equal the cards in hand, so someone always misses.
 * - Follow suit if you can. Otherwise trump or throw anything. Highest trump wins,
 *   else the highest card of the suit that was led. The trick winner leads next.
 * - Win exactly what you bid: 10 + bid points. Miss by any amount: 0.
 */

export type Suit = "S" | "D" | "C" | "H";
/** A card is suit + rank, e.g. "S14" = ace of spades, "H10" = ten of hearts. */
export type Card = string;

export type Seat = {
  id: string;
  name: string;
  bot: boolean;
  avatar?: string;
  initials: string;
  color?: string;
};

export type TrickCard = { seat: number; card: Card };

export type KState = {
  seats: Seat[];
  plan: number[]; // cards dealt in each round
  round: number;
  dealer: number;
  trump: Suit;
  hands: Card[][];
  bids: (number | null)[];
  won: number[];
  trick: TrickCard[];
  turn: number;
  phase: "bidding" | "playing" | "roundEnd" | "over";
  scores: number[][]; // points per round per seat
  lastTrick?: { cards: TrickCard[]; winner: number };
};

export const TRUMP_ORDER: Suit[] = ["S", "D", "C", "H"];
export const SUIT_NAME: Record<Suit, string> = { S: "Hukum", D: "Eent", C: "Chidi", H: "Paan" };
export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", D: "♦", C: "♣", H: "♥" };
export const isRed = (s: Suit) => s === "D" || s === "H";

export const suitOf = (c: Card) => c[0] as Suit;
export const rankOf = (c: Card) => Number(c.slice(1));
export const rankLabel = (r: number) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[r] ?? String(r);

export function peakFor(players: number, length: "short" | "full") {
  const most = Math.floor(52 / players);
  return Math.min(length === "short" ? 5 : 8, most);
}

/** 1, 2 … peak … 2, 1 */
export function roundPlan(players: number, length: "short" | "full") {
  const peak = peakFor(players, length);
  const up = Array.from({ length: peak }, (_, i) => i + 1);
  return [...up, ...up.slice(0, -1).reverse()];
}

function shuffledDeck(rand: () => number = Math.random): Card[] {
  const deck: Card[] = [];
  for (const s of TRUMP_ORDER) for (let r = 2; r <= 14; r++) deck.push(`${s}${r}`);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Sort a hand by suit (trump first), then high to low. */
export function sortHand(hand: Card[], trump: Suit) {
  const order = [trump, ...TRUMP_ORDER.filter((s) => s !== trump)];
  return [...hand].sort(
    (a, b) => order.indexOf(suitOf(a)) - order.indexOf(suitOf(b)) || rankOf(b) - rankOf(a),
  );
}

function dealRound(s: KState, rand?: () => number): KState {
  const n = s.seats.length;
  const cards = s.plan[s.round];
  const deck = shuffledDeck(rand);
  const trump = TRUMP_ORDER[s.round % TRUMP_ORDER.length];
  const hands = s.seats.map((_, i) => sortHand(deck.slice(i * cards, i * cards + cards), trump));
  return {
    ...s,
    trump,
    hands,
    bids: Array(n).fill(null),
    won: Array(n).fill(0),
    trick: [],
    lastTrick: undefined,
    turn: (s.dealer + 1) % n,
    phase: "bidding",
  };
}

export function newGame(
  seats: Seat[],
  length: "short" | "full" = "short",
  rand?: () => number,
): KState {
  if (seats.length < 3 || seats.length > 7) throw new Error("Kachuful needs 3 to 7 players.");
  const base: KState = {
    seats,
    plan: roundPlan(seats.length, length),
    round: 0,
    dealer: 0,
    trump: "S",
    hands: [],
    bids: [],
    won: [],
    trick: [],
    turn: 1,
    phase: "bidding",
    scores: [],
  };
  return dealRound(base, rand);
}

export const cardsThisRound = (s: KState) => s.plan[s.round];

/** Bids the player whose turn it is may make. */
export function bidOptions(s: KState): number[] {
  const n = cardsThisRound(s);
  const all = Array.from({ length: n + 1 }, (_, i) => i);
  if (s.turn !== s.dealer) return all;
  const sum = s.bids.reduce<number>((a, b) => a + (b ?? 0), 0);
  return all.filter((b) => sum + b !== n);
}

/** The one bid the dealer can't make this round, if any. */
export function forbiddenBid(s: KState): number | null {
  if (s.turn !== s.dealer) return null;
  const n = cardsThisRound(s);
  const sum = s.bids.reduce<number>((a, b) => a + (b ?? 0), 0);
  const f = n - sum;
  return f >= 0 && f <= n ? f : null;
}

export function placeBid(s: KState, seat: number, bid: number): KState {
  if (s.phase !== "bidding" || seat !== s.turn) throw new Error("It's not your turn to bid.");
  if (!bidOptions(s).includes(bid))
    throw new Error("The dealer can't make the bids add up to the cards in hand.");
  const bids = [...s.bids];
  bids[seat] = bid;
  const n = s.seats.length;
  const done = bids.every((b) => b !== null);
  return {
    ...s,
    bids,
    turn: done ? (s.dealer + 1) % n : (seat + 1) % n,
    phase: done ? "playing" : "bidding",
  };
}

export function ledSuit(s: KState): Suit | null {
  return s.trick.length ? suitOf(s.trick[0].card) : null;
}

/** Cards this seat may play right now. */
export function legalCards(s: KState, seat: number): Card[] {
  const hand = s.hands[seat] ?? [];
  const led = ledSuit(s);
  if (!led) return hand;
  const follow = hand.filter((c) => suitOf(c) === led);
  return follow.length ? follow : hand;
}

export function trickWinner(trick: TrickCard[], trump: Suit): number {
  const led = suitOf(trick[0].card);
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const bs = suitOf(best.card);
    const ts = suitOf(t.card);
    if (ts === bs && rankOf(t.card) > rankOf(best.card)) best = t;
    else if (ts === trump && bs !== trump) best = t;
    else if (ts === led && bs !== trump && bs !== led) best = t;
  }
  return best.seat;
}

export function playCard(s: KState, seat: number, card: Card): KState {
  if (s.phase !== "playing" || seat !== s.turn) throw new Error("It's not your turn.");
  if (!legalCards(s, seat).includes(card))
    throw new Error("You have to follow the suit that was led.");
  const n = s.seats.length;
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h));
  const trick = [...s.trick, { seat, card }];
  if (trick.length < n) return { ...s, hands, trick, turn: (seat + 1) % n };

  const winner = trickWinner(trick, s.trump);
  const won = s.won.map((w, i) => (i === winner ? w + 1 : w));
  const roundOver = hands.every((h) => h.length === 0);
  if (!roundOver)
    return { ...s, hands, trick: [], won, turn: winner, lastTrick: { cards: trick, winner } };

  const points = s.bids.map((b, i) => (b === won[i] ? 10 + (b ?? 0) : 0));
  return {
    ...s,
    hands,
    trick: [],
    won,
    lastTrick: { cards: trick, winner },
    scores: [...s.scores, points],
    phase: s.round + 1 >= s.plan.length ? "over" : "roundEnd",
  };
}

export function nextRound(s: KState, rand?: () => number): KState {
  if (s.phase !== "roundEnd") return s;
  return dealRound({ ...s, round: s.round + 1, dealer: (s.dealer + 1) % s.seats.length }, rand);
}

export const totals = (s: KState) =>
  s.seats.map((_, i) => s.scores.reduce((a, r) => a + (r[i] ?? 0), 0));

// ---------- Bots ----------
function estimateTricks(hand: Card[], trump: Suit) {
  let est = 0;
  for (const c of hand) {
    const r = rankOf(c);
    if (suitOf(c) === trump) est += r >= 12 ? 1 : r >= 9 ? 0.6 : 0.3;
    else
      est +=
        r === 14
          ? 0.85
          : r === 13
            ? hand.length >= 3
              ? 0.5
              : 0.3
            : r === 12 && hand.length >= 5
              ? 0.25
              : 0;
  }
  return est;
}

export type Move = { type: "bid"; bid: number } | { type: "play"; card: Card };

export function botMove(s: KState): Move {
  const seat = s.turn;
  if (s.phase === "bidding") {
    const want = Math.round(estimateTricks(s.hands[seat], s.trump));
    const options = bidOptions(s);
    const bid = options.reduce(
      (best, b) => (Math.abs(b - want) < Math.abs(best - want) ? b : best),
      options[0],
    );
    return { type: "bid", bid };
  }
  const legal = legalCards(s, seat);
  const need = (s.bids[seat] ?? 0) - s.won[seat];
  const beats = (c: Card) =>
    !s.trick.length || trickWinner([...s.trick, { seat, card: c }], s.trump) === seat;
  const byRank = (a: Card, b: Card) => {
    const tv = (c: Card) => rankOf(c) + (suitOf(c) === s.trump ? 20 : 0);
    return tv(a) - tv(b);
  };
  const sorted = [...legal].sort(byRank);
  if (need > 0) {
    if (!s.trick.length) return { type: "play", card: sorted[sorted.length - 1] };
    const winners = sorted.filter(beats);
    return { type: "play", card: winners[0] ?? sorted[0] };
  }
  // Already made the bid: try not to win more.
  const losers = sorted.filter((c) => !beats(c));
  return { type: "play", card: losers.length ? losers[losers.length - 1] : sorted[0] };
}

export function applyMove(s: KState, move: Move): KState {
  return move.type === "bid" ? placeBid(s, s.turn, move.bid) : playCard(s, s.turn, move.card);
}
