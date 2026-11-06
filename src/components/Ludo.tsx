/** Ludo board, dice and lobby. Rules live in lib/ludo.ts. */
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, Sheet, buzz } from "@/components/SocialUI";
import { mutualFriends, useSocial, type Person } from "@/lib/social";
import {
  COLOR_HEX,
  HOME,
  IDLE_MS,
  SAFE,
  START,
  botPick,
  legalTokens,
  moveToken,
  newLudo,
  resign,
  roll,
  skipTurn,
  waitingFor,
  type LudoColor,
  type LudoState,
} from "@/lib/ludo";

export const LUDO_BOT_NAMES = ["Chintu", "Pinky", "Bunty"];
export const ludoBots = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `bot-${i + 1}`,
    name: LUDO_BOT_NAMES[i],
    initials: LUDO_BOT_NAMES[i].slice(0, 2).toUpperCase(),
    bot: true,
  }));

/** Plays the bots' turns (one phone only: the host's). */
export function useLudoBots(
  state: LudoState | null,
  drive: boolean,
  apply: (s: LudoState) => void,
) {
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (!drive || !state || state.phase === "over" || state.phase === "lobby") return;
    const p = state.players[state.turn];
    if (!p?.bot) return;
    const t = setTimeout(
      () =>
        applyRef.current(state.phase === "roll" ? roll(state) : moveToken(state, botPick(state))),
      state.phase === "roll" ? 750 : 550,
    );
    return () => clearTimeout(t);
  }, [state, drive]);
}

/** Solo against bots: lives on this phone only. */
export function LocalLudo({
  me,
  bots,
  onClose,
}: {
  me: { id: string; name: string; avatar?: string; initials: string };
  bots: number;
  onClose: () => void;
}) {
  const fresh = () => newLudo([me, ...ludoBots(bots)]);
  const [state, setState] = useState<LudoState>(fresh);
  useLudoBots(state, true, setState);
  return (
    <LudoTable
      state={state}
      mine={0}
      onRoll={() => setState((s) => roll(s))}
      onMove={(t) => setState((s) => moveToken(s, t))}
      onSkip={() => setState((s) => skipTurn(s))}
      onClose={onClose}
      onPlayAgain={() => setState(fresh())}
      onResign={() => setState((s) => resign(s, 0))}
      solo
    />
  );
}

// ---------- Board geometry (15 × 15 grid; [row, col]) ----------

/** The shared loop, clockwise, starting at red's start square. */
const LOOP_CELLS: [number, number][] = [
  ...[1, 2, 3, 4, 5].map((c) => [6, c] as [number, number]),
  ...[5, 4, 3, 2, 1, 0].map((r) => [r, 6] as [number, number]),
  [0, 7],
  ...[0, 1, 2, 3, 4, 5].map((r) => [r, 8] as [number, number]),
  ...[9, 10, 11, 12, 13, 14].map((c) => [6, c] as [number, number]),
  [7, 14],
  ...[14, 13, 12, 11, 10, 9].map((c) => [8, c] as [number, number]),
  ...[9, 10, 11, 12, 13, 14].map((r) => [r, 8] as [number, number]),
  [14, 7],
  ...[14, 13, 12, 11, 10, 9].map((r) => [r, 6] as [number, number]),
  ...[5, 4, 3, 2, 1, 0].map((c) => [8, c] as [number, number]),
  [7, 0],
  [6, 0],
];

const HOME_COLUMN: Record<LudoColor, [number, number][]> = {
  red: [1, 2, 3, 4, 5].map((c) => [7, c]),
  green: [1, 2, 3, 4, 5].map((r) => [r, 7]),
  yellow: [13, 12, 11, 10, 9].map((c) => [7, c]),
  blue: [13, 12, 11, 10, 9].map((r) => [r, 7]),
};
const YARD_ORIGIN: Record<LudoColor, [number, number]> = {
  red: [0, 0],
  green: [0, 9],
  yellow: [9, 9],
  blue: [9, 0],
};
const HOME_SPOT: Record<LudoColor, [number, number]> = {
  red: [7, 6.3],
  green: [6.3, 7],
  yellow: [7, 7.7],
  blue: [7.7, 7],
};

