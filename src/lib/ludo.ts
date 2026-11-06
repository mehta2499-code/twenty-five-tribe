/**
 * Ludo — the rules engine. Pure functions, no UI.
 *
 * - 2 to 4 players, 4 tokens each, 52-square loop, clockwise.
 * - Roll a 6 to bring a token out onto your start square.
 * - A 6 rolls again. Three 6s in a row and your turn ends.
 * - Land on an opponent (not on a safe square) and they go back to base;
 *   you roll again. Reaching home also rolls again.
 * - After 50 squares a token turns into its home column; it needs the exact
 *   roll to reach home. First to get all 4 tokens home wins.
 *
 * Token position, counted from the owner's start square:
 *   -1 = in base, 0..50 = main loop, 51..55 = home column, 56 = home.
 */

export type LudoColor = "red" | "green" | "yellow" | "blue";

export type LudoPlayer = {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color: LudoColor;
  /** Played by the host's phone. */
  bot?: boolean;
  /** Resigned: no longer plays, pawns off the board. */
  out?: boolean;
};

export type LudoState = {
  players: LudoPlayer[];
  tokens: number[][]; // [player][token]
  turn: number;
  dice: number | null;
  /** "lobby": waiting for players to join. "roll": waiting for the dice. "move": pick a token. */
  phase: "lobby" | "roll" | "move" | "over";
  /** Online games: who has opened the game (the lobby waits for everyone). */
  joined?: string[];
  sixes: number;
  winner?: number;
  /** Last thing that happened, for the screen. */
  last?: { player: number; dice: number; token?: number; captured?: boolean; note?: string };
  turnStartedAt: number;
};

export const HOME = 56;
export const LOOP = 52;
export const START: Record<LudoColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
/** Start squares and the star squares 8 ahead of each. */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const COLORS_FOR: Record<number, LudoColor[]> = {
  2: ["red", "yellow"],
  3: ["red", "green", "yellow"],
  4: ["red", "green", "yellow", "blue"],
};

export const COLOR_HEX: Record<LudoColor, string> = {
  red: "#E5486F",
  green: "#8FD05A",
  yellow: "#E8BE55",
  blue: "#63B8E6",
};

/** Square on the shared loop, or null when in base / home column / home. */
export function absOf(color: LudoColor, rel: number) {
  if (rel < 0 || rel > 50) return null;
  return (START[color] + rel) % LOOP;
}

export function newLudo(
  players: Omit<LudoPlayer, "color">[],
  opts: { lobby?: boolean } = {},
): LudoState {
  if (players.length < 2 || players.length > 4) throw new Error("Ludo needs 2 to 4 players.");
  const colors = COLORS_FOR[players.length];
  return {
    players: players.map((p, i) => ({ ...p, color: colors[i] })),
    tokens: players.map(() => [-1, -1, -1, -1]),
    turn: 0,
    dice: null,
    phase: opts.lobby ? "lobby" : "roll",
    joined: opts.lobby ? [players[0].id] : undefined,
    sixes: 0,
    turnStartedAt: Date.now(),
  };
}

/** Where a token would land with this roll, or null if it can't move. */
export function target(rel: number, dice: number): number | null {
  if (rel === HOME) return null;
  if (rel === -1) return dice === 6 ? 0 : null;
  const to = rel + dice;
  return to > HOME ? null : to;
}

export function legalTokens(s: LudoState): number[] {
  if (s.phase !== "move" || s.dice == null) return [];
  return s.tokens[s.turn]
    .map((rel, i) => (target(rel, s.dice!) === null ? -1 : i))
    .filter((i) => i >= 0);
}

/** Next player who's still in the game. */
function nextActive(s: LudoState, from: number) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (!s.players[i].out) return i;
  }
  return from;
}

function nextTurn(s: LudoState): LudoState {
  return {
    ...s,
    turn: nextActive(s, s.turn),
    dice: null,
    phase: "roll",
    sixes: 0,
    turnStartedAt: Date.now(),
  };
}

/** Roll the dice for whoever's turn it is. */
export function roll(s: LudoState, rand: () => number = Math.random): LudoState {
  if (s.phase !== "roll") return s;
  const dice = 1 + Math.floor(rand() * 6);
  const sixes = dice === 6 ? s.sixes + 1 : 0;
  if (sixes === 3) {
    return nextTurn({ ...s, last: { player: s.turn, dice, note: "Three 6s. Turn over" } });
  }
  const rolled: LudoState = { ...s, dice, sixes, phase: "move", last: { player: s.turn, dice } };
  if (legalTokens(rolled).length === 0) {
    return nextTurn({ ...rolled, last: { player: s.turn, dice, note: "No moves" } });
  }
  return rolled;
}

/** Move one of the current player's tokens by the rolled amount. */
export function moveToken(s: LudoState, token: number): LudoState {
  if (s.phase !== "move" || s.dice == null) return s;
  const me = s.turn;
  const color = s.players[me].color;
  const to = target(s.tokens[me][token], s.dice);
  if (to === null) return s;

  const tokens = s.tokens.map((t) => [...t]);
  tokens[me][token] = to;

  // Captures: anyone else on the same loop square, unless it's safe.
  let captured = false;
  const sq = absOf(color, to);
  if (sq !== null && !SAFE.has(sq)) {
    s.players.forEach((p, pi) => {
      if (pi === me) return;
      tokens[pi] = tokens[pi].map((rel) => {
        if (absOf(p.color, rel) === sq) {
          captured = true;
          return -1;
        }
        return rel;
      });
    });
  }

  const last = { player: me, dice: s.dice, token, captured };
  if (tokens[me].every((rel) => rel === HOME)) {
    return { ...s, tokens, dice: null, phase: "over", winner: me, last };
  }
  const again = s.dice === 6 || captured || to === HOME;
  const moved: LudoState = { ...s, tokens, last };
  return again
    ? { ...moved, dice: null, phase: "roll", turnStartedAt: Date.now() }
    : nextTurn(moved);
}

