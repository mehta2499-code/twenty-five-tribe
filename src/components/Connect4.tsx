/**
 * Connect 4: the board, a game against the bot, and the lobby (play someone
 * from your 25 online, or the bot at three levels). Our own look: a deep
 * blue frame with red and yellow discs that drop into place.
 */
import { useEffect, useMemo, useState } from "react";
import { Bot, Flag, MoreHorizontal, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, buzz } from "@/components/SocialUI";
import { GameOverBoard, type LeaderRow } from "@/components/Leaderboard";
import { SoundToggle } from "@/components/SoundToggle";
import { ChatStrip } from "@/components/GameChat";
import { sfx, useGameMusic } from "@/lib/sfx";
import { meView, mutualFriends, type Person } from "@/lib/social";
import {
  COLS,
  ROWS,
  at,
  botColumn,
  dropDisc,
  landing,
  newConnect4,
  resignC4,
  type C4State,
  type Disc,
} from "@/lib/connect4";

export type C4Side = {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
};

const RED = { light: "#FF8A99", mid: "#F2364F", dark: "#A3122A", name: "Red" };
const YELLOW = { light: "#FFF1A8", mid: "#FFC928", dark: "#C98A00", name: "Yellow" };
const tone = (d: Disc) => (d === "r" ? RED : YELLOW);

/** A glossy disc: a rim, a raised centre ring and a shine. */
function DiscDot({ d, size, glow }: { d: Disc; size: number; glow?: boolean }) {
  const t = tone(d);
  return (
    <span
      className={`relative block rounded-full ${glow ? "c4-win" : ""}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 45%, ${t.mid} 0%, ${t.mid} 52%, ${t.dark} 100%)`,
        boxShadow: glow
          ? `0 0 0 3px #fff, 0 0 22px ${t.light}`
          : `inset 0 -${Math.round(size * 0.07)}px 0 rgba(0,0,0,0.22), 0 2px 3px rgba(0,0,0,0.35)`,
      }}
    >
      {/* Raised inner ring */}
      <span
        className="absolute rounded-full"
        style={{
          inset: "20%",
          background: `radial-gradient(circle at 40% 35%, ${t.light}, ${t.mid} 60%)`,
          boxShadow: `inset 0 0 0 ${Math.max(1.5, size * 0.04)}px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.25)`,
        }}
      />
      {/* Shine */}
      <span
        className="absolute rounded-full"
        style={{
          left: "18%",
          top: "12%",
          width: "34%",
          height: "22%",
          background: "rgba(255,255,255,0.55)",
          filter: "blur(1px)",
          transform: "rotate(-25deg)",
        }}
      />
    </span>
  );
}

