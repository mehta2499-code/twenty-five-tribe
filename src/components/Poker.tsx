/**
 * No-Limit Hold'em with your 25: a casino-style table (felt, rail, seats
 * around it, chips and a dealer button), big Fold / Call / Raise buttons and a
 * raise slider. Friends only, no bots. The host sets seats, buy-in and blinds.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronUp,
  Crown,
  LogOut,
  Menu,
  MessageCircle,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, buzz } from "@/components/SocialUI";
import { GameOverBoard, withRanks } from "@/components/Leaderboard";
import { SoundToggle } from "@/components/SoundToggle";
import { sfx, useGameMusic } from "@/lib/sfx";
import { friendById, mutualFriends, type Person } from "@/lib/social";
import {
  TURN_MS,
  holeCards,
  options,
  potSize,
  rank7,
  type Action,
  type Card,
  type PokerState,
} from "@/lib/poker";

const fmt = (n: number) => n.toLocaleString("en-IN");
const SUIT: Record<string, { g: string; red: boolean }> = {
  s: { g: "♠", red: false },
  h: { g: "♥", red: true },
  d: { g: "♦", red: true },
  c: { g: "♣", red: false },
};
const RANK_LABEL = (r: string) => (r === "T" ? "10" : r);

// ---------- Cards and chips ----------
export function PlayingCard({
  card,
  w = 44,
  back = false,
  dim = false,
  glow = false,
  flip = false,
}: {
  card?: Card;
  w?: number;
  back?: boolean;
  dim?: boolean;
  glow?: boolean;
  flip?: boolean;
}) {
  const h = Math.round(w * 1.42);
  if (back || !card)
    return (
      <span
        aria-hidden="true"
        className="inline-block rounded-[7px] shrink-0"
        style={{
          width: w,
          height: h,
          background: "repeating-linear-gradient(45deg, #C2253F 0 4px, #A51C33 4px 8px), #C2253F",
          border: "2px solid #fff",
          boxShadow:
            "0 3px 8px rgba(0,0,0,0.45), inset 0 0 0 3px #C2253F, inset 0 0 0 4px rgba(255,255,255,0.5)",
        }}
      />
    );
  const s = SUIT[card[1]];
  const color = s.red ? "#D3243B" : "#14121C";
  return (
    <span
      className={`relative inline-flex flex-col rounded-[7px] shrink-0 ${flip ? "card-flip" : ""}`}
      style={{
        width: w,
        height: h,
        background: "linear-gradient(160deg, #FFFFFF, #F1EFEA)",
        color,
        boxShadow: glow
          ? "0 0 0 2px #F7C948, 0 0 16px rgba(247,201,72,0.8), 0 3px 8px rgba(0,0,0,0.4)"
          : "0 3px 8px rgba(0,0,0,0.45)",
        opacity: dim ? 0.45 : 1,
      }}
      aria-label={`${RANK_LABEL(card[0])} of ${({ s: "spades", h: "hearts", d: "diamonds", c: "clubs" } as Record<string, string>)[card[1]]}`}
    >
      <span
        className="absolute left-[8%] top-[3%] font-black leading-none"
        style={{ fontSize: w * 0.36, letterSpacing: "-0.04em" }}
      >
        {RANK_LABEL(card[0])}
      </span>
      <span
        className="absolute left-[9%] leading-none"
        style={{ top: w * 0.42, fontSize: w * 0.26 }}
      >
        {s.g}
      </span>
      <span className="absolute right-[6%] bottom-[2%] leading-none" style={{ fontSize: w * 0.62 }}>
        {s.g}
      </span>
    </span>
  );
}

/** A little stack of casino chips with the amount. */
function Chips({
  amount,
  small = false,
  bare = false,
}: {
  amount: number;
  small?: boolean;
  /** Just the chips, no amount. */
  bare?: boolean;
}) {
  const tones = ["#E2506A", "#2F7BE0", "#1F9D57", "#14121C", "#F2A93B"];
  const n = Math.min(4, 1 + Math.floor(Math.log10(Math.max(1, amount))));
  const d = small ? 14 : 18;
  return (
    <span className="inline-flex items-center gap-1 chips-in">
      <span className="relative inline-block" style={{ width: d, height: d + (n - 1) * 3 }}>
        {Array.from({ length: n }, (_, k) => (
          <span
            key={k}
            aria-hidden="true"
            className="absolute left-0 rounded-full"
            style={{
              bottom: k * 3,
              width: d,
              height: d,
              background: `radial-gradient(circle, ${tones[k % tones.length]} 38%, #fff 40%, #fff 48%, ${tones[k % tones.length]} 50%)`,
              border: "1.5px solid rgba(0,0,0,0.35)",
            }}
          />
        ))}
      </span>
      {!bare && (
        <span
          className="rounded-full px-1.5 font-extrabold tabular-nums"
          style={{
            background: "rgba(0,0,0,0.55)",
            color: "#FDE68A",
            fontSize: small ? 10.5 : 12,
          }}
        >
          {fmt(amount)}
        </span>
      )}
    </span>
  );
}

// ---------- Seats ----------
type SeatView = { i: number; x: number; y: number; me: boolean };

/** Is the screen wider than tall (phone turned sideways)? */
function useWide() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const on = () => setWide(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return wide;
}

/** Size of an element, kept up to date. */
function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 360, h: 560 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

/**
 * Where everyone sits (px inside the stage): you at the bottom middle, the
 * rest spread round the rim of the table, clockwise.
 */
