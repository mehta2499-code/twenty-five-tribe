/**
 * Chess: play the bot (Easy / Medium / Hard) or someone from your 25.
 * Tap a piece to see where it can go, tap a square to move. The board turns
 * for whoever is playing black.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Flag, Handshake, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, buzz } from "@/components/SocialUI";
import { GameOverBoard, type LeaderRow } from "@/components/Leaderboard";
import { SoundToggle } from "@/components/SoundToggle";
import { sfx, useGameMusic } from "@/lib/sfx";
import {
  botMove,
  captured,
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

// Solid glyphs for both sides, coloured with CSS (text style, never emoji).
const GLYPH: Record<string, string> = {
  k: "♚︎",
  q: "♛︎",
  r: "♜︎",
  b: "♝︎",
  n: "♞︎",
  p: "♟︎",
};
const LIGHT = "#E7E2F7";
const DARK = "#8571C9";

export type ChessSide = {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
};

function Piece({ p, size }: { p: string; size: number }) {
  const white = colorOf(p) === "w";
  return (
    <span
      aria-hidden="true"
      className="block select-none leading-none"
      style={{
        fontSize: size,
        fontFamily:
          '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "DejaVu Sans", serif',
        color: white ? "#FFFFFF" : "#1A1530",
        WebkitTextStroke: white ? "1.4px #1A1530" : "1px rgba(255,255,255,0.35)",
        filter: white
          ? "drop-shadow(0 2px 1.5px rgba(0,0,0,0.45))"
          : "drop-shadow(0 2px 1.5px rgba(0,0,0,0.5))",
        transform: "translateY(-3%)",
      }}
    >
      {GLYPH[p.toLowerCase()]}
    </span>
  );
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
      className="relative w-full aspect-square rounded-[14px] overflow-hidden select-none"
      style={{
        boxShadow:
          "0 18px 40px rgba(0,0,0,0.5), 0 0 0 4px #2A2245, 0 0 0 5px rgba(255,255,255,0.1)",
      }}
      role="grid"
      aria-label="Chess board"
    >
      <div className="grid grid-cols-8 w-full h-full">
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
              className="relative flex items-center justify-center"
              style={{
                background: dark ? DARK : LIGHT,
                boxShadow:
                  sel === i
                    ? "inset 0 0 0 100px rgba(193,239,98,0.55)"
                    : isLast
                      ? "inset 0 0 0 100px rgba(247,201,72,0.38)"
                      : undefined,
              }}
            >
              {/* Coordinates on the edge squares. */}
              {f === 0 && (
                <span
                  className="absolute left-0.5 top-0 font-bold"
                  style={{ fontSize: cell * 0.2, color: dark ? LIGHT : DARK }}
                >
                  {8 - Math.floor(i / 8)}
                </span>
              )}
              {r === 7 && (
                <span
                  className="absolute right-1 bottom-0 font-bold"
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
                  <Piece p={p} size={cell * 0.82} />
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

/** A player's strip: face, name, what they've taken. */
function PlayerBar({
  who,
  color,
  taken,
  lead,
  active,
  note,
}: {
  who: ChessSide;
  color: Color;
  taken: string[];
  lead: number;
  active: boolean;
  note?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors"
      style={{
        background: active ? "rgba(193,239,98,0.12)" : "var(--fill)",
        border: `1px solid ${active ? "rgba(193,239,98,0.5)" : "var(--line)"}`,
      }}
    >
      <span className="relative shrink-0">
        <Avatar src={who.avatar} initials={who.initials} color={who.color} size={38} />
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full"
          style={{
            background: color === "w" ? "#fff" : "#1A1530",
            border: "2px solid var(--surface)",
          }}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-bold text-cream truncate" style={{ fontSize: 15 }}>
            {who.name}
          </span>
          {note && (
            <span className="meta shrink-0" style={{ fontSize: 12 }}>
              {note}
            </span>
          )}
        </span>
        <span
          className="flex items-center gap-[1px] h-4 overflow-hidden"
          aria-label={`Captured ${taken.length}`}
        >
          {taken.map((p, k) => (
            <span key={k} style={{ marginRight: -3 }}>
              <Piece p={p} size={14} />
            </span>
          ))}
          {lead > 0 && (
            <span className="ml-2 font-bold meta" style={{ fontSize: 12 }}>
              +{lead}
            </span>
          )}
        </span>
      </span>
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
  onClose: () => void;
  onPlayAgain?: () => void;
  thinking?: boolean;
}) {
  useGameMusic(!state.result);
  useMoveSounds(state);
  const [confirm, setConfirm] = useState(false);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!state.result) return setOver(false);
    const t = setTimeout(() => setOver(true), 900);
    return () => clearTimeout(t);
  }, [state.result]);
  const cap = captured(state.board);
  const myTurn = state.turn === me && !state.result;
  const check = inCheck(state);
  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    moveListRef.current?.scrollTo({ left: 99999, behavior: "smooth" });
  }, [state.san.length]);

  const status = state.result
    ? REASON[state.result.reason]
    : myTurn
      ? check
        ? "Check! Your move"
        : "Your move"
      : thinking
        ? `${them.name.split(" ")[0]} is thinking…`
        : `${them.name.split(" ")[0]}'s move`;
  const rows: LeaderRow[] = (() => {
    const w = state.result?.winner;
    const mine = { ...you, rank: w && w !== me ? 2 : 1, me: true };
    const theirs = { ...them, rank: w && w === me ? 2 : 1, link: them.id !== "bot" };
    return mine.rank <= theirs.rank ? [mine, theirs] : [theirs, mine];
  })();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--page)" }}>
      <div className="mx-auto w-full max-w-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col min-h-full">
        <header className="flex items-center justify-between">
          <span className="heading" style={{ fontSize: 20 }}>
            Chess
          </span>
          <span className="flex items-center gap-1">
            <SoundToggle />
            <button
              onClick={onClose}
              aria-label="Leave the game"
              className="text-cool w-10 h-10 flex items-center justify-center"
            >
              <X size={22} />
            </button>
          </span>
        </header>

        <div className="mt-2">
          <PlayerBar
            who={them}
            color={me === "w" ? "b" : "w"}
            taken={me === "w" ? cap.byBlack : cap.byWhite}
            lead={me === "w" ? -cap.lead : cap.lead}
            active={!state.result && state.turn !== me}
            note={thinking ? "thinking…" : undefined}
          />
        </div>
        <div className="mt-3">
          <ChessBoard state={state} me={me} canMove={myTurn} onMove={onMove} />
        </div>
        <div className="mt-3">
          <PlayerBar
            who={{ ...you, name: "You" }}
            color={me}
            taken={me === "w" ? cap.byWhite : cap.byBlack}
            lead={me === "w" ? cap.lead : -cap.lead}
            active={myTurn}
          />
        </div>

        <p
          className="text-center font-extrabold mt-3"
          style={{ fontSize: 17, color: check && myTurn ? "#FF6B7D" : "var(--ink)" }}
          aria-live="polite"
        >
          {status}
        </p>

        {/* Moves so far */}
        {state.san.length > 0 && (
          <div
            ref={moveListRef}
            className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1"
            data-noswipe
          >
            {Array.from({ length: Math.ceil(state.san.length / 2) }, (_, k) => (
              <span
                key={k}
                className="shrink-0 rounded-lg px-2 py-1 tabular-nums"
                style={{ background: "var(--fill)", fontSize: 12.5 }}
              >
                <span className="meta">{k + 1}.</span>{" "}
                <b className="font-semibold">{state.san[k * 2]}</b> {state.san[k * 2 + 1] ?? ""}
              </span>
            ))}
          </div>
        )}

        {/* Draw offered to you */}
        {!state.result && state.drawOffer && state.drawOffer !== me && onAcceptDraw && (
          <div className="mt-3 card p-3 flex items-center gap-3">
            <Handshake size={20} aria-hidden="true" />
            <span className="flex-1 font-semibold">{them.name.split(" ")[0]} offers a draw</span>
            <button onClick={onAcceptDraw} className="btn-primary px-4 min-h-[38px]">
              Accept
            </button>
          </div>
        )}

        {!state.result && (
          <div className="mt-auto pt-5 flex gap-2.5">
            {onOfferDraw && (
              <button
                onClick={onOfferDraw}
                disabled={state.drawOffer === me}
                className="btn-secondary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Handshake size={17} aria-hidden="true" />
                {state.drawOffer === me ? "Draw offered" : "Offer draw"}
              </button>
            )}
            <button
              onClick={() => setConfirm(true)}
              className="btn-secondary flex-1 flex items-center justify-center gap-1.5"
            >
              <Flag size={17} aria-hidden="true" /> Resign
            </button>
          </div>
        )}
      </div>

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
          roast={them.id !== "bot" ? { game: "Chess" } : undefined}
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
  onClose,
}: {
  level: 1 | 2 | 3;
  color: Color;
  onClose: () => void;
}) {
  const me = meView();
  const fresh = () => newChess(color === "w" ? "me" : "bot", color === "w" ? "bot" : "me", level);
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
  onBot: (level: 1 | 2 | 3, color: Color) => void;
  onFriend: (f: Person) => void;
}) {
  const [level, setLevel] = useState<1 | 2 | 3>(2);
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
          if (f) onFriend(f);
        }}
      />
    );
  const seg = (on: boolean) => ({
    background: on ? "#E2506A" : "transparent",
    color: on ? "#fff" : "var(--ink-2)",
  });
  return (
    <Sheet title="Chess" onClose={onClose}>
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
            onBot(level, color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color)
          }
          className="btn-secondary w-full mt-4"
        >
          Start
        </button>
      </div>
    </Sheet>
  );
}
