/**
 * Chess rules and a small bot. The board is 64 squares, a8 = 0 … h1 = 63
 * (FEN order). White pieces are upper case (PNBRQK), black lower case, "."
 * is empty. Everything is plain JSON so a game can be saved and shared.
 */

export type Color = "w" | "b";
export type Move = { from: number; to: number; promo?: string; castle?: "K" | "Q"; ep?: boolean };
export type ChessState = {
  board: string; // 64 chars
  turn: Color;
  castling: string; // subset of "KQkq", "" for none
  ep: number; // en passant target square, -1 if none
  half: number; // halfmove clock (50-move rule)
  full: number;
  /** Moves so far, in SAN ("e4", "Nxf3+", "O-O"). */
  san: string[];
  last?: [number, number];
  /** Position keys seen, for threefold repetition. */
  seen: Record<string, number>;
  result?: { winner: Color | null; reason: Reason };
  /** Who plays which side (user ids; "bot" for the computer). */
  white: string;
  black: string;
  /** Bot strength when one side is the computer. */
  level?: 1 | 2 | 3;
  /** Offered a draw (the colour that offered). */
  drawOffer?: Color;
};
export type Reason =
  | "checkmate"
  | "stalemate"
  | "resign"
  | "repetition"
  | "fifty"
  | "material"
  | "agreed"
  | "timeout"
  | "left";

const START = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
export const FILES = "abcdefgh";
export const sqName = (i: number) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;
export const colorOf = (p: string): Color | null => (p === "." ? null : p === p.toUpperCase() ? "w" : "b");
const other = (c: Color): Color => (c === "w" ? "b" : "w");
const fileOf = (i: number) => i % 8;
const rankOf = (i: number) => Math.floor(i / 8); // 0 = rank 8

export function newChess(white: string, black: string, level?: 1 | 2 | 3): ChessState {
  const s: ChessState = {
    board: START,
    turn: "w",
    castling: "KQkq",
    ep: -1,
    half: 0,
    full: 1,
    san: [],
    seen: {},
    white,
    black,
    level,
  };
  s.seen[key(s)] = 1;
  return s;
}

const key = (s: Pick<ChessState, "board" | "turn" | "castling" | "ep">) =>
  `${s.board}${s.turn}${s.castling}${s.ep}`;

// ---------- Attacks ----------
const KNIGHT = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KING = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const at = (r: number, f: number) => (r >= 0 && r < 8 && f >= 0 && f < 8 ? r * 8 + f : -1);

/** Is square `sq` attacked by side `by`? */
export function attacked(board: string, sq: number, by: Color): boolean {
  const r = rankOf(sq);
  const f = fileOf(sq);
  const own = (p: string, t: string) => p === (by === "w" ? t.toUpperCase() : t);
  // Pawns: a white pawn attacks up (towards rank index - 1).
  const pr = by === "w" ? r + 1 : r - 1;
  for (const df of [-1, 1]) {
    const i = at(pr, f + df);
    if (i >= 0 && own(board[i], "p")) return true;
  }
  for (const [dr, df] of KNIGHT) {
    const i = at(r + dr, f + df);
    if (i >= 0 && own(board[i], "n")) return true;
  }
  for (const [dr, df] of KING) {
    const i = at(r + dr, f + df);
    if (i >= 0 && own(board[i], "k")) return true;
  }
  for (const [dirs, a, b] of [
    [ROOK_DIRS, "r", "q"],
    [BISHOP_DIRS, "b", "q"],
  ] as const) {
    for (const [dr, df] of dirs) {
      let rr = r + dr;
      let ff = f + df;
      while (true) {
        const i = at(rr, ff);
        if (i < 0) break;
        const p = board[i];
        if (p !== ".") {
          if (own(p, a) || own(p, b)) return true;
          break;
        }
        rr += dr;
        ff += df;
      }
    }
  }
  return false;
}