function seatSpots(
  n: number,
  mine: number,
  t: { cx: number; cy: number; rx: number; ry: number },
  arc = { from: 0.3, span: 1.4 },
): SeatView[] {
  const out: SeatView[] = [];
  for (let k = 0; k < n; k++) {
    const i = (mine + k) % n;
    if (k === 0) {
      out.push({ i, x: t.cx, y: t.cy + t.ry, me: true });
      continue;
    }
    // Spread the others over the top part of the rim (the bottom is yours).
    const a =
      Math.PI / 2 + Math.PI * arc.from + ((k - 1) / Math.max(1, n - 2)) * (Math.PI * arc.span);
    out.push({ i, x: t.cx + Math.cos(a) * t.rx, y: t.cy + Math.sin(a) * t.ry, me: false });
  }
  return out;
}

/** The turn timer: a green sweep over the photo that runs down. */
function TurnSweep({ since, size }: { since: number; size: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, 1 - (now - since) / TURN_MS);
  const tone = left > 0.3 ? "184,242,92" : "255,90,110";
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `conic-gradient(rgba(${tone},0.55) ${left * 360}deg, transparent 0)`,
          mixBlendMode: "screen",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -5,
          background: `conic-gradient(rgb(${tone}) ${left * 360}deg, rgba(0,0,0,0.35) 0)`,
          WebkitMask: `radial-gradient(circle, transparent ${size / 2 + 1}px, #000 ${size / 2 + 2}px)`,
          mask: `radial-gradient(circle, transparent ${size / 2 + 1}px, #000 ${size / 2 + 2}px)`,
        }}
      />
    </>
  );
}

function SeatSpot({
  s,
  v,
  size,
  center,
  betK = 0.4,
  ring,
}: {
  s: PokerState;
  v: SeatView;
  size: number;
  center: { x: number; y: number };
  /** How far towards the middle their bet sits (0 = on them, 1 = the middle). */
  betK?: number;
  /** Put the bet on this inner ring of the felt instead (wide tables). */
  ring?: { rx: number; ry: number };
}) {
  const p = s.seats[v.i];
  const f = friendById(p.id);
  const turn = s.phase === "betting" && s.toAct === v.i;
  const won = s.result?.winners.find((w) => w.seat === v.i);
  const shown = s.result?.shown[v.i];
  const inHand = !p.out && !p.folded && s.phase !== "lobby";
  const folded = p.folded && s.phase !== "lobby";
  // Bets sit on the felt, between the seat and the middle.
  const k = v.me ? 0.42 : betK;
  // No room above (top of the screen): the label goes beside the photo.
  const sideLabel = v.y - size / 2 < 34;
  const ang = Math.atan2((v.y - center.y) / (ring?.ry ?? 1), (v.x - center.x) / (ring?.rx ?? 1));
  const bx = ring ? center.x + Math.cos(ang) * ring.rx : v.x + (center.x - v.x) * k;
  const by = ring ? center.y + Math.sin(ang) * ring.ry : v.y + (center.y - v.y) * k;
  return (
    <>
      <div
        className="absolute flex flex-col items-center"
        style={{
          left: v.x,
          top: v.y,
          transform: "translate(-50%, -50%)",
          zIndex: v.me ? 6 : 4,
          opacity: p.out ? 0.4 : 1,
        }}
      >
        {/* What they just did / won */}
        {(won || p.last) && (
          <span
            className={`absolute rounded-full px-2 py-0.5 font-black uppercase whitespace-nowrap ${won ? "win-pop" : ""}`}
            style={{
              ...(sideLabel
                ? { left: "100%", top: size * 0.3, marginLeft: size * 0.55, zIndex: 1 }
                : { bottom: "100%", marginBottom: 6 }),
              fontSize: 10,
              letterSpacing: "0.04em",
              background: won
                ? "linear-gradient(180deg,#FFE08A,#E8A929)"
                : /fold/i.test(p.last!)
                  ? "rgba(60,58,70,0.95)"
                  : /raise|bet|all/i.test(p.last!)
                    ? "linear-gradient(180deg,#F7B84B,#D98A12)"
                    : "linear-gradient(180deg,#3FB6B0,#23847F)",
              color: won ? "#3A2606" : "#fff",
              boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
            }}
          >
            {won ? `Winner +${fmt(won.amount)}` : p.last}
          </span>
        )}
        <span className="relative" style={{ width: size, height: size }}>
          <span
            className="block rounded-full overflow-hidden"
            style={{
              width: size,
              height: size,
              boxShadow: won
                ? "0 0 0 3px #F7C948, 0 0 26px rgba(247,201,72,0.9)"
                : turn
                  ? "0 0 0 3px rgba(184,242,92,0.9), 0 8px 18px rgba(0,0,0,0.6)"
                  : "0 0 0 3px rgba(255,255,255,0.85), 0 8px 18px rgba(0,0,0,0.6)",
              filter: folded ? "grayscale(0.85) brightness(0.6)" : undefined,
            }}
          >
            <Avatar
              src={p.avatar || f?.avatar || undefined}
              initials={p.initials}
              color={f?.color}
              size={size}
            />
          </span>
          {turn && <TurnSweep since={s.turnAt} size={size} />}
          {s.phase !== "lobby" && s.dealer === v.i && (
            <span
              aria-label="Dealer"
              className="absolute flex items-center justify-center font-black"
              style={{
                right: -4,
                top: -2,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "radial-gradient(circle at 35% 30%, #fff, #DCD7CC)",
                color: "#14121C",
                fontSize: 11,
                boxShadow: "0 2px 5px rgba(0,0,0,0.55)",
                border: "1.5px solid #9C8F75",
              }}
            >
              D
            </span>
          )}
          {/* Their cards: backs while in the hand, faces at the showdown. */}
          {!v.me && inHand && (
            <span
              className="absolute flex"
              style={{ [v.x < center.x ? "right" : "left"]: -size * 0.42, bottom: -2 }}
            >
              {shown
                ? shown.map((c, j) => (
                    <span
                      key={c}
                      style={{ marginLeft: j ? -14 : 0, transform: `rotate(${j ? 9 : -7}deg)` }}
                    >
                      <PlayingCard card={c} w={Math.round(size * 0.5)} flip />
                    </span>
                  ))
                : [0, 1].map((j) => (
                    <span
                      key={j}
                      style={{ marginLeft: j ? -16 : 0, transform: `rotate(${j ? 9 : -7}deg)` }}
                    >
                      <PlayingCard back w={Math.round(size * 0.36)} />
                    </span>
                  ))}
            </span>
          )}
        </span>
        {!v.me && (
          <>
            <span
              className="mt-1.5 font-bold truncate text-center"
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                maxWidth: size + 30,
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              }}
            >
              {p.name.split(" ")[0]}
            </span>
            <span
              className="font-extrabold tabular-nums"
              style={{ fontSize: 13.5, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}
            >
              {p.out ? "Out" : fmt(p.stack)}
            </span>
          </>
        )}
      </div>
      {p.bet > 0 && (
        <div
          className="absolute"
          style={{ left: bx, top: by, transform: "translate(-50%, -50%)", zIndex: 3 }}
        >
          <BetPill amount={p.bet} />
        </div>
      )}
    </>
  );
}

