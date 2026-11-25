/**
 * Chess: play the bot (Easy / Medium / Hard) or someone from your 25.
 * Tap a piece to see where it can go, tap a square to move. The board turns
 * for whoever is playing black.
 */
import { ChessPiece } from "@/components/ChessPieces";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Flag,
  Handshake,
  Menu,
  RefreshCw,
  Timer,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, buzz } from "@/components/SocialUI";
import { GameOverBoard, type LeaderRow } from "@/components/Leaderboard";
import { SoundToggle } from "@/components/SoundToggle";
import { sfx, useGameMusic } from "@/lib/sfx";
import {
  botMove,
  captured,
  claimTimeout,
  positionAt,
  timeLeft,
  colorOf,
  inCheck,
  kingSquare,
  legalMoves,
  makeMove,
  newChess,
  resign,
  type ChessState,
  type Color,
  type Move,
} from "@/lib/chess";
import { meView, mutualFriends, type Person } from "@/lib/social";

const LIGHT = "#EDEED2";
const DARK = "#769457";

export type ChessSide = {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
};

function Piece({ p, size }: { p: string; size: number }) {
  return <ChessPiece p={p} size={size} />;
}

const NAMES: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};
const sq = (i: number) => `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}`;

/** The board. `me` decides which way up it is and which pieces you can move. */
export function ChessBoard({
  state,
  me,
  canMove,
  onMove,
}: {
  state: ChessState;
  me: Color;
  canMove: boolean;
  onMove: (m: Move) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const moves = useMemo(() => (canMove ? legalMoves(state) : []), [state, canMove]);
  const targets = sel === null ? [] : moves.filter((m) => m.from === sel);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(340);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el);
    setSize(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSel(null), [state.san.length]);

  const flip = me === "b";
  const order = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const cell = size / 8;
  const check = inCheck(state) ? kingSquare(state.board, state.turn) : -1;
  const last = state.last;

  const tap = (i: number) => {
    if (!canMove) return;
    const t = targets.find((m) => m.to === i);
    if (t && sel !== null) {
      if (t.promo) setPromo({ from: sel, to: i });
      else onMove({ from: sel, to: i });
      setSel(null);
      return;
    }
    if (colorOf(state.board[i]) === state.turn && moves.some((m) => m.from === i)) {
      buzz(5);
      setSel(i === sel ? null : i);
    } else setSel(null);
  };

  // The piece that just moved slides in from where it was.
  const slide = (i: number) => {
    if (!last || last[1] !== i) return undefined;
    const pos = (x: number) => {
      const k = order.indexOf(x);
      return { r: Math.floor(k / 8), f: k % 8 };
    };
    const a = pos(last[0]);
    const b = pos(last[1]);
    return {
      ["--dx" as string]: `${(a.f - b.f) * 100}%`,
      ["--dy" as string]: `${(a.r - b.r) * 100}%`,
      animation: "piece-slide 0.22s cubic-bezier(.2,.8,.3,1) both",
    } as React.CSSProperties;
  };

  return (
    <div
      ref={boxRef}
      className="relative w-full aspect-square overflow-hidden select-none"
      role="grid"
      aria-label="Chess board"
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {order.map((i, k) => {
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const p = state.board[i];
          const isTarget = targets.some((m) => m.to === i);
          const isLast = !!last && (last[0] === i || last[1] === i);
          const r = Math.floor(k / 8);
          const f = k % 8;
          return (
            <button
              key={i}
              onClick={() => tap(i)}
              aria-label={`${sq(i)}${p !== "." ? `, ${colorOf(p) === "w" ? "white" : "black"} ${NAMES[p.toLowerCase()]}` : ""}`}
              className="relative flex items-center justify-center min-h-0 min-w-0 overflow-visible"
              style={{
                background: dark ? DARK : LIGHT,
                boxShadow:
                  sel === i
                    ? "inset 0 0 0 100px rgba(246,246,105,0.75)"
                    : isLast
                      ? "inset 0 0 0 100px rgba(246,246,105,0.55)"
                      : undefined,
              }}
            >
              {/* Coordinates on the edge squares. */}
              {f === 0 && (
                <span
                  className="absolute left-0.5 top-0 font-bold z-[3] pointer-events-none"
                  style={{ fontSize: cell * 0.2, color: dark ? LIGHT : DARK }}
                >
                  {8 - Math.floor(i / 8)}
                </span>
              )}
              {r === 7 && (
                <span
                  className="absolute right-1 bottom-0 font-bold z-[3] pointer-events-none"
                  style={{ fontSize: cell * 0.2, color: dark ? LIGHT : DARK }}
                >
                  {"abcdefgh"[i % 8]}
                </span>
              )}
              {check === i && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,60,80,0.95) 0%, rgba(255,60,80,0.55) 40%, transparent 72%)",
                  }}
                />
              )}
              {p !== "." && (
                <span key={`${i}-${state.san.length}`} className="relative z-[1]" style={slide(i)}>
                  <Piece p={p} size={cell * 0.94} />
                </span>
              )}
              {isTarget &&
                (p === "." ? (
                  <span
                    aria-hidden="true"
                    className="absolute rounded-full z-[2]"
                    style={{
                      width: cell * 0.3,
                      height: cell * 0.3,
                      background: "rgba(26,21,48,0.32)",
                    }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-[4%] rounded-full z-[2]"
                    style={{ border: `${cell * 0.08}px solid rgba(26,21,48,0.35)` }}
                  />
                ))}
            </button>
          );
        })}
      </div>
      {/* Promotion: pick the new piece. */}
      {promo && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: "rgba(10,8,20,0.6)" }}
          onClick={() => setPromo(null)}
        >
          <div className="flex gap-2 rounded-2xl p-2" style={{ background: "var(--surface)" }}>
            {"qrbn".split("").map((t) => (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove({ ...promo, promo: t });
                  setPromo(null);
                }}
                aria-label={`Promote to ${NAMES[t]}`}
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: LIGHT }}
              >
                <Piece p={state.turn === "w" ? t.toUpperCase() : t} size={46} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const REASON: Record<string, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  resign: "Resigned",
  repetition: "Same position three times",
  fifty: "50 moves without a capture",
  material: "Not enough pieces to mate",
  agreed: "Draw agreed",
  timeout: "Out of time",
  left: "Left the game",
};

