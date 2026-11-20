/**
 * Pen fight, 2 to 6 players: the table, games against bots, and the lobby.
 * Hold your pen, pull back like a slingshot and let go: it flies the other
 * way, harder the further you pull, and spins if you grab it near an end. A
 * pen only falls once its middle goes past the edge. Last pen on the table
 * wins. The table (one of four) is picked at random, and grows with players.
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
  FALL_FRAMES,
  MAX_PLAYERS,
  MAX_SPEED,
  PEN,
  TABLES,
  applyShot,
  botShot,
  newPenFight,
  onPen,
  outOf,
  penPlaces,
  resignPen,
  simulate,
  slideDistance,
  tableOf,
  type Frame,
  type Table,
  type PenPose,
  type PenState,
  type Shot,
} from "@/lib/penfight";
import {
  MEDALS,
  RIVAL,
  SKINS,
  chooseSkin,
  chosenSkin,
  loadPenWins,
  medalFor,
  skinById,
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

/** The table top, drawn for its kind (one of four, picked at random each game). */
function TableTop({ t }: { t: Table }) {
  const { w, h } = t;
  if (t.kind === "round") {
    const r = w / 2;
    return (
      <g>
        <defs>
          <radialGradient id="cafe" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#FBF6EC" />
            <stop offset="0.7" stopColor="#EADFCB" />
            <stop offset="1" stopColor="#D4C4A6" />
          </radialGradient>
        </defs>
        <circle cx={r} cy={r} r={r + 12} fill="rgba(0,0,0,0.35)" transform="translate(0 8)" />
        <circle cx={r} cy={r} r={r + 10} fill="#3B3F46" />
        <circle cx={r} cy={r} r={r + 4} fill="#7A808A" />
        <circle cx={r} cy={r} r={r} fill="url(#cafe)" />
        {/* A coffee ring someone left */}
        <circle
          cx={r * 1.45}
          cy={r * 0.55}
          r={22}
          fill="none"
          stroke="rgba(120,70,30,0.22)"
          strokeWidth={4}
          strokeDasharray="70 8 30 6"
        />
        <text
          x={r}
          y={r * 1.78}
          textAnchor="middle"
          fontSize={14}
          fontWeight={800}
          fill="rgba(90,60,30,0.22)"
          fontFamily="system-ui"
        >
          café 25
        </text>
      </g>
    );
  }
  if (t.kind === "marble") {
    return (
      <g>
        <defs>
          <linearGradient id="marble" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2E3A36" />
            <stop offset="0.5" stopColor="#1D2724" />
            <stop offset="1" stopColor="#121816" />
          </linearGradient>
        </defs>
        <rect x={-6} y={2} width={w + 12} height={h + 12} rx={10} fill="rgba(0,0,0,0.4)" />
        <rect x={-6} y={-6} width={w + 12} height={h + 12} rx={10} fill="#0B0F0E" />
        <rect x={0} y={0} width={w} height={h} rx={6} fill="url(#marble)" />
        {[
          `M 0 ${h * 0.2} C ${w * 0.3} ${h * 0.25}, ${w * 0.4} ${h * 0.05}, ${w} ${h * 0.12}`,
          `M 0 ${h * 0.62} C ${w * 0.25} ${h * 0.5}, ${w * 0.6} ${h * 0.75}, ${w} ${h * 0.55}`,
          `M ${w * 0.2} ${h} C ${w * 0.35} ${h * 0.8}, ${w * 0.55} ${h * 0.92}, ${w * 0.8} ${h * 0.7}`,
          `M ${w * 0.55} 0 C ${w * 0.5} ${h * 0.2}, ${w * 0.75} ${h * 0.3}, ${w * 0.7} ${h * 0.45}`,
        ].map((d, k) => (
          <path
            key={k}
            d={d}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={k % 2 ? 1.2 : 2.2}
            fill="none"
          />
        ))}
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={6}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={2}
        />
      </g>
    );
  }
  if (t.kind === "school") {
    return (
      <g>
        <rect x={-10} y={0} width={w + 20} height={h + 16} rx={8} fill="rgba(0,0,0,0.4)" />
        <rect x={-10} y={-10} width={w + 20} height={h + 20} rx={8} fill="#3E2412" />
        <rect x={0} y={0} width={w} height={h} rx={4} fill="#7A4A26" />
        {Array.from({ length: Math.ceil(h / 30) }, (_, k) => (
          <line
            key={k}
            x1={0}
            y1={14 + k * 30}
            x2={w}
            y2={10 + k * 30 + (k % 3) * 4}
            stroke="rgba(40,18,4,0.25)"
            strokeWidth={1.5}
          />
        ))}
        {/* The pencil groove along the top */}
        <rect x={w * 0.08} y={14} width={w * 0.84} height={9} rx={4.5} fill="rgba(30,12,2,0.45)" />
        {/* Things carved into it over the years */}
        <g
          fill="none"
          stroke="rgba(255,225,190,0.28)"
          strokeWidth={2}
          strokeLinecap="round"
          fontFamily="system-ui"
        >
          <path d={`M ${w * 0.18} ${h * 0.82} c -10 -12 -24 0 0 18 c 24 -18 10 -30 0 -18`} />
          <text
            x={w * 0.66}
            y={h * 0.86}
            fontSize={20}
            fontWeight={800}
            stroke="none"
            fill="rgba(255,225,190,0.25)"
          >
            25 ✌
          </text>
          <text
            x={w * 0.6}
            y={h * 0.16}
            fontSize={13}
            fontWeight={700}
            stroke="none"
            fill="rgba(255,225,190,0.2)"
          >
            R + S
          </text>
        </g>
      </g>
    );
  }
  return (
    <g>
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C98B52" />
          <stop offset="0.5" stopColor="#B07440" />
          <stop offset="1" stopColor="#8E5A2E" />
        </linearGradient>
      </defs>
      <rect x={-8} y={0} width={w + 16} height={h + 16} rx={18} fill="rgba(0,0,0,0.4)" />
      <rect x={-8} y={-8} width={w + 16} height={h + 16} rx={18} fill="#5A3518" />
      <rect x={0} y={0} width={w} height={h} rx={12} fill="url(#wood)" />
      {Array.from({ length: Math.ceil(h / 37) }, (_, k) => (
        <path
          key={k}
          d={`M 0 ${18 + k * 37} C ${w * 0.3} ${10 + k * 37}, ${w * 0.6} ${30 + k * 37}, ${w} ${16 + k * 37}`}
          stroke="rgba(70,35,10,0.18)"
          strokeWidth={2}
          fill="none"
        />
      ))}
      <text
        x={w - 18}
        y={h - 16}
        textAnchor="end"
        fontSize={15}
        fontWeight={800}
        fill="rgba(60,30,8,0.25)"
        fontFamily="system-ui"
      >
        25 ✌
      </text>
    </g>
  );
}