export const kingSquare = (board: string, c: Color) => board.indexOf(c === "w" ? "K" : "k");
export const inCheck = (s: Pick<ChessState, "board" | "turn">, c: Color = s.turn) =>
  attacked(s.board, kingSquare(s.board, c), other(c));

// ---------- Move generation ----------
function pseudo(s: ChessState): Move[] {
  const out: Move[] = [];
  const { board, turn } = s;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (colorOf(p) !== turn) continue;
    const t = p.toLowerCase();
    const r = rankOf(i);
    const f = fileOf(i);
    const add = (to: number) => {
      const target = board[to];
      if (target !== "." && colorOf(target) === turn) return false;
      out.push({ from: i, to });
      return target === ".";
    };
    if (t === "p") {
      const dir = turn === "w" ? -1 : 1;
      const startRank = turn === "w" ? 6 : 1;
      const lastRank = turn === "w" ? 0 : 7;
      const push = (to: number) => {
        if (rankOf(to) === lastRank) for (const q of "qrbn") out.push({ from: i, to, promo: q });
        else out.push({ from: i, to });
      };
      const one = at(r + dir, f);
      if (one >= 0 && board[one] === ".") {
        push(one);
        const two = at(r + 2 * dir, f);
        if (r === startRank && board[two] === ".") out.push({ from: i, to: two });
      }
      for (const df of [-1, 1]) {
        const to = at(r + dir, f + df);
        if (to < 0) continue;
        if (board[to] !== "." && colorOf(board[to]) !== turn) push(to);
        else if (to === s.ep) out.push({ from: i, to, ep: true });
      }
    } else if (t === "n" || t === "k") {
      for (const [dr, df] of t === "n" ? KNIGHT : KING) {
        const to = at(r + dr, f + df);
        if (to >= 0) add(to);
      }
      if (t === "k") {
        // Castling: king and rook unmoved, squares between empty, not through check.
        const home = turn === "w" ? 60 : 4;
        const enemy = other(turn);
        if (i === home && !attacked(board, home, enemy)) {
          const K = turn === "w" ? "K" : "k";
          const Q = turn === "w" ? "Q" : "q";
          if (
            s.castling.includes(K) &&
            board[home + 1] === "." &&
            board[home + 2] === "." &&
            board[home + 3] === (turn === "w" ? "R" : "r") &&
            !attacked(board, home + 1, enemy) &&
            !attacked(board, home + 2, enemy)
          )
            out.push({ from: i, to: home + 2, castle: "K" });
          if (
            s.castling.includes(Q) &&
            board[home - 1] === "." &&
            board[home - 2] === "." &&
            board[home - 3] === "." &&
            board[home - 4] === (turn === "w" ? "R" : "r") &&
            !attacked(board, home - 1, enemy) &&
            !attacked(board, home - 2, enemy)
          )
            out.push({ from: i, to: home - 2, castle: "Q" });
        }
      }
    } else {
      const dirs = t === "r" ? ROOK_DIRS : t === "b" ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
      for (const [dr, df] of dirs) {
        let rr = r + dr;
        let ff = f + df;
        while (true) {
          const to = at(rr, ff);
          if (to < 0 || !add(to)) break;
          rr += dr;
          ff += df;
        }
      }
    }
  }
  return out;
}

