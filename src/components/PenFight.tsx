/**
 * Pen fight, 2 to 6 players: the desk, games against bots, and the lobby. Put
 * your finger on your pen and swipe the way you want it to go: a longer swipe
 * pushes harder, and pushing near an end makes it spin. A pen only falls once
 * its middle goes past the edge. Last pen on the desk wins.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Flag, Minus, MoreHorizontal, Plus, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, buzz } from "@/components/SocialUI";
import { GameOverBoard, type LeaderRow } from "@/components/Leaderboard";
import { SoundToggle } from "@/components/SoundToggle";
import { ChatStrip } from "@/components/GameChat";
import { sfx, useGameMusic } from "@/lib/sfx";
import { meView, mutualFriends, type Person } from "@/lib/social";
import {
  DESK,
  FALL_FRAMES,
  MAX_PLAYERS,
  PEN,
  applyShot,
  botShot,
  newPenFight,
  onPen,
  outOf,
  penPlaces,
  resignPen,
  simulate,
  type Frame,
  type PenPose,
  type PenState,
  type Shot,
} from "@/lib/penfight";
import {
  MEDALS,
  RIVAL,
  SKINS,
  addBotWin,
  chooseSkin,
  chosenSkin,
  loadPenWins,
  medalFor,
  skinById,
  unlockNote,
  unlocked,
  type Skin,
} from "@/lib/penSkins";

export type PenSide = {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
};

const FULL_SWIPE = 140; // desk units of swipe for a full-power push
const MAX_POWER = 800;
const MARGIN = 34; // floor showing round the desk (pens drop off into it)

/** Colours for pens picked twice: each repeat gets its own. */
const TWINS: [string, string, string][] = [
  ["#FF6B7F", "#C81E3A", "#6E0E1F"],
  ["#6BE3A0", "#1E9E5A", "#0E4A2A"],
  ["#FFB547", "#D9761A", "#6B3608"],
  ["#C08BFF", "#7A3FD6", "#3A1670"],
  ["#5BE0E8", "#1A9AA6", "#0B4A50"],
];
function skinsFor(state: PenState): Skin[] {
  const seen = new Set<string>();
  let t = 0;
  return state.players.map((_, i) => {
    const s = skinById(state.skins?.[i]);
    if (!seen.has(s.id)) {
      seen.add(s.id);
      return s;
    }
    const [a, b, cap] = TWINS[t++ % TWINS.length];
    return { ...RIVAL, id: `twin-${i}`, body: [a, b], cap };
  });
}