/** Sound for whatever just happened on the board. */
function useMoveSounds(state: ChessState) {
  const n = state.san.length;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const m = state.san[n - 1] ?? "";
    if (m.includes("#") || m.includes("+")) sfx.check();
    else if (m.includes("x")) sfx.take();
    else sfx.knock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
}

/** The chess clock box: dark when it's running, grey when not, red in the last 20s. */
function Clock({ ms, running }: { ms: number | null; running: boolean }) {
  if (ms === null) return null;
  const low = ms < 20_000;
  const t = Math.ceil(ms / 1000);
  const text =
    ms < 10_000
      ? (ms / 1000).toFixed(1)
      : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  return (
    <span
      className="flex items-center gap-2 rounded-xl px-3 font-black tabular-nums shrink-0"
      style={{
        minWidth: 116,
        height: 52,
        justifyContent: "flex-end",
        fontSize: 26,
        background: running ? (low ? "#C8323F" : "#0E0D12") : "#4A4852",
        color: running ? "#fff" : "rgba(255,255,255,0.55)",
      }}
      aria-label={`${text} left`}
    >
      {running && <Timer size={20} aria-hidden="true" />}
      {text}
    </span>
  );
}

/** A player's row: square photo, name, what they've taken, their clock. */
function PlayerRow({
  who,
  taken,
  lead,
  ms,
  running,
  note,
}: {
  who: ChessSide;
  taken: string[];
  lead: number;
  ms: number | null;
  running: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="rounded-[6px] overflow-hidden shrink-0" style={{ width: 46, height: 46 }}>
        <Avatar src={who.avatar} initials={who.initials} color={who.color} size={46} />
      </span>
      <span className="flex-1 min-w-0 self-start">
        <span className="flex items-baseline gap-1.5">
          <span className="font-bold truncate" style={{ fontSize: 16, color: "#fff" }}>
            {who.name}
          </span>
          {note && (
            <span className="shrink-0" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              {note}
            </span>
          )}
        </span>
        <span
          className="flex items-center h-5 overflow-hidden"
          aria-label={`Captured ${taken.length}`}
        >
          {taken.map((p, k) => (
            <span key={k} style={{ marginRight: -4 }}>
              <Piece p={p} size={16} />
            </span>
          ))}
          {lead > 0 && (
            <span
              className="ml-2 font-bold"
              style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}
            >
              +{lead}
            </span>
          )}
        </span>
      </span>
      <Clock ms={ms} running={running} />
    </div>
  );
}