/** Centre of a token's cell, in grid units (x = col, y = row). */
function tokenXY(color: LudoColor, rel: number, idx: number): [number, number] {
  if (rel === -1) {
    const [r0, c0] = YARD_ORIGIN[color];
    const spots = [
      [1.75, 1.75],
      [1.75, 4.25],
      [4.25, 1.75],
      [4.25, 4.25],
    ];
    return [c0 + spots[idx][1], r0 + spots[idx][0]];
  }
  if (rel === HOME) {
    const [r, c] = HOME_SPOT[color];
    return [c + 0.5, r + 0.5];
  }
  const [r, c] = rel <= 50 ? LOOP_CELLS[(START[color] + rel) % 52] : HOME_COLUMN[color][rel - 51];
  return [c + 0.5, r + 0.5];
}

function Board({
  state,
  mine,
  onToken,
}: {
  state: LudoState;
  mine: number;
  onToken: (i: number) => void;
}) {
  const legal = state.turn === mine ? legalTokens(state) : [];
  const colorOf = (c: LudoColor) => COLOR_HEX[c];
  const used = new Set(state.players.map((p) => p.color));
  const turnColor = state.phase === "over" ? null : state.players[state.turn]?.color;

  // Pawns hop square by square instead of teleporting.
  const [shown, setShown] = useState(state.tokens);
  const shownRef = useRef(state.tokens);
  useEffect(() => {
    const prev = shownRef.current;
    const next = state.tokens;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const STEP = 130;
    const apply = (fn: (cur: number[][]) => void) => {
      const cur = shownRef.current.map((r) => [...r]);
      fn(cur);
      shownRef.current = cur;
      setShown(cur);
    };
    let longest = 0;
    const jumps: { p: number; t: number; to: number }[] = [];
    next.forEach((row, p) =>
      row.forEach((to, t) => {
        const from = prev[p]?.[t] ?? to;
        if (from === to) return;
        if (from >= 0 && to > from && to - from <= 6) {
          const n = to - from;
          longest = Math.max(longest, n);
          for (let i = 1; i <= n; i++)
            timers.push(setTimeout(() => apply((cur) => (cur[p][t] = from + i)), (i - 1) * STEP));
        } else jumps.push({ p, t, to });
      }),
    );
    // Leaving base lands now; getting captured lands after the hops finish.
    for (const j of jumps)
      timers.push(
        setTimeout(
          () => apply((cur) => (cur[j.p][j.t] = j.to)),
          j.to === -1 ? longest * STEP + 60 : 0,
        ),
      );
    timers.push(
      setTimeout(
        () => {
          shownRef.current = next;
          setShown(next);
        },
        longest * STEP + 140,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.tokens]);

  // Spread tokens that share a cell.
  const placed = useMemo(() => {
    const out: { p: number; t: number; x: number; y: number }[] = [];
    const seen = new Map<string, number>();
    state.players.forEach((pl, p) =>
      (pl.out ? [] : (shown[p] ?? state.tokens[p])).forEach((rel, t) => {
        const [x, y] = tokenXY(pl.color, rel, t);
        const key = rel === -1 ? `${p}-${t}` : `${x},${y}`;
        const n = seen.get(key) ?? 0;
        seen.set(key, n + 1);
        const off = n ? [0, 0.22, -0.22, 0][n % 4] : 0;
        out.push({ p, t, x: x + off, y: y + (n ? [0, -0.22, 0.22, 0.22][n % 4] : 0) });
      }),
    );
    return out;
  }, [state.players, state.tokens, shown]);

  return (
    <svg
      viewBox="0 0 15 15"
      className="w-full rounded-2xl"
      style={{ border: "2px solid var(--edge)", background: "#F6F3EA" }}
    >
      <defs>
        {(Object.keys(COLOR_HEX) as LudoColor[]).map((c) => (
          <radialGradient key={c} id={`pawn-${c}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
            <stop offset="35%" stopColor={COLOR_HEX[c]} />
            <stop offset="100%" stopColor={COLOR_HEX[c]} stopOpacity={0.85} />
          </radialGradient>
        ))}
      </defs>
      {/* Yards */}
      {(Object.keys(YARD_ORIGIN) as LudoColor[]).map((c) => {
        const [r, col] = YARD_ORIGIN[c];
        return (
          <g key={c} opacity={used.has(c) ? 1 : 0.35}>
            <rect x={col} y={r} width={6} height={6} fill={colorOf(c)} />
            <rect x={col + 0.8} y={r + 0.8} width={4.4} height={4.4} rx={0.6} fill="#fff" />
            {turnColor === c && (
              <rect
                x={col + 0.15}
                y={r + 0.15}
                width={5.7}
                height={5.7}
                rx={0.4}
                fill="none"
                stroke="#07060B"
                strokeWidth={0.14}
                strokeDasharray="0.5 0.3"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;1.6"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </rect>
            )}
          </g>
        );
      })}
      {/* Loop */}
      {LOOP_CELLS.map(([r, c], i) => {
        const startOf = (Object.keys(START) as LudoColor[]).find((k) => START[k] === i);
        return (
          <g key={i}>
            <rect
              x={c}
              y={r}
              width={1}
              height={1}
              fill={startOf ? colorOf(startOf) : "#fff"}
              stroke="#cfc8b8"
              strokeWidth={0.03}
            />
            {SAFE.has(i) && !startOf && (
              <text x={c + 0.5} y={r + 0.72} fontSize={0.62} textAnchor="middle">
                ⭐
              </text>
            )}
          </g>
        );
      })}
      {/* Home columns */}
      {(Object.keys(HOME_COLUMN) as LudoColor[]).map((c) =>
        HOME_COLUMN[c].map(([r, col], i) => (
          <rect
            key={`${c}${i}`}
            x={col}
            y={r}
            width={1}
            height={1}
            fill={colorOf(c)}
            stroke="#cfc8b8"
            strokeWidth={0.03}
          />
        )),
      )}
      {/* Centre */}
      <polygon points="6,6 9,6 7.5,7.5" fill={colorOf("green")} />
      <polygon points="9,6 9,9 7.5,7.5" fill={colorOf("yellow")} />
      <polygon points="9,9 6,9 7.5,7.5" fill={colorOf("blue")} />
      <polygon points="6,9 6,6 7.5,7.5" fill={colorOf("red")} />
      {/* Tokens */}
      {placed.map(({ p, t, x, y }) => {
        const pl = state.players[p];
        const canMove = p === mine && legal.includes(t);
        return (
          <g
            key={`${p}-${t}`}
            style={{
              transition: "transform 120ms ease-out",
              transform: `translate(${x}px, ${y}px)`,
              cursor: canMove ? "pointer" : "default",
            }}
            onClick={() => canMove && onToken(t)}
          >
            {canMove && (
              <circle r={0.5} fill="none" stroke="#07060B" strokeWidth={0.1}>
                <animate
                  attributeName="r"
                  values="0.44;0.62;0.44"
                  dur="1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0.35;1"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <ellipse cx={0.04} cy={0.3} rx={0.32} ry={0.12} fill="#07060B" opacity={0.25} />
            <circle r={0.38} fill={`url(#pawn-${pl.color})`} stroke="#07060B" strokeWidth={0.07} />
            <circle cx={-0.11} cy={-0.12} r={0.11} fill="#fff" opacity={0.75} />
          </g>
        );
      })}
    </svg>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 25],
    [72, 25],
    [28, 50],
    [72, 50],
    [28, 75],
    [72, 75],
  ],
};

function Dice({
  value,
  rolling,
  color,
}: {
  value: number | null;
  rolling: boolean;
  color: string;
}) {
  const [face, setFace] = useState(value ?? 6);
  useEffect(() => {
    if (!rolling) {
      if (value) setFace(value);
      return;
    }
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 80);
    return () => clearInterval(t);
  }, [rolling, value]);
  return (
    <svg viewBox="0 0 100 100" width={78} height={78} className={rolling ? "die-rolling" : ""}>
      <rect
        x={4}
        y={4}
        width={92}
        height={92}
        rx={20}
        fill={color}
        stroke="#07060B"
        strokeWidth={6}
      />
      {PIPS[face].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={9} fill="#07060B" />
      ))}
    </svg>
  );
}