/** A bet on the felt: a chip and the amount. */
function BetPill({ amount }: { amount: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 font-extrabold tabular-nums chips-in"
      style={{
        background: "rgba(10,6,16,0.72)",
        color: "#FDE68A",
        fontSize: 12.5,
        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
      }}
    >
      <Chips amount={amount} small bare />
      {fmt(amount)}
    </span>
  );
}

/** A round action button with its label above (Fold ✕ · Call · Raise ^). */
function RoundAction({
  label,
  ring,
  fill,
  onClick,
  disabled,
  children,
}: {
  label: string;
  ring: string;
  fill: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 disabled:opacity-35 active:scale-95 transition-transform"
      aria-label={label}
    >
      <span
        className="font-extrabold"
        style={{ fontSize: 13.5, color: ring, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
      >
        {label.split(" ")[0]}
      </span>
      <span
        className="flex items-center justify-center rounded-full font-black tabular-nums"
        style={{
          width: 62,
          height: 62,
          background: `radial-gradient(circle at 50% 35%, ${fill}, rgba(0,0,0,0.55) 72%)`,
          boxShadow: `0 0 0 3px ${ring}, 0 0 0 6px rgba(0,0,0,0.45), 0 0 18px ${ring}66`,
          color: "#fff",
          fontSize: 14,
        }}
      >
        {children}
      </span>
    </button>
  );
}

/** Our own lounge: warm and cool lights, softly out of focus. */
function Lounge() {
  const lights = [
    [8, 12, 90, "255,170,90"],
    [22, 6, 50, "255,215,140"],
    [78, 8, 110, "150,120,255"],
    [92, 22, 60, "255,120,170"],
    [60, 4, 40, "255,200,120"],
    [4, 40, 70, "255,140,80"],
    [96, 52, 80, "120,170,255"],
    [14, 78, 60, "255,170,90"],
    [88, 86, 70, "255,110,140"],
  ] as const;
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 70% at 50% 0%, #3A1B3E 0%, #1E0F25 45%, #0C0710 100%)",
        }}
      />
      {lights.map(([x, y, r, c], k) => (
        <span
          key={k}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: r,
            height: r,
            transform: "translate(-50%,-50%)",
            background: `radial-gradient(circle, rgba(${c},0.38), rgba(${c},0) 70%)`,
            filter: "blur(4px)",
          }}
        />
      ))}
      {/* A soft floor under the table. */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))" }}
      />
    </div>
  );
}

