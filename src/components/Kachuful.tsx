import { SuitIcon } from "@/components/SuitIcon";
import { SoundToggle } from "@/components/SoundToggle";
import { useGameMusic } from "@/lib/sfx";
import { useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, ListOrdered, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, Sheet, StageCtx, buzz } from "@/components/SocialUI";
import { ChatStrip } from "@/components/GameChat";
import { GameOverBoard, withRanks } from "@/components/Leaderboard";
import {
  SUIT_NAME,
  applyMove,
  bidOptions,
  botMove,
  cardsThisRound,
  forbiddenBid,
  isRed,
  legalCards,
  maxCards,
  newGame,
  nextRound,
  rankLabel,
  rankOf,
  suitOf,
  totals,
  type Card,
  type KState,
  type Length,
  type Move,
  type Seat,
  scoringRule,
  type Scoring,
} from "@/lib/kachuful";
import { botSeats } from "@/lib/games";
import { mutualFriends, useSocial, type Person } from "@/lib/social";
import { track } from "@/lib/track";

// ---------- Cards ----------
const RED = "#C8364F";
const BLACK = "#17131D";

/**
 * A clean playing card, easy to read at a glance: a big rank and suit in the
 * top corner, a large suit in the bottom corner. Our own flat art.
 */
export function PlayingCard({
  card,
  size = "md",
  w: width,
  dim = false,
  lifted = false,
  glow = false,
  style,
}: {
  card: Card;
  size?: "sm" | "md" | "lg";
  /** Exact width (overrides size). */
  w?: number;
  dim?: boolean;
  lifted?: boolean;
  glow?: boolean;
  style?: React.CSSProperties;
}) {
  const s = suitOf(card);
  const w = width ?? (size === "sm" ? 50 : size === "lg" ? 72 : 60);
  const h = Math.round(w * 1.4);
  const color = isRed(s) ? "#D3243B" : "#14121C";
  const rank = rankLabel(rankOf(card));
  return (
    <span
      className="relative inline-block select-none shrink-0"
      style={{
        width: w,
        height: h,
        borderRadius: Math.round(w * 0.12),
        background: "linear-gradient(160deg, #FFFFFF 0%, #F3F1EC 100%)",
        boxShadow: glow
          ? "0 0 0 3px var(--lime), 0 0 16px rgba(181,219,94,0.7), 0 4px 10px rgba(0,0,0,0.45)"
          : lifted
            ? "0 0 0 1px rgba(0,0,0,0.12), 0 10px 18px -6px rgba(0,0,0,0.75)"
            : "0 0 0 1px rgba(0,0,0,0.12), 0 3px 8px rgba(0,0,0,0.4)",
        color,
        opacity: dim ? 0.45 : 1,
        filter: dim ? "saturate(0.5)" : undefined,
        ...style,
      }}
      aria-label={`${rank} of ${SUIT_NAME[s]}`}
    >
      <span
        className="absolute font-black leading-none"
        style={{
          left: w * 0.08,
          top: w * 0.06,
          fontSize: w * (rank === "10" ? 0.34 : 0.4),
          letterSpacing: "-0.05em",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        {rank}
      </span>
      <SuitIcon
        suit={s}
        size={Math.round(w * 0.26)}
        style={{ position: "absolute", left: w * 0.09, top: w * 0.5 }}
      />
      <SuitIcon
        suit={s}
        size={Math.round(w * 0.58)}
        style={{ position: "absolute", right: w * 0.07, bottom: w * 0.07 }}
      />
    </span>
  );
}

/** The back of a card: striped, with a tiny 25 mark. */
function CardBack({ w = 22, style }: { w?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-block shrink-0"
      style={{
        width: w,
        height: Math.round(w * 1.42),
        borderRadius: Math.round(w * 0.16),
        border: "1.5px solid #0B0A10",
        background: "repeating-linear-gradient(45deg, #F15B91 0 4px, #C9558A 4px 8px)",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.55)",
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

// ---------- Table geometry ----------
/** Where a seat sits on the rim of the oval table (percent of the table area). */
function seatPoint(slot: number, others: number) {
  // Others spread across the top arc, from the left end round to the right end.
  const start = 172;
  const end = 368;
  const a = others === 1 ? 270 : start + ((end - start) * slot) / (others - 1);
  const rad = (a * Math.PI) / 180;
  return { x: 50 + 43 * Math.cos(rad), y: 48 + 28 * Math.sin(rad), angle: a };
}

/** Where a seat's played card lands, part-way from the centre toward them. */
function trickPoint(angle: number, reach = 0.5) {
  const rad = (angle * Math.PI) / 180;
  return { x: 50 + 30 * reach * Math.cos(rad), y: 47 + 28 * reach * Math.sin(rad) };
}

function Seat({
  seat,
  state,
  index,
  x,
  y,
}: {
  seat: Seat;
  state: KState;
  index: number;
  x: number;
  y: number;
}) {
  const turn = state.turn === index && (state.phase === "bidding" || state.phase === "playing");
  // Their turn clock runs round their photo.
  const clock = useTurnLeft(state);
  const bid = state.bids[index];
  const cardsLeft = state.hands[index]?.length ?? 0;
  const made = bid !== null && state.won[index] === bid;
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)", width: 76 }}
    >
      <div className="relative">
        <span
          className="block rounded-full"
          style={{
            padding: 3,
            background: !turn
              ? "transparent"
              : clock
                ? `conic-gradient(${clock.urgent ? "var(--pink)" : "var(--lime)"} ${clock.pct}%, rgba(255,255,255,0.15) 0)`
                : "var(--lime)",
            boxShadow: turn ? "0 0 0 2px #0B0A10, 0 0 18px rgba(181,219,94,0.6)" : undefined,
          }}
        >
          <Avatar src={seat.avatar} initials={seat.initials} color={seat.color} size={42} />
        </span>
        {state.dealer === index && (
          <span
            className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold"
            style={{ background: "var(--sun)", color: "#17151F", border: "1.5px solid #0B0A10" }}
            title="Dealer"
          >
            D
          </span>
        )}
        {cardsLeft > 0 && (
          <span className="absolute -right-3 bottom-0 flex" aria-label={`${cardsLeft} cards`}>
            {Array.from({ length: Math.min(cardsLeft, 4) }).map((_, i) => (
              <CardBack
                key={i}
                w={13}
                style={{ marginLeft: i ? -9 : 0, transform: `rotate(${(i - 1.5) * 9}deg)` }}
              />
            ))}
          </span>
        )}
      </div>
      <span
        className="mt-1 max-w-full truncate text-[12px] font-bold"
        style={{ color: "#F4F1FA", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
      >
        {seat.name.split(" ")[0]}
        {seat.bot && <span className="font-medium opacity-70"> · bot</span>}
      </span>
      <span
        className="mt-0.5 rounded-full px-2 text-[11px] font-extrabold tabular-nums"
        style={{
          background: bid === null ? "rgba(7,6,11,0.55)" : made ? "var(--lime)" : "var(--sun)",
          color: bid === null ? "#CBC5D8" : "#17151F",
          border: "1.5px solid #0B0A10",
        }}
      >
        {bid === null
          ? state.phase === "bidding"
            ? turn
              ? "thinking…"
              : "–"
            : "–"
          : `${state.won[index]}/${bid}`}
      </span>
    </div>
  );
}

// ---------- The table ----------
export function KachufulBoard({
  state,
  mySeat,
  onMove,
  onNext,
  onClose,
  onPlayAgain,
  note,
}: {
  state: KState;
  mySeat: number;
  onMove: (m: Move) => void;
  onNext: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
  note?: string;
}) {
  useGameMusic();
  const [scoresOpen, setScoresOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLast, setShowLast] = useState(false);
  const turnClock = useTurnLeft(state);
  const lastKey = state.lastTrick
    ? state.lastTrick.cards.map((c) => c.card).join() + state.round
    : "";

  // First time at the table: show how to play.
  useEffect(() => {
    try {
      if (!localStorage.getItem(HOWTO_KEY)) setHelpOpen(true);
    } catch {
      // ignore
    }
  }, []);

  // Hold the finished trick on the table for a moment so everyone sees who took it.
  useEffect(() => {
    if (!lastKey) return;
    setShowLast(true);
    const t = setTimeout(() => setShowLast(false), 1500);
    return () => clearTimeout(t);
  }, [lastKey]);

  const n = state.seats.length;
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + 1 + i) % n);
  const angleOf = (seatIndex: number) =>
    seatIndex === mySeat ? 90 : seatPoint(others.indexOf(seatIndex), others.length).angle;
  const myTurn = state.turn === mySeat;
  const legal = useMemo(
    () => (state.phase === "playing" && myTurn ? legalCards(state, mySeat) : []),
    [state, myTurn, mySeat],
  );
  const cards = cardsThisRound(state);
  const myBid = state.bids[mySeat];
  const tableCards = state.trick.length
    ? state.trick
    : showLast && state.lastTrick
      ? state.lastTrick.cards
      : [];
  const lastWinner =
    showLast && !state.trick.length && state.lastTrick ? state.lastTrick.winner : null;
  const turnName = state.seats[state.turn]?.name.split(" ")[0];
  const forbidden = myTurn && state.phase === "bidding" ? forbiddenBid(state) : null;
  const total = totals(state);
  const hand = state.hands[mySeat] ?? [];
  const myTrumps = hand.filter((c) => suitOf(c) === state.trump).length;

  const act = (m: Move) => {
    try {
      setError(null);
      applyMove(state, m); // validate before sending
      buzz(10);
      onMove(m);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  let status = "";
  if (state.phase === "bidding")
    status = myTurn ? "Your call: how many tricks?" : `${turnName} is calling…`;
  else if (state.phase === "playing") {
    if (lastWinner !== null)
      status = `${lastWinner === mySeat ? "You" : state.seats[lastWinner].name.split(" ")[0]} won the trick`;
    else if (myTurn) {
      const need = (myBid ?? 0) - state.won[mySeat];
      status =
        need > 0
          ? `Your turn · win ${need} more`
          : need === 0
            ? "Your turn · don't win any more"
            : "Your turn · you're over your call";
    } else status = `${turnName} is playing…`;
  }

  // Game over: the results (and the roast) come upright, not sideways.
  if (state.phase === "over")
    return (
      <RoundSummary
        state={state}
        mySeat={mySeat}
        onNext={onNext}
        onClose={onClose}
        onPlayAgain={onPlayAgain}
      />
    );

  const bidding = state.phase === "bidding" && myTurn;
  // Your turn clock lives in your status box (you have no seat at the table).
  const myClock = myTurn ? turnClock : null;
  return (
    <Landscape>
      {(W, H) => {
        // Fit the hand across the table: bigger cards when there are few.
        const cardW = Math.round(Math.min(78, Math.max(48, H * (bidding ? 0.16 : 0.19))));
        // Keep the hand clear of the chat box in the corner.
        const handRoom = W - 2 * (CHAT_W + 16);
        const step =
          hand.length > 1 ? Math.min(cardW * 0.92, (handRoom - cardW) / (hand.length - 1)) : 0;
        return (
          <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{
              background: "radial-gradient(120% 90% at 40% 45%, #1B2A24 0%, #121019 70%)",
            }}
          >
            <div className="flex-1 min-h-0 flex">
              {/* The table */}
              <div className="relative flex-1 min-w-0">
                <div
                  className="absolute"
                  style={{
                    left: "4%",
                    right: "4%",
                    top: "13%",
                    bottom: "22%",
                    borderRadius: "50%",
                    background:
                      "radial-gradient(ellipse at 50% 40%, #2E7A57 0%, #1F5A40 55%, #174632 100%)",
                    border: "9px solid #3A2A22",
                    boxShadow:
                      "0 0 0 2px #0B0A10, inset 0 0 0 2px rgba(0,0,0,0.35), inset 0 18px 40px rgba(0,0,0,0.35), 0 24px 40px -18px rgba(0,0,0,0.9)",
                  }}
                />

                {/* Top-left: leave · round · your points */}
                <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                  <button
                    onClick={onClose}
                    aria-label="Leave the table"
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(7,6,11,0.6)", color: "#fff" }}
                  >
                    <X size={18} />
                  </button>
                  <span
                    className="rounded-full px-3 py-1 text-[12px] font-bold"
                    style={{ background: "rgba(7,6,11,0.6)", color: "#E9E4F2" }}
                  >
                    Round {state.round + 1}/{state.plan.length} · {cards} card
                    {cards > 1 ? "s" : ""} ·{" "}
                    <b style={{ color: "var(--lime)" }}>{total[mySeat]} pts</b>
                  </span>
                </div>

                {/* Top-right: trump (just the suit) · how to play · sound · scores */}
                <div
                  className="absolute z-10 flex items-center gap-1.5"
                  style={{ right: 8, top: 8 }}
                >
                  <span
                    className="text-[12px] font-extrabold uppercase tracking-[0.08em] rounded-full px-2.5 py-1"
                    style={{ background: "rgba(7,6,11,0.6)", color: "#E9E4F2" }}
                    aria-hidden="true"
                  >
                    Trump
                  </span>
                  <span
                    className="flex items-center justify-center rounded-xl"
                    style={{
                      width: 40,
                      height: 40,
                      background: "#fff",
                      boxShadow: "0 0 0 2px #0B0A10, 0 6px 14px rgba(0,0,0,0.5)",
                    }}
                    role="img"
                    aria-label={`Trump: ${SUIT_NAME[state.trump]}`}
                    title={`Trump: ${SUIT_NAME[state.trump]}`}
                  >
                    <SuitIcon suit={state.trump} size={26} />
                  </span>
                  <button
                    onClick={() => setHelpOpen(true)}
                    aria-label="How to play"
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(7,6,11,0.6)", color: "#fff" }}
                  >
                    <HelpCircle size={17} />
                  </button>
                  <SoundToggle />
                  <button
                    onClick={() => setScoresOpen(true)}
                    aria-label="Scorecard"
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(7,6,11,0.6)", color: "#fff" }}
                  >
                    <ListOrdered size={17} />
                  </button>
                </div>

                {/* What's happening: bottom-left corner (the chat has the bottom-right) */}
                <div
                  className="absolute z-[15] rounded-2xl px-3 py-2 leading-snug"
                  style={{
                    left: 8,
                    bottom: 6,
                    width: CHAT_W,
                    background: "rgba(7,6,11,0.72)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: 13.5,
                  }}
                  role="status"
                >
                  {myClock && (
                    <span
                      className="float-right ml-2 font-black tabular-nums"
                      style={{ color: myClock.urgent ? "var(--pink)" : "var(--lime)" }}
                    >
                      {Math.ceil(myClock.left / 1000)}s
                    </span>
                  )}
                  <b>{error ?? status}</b>
                  {!error && myBid !== null && (
                    <span style={{ color: "#CBC5D8" }}>
                      {" "}
                      · won {state.won[mySeat]}/{myBid}
                    </span>
                  )}
                  {!error && note && <span style={{ color: "#CBC5D8" }}> · {note}</span>}
                  {myClock && (
                    <span
                      aria-hidden="true"
                      className="absolute left-3 right-3 bottom-1 h-[3px] rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.12)" }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${myClock.pct}%`,
                          background: myClock.urgent ? "var(--pink)" : "var(--lime)",
                          transition: "width 250ms linear",
                        }}
                      />
                    </span>
                  )}
                </div>

                {/* Game chat, tucked in the bottom-right corner (online games) */}
                <div className="absolute z-[12]" style={{ right: 8, bottom: 6, width: CHAT_W }}>
                  <ChatStrip lines={2} openable={false} />
                </div>

                {/* Played cards land in front of whoever played them */}
                {tableCards.map((t, k) => {
                  const p = trickPoint(angleOf(t.seat), t.seat === mySeat ? 0.62 : 0.5);
                  const winner = lastWinner === t.seat;
                  return (
                    <div
                      key={t.card}
                      className="absolute trick-in"
                      style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        transform: `translate(-50%,-50%) rotate(${((k * 37) % 17) - 8}deg)`,
                        zIndex: 5 + k,
                        ["--from-x" as string]: `${(p.x - 50) * 3}px`,
                        ["--from-y" as string]: `${(p.y - 47) * 3}px`,
                      }}
                    >
                      <PlayingCard
                        card={t.card}
                        w={Math.round(cardW * 0.78)}
                        dim={lastWinner !== null && !winner}
                        glow={winner}
                      />
                    </div>
                  );
                })}

                {tableCards.length === 0 && (
                  <p
                    className="absolute text-center text-[13px] font-semibold"
                    style={{
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%,-50%)",
                      color: "rgba(255,255,255,0.7)",
                      width: "50%",
                    }}
                  >
                    {state.phase === "bidding"
                      ? "Calls first, then play."
                      : myTurn
                        ? "You lead. Play any card."
                        : `${turnName} leads.`}
                  </p>
                )}

                {/* Seats */}
                {others.map((i, slot) => {
                  const p = seatPoint(slot, others.length);
                  return (
                    <Seat
                      key={state.seats[i].id}
                      seat={state.seats[i]}
                      state={state}
                      index={i}
                      x={p.x}
                      y={p.y}
                    />
                  );
                })}

                {/* Your call: a row of numbers under your cards */}
                {bidding && (
                  <div
                    className="absolute left-0 right-0 z-[20] flex items-center justify-center gap-1.5 animate-soft-in"
                    style={{ bottom: 6 }}
                  >
                    <span
                      className="text-[11.5px] font-bold mr-1 whitespace-nowrap"
                      style={{ color: "#CBC5D8" }}
                    >
                      Call ·{" "}
                      {forbidden !== null
                        ? `not ${forbidden}`
                        : `${myTrumps} trump${myTrumps === 1 ? "" : "s"}`}
                    </span>
                    {Array.from({ length: cards + 1 }, (_, b) => {
                      const ok = bidOptions(state).includes(b);
                      return (
                        <button
                          key={b}
                          disabled={!ok}
                          onClick={() => act({ type: "bid", bid: b })}
                          aria-label={ok ? `Call ${b}` : `${b} not allowed for the dealer`}
                          className={ok ? "btn-primary tabular-nums" : "btn-secondary tabular-nums"}
                          style={{
                            width: 42,
                            minWidth: 42,
                            minHeight: 40,
                            paddingInline: 0,
                            fontSize: 17,
                          }}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* My hand, fanned along the bottom of the table */}
                <div
                  className="absolute left-0 right-0 flex justify-center items-end"
                  style={{ bottom: bidding ? 52 : 6, height: Math.round(cardW * 1.4) + 20 }}
                >
                  {hand.map((c, i) => {
                    const canPlay = legal.includes(c);
                    const mid = (hand.length - 1) / 2;
                    const tilt = hand.length > 1 ? (i - mid) * 3 : 0;
                    const drop = Math.abs(i - mid) * 1.5;
                    return (
                      <button
                        key={c}
                        disabled={!canPlay}
                        onClick={() => act({ type: "play", card: c })}
                        className="relative transition-transform"
                        style={{
                          marginLeft: i ? step - cardW : 0,
                          transform: `translateY(${canPlay ? drop - 14 : drop}px) rotate(${tilt}deg)`,
                          zIndex: i,
                        }}
                        aria-label={`Play ${rankLabel(rankOf(c))} of ${SUIT_NAME[suitOf(c)]}`}
                      >
                        <PlayingCard
                          card={c}
                          w={cardW}
                          lifted={canPlay}
                          dim={state.phase === "playing" && myTurn && !canPlay}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {state.phase === "roundEnd" && (
              <RoundSummary
                state={state}
                mySeat={mySeat}
                onNext={onNext}
                onClose={onClose}
                onPlayAgain={onPlayAgain}
              />
            )}
            {scoresOpen && <ScoreSheet state={state} onClose={() => setScoresOpen(false)} />}
            {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}
          </div>
        );
      }}
    </Landscape>
  );
}

/** The game chat box in the table's bottom-right corner. */
const CHAT_W = 200;

/**
 * Judgement is played sideways. On a phone held upright the whole game turns
 * 90°, so you just turn the phone; held sideways, it fills the screen as is.
 */
function Landscape({ children }: { children: (w: number, h: number) => React.ReactNode }) {
  const read = () =>
    typeof window === "undefined"
      ? { w: 844, h: 390 }
      : { w: window.innerWidth, h: window.innerHeight };
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  const upright = vp.h > vp.w;
  const W = upright ? vp.h : vp.w;
  const H = upright ? vp.w : vp.h;
  // The game area, kept clear of the status bar, notch and home bar. Turned
  // sideways, the phone's top edge is the game's left, its bottom the right.
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [upright]);
  const safe: React.CSSProperties = upright
    ? {
        left: "max(8px, env(safe-area-inset-top))",
        right: "max(8px, env(safe-area-inset-bottom))",
        top: 0,
        bottom: 0,
      }
    : {
        left: "env(safe-area-inset-left)",
        right: "env(safe-area-inset-right)",
        top: 0,
        bottom: "env(safe-area-inset-bottom)",
      };
  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: "#121019" }}>
      <div
        className="absolute"
        style={
          upright
            ? {
                width: W,
                height: H,
                top: 0,
                left: vp.w,
                transform: "rotate(90deg)",
                transformOrigin: "top left",
              }
            : { inset: 0 }
        }
      >
        <div ref={inner} className="absolute" style={safe}>
          <StageCtx.Provider value={upright ? { w: W, h: H } : null}>
            {children(size?.w ?? W, size?.h ?? H)}
          </StageCtx.Provider>
        </div>
      </div>
    </div>
  );
}

// ---------- How to play ----------
const HOWTO_KEY = "tf.kachuful.howto";

const STEPS: { title: string; body: string; art: () => React.ReactNode }[] = [
  {
    title: "Call it, then nail it",
    body: "Each round you call how many tricks you'll win. Win exactly that many and you score. One more or one less and you get nothing.",
    art: () => (
      <div className="flex items-center gap-3">
        <span className="sticker" style={{ transform: "none", fontSize: 18 }}>
          I'll win 2
        </span>
        <span className="flex">
          <PlayingCard card="S14" size="sm" />
          <PlayingCard card="H13" size="sm" style={{ marginLeft: -18 }} />
        </span>
      </div>
    ),
  },
  {
    title: "Hands grow, then shrink",
    body: "Round 1 deals 1 card each, round 2 deals 2, and so on up to 5 (Short) or 8 (Full). Then it counts back down to 1.",
    art: () => (
      <div className="flex items-end gap-3">
        {[1, 2, 3, 2, 1].map((k, i) => (
          <span key={i} className="flex">
            {Array.from({ length: k }).map((_, j) => (
              <CardBack key={j} w={20} style={{ marginLeft: j ? -12 : 0 }} />
            ))}
          </span>
        ))}
      </div>
    ),
  },
  {
    title: "Trump changes every round",
    body: "Spades ♠, then Diamonds ♦, Clubs ♣ and Hearts ♥, then round again. Any trump card beats every card of another suit.",
    art: () => (
      <div className="flex gap-2">
        {["S14", "D14", "C14", "H14"].map((c) => (
          <PlayingCard key={c} card={c} size="sm" />
        ))}
      </div>
    ),
  },
  {
    title: "The dealer's twist",
    body: "Calls go round the table and the dealer calls last. The dealer can't pick a number that makes all the calls add up to the cards in hand, so somebody always misses.",
    art: () => (
      <div className="text-center">
        <p className="text-sm text-cool">3 cards each · calls so far: 1, 0, 1</p>
        <p className="mt-2 font-extrabold" style={{ fontSize: 18 }}>
          Dealer can call 0, 2 or 3 <span style={{ color: "var(--hot)" }}>but not 1</span>
        </p>
      </div>
    ),
  },
  {
    title: "Playing a trick",
    body: "Follow the suit that was led if you can. If you can't, play a trump to win it or throw any card. Highest trump wins; with no trump, the highest card of the led suit wins. The winner leads next.",
    art: () => (
      <div className="flex items-center gap-2">
        <PlayingCard card="H10" size="sm" />
        <PlayingCard card="H14" size="sm" />
        <PlayingCard
          card="S2"
          size="sm"
          style={{ boxShadow: "0 0 0 3px var(--lime), 2px 2px 0 #0B0A10" }}
        />
        <span className="text-sm font-bold text-cool">← trump wins</span>
      </div>
    ),
  },
  {
    title: "Scoring",
    body: "Exactly right: 10 points plus your call. Off by any amount: 0. Highest total after the last round wins the table.",
    art: () => (
      <div className="grid gap-1.5 text-sm font-bold">
        <span
          className="rounded-lg px-3 py-1.5"
          style={{ background: "var(--lime)", color: "#17151F" }}
        >
          Called 2, won 2 → +12
        </span>
        <span className="rounded-lg px-3 py-1.5" style={{ background: "var(--fill-2)" }}>
          Called 1, won 2 → 0
        </span>
        <span className="rounded-lg px-3 py-1.5" style={{ background: "var(--fill-2)" }}>
          Called 0, won 0 → +10
        </span>
      </div>
    ),
  },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const done = () => {
    try {
      localStorage.setItem(HOWTO_KEY, "1");
    } catch {
      // ignore
    }
    onClose();
  };
  return (
    <Sheet title="How to play Judgement" onClose={done}>
      <div className="flex gap-1.5 mb-5" aria-hidden="true">
        {STEPS.map((_, k) => (
          <span
            key={k}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: k <= i ? "var(--lime)" : "var(--fill-2)" }}
          />
        ))}
      </div>
      <div key={i} className="animate-soft-in">
        <div
          className="rounded-2xl flex items-center justify-center py-6 px-3"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, #2E7A57 0%, #1F5A40 70%)",
            border: "2px solid #0B0A10",
            minHeight: 150,
          }}
        >
          {step.art()}
        </div>
        <p className="meta mt-4">
          Step {i + 1} of {STEPS.length}
        </p>
        <h3 className="heading mt-1">{step.title}</h3>
        <p className="mt-2 text-cool" style={{ fontSize: 15, lineHeight: 1.55 }}>
          {step.body}
        </p>
      </div>
      <div className="mt-6 flex gap-2">
        {i > 0 && (
          <button onClick={() => setI(i - 1)} className="btn-secondary flex-1">
            Back
          </button>
        )}
        <button onClick={() => (last ? done() : setI(i + 1))} className="btn-primary flex-1">
          {last ? "Let's play" : "Next"}
        </button>
      </div>
    </Sheet>
  );
}

function RoundSummary({
  state,
  mySeat,
  onNext,
  onClose,
  onPlayAgain,
}: {
  state: KState;
  mySeat: number;
  onNext: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
}) {
  const over = state.phase === "over";
  const last = state.scores[state.scores.length - 1] ?? [];
  const total = totals(state);
  const order = state.seats.map((_, i) => i).sort((a, b) => total[b] - total[a]);
  const winner = order[0];
  const iWon = over && winner === mySeat;
  // Game over: the leaderboard, with everyone's final score.
  if (over)
    return (
      <GameOverBoard
        game="Judgement"
        roast={{ game: "Judgement" }}
        rows={withRanks(order, (i) => total[i]).map(({ r: i, rank }) => {
          const p = state.seats[i];
          return {
            id: p.id,
            rank,
            name: p.name,
            avatar: p.avatar,
            initials: p.initials,
            color: p.color,
            value: total[i],
            link: !p.bot,
            me: i === mySeat,
          };
        })}
        onClose={onClose}
        onPlayAgain={onPlayAgain}
      />
    );
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(7,6,11,0.55)" }}
    >
      <div
        className="w-full max-w-md card-editorial p-6 animate-soft-in"
        style={{ borderRadius: "28px 28px 0 0" }}
      >
        <p className="label-caps">{over ? "game over" : `end of round ${state.round + 1}`}</p>
        <h2 className="font-display mt-2" style={{ fontSize: 28, lineHeight: 1.1 }}>
          {over
            ? iWon
              ? "You won the table."
              : `${state.seats[winner].name.split(" ")[0]} takes it.`
            : last[mySeat]
              ? `Called it. +${last[mySeat]}`
              : "Missed it. 0 this round."}
        </h2>
        <ol className="mt-4 divide-y" style={{ borderColor: "var(--border-cool)" }}>
          {order.map((i, rank) => (
            <li key={state.seats[i].id} className="flex items-center gap-3 py-2.5">
              <span
                className="w-5 text-center font-bold tabular-nums"
                style={{ color: rank === 0 ? "var(--blue-deep)" : "var(--text-muted)" }}
              >
                {rank + 1}
              </span>
              <Avatar
                src={state.seats[i].avatar}
                initials={state.seats[i].initials}
                color={state.seats[i].color}
                size={32}
              />
              <span className="flex-1 font-semibold text-cream text-sm">
                {i === mySeat ? "You" : state.seats[i].name}
              </span>
              {!over && (
                <span className="text-xs tabular-nums text-cool">
                  bid {state.bids[i]} · won {state.won[i]}
                </span>
              )}
              <span
                className="w-14 text-right tabular-nums font-bold"
                style={{ color: last[i] ? "var(--mint)" : "var(--text-muted)" }}
              >
                {over ? total[i] : last[i] ? `+${last[i]}` : "0"}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex gap-3">
          {over ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 rounded-full py-3.5 font-semibold"
                style={{ background: "var(--bg-surface)" }}
              >
                Done
              </button>
              {onPlayAgain && (
                <button onClick={onPlayAgain} className="flex-1 rounded-full py-3.5 btn-bronze">
                  Play again
                </button>
              )}
            </>
          ) : (
            <button onClick={onNext} className="w-full rounded-full py-3.5 btn-bronze">
              Deal round {state.round + 2}
            </button>
          )}
        </div>
      </div>
      <Confetti fire={iWon ? 1 : 0} />
    </div>
  );
}

function ScoreSheet({ state, onClose }: { state: KState; onClose: () => void }) {
  const total = totals(state);
  return (
    <Sheet title="scorecard" onClose={onClose}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-faint">
              <th className="text-left font-semibold py-1">Round</th>
              {state.seats.map((s) => (
                <th key={s.id} className="font-semibold px-1">
                  {s.name.split(" ")[0].slice(0, 6)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.scores.map((r, ri) => (
              <tr key={ri} style={{ borderTop: "1px solid var(--border-cool)" }}>
                <td className="py-1.5 text-cool">
                  <span className="inline-flex items-center gap-1">
                    {ri + 1} · {state.plan[ri]}
                    <SuitIcon
                      suit={(["S", "D", "C", "H"] as const)[ri % 4]}
                      size={12}
                      color={ri % 4 === 1 || ri % 4 === 3 ? "#FF6B81" : "#E9E4F2"}
                    />
                  </span>
                </td>
                {r.map((p, i) => (
                  <td
                    key={i}
                    className="text-center"
                    style={{ color: p ? "var(--mint)" : "var(--text-muted)" }}
                  >
                    {p}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--border-cool)" }}>
              <td className="py-2 font-bold text-cream">Total</td>
              {total.map((t, i) => (
                <td key={i} className="text-center font-bold text-cream">
                  {t}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-cool">{scoringRule(state.scoring)}</p>
    </Sheet>
  );
}

// ---------- Bots take their turns (run by one phone only) ----------
export function useBotTurns(state: KState | null, drive: boolean, apply: (s: KState) => void) {
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const key = state
    ? `${state.round}:${state.phase}:${state.turn}:${state.trick.length}:${state.bids.join()}:${state.turnStartedAt ?? 0}`
    : "";
  useEffect(() => {
    if (!state || !drive) return;
    if (state.phase !== "bidding" && state.phase !== "playing") return;
    // Turn timer: a person who runs out of time gets a sensible move played for them.
    if (!state.seats[state.turn]?.bot) {
      if (!state.turnSeconds || !state.turnStartedAt) return;
      const left = state.turnStartedAt + state.turnSeconds * 1000 - Date.now();
      const t = setTimeout(
        () => applyRef.current(applyMove(state, botMove(state))),
        Math.max(0, left),
      );
      return () => clearTimeout(t);
    }
    const justFinishedTrick =
      state.phase === "playing" && state.trick.length === 0 && !!state.lastTrick;
    const t = setTimeout(
      () => applyRef.current(applyMove(state, botMove(state))),
      justFinishedTrick ? 1700 : 900,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, drive]);
}

// ---------- Solo vs bots (works in demo mode too) ----------
export function LocalKachuful({
  seats,
  length,
  scoring = "classic",
  turnSeconds = 0,
  onClose,
}: {
  seats: Seat[];
  length: Length;
  scoring?: Scoring;
  turnSeconds?: number;
  onClose: () => void;
}) {
  const [state, setState] = useState(() => {
    track("game_started", { game: "judgement", solo: true });
    return newGame(seats, length, undefined, scoring, turnSeconds);
  });
  const [confirmLeave, setConfirmLeave] = useState(false);
  useBotTurns(state, true, setState);
  // A solo game isn't saved anywhere, so check before throwing it away mid-game.
  const leave = () =>
    state.phase === "over" || (state.round === 0 && state.bids.every((b) => b === null))
      ? onClose()
      : setConfirmLeave(true);
  return (
    <>
      <KachufulBoard
        state={state}
        mySeat={0}
        onMove={(m) => setState((s) => applyMove(s, m))}
        onNext={() => setState((s) => nextRound(s))}
        onClose={leave}
        onPlayAgain={() => setState(newGame(seats, length, undefined, scoring, turnSeconds))}
      />
      {confirmLeave && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-6"
          style={{ background: "rgba(7,6,11,0.55)" }}
        >
          <div
            className="card w-full max-w-sm p-5"
            role="alertdialog"
            aria-modal="true"
            aria-label="Leave the game"
          >
            <p className="heading" style={{ fontSize: 18 }}>
              Leave this game?
            </p>
            <p className="meta mt-1.5" style={{ fontSize: 14 }}>
              Solo games aren't saved. You'll lose your scores for this table.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmLeave(false)} className="btn-secondary flex-1">
                Keep playing
              </button>
              <button onClick={onClose} className="btn-danger flex-1">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Lobby ----------
const TIMER_CHOICES = [0, 15, 30, 60];

export function KachufulLobby({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (
    friends: Person[],
    bots: number,
    length: Length,
    scoring: Scoring,
    turnSeconds: number,
  ) => void;
}) {
  const s = useSocial();
  const live = s.mode === "live";
  const people = live ? mutualFriends() : [];
  const [picked, setPicked] = useState<string[]>([]);
  const [rounds, setRounds] = useState(5);
  const [upDown, setUpDown] = useState(false);
  const [scoring, setScoring] = useState<Scoring>("classic");
  const [timer, setTimer] = useState(30);
  const [howTo, setHowTo] = useState(false);
  const friends = people.filter((p) => picked.includes(p.id));
  // Solo: three bots. With friends: just you and them.
  const bots = friends.length ? 0 : 3;
  const players = friends.length ? friends.length + 1 : 4;
  // At least one round per player; at most as many cards as the deck allows.
  const most = maxCards(players);
  const minRounds = Math.min(players, most);
  const shown = Math.min(Math.max(rounds, minRounds), most);
  const total = upDown ? shown * 2 - 1 : shown;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 6 ? p : [...p, id]));

  const Opt = ({
    on,
    onClick,
    title,
    sub,
  }: {
    on: boolean;
    onClick: () => void;
    title: string;
    sub?: string;
  }) => (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="flex-1 rounded-2xl py-3 px-2 text-center transition-colors"
      style={{
        background: on ? "var(--lime)" : "var(--fill)",
        color: on ? "var(--on-accent)" : "var(--ink)",
        border: on ? "var(--bd)" : "1px solid var(--line)",
        boxShadow: on ? "var(--pop-sm)" : "none",
      }}
    >
      <span className="block font-extrabold tabular-nums">{title}</span>
      {sub && <span className="block text-[11.5px] opacity-75 mt-0.5">{sub}</span>}
    </button>
  );

  return (
    <Sheet title="Judgement" onClose={onClose}>
      <p className="text-sm text-cool" style={{ lineHeight: 1.5 }}>
        Call your tricks, then win exactly that many.
      </p>

      {live && people.length > 0 && (
        <>
          <p className="label-caps mt-5 mb-2">Invite from your 25</p>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
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
        </>
      )}

      <p className="label-caps mt-5 mb-2">Rounds</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setRounds(Math.max(minRounds, shown - 1))}
          disabled={shown <= minRounds}
          className="btn-secondary btn-icon text-xl"
          aria-label="Fewer rounds"
        >
          −
        </button>
        <div className="flex-1 text-center">
          <p className="display tabular-nums" style={{ fontSize: 34, lineHeight: 1 }}>
            {total}
          </p>
          <p className="meta mt-1">
            1 → {shown} cards{upDown ? ` → 1` : ""}
          </p>
        </div>
        <button
          onClick={() => setRounds(Math.min(most, shown + 1))}
          disabled={shown >= most}
          className="btn-secondary btn-icon text-xl"
          aria-label="More rounds"
        >
          +
        </button>
      </div>
      <button
        onClick={() => setUpDown((v) => !v)}
        aria-pressed={upDown}
        className="mt-2.5 w-full flex items-center justify-between rounded-2xl px-4 py-2.5"
        style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
      >
        <span className="text-sm font-semibold text-cream">And back down to 1</span>
        <span
          className="w-11 h-6 rounded-full relative transition-colors"
          style={{ background: upDown ? "var(--lime)" : "var(--fill-2)" }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
            style={{ background: "#fff", left: 2, transform: upDown ? "translateX(20px)" : "none" }}
          />
        </span>
      </button>
      <p className="meta mt-1.5">
        At least {minRounds} rounds with {players} players.
      </p>

      <p className="label-caps mt-5 mb-2">Scoring</p>
      <div className="flex gap-2">
        <Opt
          on={scoring === "classic"}
          onClick={() => setScoring("classic")}
          title="Classic"
          sub="10 + your call"
        />
        <Opt
          on={scoring === "x10"}
          onClick={() => setScoring("x10")}
          title="×10"
          sub="10 × your call"
        />
      </div>

      <p className="label-caps mt-5 mb-2">Timer per player</p>
      <div className="flex gap-2">
        {TIMER_CHOICES.map((t) => (
          <Opt key={t} on={timer === t} onClick={() => setTimer(t)} title={t ? `${t}s` : "Off"} />
        ))}
      </div>

      <button
        onClick={() => setHowTo(true)}
        className="mt-5 w-full text-sm font-bold text-bronze py-2"
      >
        New to Judgement? See how to play
      </button>
      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}

      <button
        onClick={() => onStart(friends, bots, { rounds: shown, upDown }, scoring, timer)}
        className="mt-3 w-full btn-primary"
      >
        {friends.length
          ? `Deal in ${friends.length} friend${friends.length > 1 ? "s" : ""}`
          : "Deal me in (vs 3 bots)"}
      </button>
    </Sheet>
  );
}

export { botSeats };

/** Countdown for the current turn (only when the table has a timer). */
/** Time left on the current turn (null when there's no turn clock). */
function useTurnLeft(state: KState) {
  const [now, setNow] = useState(Date.now());
  const on =
    !!state.turnSeconds &&
    !!state.turnStartedAt &&
    (state.phase === "bidding" || state.phase === "playing");
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [on, state.turnStartedAt]);
  if (!on) return null;
  const total = state.turnSeconds! * 1000;
  const left = Math.max(0, state.turnStartedAt! + total - now);
  return { left, pct: (left / total) * 100, urgent: left < 5000 };
}