const TABLE_EMOJI: Record<Table["kind"], string> = {
  wood: "🍎",
  school: "🎒",
  round: "☕",
  marble: "🖤",
};

/** A row of your pens to switch between (locked ones show what they take). */
export function PenStrip({ pick, onPick }: { pick: string; onPick: (id: string) => void }) {
  const [wins, setWins] = useState<number | null>(null);
  useEffect(() => {
    void loadPenWins().then(setWins);
  }, []);
  const { have } = medalFor(wins ?? 0);
  return (
    <div>
      <p className="text-[12.5px] font-bold mb-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>
        Pick your pen
        {wins !== null
          ? ` · ${have ? `${have.emoji} ` : ""}${wins} win${wins === 1 ? "" : "s"}`
          : ""}
      </p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {SKINS.map((sk) => {
          const open = wins !== null && unlocked(sk, wins);
          const on = pick === sk.id;
          return (
            <button
              key={sk.id}
              disabled={!open}
              onClick={() => {
                if (!open) return;
                buzz(10);
                chooseSkin(sk.id);
                onPick(sk.id);
              }}
              aria-pressed={on}
              aria-label={open ? sk.name : `${sk.name}: ${sk.wins} wins to unlock`}
              className="shrink-0 rounded-xl px-2 pt-1.5 pb-1 text-center"
              style={{
                width: 92,
                background: on ? "rgba(184,242,92,0.16)" : "rgba(255,255,255,0.06)",
                border: `1.5px solid ${on ? "#B8F25C" : "transparent"}`,
              }}
            >
              <svg
                viewBox="-72 -14 150 28"
                className="w-full"
                style={{ height: 20, opacity: open ? 1 : 0.3 }}
              >
                <PenShape p={{ x: 0, y: 0, a: 0 }} skin={sk} uid={`strip-${sk.id}`} />
              </svg>
              <span
                className="block mt-0.5 text-[11px] font-bold truncate"
                style={{ color: open ? "#fff" : "rgba(255,255,255,0.45)" }}
              >
                {open ? sk.name : `🔒 ${sk.wins} win${sk.wins === 1 ? "" : "s"}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Screen pixels of pull-back for a full-power flick. */
const FULL_PULL = 120;

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
  onPickSkin,
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
  /** Change your pen (offered until the first flick). */
  onPickSkin?: (id: string) => void;
  /** What winning this game unlocked ("Unlocked: Ink Fountain pen"). */
  unlock?: string;
}) {
  useGameMusic(state.winner === undefined);
  const n = state.players.length;
  const out = outOf(state);
  const table = tableOf(state);
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
  // "Café table" when the game opens.
  const [intro, setIntro] = useState(state.shots === 0 && state.winner === undefined);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 2200);
    return () => clearTimeout(t);
  }, [intro]);
  // Big callouts as pens go off ("💥 Topper's off!").
  const [callout, setCallout] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    if (!callout) return;
    const t = setTimeout(() => setCallout(null), 1600);
    return () => clearTimeout(t);
  }, [callout]);
  const stage = useRef<HTMLDivElement>(null);
  const shake = () =>
    stage.current?.animate(
      [
        { transform: "translate(0,0)" },
        { transform: "translate(-7px,3px)" },
        { transform: "translate(6px,-4px)" },
        { transform: "translate(-4px,2px)" },
        { transform: "translate(0,0)" },
      ],
      { duration: 360 },
    );
  // A buzz when it comes round to you.
  useEffect(() => {
    if (myTurn && state.shots > 0) buzz(25);
  }, [myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

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
      table,
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
          shake();
          const who = k === mySeat ? "You're" : `${nameOf(k)}'s`;
          setCallout({
            text: k === last.seat && k !== mySeat ? `${nameOf(k)} flew off! 🫠` : `💥 ${who} off!`,
            key: Date.now() + k,
          });
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
    const t = setTimeout(() => setOver(true), 1100);
    return () => clearTimeout(t);
  }, [state.winner, playing, mySeat]);

  const poses: PenPose[] = anim?.poses ?? state.pens;
  const fall: number[] = anim?.fall ?? out.map((o) => (o ? FALL_FRAMES : 0));

  // ---- Slingshot: hold your pen, pull back, let go ----
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{
    ax: number; // where you grabbed the pen (desk units)
    ay: number;
    cx0: number; // and on screen
    cy0: number;
    fx: number; // your finger now (desk units)
    fy: number;
    pull: number; // 0-1
    dx: number; // flick direction (unit), opposite the pull
    dy: number;
  } | null>(null);
  const toDesk = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  const power = drag?.pull ?? 0;

  function nameOf(i: number) {
    return i === mySeat ? "You" : (sides[i]?.name.split(" ")[0] ?? "Someone");
  }
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
        ? "Last pen on the table. You win! 🎉"
        : `${nameOf(state.winner)} wins`
      : iAmOut
        ? `You're out · ${turnName}'s turn`
        : myTurn
          ? drag
            ? power < 0.12
              ? "Pull further back…"
              : `Let go to flick · ${Math.round(power * 100)}%`
            : "Your turn · hold your pen, pull back, let go"
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
  const picking = !!onPickSkin && state.shots === 0 && state.winner === undefined && !iAmOut;

  const W = table.w + MARGIN * 2;
  const H = table.h + MARGIN * 2;
  const me = poses[mySeat];
  // The aiming dots: roughly where your pen will slide to on its own.
  const reach = drag ? slideDistance(power * MAX_SPEED) : 0;
  const dots = drag && power >= 0.12 ? Math.max(2, Math.floor(reach / 18)) : 0;
  const hot = power > 0.85;
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
          <span className="label-caps text-center" style={{ color: "rgba(255,255,255,0.7)" }}>
            {TABLES[table.kind].name}
            {n > 2 ? ` · ${out.filter((o) => !o).length}/${n} left` : ""}
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

        {/* Everyone at the table, in turn order */}
        <div className="mt-2 flex justify-center gap-1.5" role="list">
          {state.players.map((_, i) => {
            const active = state.winner === undefined && state.turn === i && !out[i];
            return (
              <div
                key={i}
                role="listitem"
                aria-label={`${nameOf(i)}${out[i] ? ", out" : active ? ", to flick" : ""}`}
                className="flex flex-col items-center rounded-2xl px-1 pt-1.5 pb-1 transition-all"
                style={{
                  width: n > 4 ? 56 : 72,
                  background: active ? "rgba(184,242,92,0.16)" : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${active ? "#B8F25C" : "transparent"}`,
                  opacity: out[i] ? 0.38 : 1,
                  transform: active ? "translateY(-2px)" : undefined,
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

        {/* The table */}
        <div ref={stage} className="flex-1 min-h-0 flex items-center justify-center relative">
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
              buzz(8);
              setDrag({
                ax: p.x,
                ay: p.y,
                cx0: e.clientX,
                cy0: e.clientY,
                fx: p.x,
                fy: p.y,
                pull: 0,
                dx: 0,
                dy: 0,
              });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = toDesk(e.clientX, e.clientY);
              const px = drag.cx0 - e.clientX;
              const py = drag.cy0 - e.clientY;
              const len = Math.hypot(px, py);
              const pull = Math.min(1, len / FULL_PULL);
              if (pull >= 1 && drag.pull < 1) buzz(12);
              setDrag({
                ...drag,
                fx: p.x,
                fy: p.y,
                pull,
                dx: len ? px / len : 0,
                dy: len ? py / len : 0,
              });
            }}
            onPointerUp={() => {
              if (!drag) return;
              setDrag(null);
              if (drag.pull < 0.12) return; // barely pulled: not a flick
              const pw = drag.pull * MAX_SPEED;
              buzz(20);
              onShot({ px: drag.ax, py: drag.ay, ix: drag.dx * pw, iy: drag.dy * pw });
            }}
            onPointerCancel={() => setDrag(null)}
            aria-label="The table. Hold your pen, pull back and let go to flick it."
          >
            <TableTop t={table} />
            {/* Aim: dots to roughly where your pen slides */}
            {drag &&
              Array.from({ length: dots }, (_, k) => {
                const d = ((k + 1) / dots) * reach;
                return (
                  <circle
                    key={k}
                    cx={drag.ax + drag.dx * d}
                    cy={drag.ay + drag.dy * d}
                    r={Math.max(2.2, 5 - k * 0.2)}
                    fill={hot ? "#FF5470" : "#B8F25C"}
                    opacity={Math.max(0.2, 1 - k / (dots + 2))}
                  />
                );
              })}
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
            {/* The sling: a band from your pen to your finger */}
            {drag && drag.pull > 0.02 && (
              <g pointerEvents="none">
                {[-1, 1].map((sd) => (
                  <line
                    key={sd}
                    x1={drag.ax - drag.dy * 9 * sd}
                    y1={drag.ay + drag.dx * 9 * sd}
                    x2={drag.fx}
                    y2={drag.fy}
                    stroke={hot ? "#FF5470" : "#3A2414"}
                    strokeWidth={Math.max(2, 6 - drag.pull * 4)}
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                ))}
                <circle
                  cx={drag.fx}
                  cy={drag.fy}
                  r={11}
                  fill="rgba(255,255,255,0.18)"
                  stroke="#fff"
                  strokeWidth={2.5}
                />
              </g>
            )}
          </svg>
          {intro && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="animate-soft-in rounded-3xl px-6 py-4 text-center"
                style={{
                  background: "rgba(10,8,6,0.78)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ fontSize: 34, lineHeight: 1 }}>{TABLE_EMOJI[table.kind]}</div>
                <div className="mt-1 font-extrabold" style={{ color: "#fff", fontSize: 20 }}>
                  {TABLES[table.kind].name}
                </div>
                <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {n} pens · last one on the table wins
                </div>
              </div>
            </div>
          )}
          {callout && !intro && (
            <div
              key={callout.key}
              className="absolute inset-x-0 top-[38%] flex justify-center pointer-events-none"
            >
              <span
                className="animate-soft-in rounded-full px-5 py-2.5 font-extrabold"
                style={{
                  background: "rgba(255,84,112,0.92)",
                  color: "#fff",
                  fontSize: 19,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                }}
              >
                {callout.text}
              </span>
            </div>
          )}
        </div>

        <div
          className="h-2 rounded-full overflow-hidden mx-6"
          style={{ background: "rgba(255,255,255,0.1)" }}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${power * 100}%`, background: hot ? "#FF5470" : "#B8F25C" }}
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
          {picking ? (
            <PenStrip pick={state.skins?.[mySeat] ?? "classic"} onPick={onPickSkin!} />
          ) : (
            <ChatStrip lines={2} />
          )}
        </div>
      </div>

      {pens && (
        <Sheet title="Your pens" onClose={() => setPens(false)}>
          <PensSheet />
          <p className="meta mt-1 mb-2" style={{ fontSize: 12.5 }}>
            Win against your 25 to earn medals and unlock pens. You can switch pens before the first
            flick of a game.
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

/** Pen fight against 1 to 5 bots: practice (wins here don't count for pens). */
export function LocalPenFight({
  level,
  bots,
  wins,
  onClose,
}: {
  level: 1 | 2 | 3;
  /** How many bots (1-5). */
  bots: number;
  /** Your wins against your 25 (picks which of your pens you can use). */
  wins: number;
  onClose: () => void;
}) {
  const me = meView();
  const list = BOTS.slice(0, Math.max(1, Math.min(MAX_PLAYERS - 1, bots)));
  // You always flick first against bots.
  const fresh = (): PenState => ({
    ...newPenFight(["me", ...list.map((_, i) => `bot${i + 1}`)], level, [
      chosenSkin(wins).id,
      ...list.map((b) => b.pen),
    ]),
    turn: 0,
  });
  const [state, setState] = useState<PenState>(fresh);
  const [thinking, setThinking] = useState(false);
  // A bot's turn: wait for the last flick to finish on screen, aim a moment, flick.
  useEffect(() => {
    if (state.winner !== undefined || state.turn === 0) return;
    setThinking(true);
    const last = state.last;
    const lastFrames = last
      ? simulate(
          last.from,
          last.outBefore ?? last.from.map(() => false),
          last.seat,
          last.shot,
          tableOf(state),
        ).frames.length
      : 0;
    const t = setTimeout(
      () => {
        const shot = botShot(state, level);
        setThinking(false);
        setState((s) => (s.turn !== 0 && s.winner === undefined ? applyShot(s, shot) : s));
      },
      (lastFrames / 60) * 1000 + (state.shots === 0 ? 2400 : 700),
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
      onPickSkin={(id) =>
        setState((s) => ({
          ...s,
          skins: s.players.map((_, i) => (i === 0 ? id : (s.skins?.[i] ?? "classic"))),
        }))
      }
      onPlayAgain={() => setState(fresh())}
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
        Hold your pen, pull back like a slingshot and let go. A pen falls once its middle goes over
        the edge. Last pen on the table wins. 2 to 6 players, and a different table each game.
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
          Bot games are practice. Only wins against your 25 earn medals and pens.
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
  pick,
  onPick,
}: {
  /** Your pen, and switching it while you wait. */
  pick: string;
  onPick: (id: string) => void;
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
              <div className="mt-8 w-full text-left">
                <PenStrip pick={pick} onPick={onPick} />
              </div>
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
