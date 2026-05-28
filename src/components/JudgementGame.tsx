import { useMemo, useState } from "react";
import { X, Minus, Plus, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, ME } from "@/lib/data";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { suit: Suit; rank: string; value: number };

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function makeDeck(): Card[] {
  const d: Card[] = [];
  SUITS.forEach((s) => RANKS.forEach((r, i) => d.push({ suit: s, rank: r, value: i + 2 })));
  return d.sort(() => Math.random() - 0.5);
}

function sortHand(cards: Card[]) {
  const order: Record<Suit, number> = { "♠": 0, "♥": 1, "♣": 2, "♦": 3 };
  return [...cards].sort((a, b) => order[a.suit] - order[b.suit] || a.value - b.value);
}

function PlayingCard({ card, small, faceDown }: { card?: Card; small?: boolean; faceDown?: boolean }) {
  const w = small ? 38 : 50;
  const h = small ? 54 : 72;
  if (faceDown || !card) {
    return (
      <div
        className="rounded-md border border-white/10"
        style={{
          width: w, height: h,
          background: "linear-gradient(135deg,#534AB7,#22222A)",
        }}
      />
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      className="rounded-md bg-white flex flex-col justify-between p-1 shadow-md select-none"
      style={{ width: w, height: h, color: red ? "#D4537E" : "#0D0D0F" }}
    >
      <div className="flex flex-col items-start leading-none">
        <span className="text-[11px] font-bold">{card.rank}</span>
        <span className="text-[11px]">{card.suit}</span>
      </div>
      <div className="text-right text-base leading-none">{card.suit}</div>
    </div>
  );
}

function Seat({
  player,
  position,
  bid,
  score,
  active,
  trick,
}: {
  player: { name: string; avatar: string };
  position: "top" | "left" | "right" | "bottom";
  bid?: number;
  score?: number;
  active?: boolean;
  trick?: Card;
}) {
  const posClasses = {
    top:    "top-4 left-1/2 -translate-x-1/2 flex-col items-center",
    bottom: "bottom-44 left-1/2 -translate-x-1/2 flex-col items-center",
    left:   "left-3 top-1/2 -translate-y-1/2 flex-col items-center",
    right:  "right-3 top-1/2 -translate-y-1/2 flex-col items-center",
  }[position];

  return (
    <div className={`absolute flex ${posClasses}`}>
      <div className={active ? "animate-turn-pulse" : ""}>
        <Avatar src={player.avatar} initials={player.name.slice(0,2)} size={48} />
      </div>
      <span className="mt-1 text-[11px] font-semibold">{player.name}</span>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>Bid <span className="text-foreground font-semibold">{bid ?? "—"}</span></span>
        <span>·</span>
        <span>Won <span className="text-foreground font-semibold">{score ?? 0}</span></span>
      </div>
      {trick && (
        <div className="mt-2">
          <PlayingCard card={trick} small />
        </div>
      )}
    </div>
  );
}

export function JudgementGame({ onClose }: { onClose: () => void }) {
  type Phase = "lobby" | "bidding" | "playing" | "results";
  const [phase, setPhase] = useState<Phase>("lobby");
  const [bid, setBid] = useState(3);
  const [bids, setBids] = useState<Record<string, number>>({});
  const [won, setWon] = useState<Record<string, number>>({ me: 0, p1: 0, p2: 0, p3: 0 });
  const [trick, setTrick] = useState<Record<string, Card | undefined>>({});
  const [scoreOpen, setScoreOpen] = useState(false);

  const players = useMemo(
    () => [FRIENDS[1], FRIENDS[3], FRIENDS[8]], // Priya, Neha, Ananya
    []
  );

  const deck = useMemo(() => makeDeck(), []);
  const [hand, setHand] = useState<Card[]>(sortHand(deck.slice(0, 13)));

  function startGame() {
    setPhase("bidding");
  }

  function confirmBid() {
    setBids({
      me: bid,
      p1: 3 + Math.floor(Math.random() * 3),
      p2: 2 + Math.floor(Math.random() * 3),
      p3: 3 + Math.floor(Math.random() * 3),
    });
    setPhase("playing");
  }

  function playCard(c: Card) {
    setHand((h) => h.filter((x) => x !== c));
    const others: Record<string, Card> = {
      p1: deck[20 + (13 - hand.length)],
      p2: deck[33 + (13 - hand.length)],
      p3: deck[46 + (13 - hand.length) % 6],
    };
    setTrick({ me: c, ...others });
    setTimeout(() => {
      // crude trick winner: highest spade else highest of c.suit
      const all = [
        { k: "me", card: c },
        { k: "p1", card: others.p1 },
        { k: "p2", card: others.p2 },
        { k: "p3", card: others.p3 },
      ];
      const trumps = all.filter((x) => x.card?.suit === "♠");
      const pool = trumps.length ? trumps : all.filter((x) => x.card?.suit === c.suit);
      const winner = pool.reduce((a, b) => (a.card.value > b.card.value ? a : b));
      setWon((w) => ({ ...w, [winner.k]: (w[winner.k] || 0) + 1 }));
      setTrick({});
      if (hand.length - 1 === 0) setTimeout(() => setPhase("results"), 600);
    }, 1100);
  }

  const meScore = (won.me >= (bids.me ?? 0))
    ? (bids.me ?? 0) * 10 + (won.me - (bids.me ?? 0))
    : -((bids.me ?? 0) * 10);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-soft-in">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">🇮🇳 Judgement</span>
          <h2 className="text-lg font-bold">Call Break · Round 3 of 5</h2>
        </div>
        <button onClick={onClose} className="text-muted-foreground"><X size={22} /></button>
      </header>

      {phase === "lobby" && (
        <div className="flex-1 flex flex-col px-5">
          <div className="card-premium accent-thought p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Active game</div>
            <div className="mt-1 text-sm font-semibold">Judgement · Round 3</div>
            <div className="mt-3 flex -space-x-2">
              {[FRIENDS[0], ...players].map((f) => (
                <div key={f.id} className="ring-2 ring-background rounded-full">
                  <Avatar src={f.avatar} initials={f.initials} size={32} />
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground">Invite from your 25</p>
          <div className="mt-2 flex-1 overflow-y-auto pr-1 space-y-2">
            {FRIENDS.slice(0, 8).map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                <Avatar src={f.avatar} initials={f.initials} size={40} />
                <div className="flex-1 text-sm font-semibold">{f.name}</div>
                <button className="text-xs font-semibold text-primary border border-primary/40 px-3 py-1.5 rounded-full">
                  Invite
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl bg-surface-2/60 border border-border p-3 flex items-center gap-3">
            {[ME, ...players].map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                {"avatar" in p ? (
                  <Avatar src={p.avatar} initials={p.initials || "ME"} size={36} />
                ) : (
                  <div className="h-9 w-9 rounded-full border border-dashed border-primary/40" />
                )}
                <span className="text-[10px] text-muted-foreground">{i === 0 ? "You" : (p as { name: string }).name}</span>
              </div>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground">All seats filled</span>
          </div>

          <button
            onClick={startGame}
            className="mt-3 mb-6 w-full rounded-full fab-gradient text-white py-4 font-bold"
          >
            Create Game
          </button>
        </div>
      )}

      {phase !== "lobby" && (
        <div
          className="relative flex-1"
          style={{
            background: "radial-gradient(ellipse at center, #1a3320, #0d1a0f)",
          }}
        >
          {/* Score panel */}
          <div className="absolute top-2 left-2 right-2 z-10">
            <button
              onClick={() => setScoreOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-xl bg-black/40 backdrop-blur-md border border-white/10 px-3 py-2 text-xs"
            >
              <span className="font-semibold">Scores</span>
              <ChevronDown size={14} className={`transition ${scoreOpen ? "rotate-180" : ""}`} />
            </button>
            {scoreOpen && (
              <div className="mt-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 p-3 text-xs space-y-1">
                {["R1","R2","R3"].map((r, i) => (
                  <div key={r} className="grid grid-cols-5 gap-2 text-muted-foreground">
                    <span>{r}</span>
                    <span>You {[28,-30,meScore][i] ?? 0}</span>
                    <span>Priya {[40,20,30][i]}</span>
                    <span>Neha {[-20,30,10][i]}</span>
                    <span>Ananya {[10,40,20][i]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Seat position="top"   player={players[1]} bid={bids.p2} score={won.p2} active={false} trick={trick.p2} />
          <Seat position="left"  player={players[0]} bid={bids.p1} score={won.p1} active={false} trick={trick.p1} />
          <Seat position="right" player={players[2]} bid={bids.p3} score={won.p3} active={false} trick={trick.p3} />
          <Seat position="bottom" player={{ name: "You", avatar: ME.avatar }} bid={bids.me} score={won.me} active={phase === "playing"} trick={trick.me} />

          {/* Bidding modal */}
          {phase === "bidding" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
              <div className="card-premium p-6 w-[88%] max-w-sm text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Spades are trump</p>
                <h3 className="mt-2 text-xl font-bold">How many tricks will you win?</h3>
                <div className="mt-6 flex items-center justify-center gap-5">
                  <button
                    onClick={() => setBid((b) => Math.max(0, b - 1))}
                    className="h-11 w-11 rounded-full bg-surface-2 border border-border flex items-center justify-center"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="text-5xl font-black text-primary tabular-nums w-16">{bid}</span>
                  <button
                    onClick={() => setBid((b) => Math.min(13, b + 1))}
                    className="h-11 w-11 rounded-full bg-surface-2 border border-border flex items-center justify-center"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <button
                  onClick={confirmBid}
                  className="mt-7 w-full fab-gradient text-white rounded-full py-3.5 font-bold"
                >
                  Lock in bid
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {phase === "results" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 px-6">
              <div className="text-5xl mb-3">👑</div>
              <Avatar src={players[0].avatar} initials="PR" size={92} ring="active" />
              <p className="mt-4 text-2xl font-bold">Priya wins</p>
              <p className="text-xs text-muted-foreground">Final · 5 rounds</p>
              <div className="mt-6 w-full max-w-sm space-y-2">
                {[
                  { n: "Priya",  s: 92 },
                  { n: "You",    s: meScore + 38 },
                  { n: "Ananya", s: 68 },
                  { n: "Neha",   s: 12 },
                ].map((r, i) => (
                  <div key={r.n} className="flex justify-between rounded-xl bg-card border border-border px-4 py-2.5 text-sm">
                    <span className="font-semibold">{i + 1}. {r.n}</span>
                    <span className="tabular-nums">{r.s}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 w-full max-w-sm flex gap-2">
                <button className="flex-1 rounded-full bg-surface-2 border border-border py-3 font-semibold text-sm">
                  Save to history
                </button>
                <button onClick={onClose} className="flex-1 rounded-full fab-gradient text-white py-3 font-bold text-sm">
                  Rematch
                </button>
              </div>
            </div>
          )}

          {/* Hand */}
          {phase === "playing" && (
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-[-10px] overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex" style={{ gap: "-14px" }}>
                {hand.map((c, i) => (
                  <button
                    key={`${c.suit}${c.rank}`}
                    onClick={() => playCard(c)}
                    style={{ marginLeft: i === 0 ? 0 : -14, transform: `translateY(${i % 2 ? -2 : 0}px)` }}
                    className="hover:-translate-y-2 active:translate-y-0 transition-transform"
                  >
                    <PlayingCard card={c} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
