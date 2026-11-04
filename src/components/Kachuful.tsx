import { useEffect, useMemo, useRef, useState } from "react";
import { ListOrdered, X } from "lucide-react";
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
} from "@/lib/kachuful";
import { botSeats } from "@/lib/games";
import { seatedFriends, useSocial, type Person } from "@/lib/social";

// ---------- Cards ----------
function PlayingCard({
  card,
  size = "md",
  dim = false,
}: {
  card: Card;
  size?: "sm" | "md";
  dim?: boolean;
}) {
  const s = suitOf(card);
  const w = size === "sm" ? 44 : 58;
  return (
    <span
      className="inline-flex flex-col items-center justify-center rounded-xl select-none"
      style={{
        width: w,
        height: w * 1.4,
        background: "#fff",
        border: "1px solid var(--border-cool)",
        boxShadow: "0 6px 16px -8px rgba(14,42,69,0.45)",
        color: isRed(s) ? "var(--coral-deep)" : "var(--ink)",
        opacity: dim ? 0.45 : 1,
        fontWeight: 800,
        lineHeight: 1,
      }}
      aria-label={`${rankLabel(rankOf(card))} of ${SUIT_NAME[s]}`}
    >
      <span style={{ fontSize: size === "sm" ? 15 : 19 }}>{rankLabel(rankOf(card))}</span>
      <span style={{ fontSize: size === "sm" ? 17 : 22, marginTop: 2 }}>{SUIT_SYMBOL[s]}</span>
    </span>
  );
}