/** Humans who still need to open the game. */
export const waitingFor = (s: LudoState) =>
  s.players.filter((p) => !p.bot && !(s.joined ?? []).includes(p.id));

export function joinLudo(s: LudoState, id: string): LudoState {
  if (s.phase !== "lobby" || (s.joined ?? []).includes(id)) return s;
  return { ...s, joined: [...(s.joined ?? []), id] };
}

/** Start from the lobby. Anyone who didn't show up is played by a bot. */
export function beginLudo(s: LudoState): LudoState {
  if (s.phase !== "lobby") return s;
  const joined = s.joined ?? [];
  return {
    ...s,
    players: s.players.map((p) =>
      p.bot || joined.includes(p.id)
        ? p
        : { ...p, bot: true, name: `${p.name.split(" ")[0]} (bot)` },
    ),
    phase: "roll",
    turnStartedAt: Date.now(),
  };
}

/** Resign: you're out, pawns off the board. Last one standing (or the
 *  furthest-ahead player once no humans are left) wins. */
export function resign(s: LudoState, player: number): LudoState {
  if (s.phase === "over" || s.players[player]?.out) return s;
  const players = s.players.map((p, i) => (i === player ? { ...p, out: true } : p));
  const tokens = s.tokens.map((row, i) => (i === player ? row.map(() => -1) : row));
  const name = s.players[player].name.split(" ")[0];
  let next: LudoState = {
    ...s,
    players,
    tokens,
    last: { player, dice: 0, note: `${name} resigned` },
  };
  const active = players.map((p, i) => i).filter((i) => !players[i].out);
  const humans = active.filter((i) => !players[i].bot);
  // Only one person (or nobody) left: the game ends.
  if (active.length <= 1 || humans.length <= 1) {
    const progress = (i: number) => tokens[i].reduce((a, r) => a + Math.max(0, r + 1), 0);
    const winner = active.sort((a, b) => progress(b) - progress(a))[0] ?? 0;
    return { ...next, phase: "over", winner, dice: null };
  }
  if (s.turn === player) next = nextTurn(next);
  return next;
}

/** Leave the waiting room. Returns null when too few people are left to play. */
export function leaveLobby(s: LudoState, id: string): LudoState | null {
  if (s.phase !== "lobby") return s;
  const keep = s.players.map((p, i) => i).filter((i) => s.players[i].id !== id);
  const players = keep.map((i) => s.players[i]);
  if (players.filter((p) => !p.bot).length <= 1 || players.length < 2) return null;
  return {
    ...s,
    players,
    tokens: keep.map((i) => s.tokens[i]),
    joined: (s.joined ?? []).filter((j) => j !== id),
  };
}

/** The phone that plays the bots: the first human still in the game. */
export const ludoDriver = (s: LudoState) =>
  s.players.find((p) => !p.bot && !p.out && (s.phase !== "lobby" || (s.joined ?? []).includes(p.id)))?.id;

/** Skip a player who's gone quiet (anyone can do it after the wait). */
export const IDLE_MS = 60_000;
export function skipTurn(s: LudoState): LudoState {
  if (s.phase === "over" || s.phase === "lobby") return s;
  return nextTurn({ ...s, last: { player: s.turn, dice: 0, note: "Skipped (too slow)" } });
}

/** Simple pick for tests: furthest-ahead token. */
export function autoPick(s: LudoState): number {
  const legal = legalTokens(s);
  return legal.sort((a, b) => s.tokens[s.turn][b] - s.tokens[s.turn][a])[0];
}

/** Would an opponent be able to land on this loop square with one roll (1-6)? */
function threatened(s: LudoState, me: number, sq: number) {
  if (SAFE.has(sq)) return false;
  return s.players.some((p, pi) => {
    if (pi === me) return false;
    return s.tokens[pi].some((rel) => {
      const from = absOf(p.color, rel);
      if (from === null) return false;
      const gap = (sq - from + LOOP) % LOOP;
      return gap >= 1 && gap <= 6;
    });
  });
}

/** Bot choice: capture > finish > leave base > reach safety > escape danger > furthest. */
export function botPick(s: LudoState): number {
  const me = s.turn;
  const color = s.players[me].color;
  const legal = legalTokens(s);
  let best = legal[0];
  let bestScore = -Infinity;
  for (const t of legal) {
    const from = s.tokens[me][t];
    const to = target(from, s.dice!)!;
    const sq = absOf(color, to);
    let score = to / 10;
    if (sq !== null && !SAFE.has(sq)) {
      const hits = s.players.some(
        (p, pi) => pi !== me && s.tokens[pi].some((rel) => absOf(p.color, rel) === sq),
      );
      if (hits) score += 100;
    }
    if (to === HOME) score += 80;
    if (from === -1) score += 60;
    if (to > 50) score += 30; // safe in the home column
    if (sq !== null && SAFE.has(sq)) score += 20;
    const fromSq = absOf(color, from);
    if (fromSq !== null && threatened(s, me, fromSq)) score += 25;
    if (sq !== null && threatened(s, me, sq)) score -= 30;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