export function PenShape({
  p,
  skin,
  lit,
  uid,
  fall = 0,
}: {
  /** How far into falling off the desk (0 = on it): it shrinks and fades as it drops. */
  fall?: number;
  p: PenPose;
  skin: Skin;
  lit?: boolean;
  /** Unique per pen on screen (for its gradients). */
  uid: string;
}) {
  const L = PEN.len;
  const r = PEN.r;
  const gid = `pen-${uid}`;
  const rain = ["#FF6B7F", "#FFB547", "#FFE36B", "#6BE3A0", "#5BB8FF", "#9B7BFF"];
  return (
    <g
      transform={`translate(${p.x} ${p.y}) rotate(${(p.a * 180) / Math.PI}) scale(${Math.max(0.35, 1 - fall * 0.025)})`}
      opacity={fall ? Math.max(0, 1 - fall / FALL_FRAMES) : 1}
    >
      <defs>
        {skin.pattern === "rainbow" ? (
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            {rain.map((c, k) => (
              <stop key={k} offset={k / (rain.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        ) : (
          <linearGradient id={gid} x1="0" y1="-1" x2="0" y2="1">
            <stop offset="0" stopColor={skin.body[0]} />
            <stop offset="0.45" stopColor={skin.body[0]} />
            <stop offset="1" stopColor={skin.body[1]} />
          </linearGradient>
        )}
        <clipPath id={`${gid}-c`}>
          <rect x={-L / 2} y={-r} width={L - 16} height={r * 2} rx={r} />
        </clipPath>
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
      {/* Tip */}
      {skin.tip === "fountain" ? (
        <>
          <path
            d={`M ${L / 2 - 18} ${-r} L ${L / 2 + 2} -0.8 L ${L / 2 + 2} 0.8 L ${L / 2 - 18} ${r} Z`}
            fill={skin.clip}
          />
          <line
            x1={L / 2 - 10}
            y1={0}
            x2={L / 2 + 2}
            y2={0}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={0.8}
          />
          <circle cx={L / 2 - 11} cy={0} r={1.3} fill="rgba(0,0,0,0.45)" />
        </>
      ) : (
        <>
          <path
            d={`M ${L / 2 - 16} ${-r} L ${L / 2} -1.5 L ${L / 2} 1.5 L ${L / 2 - 16} ${r} Z`}
            fill="#C9CED8"
          />
          <circle cx={L / 2 + 1} cy={0} r={1.6} fill="#2A2F3A" />
        </>
      )}
      {/* Barrel */}
      <rect x={-L / 2} y={-r} width={L - 16} height={r * 2} rx={r} fill={`url(#${gid})`} />
      <g clipPath={`url(#${gid}-c)`}>
        {skin.pattern === "stripes" &&
          Array.from({ length: 12 }, (_, k) => (
            <rect
              key={k}
              x={-L / 2 + k * 11}
              y={-r - 4}
              width={4}
              height={r * 2 + 8}
              fill="rgba(255,255,255,0.75)"
              transform={`skewX(-30)`}
            />
          ))}
        {skin.pattern === "stars" &&
          [
            [-30, -3],
            [-12, 2],
            [5, -2],
            [20, 3],
            [34, -1],
            [-44, 1],
          ].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 2 ? 0.9 : 1.4} fill="#fff" />)}
      </g>
      {/* Grip rings */}
      {[0, 4, 8].map((k) => (
        <rect key={k} x={L / 2 - 30 + k} y={-r} width={2} height={r * 2} fill="rgba(0,0,0,0.18)" />
      ))}
      {/* Cap with a clip (and a button on click pens) */}
      {skin.tip === "click" && (
        <rect x={-L / 2 - 7} y={-r + 2.5} width={9} height={r * 2 - 5} rx={2} fill={skin.clip} />
      )}
      <rect x={-L / 2} y={-r - 0.5} width={34} height={r * 2 + 1} rx={r} fill={skin.cap} />
      <rect x={-L / 2 + 6} y={-r - 3} width={26} height={3} rx={1.5} fill={skin.clip} />
      {/* Shine */}
      <rect
        x={-L / 2 + 36}
        y={-r + 2}
        width={L - 60}
        height={skin.pattern === "shine" ? 3 : 2.2}
        rx={1.1}
        fill={skin.pattern === "shine" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)"}
      />
    </g>
  );
}

/** The game screen (bots or online). `sides[i]` is who plays seat i. */
export function PenTable({
  state,
  mySeat,
  sides,
  thinking,
  onShot,
  onResign,
  onSkip,
  onClose,
  onPlayAgain,
  unlock,
}: {
  state: PenState;
  mySeat: number;
  sides: PenSide[];
  thinking?: boolean;
  onShot: (s: Shot) => void;
  onResign: () => void;
  /** Online: skip someone who's gone quiet (shown after a minute). */
  onSkip?: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
  /** What winning this game unlocked ("Unlocked: Ink Fountain pen"). */
  unlock?: string;
}) {
  useGameMusic(state.winner === undefined);
  const n = state.players.length;
  const out = outOf(state);
  const skins = useMemo(() => skinsFor(state), [state.players.join(), (state.skins ?? []).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pens, setPens] = useState(false);
  const [over, setOver] = useState(false);
  // The shot being played out on screen, frame by frame.
  const [anim, setAnim] = useState<Frame | null>(null);
  const shown = useRef(state.shots);
  const playing = anim !== null;
  const iAmOut = out[mySeat];
  const myTurn = state.winner === undefined && state.turn === mySeat && !playing && !iAmOut;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // A new shot: play it out, pens tipping off the edge as they go, then settle.
  useEffect(() => {
    if (state.shots === shown.current || !state.last) {
      shown.current = state.shots;
      return;
    }
    shown.current = state.shots;
    const last = state.last;
    const { frames } = simulate(
      last.from,
      last.outBefore ?? last.from.map(() => false),
      last.seat,
      last.shot,
    );
    sfx.knock();
    let i = 0;
    let raf = 0;
    const falling = new Set<number>();
    const tick = () => {
      if (i >= frames.length) {
        setAnim(null);
        return;
      }
      const f = frames[i++];
      f.fall.forEach((v, k) => {
        if (v > 0 && v < FALL_FRAMES && !falling.has(k) && !(last.outBefore ?? [])[k]) {
          falling.add(k);
          sfx.capture();
          buzz(30);
        }
      });
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

  const poses: PenPose[] = anim?.poses ?? state.pens;
  const fall: number[] = anim?.fall ?? out.map((o) => (o ? FALL_FRAMES : 0));

  // ---- Swiping your pen ----
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const toDesk = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  const power = drag ? Math.min(1, Math.hypot(drag.x - drag.x0, drag.y - drag.y0) / FULL_SWIPE) : 0;

  const nameOf = (i: number) =>
    i === mySeat ? "You" : (sides[i]?.name.split(" ")[0] ?? "Someone");
  const turnName = nameOf(state.turn);
  const quiet =
    !!onSkip &&
    !myTurn &&
    !playing &&
    state.winner === undefined &&
    now - (state.turnAt ?? now) > 60_000;
  const status = playing
    ? "…"
    : state.winner !== undefined
      ? state.winner === mySeat
        ? "Last pen on the desk. You win! 🎉"
        : `${nameOf(state.winner)} wins`
      : iAmOut
        ? `You're out · ${turnName}'s turn`
        : myTurn
          ? "Your turn · swipe your pen"
          : thinking
            ? `${turnName} is aiming…`
            : `${turnName}'s turn`;

  const places = penPlaces(state);
  const rows: LeaderRow[] = places.map((seat, k) => ({
    id: sides[seat]?.id ?? String(seat),
    rank: k + 1,
    name: seat === mySeat ? "You" : (sides[seat]?.name ?? "Someone"),
    avatar: sides[seat]?.avatar,
    initials: sides[seat]?.initials ?? "?",
    color: sides[seat]?.color,
    value: k === 0 ? "Won" : `#${k + 1}`,
    link: seat !== mySeat && !(sides[seat]?.id ?? "").startsWith("bot"),
    me: seat === mySeat,
  }));
  const humanRivals = sides.some((s, i) => i !== mySeat && !s.id.startsWith("bot"));

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
            Pen fight{n > 2 ? ` · ${out.filter((o) => !o).length}/${n} left` : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPens(true)}
              className="h-10 px-3 rounded-full text-[13px] font-bold flex items-center gap-1"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
              aria-label="Your pens and medals"
            >
              🖊️ Pens
            </button>
            <SoundToggle />
          </div>
        </header>

        {/* Everyone at the desk, in turn order */}
        <div className="mt-2 flex justify-center gap-1.5" role="list">
          {state.players.map((_, i) => {
            const active = state.winner === undefined && state.turn === i && !out[i];
            return (
              <div
                key={i}
                role="listitem"
                aria-label={`${nameOf(i)}${out[i] ? ", out" : active ? ", to flick" : ""}`}
                className="flex flex-col items-center rounded-2xl px-1 pt-1.5 pb-1"
                style={{
                  width: n > 4 ? 56 : 72,
                  background: active ? "rgba(184,242,92,0.16)" : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${active ? "#B8F25C" : "transparent"}`,
                  opacity: out[i] ? 0.38 : 1,
                }}
              >
                <span className="relative">
                  <Avatar
                    src={sides[i]?.avatar}
                    initials={sides[i]?.initials ?? "?"}
                    color={sides[i]?.color}
                    size={30}
                  />
                  {out[i] && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[15px]"
                      aria-hidden="true"
                    >
                      ❌
                    </span>
                  )}
                </span>
                <span
                  className="mt-0.5 w-full truncate text-center text-[11.5px] font-bold"
                  style={{ color: "#fff" }}
                >
                  {nameOf(i)}
                </span>
                <span
                  className="mt-0.5 rounded-full"
                  style={{
                    width: 26,
                    height: 6,
                    background: `linear-gradient(90deg, ${skins[i].cap} 30%, ${skins[i].body[0]} 30%)`,
                  }}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>

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
            {Array.from({ length: 14 }, (_, k) => (
              <path
                key={k}
                d={`M 0 ${18 + k * 37} C ${DESK.w * 0.3} ${10 + k * 37}, ${DESK.w * 0.6} ${30 + k * 37}, ${DESK.w} ${16 + k * 37}`}
                stroke="rgba(70,35,10,0.18)"
                strokeWidth={2}
                fill="none"
              />
            ))}
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
            {/* Pens: fallen ones gone; falling ones drop away; yours on top */}
            {poses.map((p, i) =>
              i === mySeat || fall[i] >= FALL_FRAMES ? null : (
                <PenShape key={i} p={p} skin={skins[i]} uid={`s${i}`} fall={fall[i]} />
              ),
            )}
            {fall[mySeat] < FALL_FRAMES && (
              <PenShape
                p={me}
                skin={skins[mySeat]}
                uid="me"
                fall={fall[mySeat]}
                lit={myTurn && !drag}
              />
            )}
          </svg>
        </div>

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
        {quiet && (
          <button
            onClick={onSkip}
            className="btn-quiet mx-auto mt-1 px-3 min-h-[34px] text-sm"
            style={{ color: "#fff" }}
          >
            Skip {turnName}'s turn
          </button>
        )}
        <div className="mt-2">
          <ChatStrip lines={2} />
        </div>
      </div>

      {pens && (
        <Sheet title="Your pens" onClose={() => setPens(false)}>
          <PensSheet />
          <p className="meta mt-1 mb-2" style={{ fontSize: 12.5 }}>
            A new pick shows from your next game.
          </p>
        </Sheet>
      )}
      {menu && (
        <Sheet title="Game" onClose={() => setMenu(false)}>
          <div className="grid gap-2.5">
            <button onClick={onClose} className="btn-secondary">
              Leave for now
            </button>
            {!iAmOut && (
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
      {over && state.winner !== undefined && (
        <GameOverBoard
          game="Pen fight"
          headline={state.winner === mySeat ? "You win!" : `${nameOf(state.winner)} wins`}
          note={[`${state.shots} flick${state.shots === 1 ? "" : "s"}`, unlock]
            .filter(Boolean)
            .join(" · ")}
          rows={rows}
          roast={humanRivals ? { game: "Pen fight" } : undefined}
          onClose={onClose}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  );
}

/** Your medal and pens, loaded fresh (for the Pens button on the desk). */
function PensSheet() {
  const [wins, setWins] = useState<number | null>(null);
  const [pick, setPick] = useState("classic");
  useEffect(() => {
    void loadPenWins().then((w) => {
      setWins(w);
      setPick(chosenSkin(w).id);
    });
  }, []);
  if (wins === null) return <p className="meta py-6 text-center">Loading…</p>;
  return (
    <PenLocker
      wins={wins}
      pick={pick}
      onPick={(id) => {
        chooseSkin(id);
        setPick(id);
      }}
    />
  );
}

const BOTS: { name: string; pen: string }[] = [
  { name: "Backbencher", pen: "exam" },
  { name: "Monitor", pen: "fountain" },
  { name: "Topper", pen: "gold" },
  { name: "Clown", pen: "candy" },
  { name: "Nerd", pen: "chrome" },
];

/** Pen fight against 1 to 5 bots (nothing saved). */
export function LocalPenFight({
  level,
  bots,
  wins,
  onClose,
}: {
  level: 1 | 2 | 3;
  /** How many bots (1-5). */
  bots: number;
  /** Your wins so far (picks your pen, says what a win unlocks). */
  wins: number;
  onClose: () => void;
}) {
  const me = meView();
  const [myWins, setMyWins] = useState(wins);
  const list = BOTS.slice(0, Math.max(1, Math.min(MAX_PLAYERS - 1, bots)));
  // You always flick first against bots.
  const fresh = (): PenState => ({
    ...newPenFight(["me", ...list.map((_, i) => `bot${i + 1}`)], level, [
      chosenSkin(myWins).id,
      ...list.map((b) => b.pen),
    ]),
    turn: 0,
  });
  const [state, setState] = useState<PenState>(fresh);
  const [thinking, setThinking] = useState(false);
  const [unlock, setUnlock] = useState<string | undefined>();
  // A win against the Medium or Hard bots counts towards medals and pens.
  const counted = useRef<number | null>(null);
  useEffect(() => {
    if (state.winner !== 0 || level < 2 || counted.current === state.shots) return;
    counted.current = state.shots;
    addBotWin();
    setUnlock(unlockNote(myWins, myWins + 1));
    setMyWins((w) => w + 1);
  }, [state.winner, state.shots, level]); // eslint-disable-line react-hooks/exhaustive-deps
  // A bot's turn: wait for the last flick to finish on screen, aim a moment, flick.
  useEffect(() => {
    if (state.winner !== undefined || state.turn === 0) return;
    setThinking(true);
    const last = state.last;
    const lastFrames = last
      ? simulate(last.from, last.outBefore ?? last.from.map(() => false), last.seat, last.shot)
          .frames.length
      : 0;
    const t = setTimeout(
      () => {
        const shot = botShot(state, level);
        setThinking(false);
        setState((s) => (s.turn !== 0 && s.winner === undefined ? applyShot(s, shot) : s));
      },
      (lastFrames / 60) * 1000 + 600,
    );
    return () => clearTimeout(t);
  }, [state, level]);
  const sides: PenSide[] = [
    { id: "me", name: me.name, avatar: me.avatar, initials: me.initials },
    ...list.map((b, i) => ({ id: `bot${i + 1}`, name: `${b.name} bot`, initials: "🤖" })),
  ];
  return (
    <PenTable
      state={state}
      mySeat={0}
      sides={sides}
      thinking={thinking}
      onShot={(sh) =>
        setState((s) => (s.turn === 0 && s.winner === undefined ? applyShot(s, sh) : s))
      }
      onResign={() => setState((s) => resignPen(s, 0))}
      onClose={onClose}
      unlock={unlock}
      onPlayAgain={() => {
        setUnlock(undefined);
        setState(fresh());
      }}
    />
  );
}

/** Start a pen fight: up to 5 from your 25, or 1 to 5 bots. */
export function PenLobby({
  onClose,
  onBot,
  onFriends,
}: {
  onClose: () => void;
  onBot: (level: 1 | 2 | 3, bots: number, wins: number) => void;
  onFriends: (f: Person[]) => void;
}) {
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [bots, setBots] = useState(1);
  const [picking, setPicking] = useState(false);
  const [wins, setWins] = useState<number | null>(null);
  const [pick, setPick] = useState("classic");
  useEffect(() => {
    void loadPenWins().then((w) => {
      setWins(w);
      setPick(chosenSkin(w).id);
    });
  }, []);
  const friends = useMemo(() => mutualFriends(), []);
  if (picking)
    return (
      <FriendPicker
        title="Who's playing? (up to 5)"
        cta="Send challenge"
        max={MAX_PLAYERS - 1}
        onClose={() => setPicking(false)}
        onPick={(ids) => {
          const fs = friends.filter((x) => ids.includes(x.id)).slice(0, MAX_PLAYERS - 1);
          if (fs.length) onFriends(fs);
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
        Swipe your pen to flick it. A pen falls once its middle goes over the edge. Last pen on the
        desk wins. 2 to 6 players.
      </p>
      <button
        onClick={() => setPicking(true)}
        disabled={!friends.length}
        className="btn-primary w-full disabled:opacity-50"
        style={{ minHeight: 54 }}
      >
        Play with your 25 (up to 5)
      </button>
      <p className="meta text-center mt-2" style={{ fontSize: 12.5 }}>
        They get a challenge in chat. It starts when everyone's in.
      </p>
      <div
        className="mt-6 rounded-2xl p-4"
        style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
      >
        <p className="font-bold flex items-center gap-2">
          <Bot size={18} aria-hidden="true" /> Play bots
        </p>
        <p className="label-caps mt-3 mb-1.5">How many</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBots((b) => Math.max(1, b - 1))}
            aria-label="Fewer bots"
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--surface)" }}
          >
            <Minus size={18} />
          </button>
          <span className="font-extrabold tabular-nums" style={{ fontSize: 18 }}>
            {bots} bot{bots > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setBots((b) => Math.min(MAX_PLAYERS - 1, b + 1))}
            aria-label="More bots"
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--surface)" }}
          >
            <Plus size={18} />
          </button>
        </div>
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
        <p className="meta mt-2" style={{ fontSize: 12 }}>
          Wins against Medium and Hard bots count towards medals.
        </p>
        <button onClick={() => onBot(level, bots, wins ?? 0)} className="btn-secondary w-full mt-3">
          Play bots
        </button>
      </div>
      <p className="label-caps mt-6 mb-2">Your pens and medals</p>
      {wins !== null && (
        <PenLocker
          wins={wins}
          pick={pick}
          onPick={(id) => {
            chooseSkin(id);
            setPick(id);
          }}
        />
      )}
    </Sheet>
  );
}

/** Your medal, progress to the next, and every pen (locked ones show what it takes). */
function PenLocker({
  wins,
  pick,
  onPick,
}: {
  wins: number;
  pick: string;
  onPick: (id: string) => void;
}) {
  const { have, next } = medalFor(wins);
  return (
    <div className="mb-5">
      <div
        className="rounded-2xl p-3.5 flex items-center gap-3"
        style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
      >
        <span className="text-[34px] leading-none" aria-hidden="true">
          {have?.emoji ?? "🖊️"}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-extrabold" style={{ fontSize: 16 }}>
            {have ? `${have.name} medal` : "No medal yet"} · {wins} win{wins === 1 ? "" : "s"}
          </span>
          {next ? (
            <>
              <span className="block meta" style={{ fontSize: 12.5 }}>
                {next.wins - wins} more for {next.emoji} {next.name}
              </span>
              <span
                className="block mt-1.5 h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (wins / next.wins) * 100)}%`,
                    background: next.color,
                  }}
                />
              </span>
            </>
          ) : (
            <span className="block meta" style={{ fontSize: 12.5 }}>
              Every medal won. Legend.
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {MEDALS.map((m) => (
          <span
            key={m.name}
            className="flex-1 rounded-lg py-1 text-center text-[11.5px] font-bold"
            style={{
              background: wins >= m.wins ? `${m.color}33` : "var(--fill)",
              color: wins >= m.wins ? "#fff" : "var(--ink-3)",
            }}
          >
            {m.emoji} {m.wins}
          </span>
        ))}
      </div>
      <p className="label-caps mt-4 mb-2">Your pen</p>
      <div className="grid grid-cols-2 gap-2">
        {SKINS.map((sk) => {
          const open = unlocked(sk, wins);
          const on = pick === sk.id;
          return (
            <button
              key={sk.id}
              disabled={!open}
              onClick={() => open && onPick(sk.id)}
              aria-pressed={on}
              aria-label={open ? sk.name : `${sk.name}: ${sk.wins} wins to unlock`}
              className="rounded-2xl p-2.5 text-left relative"
              style={{
                background: on ? "rgba(184,242,92,0.12)" : "var(--fill)",
                border: `1.5px solid ${on ? "var(--lime)" : "var(--line)"}`,
              }}
            >
              <svg
                viewBox="-72 -14 150 28"
                className="w-full"
                style={{ height: 28, opacity: open ? 1 : 0.35 }}
              >
                <PenShape p={{ x: 0, y: 0, a: 0 }} skin={sk} uid={`pick-${sk.id}`} />
              </svg>
              <span className="block mt-1 text-[12.5px] font-bold truncate">{sk.name}</span>
              <span
                className="block text-[11px] font-bold"
                style={{
                  color: open
                    ? {
                        Common: "var(--ink-3)",
                        Rare: "#5BB8FF",
                        Epic: "#B28BFF",
                        Legendary: "#F7C948",
                      }[sk.rarity]
                    : "var(--ink-3)",
                }}
              >
                {open ? sk.rarity : `🔒 ${sk.wins} win${sk.wins === 1 ? "" : "s"}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Online waiting room: who's in. The host can start once 2 or more are. */
export function PenWaiting({
  sides,
  joined,
  isHost,
  cancelled,
  onStart,
  onCancel,
  onClose,
}: {
  sides: PenSide[];
  joined: string[];
  isHost: boolean;
  cancelled?: boolean;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const inCount = sides.filter((s) => joined.includes(s.id)).length;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        background: "radial-gradient(120% 70% at 50% 0%, #3A2A20 0%, #120D0A 75%)",
        color: "#fff",
      }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 min-h-full flex flex-col">
        <header className="flex items-center justify-between">
          <span className="font-extrabold" style={{ fontSize: 19 }}>
            Pen fight · waiting room
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
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-5 max-w-[300px]">
                {sides.map((side, i) => {
                  const here = joined.includes(side.id);
                  return (
                    <div key={side.id} className="flex flex-col items-center gap-1.5">
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
                          size={62}
                        />
                      </span>
                      <span className="font-bold text-[14px]">
                        {i === 0 && isHost ? "You" : side.name.split(" ")[0]}
                      </span>
                      <span
                        className="text-[12px] font-bold"
                        style={{ color: here ? "var(--lime)" : "rgba(255,255,255,0.5)" }}
                      >
                        {here ? "in" : "joining…"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-8 text-[15px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                {inCount < sides.length
                  ? `${inCount} of ${sides.length} in. It starts when everyone's here.`
                  : "Everyone's in!"}
              </p>
              {isHost && inCount >= 2 && inCount < sides.length && (
                <button onClick={onStart} className="btn-primary mt-5 px-8">
                  Start with {inCount}
                </button>
              )}
              <button
                onClick={onCancel}
                className="mt-3 min-h-[44px] px-4 font-bold"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {isHost ? "Call it off" : "Leave"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