/** The whole game screen (bot or online). */
export function ChessTable({
  state,
  me,
  you,
  them,
  onMove,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onTimeout,
  onClose,
  onPlayAgain,
  thinking,
}: {
  state: ChessState;
  me: Color;
  you: ChessSide;
  them: ChessSide;
  onMove: (m: Move) => void;
  onResign: () => void;
  onOfferDraw?: () => void;
  onAcceptDraw?: () => void;
  /** Someone's clock hit zero. */
  onTimeout?: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
  thinking?: boolean;
}) {
  useGameMusic(!state.result);
  useMoveSounds(state);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [over, setOver] = useState(false);
  // Going back through the moves: null = the live position.
  const [view, setView] = useState<number | null>(null);
  useEffect(() => setView(null), [state.san.length]);
  useEffect(() => {
    if (!state.result) return setOver(false);
    const t = setTimeout(() => setOver(true), 900);
    return () => clearTimeout(t);
  }, [state.result]);
  // Clocks tick on screen; when one hits zero, the game ends.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!state.clock || state.result) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [state.clock, state.result]);
  const flagged = !!state.clock && !state.result && (timeLeft(state, state.turn, now) ?? 1) <= 0;
  useEffect(() => {
    if (flagged) onTimeout?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagged]);

  const live = view === null;
  const shown = live ? state : positionAt(state, view);
  const cap = captured(shown.board);
  const myTurn = state.turn === me && !state.result;
  const check = live && inCheck(state);
  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    moveListRef.current?.scrollTo({ left: 99999, behavior: "smooth" });
  }, [state.san.length]);
  const bottom: Color = flipped ? (me === "w" ? "b" : "w") : me;
  const top: Color = bottom === "w" ? "b" : "w";
  const side = (c: Color) => (c === me ? you : them);
  const n = view ?? state.san.length;
  const running = (c: Color) => !state.result && state.turn === c && state.san.length > 0;

  const rows: LeaderRow[] = (() => {
    const w = state.result?.winner;
    const mine = { ...you, rank: w && w !== me ? 2 : 1, me: true };
    // Did they ever make a move? (Not if they never opened it and their clock ran out.)
    const theirMoves =
      me === "w" ? Math.floor(state.san.length / 2) : Math.ceil(state.san.length / 2);
    const theirs = {
      ...them,
      rank: w && w === me ? 2 : 1,
      link: them.id !== "bot",
      played: them.id === "bot" || theirMoves > 0,
    };
    return mine.rank <= theirs.rank ? [mine, theirs] : [theirs, mine];
  })();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#302E2B" }}>
      <div className="mx-auto w-full max-w-md flex flex-col min-h-full pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between px-3">
          <button
            onClick={onClose}
            aria-label="Leave the game"
            className="w-10 h-10 flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <X size={22} />
          </button>
          <span className="font-black" style={{ fontSize: 17, color: "#fff" }}>
            {state.clock ? `${Math.round(state.clock.base / 60_000)} min chess` : "Chess"}
          </span>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>
            <SoundToggle />
          </span>
        </header>

        {/* Moves along the top. Tap one to see that position. */}
        <div
          ref={moveListRef}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 h-11"
          data-noswipe
        >
          {state.san.map((m, k) => (
            <Fragment key={k}>
              {k % 2 === 0 && (
                <span
                  className="shrink-0 tabular-nums ml-1"
                  style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}
                >
                  {k / 2 + 1}.
                </span>
              )}
              <button
                onClick={() => setView(k + 1 === state.san.length ? null : k + 1)}
                className="shrink-0 rounded-md px-1.5 py-0.5 font-bold"
                style={{
                  fontSize: 15,
                  color: "#fff",
                  background: k + 1 === n ? "rgba(255,255,255,0.16)" : "transparent",
                  boxShadow: k + 1 === n ? "inset 0 -2px 0 rgba(255,255,255,0.55)" : undefined,
                }}
              >
                {m}
              </button>
            </Fragment>
          ))}
        </div>

        <PlayerRow
          who={side(top)}
          taken={top === "w" ? cap.byWhite : cap.byBlack}
          lead={top === "w" ? cap.lead : -cap.lead}
          ms={timeLeft(state, top, now)}
          running={running(top)}
          note={
            top !== me
              ? thinking
                ? "thinking…"
                : them.id === "bot"
                  ? "(bot)"
                  : undefined
              : undefined
          }
        />
        <ChessBoard
          state={shown}
          me={bottom}
          canMove={myTurn && live && bottom === me}
          onMove={onMove}
        />
        <PlayerRow
          who={side(bottom)}
          taken={bottom === "w" ? cap.byWhite : cap.byBlack}
          lead={bottom === "w" ? cap.lead : -cap.lead}
          ms={timeLeft(state, bottom, now)}
          running={running(bottom)}
          note={bottom !== me && thinking ? "thinking…" : undefined}
        />

        <p
          className="text-center font-extrabold px-3"
          style={{
            fontSize: 15,
            color: check && myTurn ? "#FF6B7D" : "rgba(255,255,255,0.75)",
            minHeight: 22,
          }}
          aria-live="polite"
        >
          {!live
            ? `Going back · move ${Math.ceil(n / 2)}`
            : state.result
              ? REASON[state.result.reason]
              : check && myTurn
                ? "Check!"
                : myTurn && state.san.length < 2
                  ? "Your move"
                  : ""}
        </p>

        {!state.result && state.drawOffer && state.drawOffer !== me && onAcceptDraw && (
          <div
            className="mx-3 mt-2 rounded-xl p-3 flex items-center gap-3"
            style={{ background: "#3D3A36" }}
          >
            <Handshake size={20} aria-hidden="true" />
            <span className="flex-1 font-semibold">{them.name.split(" ")[0]} offers a draw</span>
            <button onClick={onAcceptDraw} className="btn-primary px-4 min-h-[38px]">
              Accept
            </button>
          </div>
        )}

        {/* Toolbar */}
        <nav
          className="mt-auto grid grid-cols-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          style={{ background: "#262421" }}
          aria-label="Game"
        >
          {(
            [
              { label: "Options", Icon: Menu, on: () => setMenu(true), off: false },
              {
                label: "Back",
                Icon: ChevronLeft,
                on: () => setView(Math.max(0, n - 1)),
                off: n === 0,
              },
              {
                label: "Forward",
                Icon: ChevronRight,
                on: () => setView(n + 1 >= state.san.length ? null : n + 1),
                off: live,
              },
            ] as const
          ).map(({ label, Icon, on, off }) => (
            <button
              key={label}
              onClick={on}
              disabled={off}
              className="flex flex-col items-center gap-0.5 py-1.5 disabled:opacity-35"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              <Icon size={26} aria-hidden="true" />
              <span className="font-bold" style={{ fontSize: 13 }}>
                {label}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {menu && (
        <Sheet title="Options" onClose={() => setMenu(false)}>
          <div className="grid gap-2.5">
            <button
              onClick={() => {
                setFlipped((f) => !f);
                setMenu(false);
              }}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <RefreshCw size={17} aria-hidden="true" /> Flip board
            </button>
            {!state.result && onOfferDraw && (
              <button
                onClick={() => {
                  onOfferDraw();
                  setMenu(false);
                }}
                disabled={state.drawOffer === me}
                className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Handshake size={17} aria-hidden="true" />
                {state.drawOffer === me ? "Draw offered" : "Offer a draw"}
              </button>
            )}
            {!state.result && (
              <button
                onClick={() => {
                  setMenu(false);
                  setConfirm(true);
                }}
                className="btn-danger flex items-center justify-center gap-2"
              >
                <Flag size={17} aria-hidden="true" /> Resign
              </button>
            )}
          </div>
        </Sheet>
      )}
      {confirm && (
        <Sheet title="Resign?" onClose={() => setConfirm(false)}>
          <div className="grid gap-2.5">
            <button onClick={() => setConfirm(false)} className="btn-primary">
              Keep playing
            </button>
            <button
              onClick={() => {
                setConfirm(false);
                onResign();
              }}
              className="btn-danger"
            >
              <Flag size={16} aria-hidden="true" /> Resign
            </button>
          </div>
        </Sheet>
      )}
      {over && state.result && (
        <GameOverBoard
          game="Chess"
          headline={
            state.result.winner === null
              ? "Draw"
              : state.result.winner === me
                ? "You win!"
                : `${them.name.split(" ")[0]} wins`
          }
          note={REASON[state.result.reason]}
          rows={rows}
          // Only checkmate can be roasted, not a resign, timeout or someone leaving.
          roast={
            them.id !== "bot" && state.result.reason === "checkmate" ? { game: "Chess" } : undefined
          }
          onClose={onClose}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  );
}

const BOT_NAMES: Record<1 | 2 | 3, string> = { 1: "Rookie bot", 2: "Club bot", 3: "Master bot" };

/** Chess against the computer (nothing saved). */
export function LocalChess({
  level,
  color,
  minutes,
  onClose,
}: {
  level: 1 | 2 | 3;
  color: Color;
  minutes?: number;
  onClose: () => void;
}) {
  const me = meView();
  const fresh = () =>
    newChess(color === "w" ? "me" : "bot", color === "w" ? "bot" : "me", level, minutes);
  const [state, setState] = useState<ChessState>(fresh);
  const [thinking, setThinking] = useState(false);
  // The bot's turn: think for a moment (so it feels like a move), then play.
  useEffect(() => {
    if (state.result || state.turn === color) return;
    setThinking(true);
    const t = setTimeout(() => {
      const m = botMove(state, level);
      setThinking(false);
      if (m) setState((s) => makeMove(s, m) ?? s);
    }, 450);
    return () => clearTimeout(t);
  }, [state, color, level]);
  return (
    <ChessTable
      state={state}
      me={color}
      you={{ id: "me", name: me.name, avatar: me.avatar, initials: me.initials }}
      them={{ id: "bot", name: BOT_NAMES[level], initials: "🤖" }}
      thinking={thinking}
      onMove={(m) => setState((s) => makeMove(s, m) ?? s)}
      onResign={() => setState((s) => resign(s, color))}
      onTimeout={() => setState((s) => claimTimeout(s) ?? s)}
      onClose={onClose}
      onPlayAgain={() => setState(fresh())}
    />
  );
}

/** Start chess: pick a friend, or the bot with a difficulty and your colour. */
export function ChessLobby({
  onClose,
  onBot,
  onFriend,
}: {
  onClose: () => void;
  onBot: (level: 1 | 2 | 3, color: Color, minutes?: number) => void;
  onFriend: (f: Person, minutes?: number) => void;
}) {
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [minutes, setMinutes] = useState<number>(10);
  const [color, setColor] = useState<"w" | "b" | "random">("w");
  const [picking, setPicking] = useState(false);
  const friends = mutualFriends();
  if (picking)
    return (
      <FriendPicker
        title="Challenge who?"
        cta="Send challenge"
        single
        onClose={() => setPicking(false)}
        onPick={(ids) => {
          const f = friends.find((x) => x.id === ids[0]);
          if (f) onFriend(f, minutes || undefined);
        }}
      />
    );
  const seg = (on: boolean) => ({
    background: on ? "#E2506A" : "transparent",
    color: on ? "#fff" : "var(--ink-2)",
  });
  return (
    <Sheet title="Chess" onClose={onClose}>
      <p className="label-caps mb-1.5">Time per player</p>
      <div className="grid grid-cols-6 gap-1.5 mb-5" role="group" aria-label="Time per player">
        {[0, 1, 3, 5, 10, 30].map((m) => (
          <button
            key={m}
            onClick={() => setMinutes(m)}
            aria-pressed={minutes === m}
            aria-label={m ? `${m} minutes` : "No clock"}
            className="rounded-xl py-2 font-bold"
            style={{
              ...seg(minutes === m),
              border: `1px solid ${minutes === m ? "#E2506A" : "var(--line)"}`,
              fontSize: 13.5,
            }}
          >
            {m ? `${m}m` : "∞"}
          </button>
        ))}
      </div>
      <button
        onClick={() => setPicking(true)}
        disabled={!friends.length}
        className="btn-primary w-full disabled:opacity-50"
        style={{ minHeight: 54 }}
      >
        Play someone from your 25
      </button>
      <p className="meta text-center mt-2" style={{ fontSize: 12.5 }}>
        They get a challenge in chat. You play live, move by move.
      </p>

      <div
        className="mt-6 rounded-2xl p-4"
        style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
      >
        <p className="font-bold flex items-center gap-2">
          <Bot size={18} aria-hidden="true" /> Play the bot
        </p>
        <p className="label-caps mt-3 mb-1.5">Difficulty</p>
        <div
          className="flex rounded-xl p-1"
          style={{ background: "var(--surface)" }}
          role="group"
          aria-label="Difficulty"
        >
          {([1, 2, 3] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className="flex-1 rounded-lg py-2 font-bold"
              style={seg(level === l)}
            >
              {["Easy", "Medium", "Hard"][l - 1]}
            </button>
          ))}
        </div>
        <p className="label-caps mt-3 mb-1.5">You play</p>
        <div
          className="flex rounded-xl p-1"
          style={{ background: "var(--surface)" }}
          role="group"
          aria-label="Your colour"
        >
          {(
            [
              ["w", "White"],
              ["b", "Black"],
              ["random", "Random"],
            ] as const
          ).map(([c, label]) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-pressed={color === c}
              className="flex-1 rounded-lg py-2 font-bold"
              style={seg(color === c)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            onBot(
              level,
              color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color,
              minutes || undefined,
            )
          }
          className="btn-secondary w-full mt-4"
        >
          Start
        </button>
      </div>
    </Sheet>
  );
}