// ---------- Game screen ----------

export function LudoTable({
  state,
  mine,
  onRoll,
  onMove,
  onSkip,
  onClose,
  onPlayAgain,
  onResign,
  solo,
}: {
  state: LudoState;
  mine: number;
  onRoll: () => void;
  onMove: (token: number) => void;
  onSkip: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
  onResign: () => void;
  /** Solo games aren't saved, so leaving ends them. */
  solo?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const turnPlayer = state.players[state.turn];
  // Big "Captured!" flash when anyone sends a pawn home.
  const [flash, setFlash] = useState(0);
  const lastCaptureKey = state.last?.captured
    ? `${state.last.player}-${state.tokens.flat().join(",")}`
    : "";
  useEffect(() => {
    if (!lastCaptureKey) return;
    setFlash((n) => n + 1);
    buzz(state.last?.player === mine ? 25 : 60);
    const t = setTimeout(() => setFlash(0), 1300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCaptureKey]);
  const myTurn = state.turn === mine && state.phase !== "over";
  const idle =
    !myTurn && !turnPlayer.bot && state.phase !== "over" && now - state.turnStartedAt > IDLE_MS;
  const home = (p: number) => state.tokens[p].filter((t) => t === HOME).length;

  const doRoll = () => {
    if (!myTurn || state.phase !== "roll" || rolling) return;
    setRolling(true);
    buzz(15);
    setTimeout(() => {
      setRolling(false);
      onRoll();
    }, 600);
  };

  const status =
    state.phase === "over"
      ? state.winner === mine
        ? "You win! 🏆"
        : `${state.players[state.winner!].name.split(" ")[0]} wins 🏆`
      : myTurn
        ? state.phase === "roll"
          ? "Your turn: roll"
          : "Pick a glowing token"
        : `${turnPlayer.name.split(" ")[0]}'s turn`;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="mx-auto w-full max-w-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8">
        <header className="flex items-center justify-between">
          <span className="heading" style={{ fontSize: 20 }}>
            🎲 Ludo
          </span>
          <button
            onClick={() =>
              state.phase === "over" || state.players[mine]?.out ? onClose() : setMenu(true)
            }
            aria-label="Leave or resign"
            className="text-cool w-10 h-10 flex items-center justify-center"
          >
            <X size={22} />
          </button>
        </header>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {state.players.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5"
              style={{
                border: `2px solid ${i === state.turn && state.phase !== "over" ? COLOR_HEX[p.color] : "var(--edge)"}`,
                background: i === state.turn ? "var(--fill)" : "transparent",
              }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: COLOR_HEX[p.color] }}
              />
              <Avatar src={p.avatar} initials={p.initials} size={26} />
              <span className="flex-1 min-w-0 truncate text-[13px] font-bold text-cream">
                {i === mine ? "You" : p.name.split(" ")[0]}
                {p.bot && " 🤖"}
                {p.out && " 🏳️"}
              </span>
              <span className="meta tabular-nums" style={{ fontSize: 12 }}>
                🏠{home(i)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Board
            state={state}
            mine={mine}
            onToken={(t) => myTurn && state.phase === "move" && onMove(t)}
          />
        </div>

        <div
          className="mt-4 flex items-center gap-4 rounded-2xl p-3"
          style={{
            background: myTurn ? "var(--fill)" : "transparent",
            border: `2px solid ${myTurn ? COLOR_HEX[turnPlayer.color] : "transparent"}`,
          }}
        >
          <button
            onClick={doRoll}
            disabled={!myTurn || state.phase !== "roll" || rolling}
            aria-label="Roll the dice"
            className="relative shrink-0 disabled:opacity-70"
          >
            <span
              className={
                myTurn && state.phase === "roll" && !rolling ? "inline-block float" : "inline-block"
              }
            >
              <Dice
                value={state.dice ?? state.last?.dice ?? null}
                rolling={rolling}
                color={COLOR_HEX[turnPlayer.color]}
              />
            </span>
            {myTurn && state.phase === "roll" && !rolling && (
              <span
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-extrabold px-2 rounded-full"
                style={{ background: "var(--edge)", color: "#fff" }}
              >
                TAP TO ROLL
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-cream text-[18px] leading-tight">{status}</p>
            {state.last?.note && <p className="meta mt-0.5">{state.last.note}</p>}
            {state.dice === 6 && state.phase === "move" && (
              <p className="meta mt-0.5">🎉 A six! You'll roll again.</p>
            )}
            {state.phase === "over" && onPlayAgain && (
              <button onClick={onPlayAgain} className="btn-primary mt-2 px-4 min-h-[38px] text-sm">
                Play again
              </button>
            )}
            {idle && (
              <button onClick={onSkip} className="btn-quiet mt-1 px-3 min-h-[34px] text-sm">
                Skip {turnPlayer.name.split(" ")[0]}'s turn
              </button>
            )}
          </div>
        </div>
      </div>
      {menu && (
        <Sheet title="Leave the game?" onClose={() => setMenu(false)}>
          <div className="grid gap-2.5">
            <button onClick={() => setMenu(false)} className="btn-primary">
              Keep playing
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onClose();
              }}
              className="btn-secondary"
            >
              {solo ? "Leave (game ends)" : "Leave for now (come back from Your games)"}
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onResign();
              }}
              className="btn-danger"
            >
              🏳️ Resign
            </button>
          </div>
          <p className="meta mt-3">
            Resigning takes your pawns off the board
            {solo ? "" : ". If only one person is left, the game ends"}.
          </p>
        </Sheet>
      )}
      {flash > 0 && (
        <div className="fixed inset-0 z-[62] pointer-events-none flex items-center justify-center">
          <span
            key={flash}
            className="display pop"
            style={{ fontSize: 44, color: "#fff", textShadow: "3px 3px 0 #07060B" }}
          >
            💥 Captured!
          </span>
        </div>
      )}
      <Confetti fire={state.phase === "over" && state.winner === mine ? 1 : 0} />
    </div>
  );
}

