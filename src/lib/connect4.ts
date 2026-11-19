/**
 * Connect 4: 7 columns × 6 rows. Drop a disc into a column; it falls to the
 * lowest free spot. Four in a row (across, down or diagonal) wins. A full
 * board is a draw. Red goes first.
 */
export type Disc = "r" | "y";
export const COLS = 7;
export const ROWS = 6;

export type C4State = {
  /** Who plays which colour (user ids; "me"/"bot" in bot games). */
  red: string;
  yellow: string;
  /** 42 cells, row 0 at the top: "." empty, "r" or "y". */
  board: string;
  turn: Disc;
  moves: number;
  /** The last disc dropped (for the drop animation and highlight). */
  last?: { col: number; row: number };
  result?: {
    winner: Disc | null;
    reason: "four" | "full" | "resign";
    /** The winning four (cell indexes). */
    line?: number[];
  };
  /** Bot difficulty (bot games only). */
  level?: 1 | 2 | 3;
  /**
   * Online games: who has opened it. The game starts once both are in (like
   * Ludo's waiting room). Older games without it just play.
   */
  joined?: string[];
};

/** Both players are in (or it's a bot game / an older game). */
export const c4Started = (s: C4State) => !s.joined || s.joined.length >= 2;

export const at = (col: number, row: number) => row * COLS + col;

export function newConnect4(red: string, yellow: string, level?: 1 | 2 | 3): C4State {
  return { red, yellow, board: ".".repeat(COLS * ROWS), turn: "r", moves: 0, level };
}

/** The row a disc dropped in this column lands on, or -1 if it's full. */
export function landing(board: string, col: number) {
  for (let row = ROWS - 1; row >= 0; row--) if (board[at(col, row)] === ".") return row;
  return -1;
}

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
/** Four in a row through this cell, if any. */
export function fourFrom(board: string, col: number, row: number): number[] | null {
  const d = board[at(col, row)];
  if (d === ".") return null;
  for (const [dc, dr] of DIRS) {
    const line = [at(col, row)];
    for (const s of [1, -1]) {
      let c = col + dc * s;
      let r = row + dr * s;
      while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[at(c, r)] === d) {
        line.push(at(c, r));
        c += dc * s;
        r += dr * s;
      }
    }
    if (line.length >= 4) return line.sort((a, b) => a - b);
  }
  return null;
}

/** Drop the player-to-move's disc in a column. Null if not allowed. */
export function dropDisc(s: C4State, col: number): C4State | null {
  if (s.result || !c4Started(s) || col < 0 || col >= COLS) return null;
  const row = landing(s.board, col);
  if (row < 0) return null;
  const i = at(col, row);
  const board = s.board.slice(0, i) + s.turn + s.board.slice(i + 1);
  const line = fourFrom(board, col, row);
  const moves = s.moves + 1;
  return {
    ...s,
    board,
    moves,
    last: { col, row },
    turn: s.turn === "r" ? "y" : "r",
    result: line
      ? { winner: s.turn, reason: "four", line }
      : moves >= COLS * ROWS
        ? { winner: null, reason: "full" }
        : undefined,
  };
}

export function resignC4(s: C4State, who: Disc): C4State {
  if (s.result) return s;
  return { ...s, result: { winner: who === "r" ? "y" : "r", reason: "resign" } };
}

// ---------- The bot ----------
/** Score a board for `me`: windows of four with more of mine and none of theirs. */
function evaluate(board: string, me: Disc) {
  const them = me === "r" ? "y" : "r";
  let score = 0;
  // Centre column is worth holding.
  for (let r = 0; r < ROWS; r++) if (board[at(3, r)] === me) score += 3;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dc, dr] of DIRS) {
        const ec = c + dc * 3;
        const er = r + dr * 3;
        if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < 4; k++) {
          const v = board[at(c + dc * k, r + dr * k)];
          if (v === me) mine++;
          else if (v === them) theirs++;
        }
        if (theirs === 0) score += mine === 3 ? 5 : mine === 2 ? 2 : 0;
        if (mine === 0) score -= theirs === 3 ? 4 : 0;
      }
  return score;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6];
function minimax(s: C4State, depth: number, alpha: number, beta: number, me: Disc): number {
  if (s.result) {
    if (s.result.winner === null) return 0;
    return s.result.winner === me ? 100_000 + depth : -100_000 - depth;
  }
  if (depth === 0) return evaluate(s.board, me);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const c of ORDER) {
    const n = dropDisc(s, c);
    if (!n) continue;
    const v = minimax(n, depth - 1, alpha, beta, me);
    if (maxing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/** The bot's column. Easy looks 2 moves ahead (and slips), medium 4, hard 6. */
export function botColumn(s: C4State, level: 1 | 2 | 3): number {
  const me = s.turn;
  const open = ORDER.filter((c) => landing(s.board, c) >= 0);
  // Always take a win; always block an obvious one (except easy, sometimes).
  for (const c of open) if (dropDisc(s, c)?.result?.winner === me) return c;
  const blockOdds = level === 1 ? 0.6 : 1;
  for (const c of open) {
    const them = dropDisc({ ...s, turn: me === "r" ? "y" : "r" }, c);
    if (them?.result?.winner && Math.random() < blockOdds) return c;
  }
  if (level === 1 && Math.random() < 0.45) return open[Math.floor(Math.random() * open.length)];
  const depth = level === 1 ? 2 : level === 2 ? 4 : 6;
  let best = open[0];
  let bestV = -Infinity;
  for (const c of open) {
    const v = minimax(dropDisc(s, c)!, depth - 1, -Infinity, Infinity, me) + Math.random() * 0.5;
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}