/** Online games: waiting for your friend to open it. Starts by itself once they're in. */
export function Connect4Waiting({
  you,
  them,
  themIn,
  cancelled,
  onCancel,
  onClose,
  title = "Connect 4",
}: {
  title?: string;
  you: C4Side;
  them: C4Side;
  themIn: boolean;
  cancelled?: boolean;
  onCancel: () => void;
  onClose: () => void;
}) {
  const first = them.name.split(" ")[0];
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        background: "radial-gradient(120% 70% at 50% 0%, #1E2A5C 0%, #0D0F1E 70%)",
        color: "#fff",
      }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 min-h-full flex flex-col">
        <header className="flex items-center justify-between">
          <span className="font-extrabold" style={{ fontSize: 19 }}>
            {title} · waiting room
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <X size={22} />
          </button>
        </header>
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          {cancelled ? (
            <>
              <p className="font-extrabold" style={{ fontSize: 24 }}>
                Game called off
              </p>
              <button onClick={onClose} className="btn-primary mt-8 px-8">
                Back to games
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-6">
                {[
                  { side: you, here: true, label: "You" },
                  { side: them, here: themIn, label: first },
                ].map(({ side, here, label }) => (
                  <div key={side.id} className="flex flex-col items-center gap-2">
                    <span
                      className="rounded-full"
                      style={{
                        opacity: here ? 1 : 0.5,
                        boxShadow: here
                          ? "0 0 0 3px var(--lime)"
                          : "0 0 0 2px rgba(255,255,255,0.2)",
                      }}
                    >
                      <Avatar
                        src={side.avatar}
                        initials={side.initials}
                        color={side.color}
                        size={72}
                      />
                    </span>
                    <span className="font-bold">{label}</span>
                    <span
                      className="text-[13px] font-bold"
                      style={{ color: here ? "var(--lime)" : "rgba(255,255,255,0.5)" }}
                    >
                      {here ? "in" : "joining…"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-[15px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                {themIn
                  ? "Both in. Starting…"
                  : `We sent ${first} the challenge. The game starts as soon as they open it.`}
              </p>
              <button
                onClick={onCancel}
                className="mt-8 min-h-[44px] px-5 font-bold"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Call it off
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The game screen (bot or online). */
export function Connect4Table({
  state,
  me,
  you,
  them,
  thinking,
  onDrop,
  onResign,
  onClose,
  onPlayAgain,
}: {
  state: C4State;
  me: Disc;
  you: C4Side;
  them: C4Side;
  thinking?: boolean;
  onDrop: (col: number) => void;
  onResign: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
}) {
  useGameMusic(!state.result);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [over, setOver] = useState(false);
  const [aim, setAim] = useState<number | null>(null);
  const myTurn = !state.result && state.turn === me;
  const them_ = me === "r" ? "y" : "r";
  const win = useMemo(() => new Set(state.result?.line ?? []), [state.result]);

  // A disc lands: a knock. The game ends: a moment to see the four, then the board.
  useEffect(() => {
    if (state.last) sfx.knock();
  }, [state.moves]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state.result) return setOver(false);
    if (state.result.winner === me) sfx.win();
    const t = setTimeout(() => setOver(true), state.result.reason === "resign" ? 300 : 1800);
    return () => clearTimeout(t);
  }, [state.result, me]);

  // Fit the board across the screen: 7 holes, 6 gaps and the frame (~8.3 holes wide).
  const room = (typeof window === "undefined" ? 390 : Math.min(window.innerWidth, 448)) - 32;
  const size = Math.min(52, Math.floor(room / 8.3));
  const gap = Math.round(size * 0.14);
  const status = state.result
    ? state.result.winner === null
      ? "It's a draw"
      : state.result.winner === me
        ? "You connected four! 🎉"
        : `${them.name.split(" ")[0]} connected four`
    : myTurn
      ? "Your turn · tap a column"
      : thinking
        ? `${them.name.split(" ")[0]} is thinking…`
        : `${them.name.split(" ")[0]}'s turn`;

  const rows: LeaderRow[] = [
    { side: you, d: me, isMe: true },
    { side: them, d: them_ as Disc, isMe: false },
  ].map(({ side, d, isMe }) => ({
    id: side.id,
    rank: state.result?.winner === null ? 1 : state.result?.winner === d ? 1 : 2,
    name: isMe ? "You" : side.name,
    avatar: side.avatar,
    initials: side.initials,
    color: side.color,
    value: state.result?.winner === d ? "Won" : state.result?.winner === null ? "Draw" : "Lost",
    link: !isMe && side.id !== "bot",
    me: isMe,
    // Never dropped a disc (left before playing): can't be roasted.
    played: isMe || side.id === "bot" || state.board.includes(d),
  }));

  const Player = ({ side, d, active }: { side: C4Side; d: Disc; active: boolean }) => (
    <div className="flex items-center gap-3 px-1 py-2">
      <span
        className="rounded-full"
        style={{ boxShadow: active ? `0 0 0 3px ${tone(d).light}` : undefined }}
      >
        <Avatar src={side.avatar} initials={side.initials} color={side.color} size={42} />
      </span>
      <span className="flex-1 min-w-0 font-bold truncate" style={{ color: "#fff", fontSize: 16 }}>
        {side.name}
      </span>
      <DiscDot d={d} size={22} />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto select-none"
      style={{ background: "radial-gradient(120% 70% at 50% 0%, #1E2A5C 0%, #0D0F1E 70%)" }}
    >
      <div className="mx-auto w-full max-w-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col min-h-full">
        <header className="flex items-center justify-between">
          <button
            onClick={() => (state.result ? onClose() : setMenu(true))}
            aria-label={state.result ? "Close" : "Game menu"}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
          >
            {state.result ? <X size={20} /> : <MoreHorizontal size={20} />}
          </button>
          <span className="label-caps" style={{ color: "rgba(255,255,255,0.7)" }}>
            Connect 4
          </span>
          <SoundToggle />
        </header>

        <div className="mt-3">
          <Player side={them} d={them_ as Disc} active={!state.result && state.turn !== me} />
        </div>

        {/* The board */}
        <div className="flex-1 flex flex-col justify-center items-center py-3">
          {/* Your disc, ready above the column you're aiming at */}
          <div
            className="grid mb-1.5"
            style={{
              gridTemplateColumns: `repeat(${COLS}, ${size}px)`,
              columnGap: gap,
              height: Math.round(size * 0.8),
            }}
            aria-hidden="true"
          >
            {Array.from({ length: COLS }, (_, c) => (
              <span key={c} className="flex items-end justify-center">
                {myTurn && (aim ?? 3) === c && (
                  <span style={{ animation: "float 1.6s ease-in-out infinite" }}>
                    <DiscDot d={me} size={Math.round(size * 0.72)} />
                  </span>
                )}
              </span>
            ))}
          </div>
          <div
            className="relative rounded-[22px]"
            style={{
              padding: gap * 1.5,
              background: "linear-gradient(180deg, #3D6BFF 0%, #2448C9 55%, #1A35A0 100%)",
              boxShadow:
                "0 24px 50px rgba(0,0,0,0.6), 0 0 0 2px #10236E, inset 0 3px 0 rgba(255,255,255,0.3), inset 0 -6px 0 rgba(0,0,0,0.25)",
            }}
          >
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${COLS}, ${size}px)`, columnGap: gap }}
            >
              {Array.from({ length: COLS }, (_, c) => {
                const open = landing(state.board, c) >= 0;
                return (
                  <button
                    key={c}
                    disabled={!myTurn || !open}
                    onPointerEnter={() => setAim(c)}
                    onPointerLeave={() => setAim(null)}
                    onClick={() => {
                      buzz(10);
                      onDrop(c);
                    }}
                    aria-label={`Drop in column ${c + 1}${open ? "" : " (full)"}`}
                    className="grid rounded-[14px]"
                    style={{
                      rowGap: gap,
                      background:
                        myTurn && open && aim === c ? "rgba(255,255,255,0.08)" : "transparent",
                    }}
                  >
                    {Array.from({ length: ROWS }, (_, r) => {
                      const v = state.board[at(c, r)];
                      const just = state.last?.col === c && state.last?.row === r;
                      return (
                        <span
                          key={r}
                          className="block rounded-full relative"
                          style={{
                            width: size,
                            height: size,
                            background: "radial-gradient(circle at 50% 40%, #0A1238, #050A24)",
                            boxShadow:
                              "inset 0 5px 8px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.25), 0 0 0 2px rgba(10,25,90,0.6)",
                          }}
                        >
                          {v !== "." && (
                            <span
                              className="block relative"
                              style={
                                just
                                  ? ({
                                      zIndex: 5,
                                      animation: "c4-drop 0.42s cubic-bezier(.3,1.4,.5,1) both",
                                      "--from": `${-(r + 1) * (size + gap)}px`,
                                    } as React.CSSProperties)
                                  : undefined
                              }
                            >
                              <DiscDot d={v as Disc} size={size} glow={win.has(at(c, r))} />
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </button>
                );
              })}
            </div>
          </div>

          <p
            className="mt-4 text-center font-extrabold"
            style={{ color: "#fff", fontSize: 17 }}
            role="status"
          >
            {status}
          </p>
          {/* Game chat (online games). */}
          <div className="w-full mt-3">
            <ChatStrip />
          </div>
        </div>

        <div>
          <Player side={{ ...you, name: "You" }} d={me} active={myTurn} />
        </div>
      </div>

      {menu && (
        <Sheet title="Game" onClose={() => setMenu(false)}>
          <div className="grid gap-2.5">
            <button onClick={onClose} className="btn-secondary">
              Leave for now
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setConfirm(true);
              }}
              className="btn-danger flex items-center justify-center gap-2"
            >
              <Flag size={17} aria-hidden="true" /> Resign
            </button>
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
          game="Connect 4"
          headline={
            state.result.winner === null
              ? "Draw"
              : state.result.winner === me
                ? "You win!"
                : `${them.name.split(" ")[0]} wins`
          }
          note={
            state.result.reason === "resign"
              ? state.result.winner === me
                ? `${them.name.split(" ")[0]} resigned`
                : "You resigned"
              : state.result.reason === "full"
                ? "Board full, nobody got four"
                : undefined
          }
          rows={rows}
          // Only a win on the board (four in a row) can be roasted, not a resign.
          roast={
            them.id !== "bot" && state.result.reason === "four" ? { game: "Connect 4" } : undefined
          }
          onClose={onClose}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  );
}

const BOT_NAMES: Record<1 | 2 | 3, string> = { 1: "Rookie bot", 2: "Sharp bot", 3: "Master bot" };

/** Connect 4 against the computer (nothing saved). You're red and go first. */
export function LocalConnect4({
  level,
  first,
  onClose,
}: {
  level: 1 | 2 | 3;
  /** You go first (red), or the bot does. */
  first: boolean;
  onClose: () => void;
}) {
  const me = meView();
  const mine: Disc = first ? "r" : "y";
  const fresh = () => newConnect4(first ? "me" : "bot", first ? "bot" : "me", level);
  const [state, setState] = useState<C4State>(fresh);
  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    if (state.result || state.turn === mine) return;
    setThinking(true);
    const t = setTimeout(() => {
      const c = botColumn(state, level);
      setThinking(false);
      setState((s) => dropDisc(s, c) ?? s);
    }, 550);
    return () => clearTimeout(t);
  }, [state, mine, level]);
  return (
    <Connect4Table
      state={state}
      me={mine}
      you={{ id: "me", name: me.name, avatar: me.avatar, initials: me.initials }}
      them={{ id: "bot", name: BOT_NAMES[level], initials: "🤖" }}
      thinking={thinking}
      onDrop={(c) => setState((s) => (s.turn === mine ? (dropDisc(s, c) ?? s) : s))}
      onResign={() => setState((s) => resignC4(s, mine))}
      onClose={onClose}
      onPlayAgain={() => setState(fresh())}
    />
  );
}

/** Start Connect 4: someone from your 25, or the bot. */
export function Connect4Lobby({
  onClose,
  onBot,
  onFriend,
}: {
  onClose: () => void;
  onBot: (level: 1 | 2 | 3, first: boolean) => void;
  onFriend: (f: Person) => void;
}) {
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [first, setFirst] = useState(true);
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
    background: on ? "#2F5BE0" : "transparent",
    color: on ? "#fff" : "var(--ink-2)",
  });
  return (
    <Sheet title="Connect 4" onClose={onClose}>
      <p className="meta mb-4" style={{ fontSize: 13.5 }}>
        Drop your discs. First to get four in a row (across, down or diagonal) wins.
      </p>
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
        <div className="flex rounded-xl p-1" style={{ background: "var(--surface)" }} role="group">
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
        <p className="label-caps mt-3 mb-1.5">Who goes first</p>
        <div className="flex rounded-xl p-1" style={{ background: "var(--surface)" }} role="group">
          {[true, false].map((f) => (
            <button
              key={String(f)}
              onClick={() => setFirst(f)}
              aria-pressed={first === f}
              className="flex-1 rounded-lg py-2 font-bold"
              style={seg(first === f)}
            >
              {f ? "Me" : "The bot"}
            </button>
          ))}
        </div>
        <button onClick={() => onBot(level, first)} className="btn-secondary w-full mt-4">
          Play the bot
        </button>
      </div>
    </Sheet>
  );
}