// ---------- Waiting room (online games) ----------

export function LudoWaiting({
  state,
  meId,
  isHost,
  onStart,
  onClose,
}: {
  state: LudoState;
  meId: string;
  isHost: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  const missing = waitingFor(state);
  const joined = state.joined ?? [];
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="mx-auto w-full max-w-md px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 min-h-full flex flex-col">
        <header className="flex items-center justify-between">
          <span className="heading" style={{ fontSize: 20 }}>
            🎲 Ludo · waiting room
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-cool w-10 h-10 flex items-center justify-center"
          >
            <X size={22} />
          </button>
        </header>
        <div className="flex-1 flex flex-col justify-center">
          <ul className="grid gap-3">
            {state.players.map((p) => {
              const here = p.bot || joined.includes(p.id);
              return (
                <li
                  key={p.id}
                  className="card flex items-center gap-3 p-3"
                  style={{ opacity: here ? 1 : 0.6 }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ background: COLOR_HEX[p.color] }}
                  />
                  <Avatar src={p.avatar} initials={p.initials} size={40} />
                  <span className="flex-1 font-bold text-cream">
                    {p.id === meId ? "You" : p.name.split(" ")[0]}
                    {p.bot && " 🤖"}
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: here ? "var(--lime)" : "var(--ink-3)" }}
                  >
                    {here ? "✓ in" : "joining…"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="meta text-center mt-5">
            {missing.length
              ? `Waiting for ${missing.map((p) => p.name.split(" ")[0]).join(", ")}. They got an invite.`
              : "Everyone's in. Starting…"}
          </p>
          {isHost && missing.length > 0 && (
            <button onClick={onStart} className="btn-secondary mt-4 mx-auto px-5">
              Start now (bots play for anyone missing)
            </button>
          )}
          {!isHost && missing.length > 0 && (
            <p className="meta text-center mt-3">The host starts the game.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Lobby ----------

export function LudoLobby({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (friends: Person[], bots: number) => void;
}) {
  const s = useSocial();
  const people = s.mode === "live" ? mutualFriends() : [];
  const [picked, setPicked] = useState<string[]>([]);
  const [bots, setBots] = useState(0);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  const friends = people.filter((p) => picked.includes(p.id));
  const maxBots = 3 - friends.length;
  const botCount = Math.min(bots, maxBots);
  const total = 1 + friends.length + botCount;
  return (
    <Sheet title="🎲 Ludo" onClose={onClose}>
      <p className="text-sm text-cool leading-relaxed">
        Live, 2 to 4 players. Roll a 6 to get out. Land on someone to send them home. First to get
        all 4 tokens home wins.
      </p>
      <p className="label-caps mt-5 mb-2">friends (optional, up to 3)</p>
      {people.length === 0 ? (
        <p className="text-sm text-faint">No mutual seats yet. Play the bots for now.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {people.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className="flex flex-col items-center shrink-0"
                style={{ width: 60 }}
              >
                <span
                  className="rounded-full p-[2px]"
                  style={{ background: on ? "var(--lime)" : "transparent" }}
                >
                  <Avatar
                    src={p.avatar || undefined}
                    initials={p.initials}
                    color={p.color}
                    size={48}
                  />
                </span>
                <span className="text-[11px] mt-1 truncate w-full text-center text-cream">
                  {p.name.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="label-caps mt-5 mb-2">bots 🤖</p>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            disabled={n > maxBots}
            onClick={() => setBots(n)}
            className="flex-1 h-11 rounded-2xl font-bold tabular-nums disabled:opacity-30"
            style={{
              background: botCount === n ? "var(--lime)" : "var(--fill)",
              color: botCount === n ? "var(--on-accent)" : "var(--ink)",
              border: "2px solid var(--edge)",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="meta mt-2">
        {friends.length === 0
          ? "Solo: plays on this phone only."
          : "Your phone plays the bots, so keep 25 open."}
      </p>
      <button
        disabled={total < 2}
        onClick={() => onStart(friends, botCount)}
        className="btn-primary w-full mt-4"
      >
        {total < 2 ? "Add a friend or a bot" : `Start · ${total} players`}
      </button>
    </Sheet>
  );
}
