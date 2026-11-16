/**
 * No-Limit Hold'em with your 25: a casino-style table (felt, rail, seats
 * around it, chips and a dealer button), big Fold / Call / Raise buttons and a
 * raise slider. Friends only, no bots. The host sets seats, buy-in and blinds.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Crown, LogOut, UserPlus, X } from "lucide-react";
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
type SeatView = {
  i: number;
  x: number;
  y: number;
};

/** Seat positions around the table, you at the bottom middle. */
function seatSpots(n: number, mine: number): SeatView[] {
  const out: SeatView[] = [];
  for (let k = 0; k < n; k++) {
    const i = (mine + k) % n;
    // Start at the bottom and go clockwise.
    const a = Math.PI / 2 + (k * 2 * Math.PI) / n;
    out.push({ i, x: 50 + Math.cos(a) * 46, y: 50 + Math.sin(a) * 45 });
  }
  return out;
}

function TurnRing({ since, size }: { since: number; size: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, 1 - (now - since) / TURN_MS);
  const r = size / 2 + 4;
  const c = 2 * Math.PI * r;
  return (
    <svg
      aria-hidden="true"
      className="absolute pointer-events-none"
      width={r * 2 + 6}
      height={r * 2 + 6}
      style={{ left: -(r + 3 - size / 2), top: -(r + 3 - size / 2), transform: "rotate(-90deg)" }}
    >
      <circle cx={r + 3} cy={r + 3} r={r} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="4" />
      <circle
        cx={r + 3}
        cy={r + 3}
        r={r}
        fill="none"
        stroke={left > 0.3 ? "#B8F25C" : "#FF5A6E"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${c * left} ${c}`}
      />
    </svg>
  );
}

function SeatSpot({ s, v, me, size }: { s: PokerState; v: SeatView; me: boolean; size: number }) {
  const p = s.seats[v.i];
  const f = friendById(p.id);
  const turn = s.phase === "betting" && s.toAct === v.i;
  const won = s.result?.winners.find((w) => w.seat === v.i);
  const shown = s.result?.shown[v.i];
  const inHand = !p.out && !p.folded && s.phase !== "lobby";
  // Bets sit between the seat and the middle of the table.
  const bx = 50 + (v.x - 50) * 0.55;
  const by = 50 + (v.y - 50) * 0.55;
  return (
    <>
      <div
        className="absolute flex flex-col items-center"
        style={{
          left: `${v.x}%`,
          top: `${v.y}%`,
          transform: "translate(-50%, -50%)",
          zIndex: 3,
          opacity: p.out ? 0.4 : 1,
        }}
      >
        {/* Last action */}
        {p.last && !won && (
          <span
            className="mb-1 rounded-md px-1.5 py-0.5 font-black uppercase whitespace-nowrap"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.04em",
              background: /fold/i.test(p.last)
                ? "#555"
                : /raise|bet|all/i.test(p.last)
                  ? "#E2A21B"
                  : "#2F7BE0",
              color: "#fff",
            }}
          >
            {p.last}
          </span>
        )}
        {won && (
          <span
            className="mb-1 rounded-md px-1.5 py-0.5 font-black uppercase whitespace-nowrap win-pop"
            style={{ fontSize: 10, background: "#F7C948", color: "#3A2606" }}
          >
            Winner +{fmt(won.amount)}
          </span>
        )}
        <span className="relative" style={{ width: size, height: size }}>
          {turn && <TurnRing since={s.turnAt} size={size} />}
          <span
            className="block rounded-full overflow-hidden"
            style={{
              border: `3px solid ${won ? "#F7C948" : turn ? "#B8F25C" : "#C9A66B"}`,
              boxShadow: won ? "0 0 22px rgba(247,201,72,0.9)" : "0 4px 10px rgba(0,0,0,0.5)",
              filter:
                p.folded && s.phase !== "lobby" ? "grayscale(0.8) brightness(0.7)" : undefined,
            }}
          >
            <Avatar
              src={p.avatar || f?.avatar || undefined}
              initials={p.initials}
              color={f?.color}
              size={size - 6}
            />
          </span>
          {s.phase !== "lobby" && s.dealer === v.i && (
            <span
              aria-label="Dealer"
              className="absolute -right-2 -top-1 w-5 h-5 rounded-full flex items-center justify-center font-black"
              style={{
                background: "#fff",
                color: "#14121C",
                fontSize: 10,
                boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
              }}
            >
              D
            </span>
          )}
          {/* Their cards: backs while in the hand, faces at showdown. */}
          {!me && inHand && (
            <span className="absolute -right-5 bottom-0 flex">
              {shown
                ? shown.map((c, k) => (
                    <span
                      key={c}
                      style={{ marginLeft: k ? -12 : 0, transform: `rotate(${k ? 8 : -6}deg)` }}
                    >
                      <PlayingCard card={c} w={24} flip />
                    </span>
                  ))
                : [0, 1].map((k) => (
                    <span
                      key={k}
                      style={{ marginLeft: k ? -14 : 0, transform: `rotate(${k ? 8 : -6}deg)` }}
                    >
                      <PlayingCard back w={18} />
                    </span>
                  ))}
            </span>
          )}
        </span>
        <span
          className="-mt-1.5 relative rounded-lg px-2 py-0.5 text-center min-w-[64px]"
          style={{
            background: "linear-gradient(180deg, #2A2438, #16131F)",
            border: "1px solid rgba(201,166,107,0.6)",
            boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
          }}
        >
          <span
            className="block font-bold truncate max-w-[78px]"
            style={{ fontSize: 11, color: "#fff" }}
          >
            {me ? "You" : p.name.split(" ")[0]}
          </span>
          <span
            className="block font-extrabold tabular-nums"
            style={{ fontSize: 11.5, color: "#FDE68A" }}
          >
            {p.out ? "Out" : fmt(p.stack)}
          </span>
        </span>
      </div>
      {p.bet > 0 && (
        <div
          className="absolute"
          style={{ left: `${bx}%`, top: `${by}%`, transform: "translate(-50%, -50%)", zIndex: 2 }}
        >
          <Chips amount={p.bet} small />
        </div>
      )}
    </>
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
  const mine = s.seats.findIndex((p) => p.id === meId);
  const spots = useMemo(() => seatSpots(s.seats.length, Math.max(0, mine)), [s.seats.length, mine]);
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
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
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
  const size = s.seats.length > 6 ? 46 : 54;
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #2B1F4A 0%, #110D1C 70%)" }}
    >
      <div className="mx-auto w-full max-w-md flex flex-col h-full px-3 pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between px-1">
          <span className="flex items-center gap-2">
            <span className="heading" style={{ fontSize: 19 }}>
              Hold'em
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-bold"
              style={{ background: "rgba(255,255,255,0.08)", fontSize: 11.5 }}
            >
              Blinds {fmt(s.sb)}/{fmt(s.bb)} · Hand {s.handNo}
            </span>
          </span>
          <span className="flex items-center">
            <SoundToggle />
            <button
              onClick={() =>
                s.phase === "over" || mine < 0 || s.seats[mine].out ? onClose() : setLeaving(true)
              }
              aria-label="Leave the table"
              className="w-10 h-10 flex items-center justify-center text-cool"
            >
              <X size={22} />
            </button>
          </span>
        </header>

        {/* Felt + rail */}
        <div className="relative flex-1 min-h-0 mt-2 mb-2">
          <div
            className="absolute rounded-[50%/38%]"
            style={{
              inset: "9% 9% 9% 9%",
              background:
                "radial-gradient(ellipse at 50% 42%, #2FA866 0%, #1F7F4C 45%, #155C36 100%)",
              boxShadow:
                "0 0 0 10px #5A3420, 0 0 0 12px #7A4A2C, 0 0 0 15px #3B2214, 0 18px 50px rgba(0,0,0,0.7), inset 0 0 40px rgba(0,0,0,0.45)",
            }}
          >
            <span
              aria-hidden="true"
              className="absolute rounded-[50%/38%]"
              style={{ inset: "7%", border: "2px solid rgba(255,230,160,0.22)" }}
            />
            {/* Middle: pot and the board */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              {middle > 0 && (
                <span
                  className="flex items-center gap-1.5 rounded-full pl-1 pr-3 py-0.5 font-extrabold tabular-nums"
                  style={{ background: "rgba(0,0,0,0.45)", color: "#FDE68A", fontSize: 14 }}
                >
                  <Chips amount={middle} small bare />
                  Pot {fmt(middle)}
                </span>
              )}
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((k) =>
                  s.board[k] ? (
                    <PlayingCard
                      key={s.board[k]}
                      card={s.board[k]}
                      w={40}
                      flip
                      glow={winnerCards.size > 0 && false}
                    />
                  ) : (
                    <span
                      key={k}
                      className="rounded-[7px]"
                      style={{
                        width: 40,
                        height: 57,
                        border: "1.5px dashed rgba(255,255,255,0.18)",
                      }}
                    />
                  ),
                )}
              </div>
              {banner && (
                <span
                  className="rounded-full px-3 py-1 font-extrabold text-center win-pop"
                  style={{
                    background: "#F7C948",
                    color: "#3A2606",
                    fontSize: 12.5,
                    maxWidth: "80%",
                  }}
                >
                  {banner}
                </span>
              )}
              {s.phase === "betting" && !banner && (
                <span
                  className="font-semibold"
                  style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)" }}
                >
                  {["Pre-flop", "Flop", "Turn", "River"][s.street]}
                </span>
              )}
            </div>
          </div>
          {spots.map((v) => (
            <SeatSpot key={s.seats[v.i].id} s={s} v={v} me={v.i === mine} size={size} />
          ))}
        </div>

        {/* Your cards */}
        {mine >= 0 && !s.seats[mine].out && myCards.length === 2 && (
          <div className="flex items-end justify-center gap-3 -mt-1">
            <div className="flex">
              {myCards.map((c, k) => (
                <span
                  key={c}
                  style={{
                    transform: `rotate(${k ? 6 : -6}deg) translateY(${k ? 0 : 2}px)`,
                    marginLeft: k ? -10 : 0,
                    opacity: s.seats[mine].folded ? 0.45 : 1,
                  }}
                >
                  <PlayingCard card={c} w={58} glow={winnerCards.has(c)} />
                </span>
              ))}
            </div>
            {myHand && !s.seats[mine].folded && (
              <span
                className="mb-2 rounded-full px-2.5 py-1 font-bold"
                style={{ background: "rgba(255,255,255,0.1)", fontSize: 12 }}
              >
                {myHand}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 min-h-[64px]">
          {myTurn && o ? (
            raising ? (
              <div
                className="rounded-2xl p-3"
                style={{
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="meta font-bold">Raise to</span>
                  <span
                    className="font-black tabular-nums"
                    style={{ fontSize: 22, color: "#FDE68A" }}
                  >
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
                      className="rounded-lg py-1.5 font-bold"
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
                    style={{
                      background: "linear-gradient(180deg, #F7B84B, #D98A12)",
                      color: "#2B1A00",
                    }}
                  >
                    {raiseTo >= o.maxTo ? "All in" : `Raise to ${fmt(raiseTo)}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onAction({ type: "fold" })}
                  className="poker-btn"
                  style={{ background: "linear-gradient(180deg, #E5566C, #B92A41)" }}
                >
                  Fold
                </button>
                <button
                  onClick={() => onAction(o.canCheck ? { type: "check" } : { type: "call" })}
                  className="poker-btn"
                  style={{ background: "linear-gradient(180deg, #3B8EF0, #1E5FC2)" }}
                >
                  {o.canCheck
                    ? "Check"
                    : o.toCall >= s.seats[mine].stack
                      ? `All in ${fmt(o.toCall)}`
                      : `Call ${fmt(o.toCall)}`}
                </button>
                <button
                  disabled={!o.canRaise || o.toCall >= s.seats[mine].stack}
                  onClick={() => {
                    setRaiseTo(o.minTo);
                    setRaising(true);
                  }}
                  className="poker-btn disabled:opacity-40"
                  style={{
                    background: "linear-gradient(180deg, #F7B84B, #D98A12)",
                    color: "#2B1A00",
                  }}
                >
                  {s.currentBet === 0 ? "Bet" : "Raise"}
                </button>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <p className="meta font-semibold" aria-live="polite">
                {s.phase === "betting"
                  ? `${s.seats[s.toAct]?.name.split(" ")[0]} to act…`
                  : s.phase === "showdown"
                    ? "Next hand coming up…"
                    : ""}
              </p>
              {away && (
                <button onClick={onFoldAway} className="btn-secondary px-4 min-h-[38px] text-sm">
                  {s.seats[s.toAct].name.split(" ")[0]} is away. Fold them
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {leaving && (
        <Sheet title="Leave the table?" onClose={() => setLeaving(false)}>
          <div className="grid gap-2.5">
            <button onClick={() => setLeaving(false)} className="btn-primary">
              Stay
            </button>
            <button onClick={onClose} className="btn-secondary">
              Step away (come back from Your games)
            </button>
            <button
              onClick={() => {
                setLeaving(false);
                onLeave();
              }}
              className="btn-danger"
            >
              <LogOut size={16} aria-hidden="true" /> Cash out and leave
            </button>
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
