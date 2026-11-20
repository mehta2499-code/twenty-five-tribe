/**
 * Pen fight: the desk, a game against the bot, and the lobby. Put your finger
 * on your pen and swipe the way you want it to go: a longer swipe pushes
 * harder, and pushing near an end makes it spin. Knock the other pen off the
 * desk to win.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Flag, MoreHorizontal, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, buzz } from "@/components/SocialUI";
import { GameOverBoard, type LeaderRow } from "@/components/Leaderboard";
import { SoundToggle } from "@/components/SoundToggle";
import { ChatStrip } from "@/components/GameChat";
import { sfx, useGameMusic } from "@/lib/sfx";
import { meView, mutualFriends, type Person } from "@/lib/social";
import {
  DESK,
  PEN,
  applyShot,
  botShot,
  newPenFight,
  offDesk,
  onPen,
  resignPen,
  simulate,
  type PenPose,
  type PenState,
  type Shot,
} from "@/lib/penfight";

export type PenSide = {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
};

/** Your pen is always blue, theirs red. */
const INK = [
  { body: ["#5B8CFF", "#2448C9"], cap: "#13256B", name: "Blue" },
  { body: ["#FF6B7F", "#C81E3A"], cap: "#6E0E1F", name: "Red" },
];
const FULL_SWIPE = 140; // desk units of swipe for a full-power push
const MAX_POWER = 800;
const MARGIN = 26; // floor showing round the desk

/** One pen, drawn: a glossy barrel, a cap at one end, a metal tip at the other. */
function PenShape({ p, ink, lit }: { p: PenPose; ink: (typeof INK)[number]; lit?: boolean }) {
  const L = PEN.len;
  const r = PEN.r;
  const gid = `pen-${ink.name}`;
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${(p.a * 180) / Math.PI})`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0" stopColor={ink.body[0]} />
          <stop offset="0.45" stopColor={ink.body[0]} />
          <stop offset="1" stopColor={ink.body[1]} />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <rect x={-L / 2 + 3} y={-r + 5} width={L} height={r * 2} rx={r} fill="rgba(0,0,0,0.28)" />
      {lit && (
        <rect
          x={-L / 2 - 5}
          y={-r - 5}
          width={L + 10}
          height={r * 2 + 10}
          rx={r + 5}
          fill="none"
          stroke="#B8F25C"
          strokeWidth={3}
          opacity={0.9}
        />
      )}
      {/* Tip: a metal cone and the nib */}
      <path
        d={`M ${L / 2 - 16} ${-r} L ${L / 2} -1.5 L ${L / 2} 1.5 L ${L / 2 - 16} ${r} Z`}
        fill="#C9CED8"
      />
      <circle cx={L / 2 + 1} cy={0} r={1.6} fill="#2A2F3A" />
      {/* Barrel */}
      <rect x={-L / 2} y={-r} width={L - 16} height={r * 2} rx={r} fill={`url(#${gid})`} />
      {/* Grip rings */}
      {[0, 4, 8].map((k) => (
        <rect key={k} x={L / 2 - 30 + k} y={-r} width={2} height={r * 2} fill="rgba(0,0,0,0.18)" />
      ))}
      {/* Cap with a clip */}
      <rect x={-L / 2} y={-r - 0.5} width={34} height={r * 2 + 1} rx={r} fill={ink.cap} />
      <rect x={-L / 2 + 6} y={-r - 3} width={26} height={3} rx={1.5} fill="#D9DEE7" />
      {/* Shine */}
      <rect
        x={-L / 2 + 36}
        y={-r + 2}
        width={L - 60}
        height={2.2}
        rx={1.1}
        fill="rgba(255,255,255,0.55)"
      />
    </g>
  );
}