function SeatChip({ seat, state, index }: { seat: Seat; state: KState; index: number }) {
  const turn = state.turn === index && (state.phase === "bidding" || state.phase === "playing");
  const bid = state.bids[index];
  return (
    <div className="flex flex-col items-center shrink-0" style={{ width: 64 }}>
      <div
        className={`relative rounded-full ${turn ? "animate-ember-pulse" : ""}`}
        style={{ boxShadow: turn ? "0 0 0 3px var(--blue)" : "none" }}
      >
        <Avatar src={seat.avatar} initials={seat.initials} color={seat.color} size={44} />
        {state.dealer === index && (
          <span
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "var(--navy)", color: "#fff" }}
            title="Dealer"
          >
            D
          </span>
        )}
      </div>
      <span className="mt-1 text-[11px] font-semibold truncate w-full text-center text-cream">
        {seat.name.split(" ")[0]}
        {seat.bot && <span className="text-faint font-normal"> · bot</span>}
      </span>
      <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
        {bid === null ? "–" : `${state.won[index]}/${bid}`}
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
  const [error, setError] = useState<string | null>(null);
  const [showLast, setShowLast] = useState(false);
  const lastKey = state.lastTrick
    ? state.lastTrick.cards.map((c) => c.card).join() + state.round
    : "";

  // Hold the finished trick on the table for a moment so everyone sees who took it.
  useEffect(() => {
    if (!lastKey) return;
    setShowLast(true);
    const t = setTimeout(() => setShowLast(false), 1500);
    return () => clearTimeout(t);
  }, [lastKey]);

  const n = state.seats.length;
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + 1 + i) % n);
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
    showLast && !state.trick.length && state.lastTrick ? state.seats[state.lastTrick.winner] : null;
  const turnName = state.seats[state.turn]?.name.split(" ")[0];
  const forbidden = myTurn && state.phase === "bidding" ? forbiddenBid(state) : null;
  const total = totals(state);

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
    status = myTurn
      ? `How many tricks will you win? (${cards} in hand)`
      : `${turnName} is bidding…`;
  else if (state.phase === "playing") {
    if (lastWinner)
      status = `${lastWinner.id === state.seats[mySeat].id ? "You" : lastWinner.name.split(" ")[0]} took the trick`;
    else if (myTurn) {
      const need = (myBid ?? 0) - state.won[mySeat];
      status =
        need > 0
          ? `Your turn · you need ${need} more`
          : need === 0
            ? "Your turn · don't win any more"
            : "Your turn · you're over your bid";
    } else status = `${turnName} is playing…`;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <div className="mx-auto w-full max-w-md flex flex-col h-full">
        {/* Header */}
        <header
          className="band px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4"
          style={{ borderRadius: "0 0 24px 24px" }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              aria-label="Leave the table"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/20"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <p className="label-caps">
                kachuful · round {state.round + 1} of {state.plan.length}
              </p>
              <p className="font-semibold mt-0.5" style={{ fontSize: 15 }}>
                {cards} card{cards > 1 ? "s" : ""} · Trump{" "}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-white"
                  style={{ color: isRed(state.trump) ? "var(--coral-deep)" : "var(--ink)" }}
                >
                  {SUIT_SYMBOL[state.trump]} {SUIT_NAME[state.trump]}
                </span>
              </p>
            </div>
            <button
              onClick={() => setScoresOpen(true)}
              aria-label="Scores"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/20"
            >
              <ListOrdered size={18} />
            </button>
          </div>
        </header>

        {/* Other players */}
        <div className="flex justify-center gap-1 px-2 pt-4 overflow-x-auto">
          {others.map((i) => (
            <SeatChip key={state.seats[i].id} seat={state.seats[i]} state={state} index={i} />
          ))}
        </div>

        {/* Trick */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="table-felt rounded-[40px] w-full max-w-[340px] min-h-[170px] flex flex-wrap items-center justify-center gap-2 p-5">
            {tableCards.length === 0 && (
              <p className="text-sm text-faint text-center">
                {state.phase === "bidding" ? "Bids first, then play." : "Lead any card."}
              </p>
            )}
            {tableCards.map((t) => (
              <div key={t.card} className="flex flex-col items-center gap-1 animate-soft-in">
                <PlayingCard
                  card={t.card}
                  size="sm"
                  dim={!!lastWinner && t.seat !== state.lastTrick?.winner}
                />
                <span className="text-[10px] font-semibold text-cool">
                  {t.seat === mySeat ? "You" : state.seats[t.seat].name.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
          <p
            className="mt-4 text-center font-semibold text-cream min-h-[22px]"
            style={{ fontSize: 15 }}
            role="status"
          >
            {status}
          </p>
          {note && <p className="mt-1 text-center text-xs text-faint">{note}</p>}
          {error && (
            <p
              className="mt-2 text-center text-sm font-semibold"
              style={{ color: "var(--coral-deep)" }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Bidding */}
        {state.phase === "bidding" && myTurn && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: cards + 1 }, (_, b) => {
                const ok = bidOptions(state).includes(b);
                return (
                  <button
                    key={b}
                    disabled={!ok}
                    onClick={() => act({ type: "bid", bid: b })}
                    className="w-12 h-12 rounded-2xl font-bold text-lg tabular-nums disabled:opacity-35"
                    style={{
                      background: ok ? "var(--blue-deep)" : "var(--bg-surface)",
                      color: ok ? "#fff" : "var(--text-muted)",
                      boxShadow: ok ? "var(--shadow-pop)" : "none",
                    }}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            {forbidden !== null && (
              <p className="mt-2 text-center text-xs text-cool">
                You're the dealer, so you can't bid {forbidden}. The bids can't add up to {cards}.
              </p>
            )}
          </div>
        )}

        {/* My hand */}
        <div
          className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          style={{ background: "linear-gradient(to top, var(--sky-100), transparent)" }}
        >
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-sm font-semibold text-cream">
              You{" "}
              {myBid !== null && (
                <span className="text-faint font-normal">
                  · won {state.won[mySeat]} of {myBid}
                </span>
              )}
            </span>
            <span className="text-sm tabular-nums text-cool">{total[mySeat]} pts</span>
          </div>
          <div className="flex justify-center flex-wrap gap-1.5">
            {state.hands[mySeat]?.map((c) => {
              const canPlay = legal.includes(c);
              return (
                <button
                  key={c}
                  disabled={!canPlay}
                  onClick={() => act({ type: "play", card: c })}
                  className="transition-transform"
                  style={{ transform: canPlay ? "translateY(-8px)" : "none" }}
                  aria-label={`Play ${rankLabel(rankOf(c))} of ${SUIT_NAME[suitOf(c)]}`}
                >
                  <PlayingCard card={c} dim={state.phase === "playing" && myTurn && !canPlay} />
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
    </div>
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
      <p className="mt-4 text-xs text-cool">
        Win exactly what you bid for 10 + your bid. Miss by any amount and you get 0.
      </p>
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
  onClose,
}: {
  seats: Seat[];
  length: "short" | "full";
  onClose: () => void;
}) {
  const [state, setState] = useState(() => newGame(seats, length));
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
        onPlayAgain={() => setState(newGame(seats, length))}
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
  onStart: (friends: Person[], bots: number, length: "short" | "full") => void;
}) {
  const s = useSocial();
  const live = s.mode === "live";
  const people = live ? seatedFriends() : [];
  const [picked, setPicked] = useState<string[]>([]);
  const [players, setPlayers] = useState(4);
  const [length, setLength] = useState<"short" | "full">("short");
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
        {[3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            disabled={n < friends.length + 1}
            onClick={() => setPlayers(n)}
            className="flex-1 h-11 rounded-2xl font-bold tabular-nums disabled:opacity-30"
            style={{
              background: total === n ? "var(--blue-deep)" : "var(--bg-surface)",
              color: total === n ? "#fff" : "var(--text-primary)",
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
              color: length === l ? "#fff" : "var(--text-primary)",
            }}
          >
            <span className="block font-bold">{l === "short" ? "Short" : "Full"}</span>
            <span className="block text-xs opacity-80">
              {l === "short" ? "1 → 5 → 1 cards" : "1 → 8 → 1 cards"}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onStart(friends, bots, length)}
        className="mt-6 w-full rounded-full py-3.5 btn-bronze"
      >
        {friends.length
          ? `Deal in ${friends.length} friend${friends.length > 1 ? "s" : ""}`
          : "Deal me in"}
      </button>
    </Sheet>
  );
}

export { botSeats };