/** Board after a move (no legality checks, no history). */
function play(s: ChessState, m: Move): ChessState {
  const b = s.board.split("");
  const p = b[m.from];
  const t = p.toLowerCase();
  const captured = b[m.to] !== "." || !!m.ep;
  b[m.to] = m.promo ? (s.turn === "w" ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = ".";
  if (m.ep) b[m.to + (s.turn === "w" ? 8 : -8)] = ".";
  if (m.castle) {
    const home = s.turn === "w" ? 60 : 4;
    if (m.castle === "K") {
      b[home + 1] = b[home + 3];
      b[home + 3] = ".";
    } else {
      b[home - 1] = b[home - 4];
      b[home - 4] = ".";
    }
  }
  let castling = s.castling;
  const strip = (c: string) => (castling = castling.replace(c, ""));
  if (p === "K") (strip("K"), strip("Q"));
  if (p === "k") (strip("k"), strip("q"));
  for (const [sq, c] of [
    [63, "K"],
    [56, "Q"],
    [7, "k"],
    [0, "q"],
  ] as const)
    if (m.from === sq || m.to === sq) strip(c);
  const ep = t === "p" && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return {
    ...s,
    board: b.join(""),
    turn: other(s.turn),
    castling,
    ep,
    half: t === "p" || captured ? 0 : s.half + 1,
    full: s.turn === "b" ? s.full + 1 : s.full,
  };
}

/** All legal moves for the side to move. */
export function legalMoves(s: ChessState): Move[] {
  return pseudo(s).filter((m) => !inCheck(play(s, m), s.turn));
}

// ---------- SAN ----------
function san(s: ChessState, m: Move, all: Move[]): string {
  const p = s.board[m.from];
  const t = p.toLowerCase();
  let out: string;
  if (m.castle) out = m.castle === "K" ? "O-O" : "O-O-O";
  else {
    const capture = s.board[m.to] !== "." || m.ep;
    if (t === "p") {
      out = (capture ? `${FILES[fileOf(m.from)]}x` : "") + sqName(m.to);
      if (m.promo) out += `=${m.promo.toUpperCase()}`;
    } else {
      // Disambiguate when two of the same piece can reach the square.
      const twins = all.filter(
        (o) => o.to === m.to && o.from !== m.from && s.board[o.from] === p,
      );
      let dis = "";
      if (twins.length) {
        const sameFile = twins.some((o) => fileOf(o.from) === fileOf(m.from));
        const sameRank = twins.some((o) => rankOf(o.from) === rankOf(m.from));
        if (!sameFile) dis = FILES[fileOf(m.from)];
        else if (!sameRank) dis = String(8 - rankOf(m.from));
        else dis = sqName(m.from);
      }
      out = t.toUpperCase() + dis + (capture ? "x" : "") + sqName(m.to);
    }
  }
  const next = play(s, m);
  if (inCheck(next)) out += legalMoves(next).length ? "+" : "#";
  return out;
}

// ---------- Playing a move ----------
function insufficient(board: string) {
  const left = board.replace(/[.kK]/g, "");
  if (!left) return true;
  if (left.length === 1 && /[nNbB]/.test(left)) return true;
  return false;
}

/** Make a legal move (null if it isn't legal). Ends the game when it should. */
export function makeMove(s: ChessState, m: Move): ChessState | null {
  if (s.result) return null;
  const all = legalMoves(s);
  const legal = all.find(
    (o) => o.from === m.from && o.to === m.to && (o.promo ?? "") === (m.promo ?? (o.promo ? "q" : "")),
  );
  if (!legal) return null;
  const note = san(s, legal, all);
  const next = play(s, legal);
  const k = key(next);
  const seen = { ...s.seen, [k]: (s.seen[k] ?? 0) + 1 };
  const out: ChessState = {
    ...next,
    san: [...s.san, note],
    last: [legal.from, legal.to],
    seen,
    drawOffer: undefined,
  };
  const replies = legalMoves(out);
  if (!replies.length)
    out.result = inCheck(out)
      ? { winner: s.turn, reason: "checkmate" }
      : { winner: null, reason: "stalemate" };
  else if (seen[k] >= 3) out.result = { winner: null, reason: "repetition" };
  else if (out.half >= 100) out.result = { winner: null, reason: "fifty" };
  else if (insufficient(out.board)) out.result = { winner: null, reason: "material" };
  return out;
}

export const resign = (s: ChessState, who: Color): ChessState => ({
  ...s,
  result: { winner: other(who), reason: "resign" },
});

/** Captured pieces for each side (what's missing from the board), and material lead. */
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function captured(board: string) {
  const full = "ppppppppnnbbrrq";
  const count = (s: string, c: string) => s.split("").filter((x) => x === c).length;
  const lost = (c: Color) => {
    const out: string[] = [];
    for (const t of "qrbnp") {
      const want = count(full, t);
      const have = count(board, c === "w" ? t.toUpperCase() : t);
      for (let k = have; k < want; k++) out.push(c === "w" ? t.toUpperCase() : t);
    }
    return out;
  };
  const material = (c: Color) =>
    board
      .split("")
      .filter((p) => colorOf(p) === c)
      .reduce((a, p) => a + VALUE[p.toLowerCase()], 0);
  // White took black's pieces, and the other way round.
  return { byWhite: lost("b"), byBlack: lost("w"), lead: material("w") - material("b") };
}

// ---------- Bot ----------
// Piece-square tables (white's view, a8 first), small nudges towards good squares.
const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5,
    10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20,
    -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10,
    0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10,
    5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
    -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10,
    -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
    0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0,
    0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0,
    0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
    -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
    -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
    10, 30, 20,
  ],
};
const PIECE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 } as Record<string, number>;