/** The game screen (bot or online). */
export function PenTable({
  state,
  mySeat,
  you,
  them,
  thinking,
  onShot,
  onResign,
  onClose,
  onPlayAgain,
}: {
  state: PenState;
  mySeat: 0 | 1;
  you: PenSide;
  them: PenSide;
  thinking?: boolean;
  onShot: (s: Shot) => void;
  onResign: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
}) {
  useGameMusic(state.winner === undefined);
  const theirSeat = (mySeat === 0 ? 1 : 0) as 0 | 1;
  const inkOf = (seat: 0 | 1) => INK[seat === mySeat ? 0 : 1];
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [over, setOver] = useState(false);
  // The shot being played out on screen (poses frame by frame).
  const [anim, setAnim] = useState<[PenPose, PenPose] | null>(null);
  const shown = useRef(state.shots);
  const playing = anim !== null;
  const myTurn = state.winner === undefined && state.turn === mySeat && !playing;

  // A new shot: play it out frame by frame, then settle on the saved positions.
  useEffect(() => {
    if (state.shots === shown.current || !state.last) {
      shown.current = state.shots;
      return;
    }
    shown.current = state.shots;
    const { frames } = simulate(state.last.from, state.last.seat, state.last.shot);
    sfx.knock();
    let i = 0;
    let raf = 0;
    let fell = false;
    const tick = () => {
      if (i >= frames.length) {
        setAnim(null);
        return;
      }
      const f = frames[i++];
      if (!fell && (offDesk(f[0]) || offDesk(f[1]))) {
        fell = true;
        sfx.capture();
        buzz(30);
      }
      setAnim(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.shots]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.winner === undefined || playing) return setOver(false);
    if (state.winner === mySeat) sfx.win();
    const t = setTimeout(() => setOver(true), 900);
    return () => clearTimeout(t);
  }, [state.winner, playing, mySeat]);

  const poses = anim ?? state.pens;

  // ---- Swiping your pen ----
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const toDesk = (cx: number, cy: number) => {
    const el = svg.current;
    if (!el) return { x: 0, y: 0 };
    const m = el.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  const power = drag ? Math.min(1, Math.hypot(drag.x - drag.x0, drag.y - drag.y0) / FULL_SWIPE) : 0;

  const first = them.name.split(" ")[0];
  const status =
    state.winner !== undefined
      ? state.winner === mySeat
        ? state.how === "fell"
          ? `${first}'s pen went off. You win!`
          : "You knocked it off! 🎉"
        : state.how === "fell"
          ? "Your pen went off the desk"
          : `${first} knocked you off`
      : playing
        ? "…"
        : myTurn
          ? "Your turn · swipe your pen"
          : thinking
            ? `${first} is aiming…`
            : `${first}'s turn`;

  const rows: LeaderRow[] = [
    { side: you, seat: mySeat, isMe: true },
    { side: them, seat: theirSeat, isMe: false },
  ].map(({ side, seat, isMe }) => ({
    id: side.id,
    rank: state.winner === seat ? 1 : 2,
    name: isMe ? "You" : side.name,
    avatar: side.avatar,
    initials: side.initials,
    color: side.color,
    value: state.winner === seat ? "Won" : "Lost",
    link: !isMe && side.id !== "bot",
    me: isMe,
  }));

  const Player = ({ side, seat, active }: { side: PenSide; seat: 0 | 1; active: boolean }) => (
    <div className="flex items-center gap-3 px-1 py-1.5">
      <span
        className="rounded-full"
        style={{ boxShadow: active ? `0 0 0 3px ${inkOf(seat).body[0]}` : undefined }}
      >
        <Avatar src={side.avatar} initials={side.initials} color={side.color} size={40} />
      </span>
      <span className="flex-1 min-w-0 font-bold truncate" style={{ color: "#fff", fontSize: 16 }}>
        {side.name}
      </span>
      <span
        className="rounded-full"
        style={{
          width: 34,
          height: 9,
          background: `linear-gradient(90deg, ${inkOf(seat).cap} 30%, ${inkOf(seat).body[0]} 30%)`,
        }}
        aria-label={`${inkOf(seat).name} pen`}
      />
    </div>
  );

  const W = DESK.w + MARGIN * 2;
  const H = DESK.h + MARGIN * 2;
  const me = poses[mySeat];
  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none flex flex-col"
      style={{ background: "radial-gradient(120% 70% at 50% 0%, #3A2A20 0%, #120D0A 75%)" }}
    >
      <div className="mx-auto w-full max-w-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col h-full">
        <header className="flex items-center justify-between">
          <button
            onClick={() => (state.winner !== undefined ? onClose() : setMenu(true))}
            aria-label={state.winner !== undefined ? "Close" : "Game menu"}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
          >
            {state.winner !== undefined ? <X size={20} /> : <MoreHorizontal size={20} />}
          </button>
          <span className="label-caps" style={{ color: "rgba(255,255,255,0.7)" }}>
            Pen fight
          </span>
          <SoundToggle />
        </header>

        <Player
          side={them}
          seat={theirSeat}
          active={state.winner === undefined && state.turn === theirSeat}
        />

        {/* The desk */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <svg
            ref={svg}
            viewBox={`${-MARGIN} ${-MARGIN} ${W} ${H}`}
            className="max-h-full max-w-full touch-none"
            style={{ aspectRatio: `${W} / ${H}` }}
            onPointerDown={(e) => {
              if (!myTurn) return;
              const p = toDesk(e.clientX, e.clientY);
              if (!onPen(me, p.x, p.y)) return;
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              setDrag({ x0: p.x, y0: p.y, x: p.x, y: p.y });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = toDesk(e.clientX, e.clientY);
              setDrag({ ...drag, x: p.x, y: p.y });
            }}
            onPointerUp={() => {
              if (!drag) return;
              const dx = drag.x - drag.x0;
              const dy = drag.y - drag.y0;
              const len = Math.hypot(dx, dy);
              setDrag(null);
              if (len < 10) return; // a tap, not a flick
              const pw = Math.min(1, len / FULL_SWIPE) * MAX_POWER;
              buzz(15);
              onShot({ px: drag.x0, py: drag.y0, ix: (dx / len) * pw, iy: (dy / len) * pw });
            }}
            onPointerCancel={() => setDrag(null)}
            aria-label="The desk. Swipe your pen to flick it."
          >
            <defs>
              <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#C98B52" />
                <stop offset="0.5" stopColor="#B07440" />
                <stop offset="1" stopColor="#8E5A2E" />
              </linearGradient>
            </defs>
            {/* Desk edge and top */}
            <rect x={-8} y={-8} width={DESK.w + 16} height={DESK.h + 16} rx={18} fill="#5A3518" />
            <rect x={0} y={0} width={DESK.w} height={DESK.h} rx={12} fill="url(#wood)" />
            {/* Grain */}
            {Array.from({ length: 14 }, (_, k) => (
              <path
                key={k}
                d={`M 0 ${18 + k * 37} C ${DESK.w * 0.3} ${10 + k * 37}, ${DESK.w * 0.6} ${30 + k * 37}, ${DESK.w} ${16 + k * 37}`}
                stroke="rgba(70,35,10,0.18)"
                strokeWidth={2}
                fill="none"
              />
            ))}
            {/* A little school-desk graffiti */}
            <text
              x={DESK.w - 18}
              y={DESK.h - 16}
              textAnchor="end"
              fontSize={15}
              fontWeight={800}
              fill="rgba(60,30,8,0.25)"
              fontFamily="system-ui"
            >
              25 ✌
            </text>
            {/* Aim: where your pen will go, and how hard */}
            {drag && power > 0.05 && (
              <g>
                <line
                  x1={drag.x0}
                  y1={drag.y0}
                  x2={
                    drag.x0 +
                    ((drag.x - drag.x0) /
                      Math.max(1, Math.hypot(drag.x - drag.x0, drag.y - drag.y0))) *
                      (40 + power * 140)
                  }
                  y2={
                    drag.y0 +
                    ((drag.y - drag.y0) /
                      Math.max(1, Math.hypot(drag.x - drag.x0, drag.y - drag.y0))) *
                      (40 + power * 140)
                  }
                  stroke={power > 0.85 ? "#FF5470" : "#B8F25C"}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeDasharray="2 12"
                />
                <circle cx={drag.x0} cy={drag.y0} r={9} fill="none" stroke="#fff" strokeWidth={3} />
              </g>
            )}
            <PenShape p={poses[theirSeat]} ink={inkOf(theirSeat)} />
            <PenShape p={poses[mySeat]} ink={inkOf(mySeat)} lit={myTurn && !drag} />
          </svg>
        </div>

        {/* Power while aiming */}
        <div
          className="h-2 rounded-full overflow-hidden mx-6"
          style={{ background: "rgba(255,255,255,0.1)" }}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${power * 100}%`, background: power > 0.85 ? "#FF5470" : "#B8F25C" }}
          />
        </div>
        <p
          className="mt-2 text-center font-extrabold"
          style={{ color: "#fff", fontSize: 16 }}
          role="status"
        >
          {status}
        </p>
        <div className="mt-2">
          <ChatStrip lines={2} />
        </div>
        <Player side={{ ...you, name: "You" }} seat={mySeat} active={myTurn} />
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
      {over && state.winner !== undefined && (
        <GameOverBoard
          game="Pen fight"
          headline={state.winner === mySeat ? "You win!" : `${first} wins`}
          note={`${state.shots} flick${state.shots === 1 ? "" : "s"}`}
          rows={rows}
          roast={them.id !== "bot" ? { game: "Pen fight" } : undefined}
          onClose={onClose}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  );
}

const BOT_NAMES: Record<1 | 2 | 3, string> = {
  1: "Backbencher bot",
  2: "Monitor bot",
  3: "Topper bot",
};

/** Pen fight against the computer (nothing saved). */
export function LocalPenFight({ level, onClose }: { level: 1 | 2 | 3; onClose: () => void }) {
  const me = meView();
  const fresh = () => newPenFight("me", "bot", level);
  const [state, setState] = useState<PenState>(fresh);
  const [thinking, setThinking] = useState(false);
  // The bot's turn: wait for the last shot to finish on screen, aim a moment, flick.
  useEffect(() => {
    if (state.winner !== undefined || state.turn !== 1) return;
    setThinking(true);
    const lastFrames = state.last
      ? simulate(state.last.from, state.last.seat, state.last.shot).frames.length
      : 0;
    const t = setTimeout(
      () => {
        const shot = botShot(state, level);
        setThinking(false);
        setState((s) => (s.turn === 1 ? applyShot(s, shot) : s));
      },
      (lastFrames / 60) * 1000 + 700,
    );
    return () => clearTimeout(t);
  }, [state, level]);
  return (
    <PenTable
      state={state}
      mySeat={0}
      you={{ id: "me", name: me.name, avatar: me.avatar, initials: me.initials }}
      them={{ id: "bot", name: BOT_NAMES[level], initials: "🤖" }}
      thinking={thinking}
      onShot={(sh) =>
        setState((s) => (s.turn === 0 && s.winner === undefined ? applyShot(s, sh) : s))
      }
      onResign={() => setState((s) => resignPen(s, 0))}
      onClose={onClose}
      onPlayAgain={() => setState(fresh())}
    />
  );
}

/** Start a pen fight: someone from your 25, or the bot. */
export function PenLobby({
  onClose,
  onBot,
  onFriend,
}: {
  onClose: () => void;
  onBot: (level: 1 | 2 | 3) => void;
  onFriend: (f: Person) => void;
}) {
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [picking, setPicking] = useState(false);
  const friends = useMemo(() => mutualFriends(), []);
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
    background: on ? "#B07440" : "transparent",
    color: on ? "#fff" : "var(--ink-2)",
  });
  return (
    <Sheet title="Pen fight" onClose={onClose}>
      <p className="meta mb-4" style={{ fontSize: 13.5 }}>
        Swipe your pen to flick it. Knock theirs off the desk to win, but don't fall off yourself.
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
        They get a challenge in chat. It starts when they're in.
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
        <button onClick={() => onBot(level)} className="btn-secondary w-full mt-4">
          Play the bot
        </button>
      </div>
    </Sheet>
  );
}
