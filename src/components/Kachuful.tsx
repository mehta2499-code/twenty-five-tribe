import { useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, ListOrdered, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, Sheet, buzz } from "@/components/SocialUI";
import {
  SUIT_NAME,
  SUIT_SYMBOL,
  applyMove,
  bidOptions,
  botMove,
  cardsThisRound,
  forbiddenBid,
  isRed,
  legalCards,
  newGame,
  nextRound,
  rankLabel,
  rankOf,
  suitOf,
  totals,
  type Card,
  type KState,
  type Move,
  type Seat,
  scoringRule,
  type Scoring,
} from "@/lib/kachuful";
import { botSeats } from "@/lib/games";
import { mutualFriends, useSocial, type Person } from "@/lib/social";

// ---------- Cards ----------
const RED = "#C8364F";
const BLACK = "#17131D";

/** A proper playing card: corner indices, a big centre pip, rounded white stock. */
export function PlayingCard({
  card,
  size = "md",
  dim = false,
  lifted = false,
  style,
}: {
  card: Card;
  size?: "sm" | "md" | "lg";
  dim?: boolean;
  lifted?: boolean;
  style?: React.CSSProperties;
}) {
  const s = suitOf(card);
  const w = size === "sm" ? 46 : size === "lg" ? 70 : 60;
  const h = Math.round(w * 1.42);
  const color = isRed(s) ? RED : BLACK;
  const rank = rankLabel(rankOf(card));
  const corner = Math.round(w * 0.24);
  return (
    <span
      className="relative inline-block select-none shrink-0"
      style={{
        width: w,
        height: h,
        borderRadius: Math.round(w * 0.14),
        background: "linear-gradient(180deg, #FFFFFF 0%, #F4F1EA 100%)",
        border: "1.5px solid #0B0A10",
        boxShadow: lifted ? "0 10px 18px -8px rgba(0,0,0,0.9)" : "2px 2px 0 #0B0A10",
        color,
        opacity: dim ? 0.42 : 1,
        filter: dim ? "saturate(0.6)" : undefined,
        ...style,
      }}
      aria-label={`${rank} of ${SUIT_NAME[s]}`}
    >
      <span
        className="absolute flex flex-col items-center leading-none font-extrabold"
        style={{ top: 4, left: 5, fontSize: corner }}
      >
        <span>{rank}</span>
        <span style={{ fontSize: corner * 0.95, marginTop: 1 }}>{SUIT_SYMBOL[s]}</span>
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: Math.round(w * 0.52), lineHeight: 1 }}
        aria-hidden="true"
      >
        {SUIT_SYMBOL[s]}
      </span>
      <span
        className="absolute flex flex-col items-center leading-none font-extrabold"
        style={{ bottom: 4, right: 5, fontSize: corner, transform: "rotate(180deg)" }}
        aria-hidden="true"
      >
        <span>{rank}</span>
        <span style={{ fontSize: corner * 0.95, marginTop: 1 }}>{SUIT_SYMBOL[s]}</span>
      </span>
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
/** Where a seat sits on the rim of the oval table (percent of the table box). */
function seatPoint(slot: number, others: number) {
  // Others spread across the top arc, from the left side round to the right side.
  const start = 165;
  const end = 375;
  const a = others === 1 ? 270 : start + ((end - start) * slot) / (others - 1);
  const rad = (a * Math.PI) / 180;
  return { x: 50 + 44 * Math.cos(rad), y: 47 + 41 * Math.sin(rad), angle: a };
}