/** Score from white's point of view (centipawns). */
function evaluate(board: string) {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === ".") continue;
    const t = p.toLowerCase();
    if (p === t) v -= PIECE[t] + PST[t][(7 - rankOf(i)) * 8 + fileOf(i)];
    else v += PIECE[t] + PST[t][i];
  }
  return v;
}

function order(s: ChessState, moves: Move[]) {
  const score = (m: Move) => {
    const victim = s.board[m.to];
    return (victim !== "." ? PIECE[victim.toLowerCase()] * 10 - PIECE[s.board[m.from].toLowerCase()] : 0) +
      (m.promo === "q" ? 800 : 0);
  };
  return moves.sort((a, b) => score(b) - score(a));
}

function search(s: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(s);
  if (!moves.length) return inCheck(s) ? -100000 - depth : 0;
  if (depth === 0) return (s.turn === "w" ? 1 : -1) * evaluate(s.board);
  for (const m of order(s, moves)) {
    const v = -search(play(s, m), depth - 1, -beta, -alpha);
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return alpha;
}

/** The computer's move. Level 1 is forgiving (and a bit random); 3 thinks ahead. */
export function botMove(s: ChessState, level: 1 | 2 | 3 = 2): Move | null {
  const moves = legalMoves(s);
  if (!moves.length) return null;
  const depth = level === 1 ? 1 : level === 2 ? 2 : 3;
  let best: Move[] = [];
  let bestV = -Infinity;
  for (const m of order(s, moves)) {
    let v = -search(play(s, m), depth - 1, -Infinity, Infinity);
    if (level === 1) v += Math.random() * 120; // easy: makes human mistakes
    else v += Math.random() * 8; // a little variety
    if (v > bestV + 0.0001) {
      bestV = v;
      best = [m];
    }
  }
  const m = best[0];
  return m.promo ? { ...m, promo: "q" } : m;
}

/** For tests: count leaf nodes. */
export function perft(s: ChessState, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(s)) n += depth === 1 ? 1 : perft(play(s, m), depth - 1);
  return n;
}

/** Load a FEN (tests). */
export function fromFen(fen: string): ChessState {
  const [pos, turn, castling, ep] = fen.split(" ");
  const board = pos
    .split("/")
    .map((row) => row.replace(/\d/g, (d) => ".".repeat(Number(d))))
    .join("");
  const epSq = ep === "-" ? -1 : FILES.indexOf(ep[0]) + (8 - Number(ep[1])) * 8;
  return {
    board,
    turn: turn as Color,
    castling: castling === "-" ? "" : castling,
    ep: epSq,
    half: 0,
    full: 1,
    san: [],
    seen: {},
    white: "w",
    black: "b",
  };
}