// ---------- The table ----------
export function PokerTable({
  s,
  meId,
  hostId,
  onAction,
  onNextHand,
  onFoldAway,
  onLeave,
  onClose,
}: {
  s: PokerState;
  meId: string;
  hostId: string;
  onAction: (a: Action) => void;
  onNextHand: () => void;
  onFoldAway: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  useGameMusic(s.phase !== "over");
  const wide = useWide();
  const [stageRef, box] = useBox<HTMLDivElement>();
  const mine = s.seats.findIndex((p) => p.id === meId);
  // The table: a wide oval sideways, a tall one upright.
  // (The stage is the whole screen; the top bar and buttons float over it.)
  const tbl = wide
    ? { cx: box.w / 2, cy: box.h * 0.45, rx: box.w * 0.31, ry: box.h * 0.27 }
    : { cx: box.w / 2, cy: box.h * 0.44, rx: box.w * 0.38, ry: box.h * 0.25 };
  const spots = useMemo(
    () =>
      seatSpots(
        s.seats.length,
        Math.max(0, mine),
        {
          cx: tbl.cx,
          cy: tbl.cy,
          rx: tbl.rx + (wide ? 50 : 16),
          ry: tbl.ry + (wide ? 26 : 32),
        },
        wide ? { from: 0.36, span: 1.28 } : undefined,
      ),
    [s.seats.length, mine, tbl.cx, tbl.cy, tbl.rx, tbl.ry, wide],
  );
  const myCards = mine >= 0 ? holeCards(s, mine) : [];
  const myTurn = s.phase === "betting" && s.toAct === mine;
  const o = myTurn ? options(s, mine) : null;
  const pot = potSize(s);
  // The pot in the middle: chips from earlier streets (this street's bets sit in front of each seat).
  const middle = pot - s.seats.reduce((a, p) => a + p.bet, 0);
  const [raising, setRaising] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [chatNew, setChatNew] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const on = (e: Event) => setChatNew((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener("gamechat:unread", on);
    return () => window.removeEventListener("gamechat:unread", on);
  }, []);
  useEffect(() => {
    setRaising(false);
    if (o) setRaiseTo(o.minTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.toAct, s.street, s.handNo]);

  // Sounds: cards dealt / turned, chips in, your turn.
  const boardN = s.board.length;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return;
    if (boardN) sfx.card(boardN === 3 ? 3 : 1);
  }, [boardN]);
  useEffect(() => {
    if (first.current) return;
    sfx.card(2);
  }, [s.handNo]);
  const potRef = useRef(pot);
  useEffect(() => {
    if (!first.current && pot > potRef.current) sfx.chips(3);
    potRef.current = pot;
  }, [pot]);
  useEffect(() => {
    if (myTurn && !first.current) {
      buzz(20);
      sfx.good();
    }
  }, [myTurn]);
  useEffect(() => {
    first.current = false;
  }, []);
  useEffect(() => {
    if (s.result?.winners.some((w) => s.seats[w.seat]?.id === meId)) sfx.win();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result]);

  // The host deals the next hand a few seconds after the showdown (anyone can if the host left).
  const dealer =
    s.seats.find((p) => p.id === hostId && !p.out)?.id ?? s.seats.find((p) => !p.out)?.id;
  useEffect(() => {
    if (s.phase !== "showdown" || dealer !== meId) return;
    const t = setTimeout(onNextHand, 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.handNo, dealer]);

  const myHand =
    myCards.length === 2 && s.board.length >= 3 ? rank7([...myCards, ...s.board]).name : null;
  const winnerCards = new Set(
    s.result && !s.result.uncontested
      ? s.result.winners.flatMap((w) => s.result!.shown[w.seat] ?? [])
      : [],
  );
  const away =
    s.phase === "betting" && !myTurn && now - s.turnAt > TURN_MS && mine >= 0 && !s.seats[mine].out;
  const many = s.seats.length > 6;
  const size = wide ? (many ? 48 : 56) : many ? 50 : 58;
  const mySize = wide ? 78 : 76;
  const cardW = Math.round(Math.min(wide ? 52 : 50, (tbl.rx * 2 * 0.86) / 5.3));
  const presets = o
    ? [
        ["Min", o.minTo],
        ["½ Pot", s.currentBet + Math.round(pot / 2)],
        ["Pot", s.currentBet + pot],
        ["All in", o.maxTo],
      ]
        .map(([l, v]) => [l, Math.min(o.maxTo, Math.max(o.minTo, v as number))] as const)
        .filter((x, k, a) => a.findIndex((y) => y[1] === x[1]) === k)
    : [];

  const banner = s.result
    ? (() => {
        const w = s.result.winners;
        const names = w
          .map((x) => (s.seats[x.seat].id === meId ? "You" : s.seats[x.seat].name.split(" ")[0]))
          .join(" & ");
        return `${names} win${w.length === 1 && names !== "You" ? "s" : ""} ${fmt(w.reduce((a, x) => a + x.amount, 0))}${w[0]?.hand ? ` · ${w[0].hand}` : ""}`;
      })()
    : null;
  const meSeat = mine >= 0 ? s.seats[mine] : null;
  const meSpot = spots.find((v) => v.me);
  // You sit on the near edge of the table, photo above your cards.
  const mySpot = meSpot && { ...meSpot, y: tbl.cy + tbl.ry - (wide ? 18 : 4) };
  const myCardW = wide ? 50 : 54;
  const status =
    s.phase === "betting" && !myTurn
      ? `${s.seats[s.toAct]?.name.split(" ")[0]} to act…`
      : s.phase === "showdown" && !banner
        ? "Next hand coming up…"
        : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none"
      style={{ background: "#0C0710" }}
    >
      <Lounge />
      <div className="relative mx-auto w-full h-full">
        {/* Top: leave · blinds */}
        <header className="absolute z-10 top-[max(0.5rem,env(safe-area-inset-top))] left-[max(0.5rem,env(safe-area-inset-left))] flex items-center gap-2 px-1">
          <button
            onClick={() =>
              s.phase === "over" || mine < 0 || s.seats[mine].out ? onClose() : setLeaving(true)
            }
            aria-label="Leave the table"
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(20,12,26,0.7)",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.18)",
              color: "#fff",
            }}
          >
            <ChevronLeft size={24} />
          </button>
          <span
            className="rounded-full px-3 py-1 font-bold tabular-nums"
            style={{
              background: "rgba(20,12,26,0.7)",
              color: "#FDE68A",
              fontSize: 12.5,
              boxShadow: "0 0 0 1px rgba(253,230,138,0.3)",
            }}
          >
            Blinds {fmt(s.sb)}/{fmt(s.bb)} · Hand {s.handNo}
          </span>
        </header>

        {/* The table */}
        <div ref={stageRef} className="absolute inset-0">
          <div
            className="absolute"
            style={{
              left: tbl.cx - tbl.rx,
              top: tbl.cy - tbl.ry,
              width: tbl.rx * 2,
              height: tbl.ry * 2,
              borderRadius: 9999,
            }}
          >
            {/* Rail with a warm glowing edge */}
            <span
              aria-hidden="true"
              className="absolute rounded-[9999px]"
              style={{
                inset: -18,
                background: "linear-gradient(180deg, #3B1E36, #1C0D1A)",
                boxShadow:
                  "0 0 0 2px rgba(255,170,90,0.85), 0 0 26px 6px rgba(255,140,60,0.45), 0 30px 60px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.12)",
              }}
            />
            {/* Felt */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[9999px] overflow-hidden"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 40%, #8E2A4C 0%, #6A1A38 50%, #44102A 100%)",
                boxShadow:
                  "inset 0 0 0 2px rgba(255,190,120,0.65), inset 0 0 40px rgba(0,0,0,0.55)",
              }}
            >
              <span
                className="absolute rounded-[9999px]"
                style={{ inset: "9%", border: "1.5px solid rgba(255,214,160,0.18)" }}
              />
              {/* Our mark on the felt */}
              <span
                className="absolute inset-0 flex items-center justify-center font-black"
                style={{
                  fontSize: Math.min(tbl.rx, tbl.ry) * 0.75,
                  color: "rgba(255,214,160,0.06)",
                  letterSpacing: "-0.06em",
                }}
              >
                25
              </span>
            </span>
            {/* Middle: pot, board, what's happening */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2">
              {!wide && middle > 0 && (
                <span
                  className="flex items-center gap-1.5 rounded-full pl-1 pr-3 py-0.5 font-extrabold tabular-nums"
                  style={{
                    background: "rgba(10,6,16,0.6)",
                    color: "#FDE68A",
                    fontSize: 14,
                  }}
                >
                  <Chips amount={middle} small bare />
                  Pot {fmt(middle)}
                </span>
              )}
              <div className="relative flex gap-1.5" style={{ order: 1 }}>
                {/* Sideways there's little height: the pot sits beside the cards. */}
                {wide && middle > 0 && (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full pl-1 pr-3 py-0.5 font-extrabold tabular-nums whitespace-nowrap"
                    style={{
                      right: "100%",
                      marginRight: 10,
                      background: "rgba(10,6,16,0.6)",
                      color: "#FDE68A",
                      fontSize: 13,
                    }}
                  >
                    <Chips amount={middle} small bare />
                    {fmt(middle)}
                  </span>
                )}
                {[0, 1, 2, 3, 4].map((k) =>
                  s.board[k] ? (
                    <PlayingCard
                      key={s.board[k]}
                      card={s.board[k]}
                      w={cardW}
                      flip
                      glow={winnerCards.size > 0 && false}
                    />
                  ) : (
                    <span
                      key={k}
                      className="rounded-[7px]"
                      style={{
                        width: cardW,
                        height: Math.round(cardW * 1.42),
                        border: "1.5px solid rgba(255,214,160,0.14)",
                        background: "rgba(0,0,0,0.12)",
                      }}
                    />
                  ),
                )}
              </div>
              {banner ? (
                <span
                  className="rounded-full px-3 py-1 font-extrabold text-center win-pop"
                  style={{
                    order: 3,
                    background: "linear-gradient(180deg,#FFE08A,#E8A929)",
                    color: "#3A2606",
                    fontSize: 12.5,
                    maxWidth: "86%",
                  }}
                >
                  {banner}
                </span>
              ) : (
                <span
                  className="font-semibold text-center"
                  style={{ order: 3, fontSize: 11.5, color: "rgba(255,230,200,0.7)" }}
                  aria-live="polite"
                >
                  {/* Sideways the turn timer on their photo says it all (no room here). */}
                  {wide
                    ? ""
                    : (status ??
                      (s.phase === "betting"
                        ? ["Pre-flop", "Flop", "Turn", "River"][s.street]
                        : ""))}
                </span>
              )}
              {away && (
                <button
                  onClick={onFoldAway}
                  className="rounded-full px-3 py-1 font-bold"
                  style={{ order: 4, background: "rgba(10,6,16,0.7)", color: "#fff", fontSize: 12 }}
                >
                  {s.seats[s.toAct].name.split(" ")[0]} is away. Fold them
                </button>
              )}
            </div>
          </div>

          {spots
            .filter((v) => !v.me)
            .map((v) => (
              <SeatSpot
                key={s.seats[v.i].id}
                s={s}
                v={v}
                size={size}
                center={{ x: tbl.cx, y: tbl.cy }}
                ring={wide ? { rx: tbl.rx * 0.74, ry: tbl.ry * 0.66 } : undefined}
              />
            ))}

          {/* You: big photo at the bottom with your cards in front */}
          {meSeat && mySpot && (
            <>
              <SeatSpot s={s} v={mySpot} size={mySize} center={{ x: tbl.cx, y: tbl.cy }} />
              {!meSeat.out && myCards.length === 2 && (
                <div
                  className="absolute flex"
                  style={{
                    left: mySpot.x,
                    top: mySpot.y + mySize * 0.5 + myCardW * 0.25,
                    transform: "translate(-50%, -50%)",
                    zIndex: 7,
                  }}
                >
                  {myCards.map((c, k) => (
                    <span
                      key={c}
                      style={{
                        transform: `rotate(${k ? 8 : -8}deg) translateY(${k ? 2 : 0}px)`,
                        marginLeft: k ? -18 : 0,
                        opacity: meSeat.folded ? 0.45 : 1,
                      }}
                    >
                      <PlayingCard card={c} w={myCardW} glow={winnerCards.has(c)} />
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`absolute flex items-center ${wide ? "flex-row gap-2" : "flex-col"}`}
                style={{
                  left: mySpot.x,
                  top: mySpot.y + mySize * 0.5 + myCardW * 0.25 + myCardW * 0.71 + 4,
                  transform: "translateX(-50%)",
                  zIndex: 7,
                }}
              >
                <span
                  className="font-black tabular-nums"
                  style={{ fontSize: 19, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.95)" }}
                >
                  {meSeat.out ? "Out" : fmt(meSeat.stack)}
                </span>
                {myHand && !meSeat.folded && (
                  <span
                    className="mt-0.5 rounded-full px-2.5 py-0.5 font-bold whitespace-nowrap"
                    style={{ background: "rgba(10,6,16,0.7)", color: "#FDE68A", fontSize: 11.5 }}
                  >
                    {myHand}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Bottom: menu + chat on the left, Fold · Call · Raise on the right */}
        <div className="absolute z-10 inset-x-0 bottom-[max(0.6rem,env(safe-area-inset-bottom))] flex items-end justify-between px-[max(0.75rem,env(safe-area-inset-left))]">
          <div className="flex items-center gap-2.5 pb-1">
            <button
              onClick={() => setLeaving(true)}
              aria-label="Table menu"
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(20,12,26,0.8)",
                boxShadow: "0 0 0 2px rgba(255,170,200,0.45)",
                color: "#fff",
              }}
            >
              <Menu size={22} />
            </button>
            <button
              onClick={() => window.dispatchEvent(new Event("gamechat:open"))}
              aria-label={chatNew ? `Table chat, ${chatNew} new` : "Table chat"}
              className="relative w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(20,12,26,0.8)",
                boxShadow: "0 0 0 2px rgba(255,170,200,0.45)",
                color: "#fff",
              }}
            >
              <MessageCircle size={21} />
              {chatNew > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-black flex items-center justify-center"
                  style={{ background: "var(--pink)", color: "#fff" }}
                >
                  {chatNew}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-end gap-3 min-h-[86px]">
            {myTurn && o && !raising && (
              <>
                <RoundAction
                  label="Fold"
                  ring="#FF5A6E"
                  fill="#E5566C"
                  onClick={() => onAction({ type: "fold" })}
                >
                  <X size={26} strokeWidth={3} />
                </RoundAction>
                <RoundAction
                  label={o.canCheck ? "Check" : o.toCall >= s.seats[mine].stack ? "All in" : "Call"}
                  ring="#3FD0C8"
                  fill="#2BA59E"
                  onClick={() => onAction(o.canCheck ? { type: "check" } : { type: "call" })}
                >
                  {o.canCheck ? <Check size={26} strokeWidth={3} /> : short(o.toCall)}
                </RoundAction>
                <RoundAction
                  label={s.currentBet === 0 ? "Bet" : "Raise"}
                  ring="#F7B84B"
                  fill="#D98A12"
                  disabled={!o.canRaise || o.toCall >= s.seats[mine].stack}
                  onClick={() => {
                    setRaiseTo(o.minTo);
                    setRaising(true);
                  }}
                >
                  <ChevronUp size={30} strokeWidth={3} />
                </RoundAction>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Raise: slider and quick amounts, above the buttons */}
      {myTurn && o && raising && (
        <div
          className="absolute z-20 right-3 rounded-3xl p-3.5"
          style={{
            bottom: "max(0.75rem, env(safe-area-inset-bottom))",
            width: "min(340px, calc(100vw - 24px))",
            background: "rgba(22,13,28,0.96)",
            boxShadow: "0 0 0 1.5px rgba(247,184,75,0.6), 0 20px 50px rgba(0,0,0,0.7)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Raise to
            </span>
            <span className="font-black tabular-nums" style={{ fontSize: 24, color: "#FDE68A" }}>
              {fmt(raiseTo)}
            </span>
          </div>
          <input
            type="range"
            min={o.minTo}
            max={o.maxTo}
            step={s.bb >= 10 ? Math.max(1, Math.round(s.bb / 2)) : 1}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            aria-label="Raise amount"
            className="w-full mt-2 accent-[#F2A93B]"
          />
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {presets.map(([label, v]) => (
              <button
                key={label}
                onClick={() => setRaiseTo(v)}
                className="rounded-xl py-1.5 font-bold"
                style={{
                  background: raiseTo === v ? "#F2A93B" : "rgba(255,255,255,0.08)",
                  color: raiseTo === v ? "#2B1A00" : "#fff",
                  fontSize: 12.5,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => setRaising(false)}
              className="flex-1 poker-btn"
              style={{ background: "#3A3550" }}
            >
              Back
            </button>
            <button
              onClick={() => {
                onAction({ type: "raise", to: raiseTo });
                setRaising(false);
              }}
              className="flex-[2] poker-btn"
              style={{ background: "linear-gradient(180deg, #F7B84B, #D98A12)", color: "#2B1A00" }}
            >
              {raiseTo >= o.maxTo ? "All in" : `Raise to ${fmt(raiseTo)}`}
            </button>
          </div>
        </div>
      )}

      {leaving && (
        <Sheet title="Table menu" onClose={() => setLeaving(false)}>
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-2 mb-3"
            style={{ background: "var(--fill)" }}
          >
            <span className="font-semibold">Sound</span>
            <SoundToggle />
          </div>
          <div className="grid gap-2.5">
            <button onClick={() => setLeaving(false)} className="btn-primary">
              Keep playing
            </button>
            <button onClick={onClose} className="btn-secondary">
              Step away (come back from Your games)
            </button>
            {meSeat && !meSeat.out && s.phase !== "over" && (
              <button
                onClick={() => {
                  setLeaving(false);
                  onLeave();
                }}
                className="btn-danger"
              >
                <LogOut size={16} aria-hidden="true" /> Cash out and leave
              </button>
            )}
          </div>
          <p className="meta mt-3">Leaving folds your hand. Your chips stay where they are.</p>
        </Sheet>
      )}

      {s.phase === "over" && (
        <GameOverBoard
          game="Hold'em"
          note={`${s.handNo} hands played`}
          rows={withRanks(
            s.seats.map((p, i) => ({ p, i })).sort((a, b) => b.p.stack - a.p.stack),
            (x) => x.p.stack,
          ).map(({ r: { p }, rank }) => ({
            id: p.id,
            rank,
            name: p.name,
            avatar: p.avatar,
            initials: p.initials,
            value: p.stack,
            link: p.id !== meId,
            me: p.id === meId,
          }))}
          roast={{ game: "poker" }}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/** 12,500 → "12.5K", for the round Call button. */
const short = (n: number) =>
  n >= 1e7
    ? `${+(n / 1e7).toFixed(1)}Cr`
    : n >= 1e5
      ? `${+(n / 1e5).toFixed(1)}L`
      : n >= 1e3
        ? `${+(n / 1e3).toFixed(1)}K`
        : String(n);

// ---------- Lobby (before the first hand) ----------
export function PokerWaiting({
  s,
  meId,
  isHost,
  invited,
  onSit,
  onStart,
  onInvite,
  onLeave,
}: {
  s: PokerState;
  meId: string;
  isHost: boolean;
  invited: string[];
  onSit: () => void;
  onStart: () => void;
  onInvite: (ids: string[]) => void;
  onLeave: () => void;
}) {
  const seated = s.seats.some((p) => p.id === meId);
  const full = s.seats.length >= s.maxSeats;
  const [picking, setPicking] = useState(false);
  const notYet = invited.filter((id) => !s.seats.some((p) => p.id === id));
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "radial-gradient(ellipse at 50% 20%, #2B1F4A 0%, #110D1C 70%)" }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
        <header className="flex items-center justify-between">
          <span className="heading" style={{ fontSize: 20 }}>
            Hold'em table
          </span>
          <button
            onClick={onLeave}
            aria-label="Leave"
            className="w-10 h-10 flex items-center justify-center text-cool"
          >
            <X size={22} />
          </button>
        </header>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Buy-in", fmt(s.startStack)],
            ["Blinds", `${fmt(s.sb)}/${fmt(s.bb)}`],
            ["Seats", `${s.seats.length}/${s.maxSeats}`],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-2xl py-2.5"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p className="font-black tabular-nums" style={{ fontSize: 18, color: "#FDE68A" }}>
                {v}
              </p>
              <p className="meta" style={{ fontSize: 11.5 }}>
                {k}
              </p>
            </div>
          ))}
        </div>
        <p className="meta text-center mt-2" style={{ fontSize: 12 }}>
          {s.rise ? "Blinds double every 10 hands." : "Blinds stay the same."} Last one with chips
          wins.
        </p>

        <p className="label-caps mt-6 mb-2">At the table</p>
        <ul className="grid gap-2">
          {s.seats.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <Avatar
                src={p.avatar || friendById(p.id)?.avatar || undefined}
                initials={p.initials}
                size={36}
              />
              <span className="flex-1 font-semibold">{p.id === meId ? "You" : p.name}</span>
              {s.seats[0]?.id === p.id && (
                <span className="flex items-center gap-1 meta" style={{ fontSize: 12 }}>
                  <Crown size={13} aria-hidden="true" /> host
                </span>
              )}
              <Check size={18} aria-hidden="true" style={{ color: "var(--lime)" }} />
            </li>
          ))}
          {notYet.map((id) => {
            const f = friendById(id);
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-2xl px-3 py-2 opacity-60"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <Avatar src={f?.avatar || undefined} initials={f?.initials ?? "?"} size={36} />
                <span className="flex-1 font-semibold">{f?.name ?? "Invited"}</span>
                <span className="meta" style={{ fontSize: 12 }}>
                  invited…
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 grid gap-2.5">
          {!seated && (
            <button
              onClick={onSit}
              disabled={full}
              className="btn-primary disabled:opacity-50"
              style={{ minHeight: 54 }}
            >
              {full ? "The table is full" : `Take a seat (${fmt(s.startStack)} chips)`}
            </button>
          )}
          {isHost && (
            <>
              <button
                onClick={() => setPicking(true)}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <UserPlus size={18} aria-hidden="true" /> Invite your 25
              </button>
              <button
                onClick={onStart}
                disabled={s.seats.length < 2}
                className="poker-btn disabled:opacity-40"
                style={{ background: "linear-gradient(180deg, #2FBF71, #1E8F52)", minHeight: 56 }}
              >
                {s.seats.length < 2 ? "Waiting for players…" : `Deal · ${s.seats.length} players`}
              </button>
            </>
          )}
          {!isHost && seated && (
            <p className="meta text-center">You're in. Waiting for the host to deal.</p>
          )}
        </div>
      </div>
      {picking && (
        <FriendPicker
          title="Invite to the table"
          cta="Send invites"
          only={mutualFriends()
            .map((f) => f.id)
            .filter((id) => !invited.includes(id))}
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            onInvite(ids);
          }}
        />
      )}
    </div>
  );
}

// ---------- Setting up a table ----------
/** Buy-ins on the slider (nice round numbers). */
const BUY_INS = [
  100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10_000, 15_000, 20_000,
  25_000, 50_000, 100_000,
];
/** Big blinds on the slider (even, so the small blind is exactly half). */
const BIG_BLINDS = [
  2, 4, 6, 10, 20, 30, 40, 50, 60, 100, 150, 200, 250, 300, 400, 500, 1000, 1500, 2000, 2500, 5000,
  10_000,
];
export function PokerSetup({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (
    friends: Person[],
    opts: { maxSeats: number; buyIn: number; sb: number; bb: number; rise: boolean },
  ) => void;
}) {
  const [seats, setSeats] = useState(6);
  const [buyK, setBuyK] = useState(BUY_INS.indexOf(1000));
  const buyIn = BUY_INS[buyK];
  // Blinds: from 500 big blinds deep down to 10 (big blind must be even so the small is half).
  const blindOptions = BIG_BLINDS.filter((b) => b <= buyIn / 10 && b >= buyIn / 500);
  const [bbPick, setBbPick] = useState(20);
  const bb = blindOptions.reduce(
    (best, b) => (Math.abs(b - bbPick) < Math.abs(best - bbPick) ? b : best),
    blindOptions[0] ?? 2,
  );
  const blinds: [number, number] = [bb / 2, bb];
  const [rise, setRise] = useState(true);
  const [picking, setPicking] = useState(false);
  const friends = mutualFriends();
  if (picking)
    return (
      <FriendPicker
        title="Who's playing?"
        cta="Open the table"
        note={`Up to ${seats - 1} friends can sit. You can invite more later.`}
        onClose={() => setPicking(false)}
        onPick={(ids) =>
          onOpen(
            friends.filter((f) => ids.includes(f.id)),
            { maxSeats: seats, buyIn, sb: blinds[0], bb: blinds[1], rise },
          )
        }
      />
    );
  return (
    <Sheet title="New Hold'em table" onClose={onClose}>
      <p className="label-caps mb-1.5">Players</p>
      <div
        className="flex items-center justify-between rounded-2xl px-3 py-2"
        style={{ background: "var(--fill)" }}
      >
        <button
          onClick={() => setSeats((n) => Math.max(2, n - 1))}
          aria-label="Fewer seats"
          className="w-10 h-10 rounded-full font-black"
          style={{ background: "var(--surface)", fontSize: 20 }}
        >
          −
        </button>
        <span className="font-black tabular-nums" style={{ fontSize: 22 }}>
          {seats} seats
        </span>
        <button
          onClick={() => setSeats((n) => Math.min(9, n + 1))}
          aria-label="More seats"
          className="w-10 h-10 rounded-full font-black"
          style={{ background: "var(--surface)", fontSize: 20 }}
        >
          +
        </button>
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <p className="label-caps">Buy-in</p>
        <p className="font-black tabular-nums" style={{ fontSize: 22, color: "#F2A93B" }}>
          {fmt(buyIn)}
        </p>
      </div>
      <input
        type="range"
        min={0}
        max={BUY_INS.length - 1}
        step={1}
        value={buyK}
        onChange={(e) => setBuyK(Number(e.target.value))}
        aria-label="Buy-in"
        aria-valuetext={`${fmt(buyIn)} chips`}
        className="w-full mt-1 accent-[#F2A93B]"
      />
      <div className="flex justify-between meta" style={{ fontSize: 11.5 }}>
        <span>{fmt(BUY_INS[0])}</span>
        <span>{fmt(BUY_INS[BUY_INS.length - 1])}</span>
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <p className="label-caps">Blinds</p>
        <p className="font-black tabular-nums" style={{ fontSize: 22, color: "#F2A93B" }}>
          {fmt(blinds[0])}/{fmt(blinds[1])}
        </p>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, blindOptions.length - 1)}
        step={1}
        value={Math.max(0, blindOptions.indexOf(bb))}
        onChange={(e) => setBbPick(blindOptions[Number(e.target.value)])}
        aria-label="Blinds"
        aria-valuetext={`${blinds[0]} and ${blinds[1]}`}
        className="w-full mt-1 accent-[#F2A93B]"
      />
      <div className="flex justify-between meta" style={{ fontSize: 11.5 }}>
        <span>
          {fmt((blindOptions[0] ?? 2) / 2)}/{fmt(blindOptions[0] ?? 2)}
        </span>
        <span>{Math.round(buyIn / blinds[1])} big blinds deep</span>
        <span>
          {fmt((blindOptions[blindOptions.length - 1] ?? 2) / 2)}/
          {fmt(blindOptions[blindOptions.length - 1] ?? 2)}
        </span>
      </div>

      <label className="mt-4 flex items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">Blinds go up</span>
          <span className="block meta" style={{ fontSize: 12 }}>
            Double every 10 hands, so the game ends.
          </span>
        </span>
        <input
          type="checkbox"
          checked={rise}
          onChange={(e) => setRise(e.target.checked)}
          className="w-5 h-5 accent-[#C1EF62]"
        />
      </label>

      <button
        onClick={() => setPicking(true)}
        disabled={!friends.length}
        className="btn-primary w-full mt-5 disabled:opacity-50"
        style={{ minHeight: 54 }}
      >
        Invite your 25
      </button>
    </Sheet>
  );
}