/** Where a seat's played card lands, part-way from the centre toward them. */
function trickPoint(angle: number, reach = 0.42) {
  const rad = (angle * Math.PI) / 180;
  return { x: 50 + 44 * reach * Math.cos(rad), y: 47 + 41 * reach * Math.sin(rad) };
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
            background: turn ? "var(--lime)" : "transparent",
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
  const [scoresOpen, setScoresOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLast, setShowLast] = useState(false);
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
    status = myTurn ? `Your call: how many tricks will you win?` : `${turnName} is calling…`;
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

  // Fan the hand: a gentle arc, overlapping more as it grows.
  const overlap = hand.length > 6 ? -26 : hand.length > 4 ? -18 : -8;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "radial-gradient(120% 70% at 50% 40%, #1B2A24 0%, #121019 70%)" }}
    >
      <div className="mx-auto w-full max-w-md flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <button
            onClick={onClose}
            aria-label="Leave the table"
            className="btn-secondary btn-icon"
            style={{ minHeight: 42, width: 42, minWidth: 42 }}
          >
            <X size={18} />
          </button>
          <div className="text-center min-w-0">
            <p className="text-[12px] font-bold text-faint">
              Round {state.round + 1} of {state.plan.length} · {cards} card{cards > 1 ? "s" : ""}
            </p>
            <p className="font-extrabold" style={{ fontSize: 16 }}>
              {total[mySeat]} pts
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setHelpOpen(true)}
              aria-label="How to play"
              className="btn-secondary btn-icon"
              style={{ minHeight: 42, width: 42, minWidth: 42 }}
            >
              <HelpCircle size={18} />
            </button>
            <button
              onClick={() => setScoresOpen(true)}
              aria-label="Scorecard"
              className="btn-secondary btn-icon"
              style={{ minHeight: 42, width: 42, minWidth: 42 }}
            >
              <ListOrdered size={18} />
            </button>
          </div>
        </header>

        {/* Table */}
        <div className="relative flex-1 min-h-[300px] mx-3 mt-6 mb-2">
          <div
            className="absolute"
            style={{
              inset: "6% 4% 4% 4%",
              borderRadius: "50% / 46%",
              background:
                "radial-gradient(ellipse at 50% 40%, #2E7A57 0%, #1F5A40 55%, #174632 100%)",
              border: "10px solid #3A2A22",
              boxShadow:
                "0 0 0 2px #0B0A10, inset 0 0 0 2px rgba(0,0,0,0.35), inset 0 18px 40px rgba(0,0,0,0.35), 0 24px 40px -18px rgba(0,0,0,0.9)",
            }}
          >
            <span
              className="absolute inset-[10%] rounded-[50%/46%]"
              style={{ border: "1.5px dashed rgba(255,255,255,0.14)" }}
              aria-hidden="true"
            />
          </div>

          {/* Trump plaque */}
          <div
            className="absolute flex items-center gap-1.5 rounded-xl px-2.5 py-1.5"
            style={{
              left: "30%",
              top: "21%",
              transform: "translate(-50%,-50%)",
              background: "rgba(7,6,11,0.55)",
              border: "1.5px solid rgba(255,255,255,0.15)",
            }}
          >
            <span className="text-[11px] font-bold" style={{ color: "#CBC5D8" }}>
              Trump
            </span>
            <span
              className="rounded-md px-1.5 font-extrabold text-[14px]"
              style={{ background: "#FFFFFF", color: isRed(state.trump) ? RED : BLACK }}
            >
              {SUIT_SYMBOL[state.trump]} {SUIT_NAME[state.trump]}
            </span>
          </div>

          {/* Played cards land in front of whoever played them */}
          {tableCards.map((t, k) => {
            const p = trickPoint(angleOf(t.seat), t.seat === mySeat ? 0.55 : 0.42);
            const winner = lastWinner === t.seat;
            return (
              <div
                key={t.card}
                className="absolute trick-in"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y + 8}%`,
                  transform: `translate(-50%,-50%) rotate(${((k * 37) % 17) - 8}deg)`,
                  zIndex: 5 + k,
                  ["--from-x" as string]: `${(p.x - 50) * 2}px`,
                  ["--from-y" as string]: `${(p.y - 47) * 3}px`,
                }}
              >
                <PlayingCard
                  card={t.card}
                  size="sm"
                  dim={lastWinner !== null && !winner}
                  style={
                    winner ? { boxShadow: "0 0 0 3px var(--lime), 3px 3px 0 #0B0A10" } : undefined
                  }
                />
              </div>
            );
          })}

          {tableCards.length === 0 && (
            <p
              className="absolute text-center text-[13px] font-semibold"
              style={{
                left: "50%",
                top: "56%",
                transform: "translate(-50%,-50%)",
                color: "rgba(255,255,255,0.7)",
                width: "60%",
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
        </div>

        {/* Status */}
        <div className="px-4 text-center min-h-[44px]" role="status">
          <p className="font-extrabold" style={{ fontSize: 16 }}>
            {status}
          </p>
          {note && <p className="text-xs text-faint mt-0.5">{note}</p>}
          {error && (
            <p className="mt-1 text-sm font-bold" style={{ color: "var(--hot)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Calling (bids) */}
        {state.phase === "bidding" && myTurn && (
          <div className="mx-3 mb-2 card p-3 animate-soft-in">
            <p className="text-center text-[13px] text-cool">
              {cards} card{cards > 1 ? "s" : ""} in hand · {myTrumps} trump
              {myTrumps === 1 ? "" : "s"}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
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
                      width: 48,
                      minWidth: 48,
                      minHeight: 48,
                      paddingInline: 0,
                      fontSize: 18,
                    }}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            {forbidden !== null && (
              <p className="mt-2 text-center text-xs text-cool">
                You're the dealer: you can't call {forbidden}, or the calls would add up to {cards}.
              </p>
            )}
          </div>
        )}

        {/* My hand */}
        <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-sm font-bold">
              You{" "}
              {myBid !== null && (
                <span className="font-semibold text-faint">
                  · won {state.won[mySeat]} of {myBid}
                </span>
              )}
            </span>
            {state.dealer === mySeat && (
              <span className="sticker sun" style={{ transform: "none" }}>
                dealer
              </span>
            )}
          </div>
          <div className="flex justify-center items-end pt-4 pb-1" style={{ minHeight: 112 }}>
            {hand.map((c, i) => {
              const canPlay = legal.includes(c);
              const mid = (hand.length - 1) / 2;
              const tilt = hand.length > 1 ? (i - mid) * (hand.length > 6 ? 4 : 6) : 0;
              const drop = Math.abs(i - mid) * (hand.length > 6 ? 2 : 3);
              return (
                <button
                  key={c}
                  disabled={!canPlay}
                  onClick={() => act({ type: "play", card: c })}
                  className="relative transition-transform"
                  style={{
                    marginLeft: i ? overlap : 0,
                    transform: `translateY(${canPlay ? drop - 16 : drop}px) rotate(${tilt}deg)`,
                    zIndex: i,
                  }}
                  aria-label={`Play ${rankLabel(rankOf(c))} of ${SUIT_NAME[suitOf(c)]}`}
                >
                  <PlayingCard
                    card={c}
                    size="lg"
                    lifted={canPlay}
                    dim={state.phase === "playing" && myTurn && !canPlay}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(state.phase === "roundEnd" || state.phase === "over") && (
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
    <Sheet title="How to play Kachuful" onClose={done}>
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
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(14,42,69,0.45)" }}
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
                  {ri + 1} · {state.plan[ri]}
                  {SUIT_SYMBOL[(["S", "D", "C", "H"] as const)[ri % 4]]}
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
    ? `${state.round}:${state.phase}:${state.turn}:${state.trick.length}:${state.bids.join()}`
    : "";
  useEffect(() => {
    if (!state || !drive) return;
    if (state.phase !== "bidding" && state.phase !== "playing") return;
    if (!state.seats[state.turn]?.bot) return;
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
  onClose,
}: {
  seats: Seat[];
  length: "short" | "full";
  scoring?: Scoring;
  onClose: () => void;
}) {
  const [state, setState] = useState(() => newGame(seats, length, undefined, scoring));
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
        onPlayAgain={() => setState(newGame(seats, length, undefined, scoring))}
      />
      {confirmLeave && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-6"
          style={{ background: "rgba(14,42,69,0.45)" }}
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
export function KachufulLobby({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (friends: Person[], bots: number, length: "short" | "full", scoring: Scoring) => void;
}) {
  const s = useSocial();
  const live = s.mode === "live";
  const people = live ? mutualFriends() : [];
  const [picked, setPicked] = useState<string[]>([]);
  const [players, setPlayers] = useState(4);
  const [length, setLength] = useState<"short" | "full">("short");
  const [scoring, setScoring] = useState<Scoring>("classic");
  const [howTo, setHowTo] = useState(false);
  const friends = people.filter((p) => picked.includes(p.id));
  const total = Math.max(players, friends.length + 1);
  const bots = total - 1 - friends.length;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 6 ? p : [...p, id]));

  return (
    <Sheet title="kachuful · judgement" onClose={onClose}>
      <p className="text-sm text-cool" style={{ lineHeight: 1.5 }}>
        Call how many tricks you'll win, then win exactly that many. Trump changes every round. The
        dealer can't make the bids add up.
      </p>

      {live ? (
        <>
          <p className="label-caps mt-5 mb-2">invite from your 25</p>
          {people.length === 0 ? (
            <p className="text-sm text-faint">
              Add people to your 25 to play with them. Bots can fill in for now.
            </p>
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
                      style={{ background: on ? "var(--blue)" : "transparent" }}
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
        </>
      ) : (
        <p className="mt-5 text-sm text-faint">
          Demo mode: you'll play against bots. Sign in to play with your 25.
        </p>
      )}

      <p className="label-caps mt-5 mb-2">players at the table</p>
      <div className="flex gap-2">
        {[2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            disabled={n < friends.length + 1}
            onClick={() => setPlayers(n)}
            className="flex-1 h-11 rounded-2xl font-bold tabular-nums disabled:opacity-30"
            style={{
              background: total === n ? "var(--blue-deep)" : "var(--bg-surface)",
              color: total === n ? "var(--on-accent)" : "var(--text-primary)",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-cool">
        You{friends.length ? ` + ${friends.map((f) => f.name.split(" ")[0]).join(", ")}` : ""}
        {bots > 0 ? ` + ${bots} bot${bots > 1 ? "s" : ""}` : ""}
      </p>

      <p className="label-caps mt-5 mb-2">length</p>
      <div className="flex gap-2">
        {(["short", "full"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLength(l)}
            className="flex-1 rounded-2xl py-3 text-left px-4"
            style={{
              background: length === l ? "var(--blue-deep)" : "var(--bg-surface)",
              color: length === l ? "var(--on-accent)" : "var(--text-primary)",
            }}
          >
            <span className="block font-bold">{l === "short" ? "Short" : "Full"}</span>
            <span className="block text-xs opacity-80">
              {l === "short" ? "1 → 5 → 1 cards" : "1 → 8 → 1 cards"}
            </span>
          </button>
        ))}
      </div>

      <p className="label-caps mt-5 mb-2">scoring</p>
      <div className="flex gap-2">
        {(["classic", "x10"] as const).map((sc) => (
          <button
            key={sc}
            onClick={() => setScoring(sc)}
            className="flex-1 rounded-2xl py-3 text-left px-4"
            style={{
              background: scoring === sc ? "var(--blue-deep)" : "var(--bg-surface)",
              color: scoring === sc ? "var(--on-accent)" : "var(--text-primary)",
            }}
          >
            <span className="block font-bold">{sc === "classic" ? "Classic" : "×10"}</span>
            <span className="block text-xs opacity-80">
              {sc === "classic" ? "Make it: 10 + call" : "Make it: 10 × call"}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setHowTo(true)}
        className="mt-5 w-full text-sm font-bold text-bronze py-2"
      >
        New to Kachuful? See how to play
      </button>
      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}

      <button
        onClick={() => onStart(friends, bots, length, scoring)}
        className="mt-3 w-full btn-primary"
      >
        {friends.length
          ? `Deal in ${friends.length} friend${friends.length > 1 ? "s" : ""}`
          : "Deal me in"}
      </button>
    </Sheet>
  );
}

export { botSeats };
