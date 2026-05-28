import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { X, ChevronRight, Bell } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  FRIENDSHIP_GAMES, ACTIVE_GAMES, FRIENDS, TRIVIA_PACKS,
  type Game, type TriviaPack,
} from "@/lib/data";
import { JudgementGame } from "@/components/JudgementGame";
import { TriviaGame } from "@/components/TriviaGame";

export const Route = createFileRoute("/app/games")({
  component: Games,
});

const MOST_LIKELY_Q = "Most likely to drop everything and travel tomorrow";

function MostLikelyGame({ onClose }: { onClose: () => void }) {
  const [voted, setVoted] = useState<string | null>(null);
  const winner = FRIENDS[3];
  const pool = FRIENDS.slice(0, 12);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-soft-in">
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">🎯 Most Likely To</span>
        <button onClick={onClose} className="text-muted-foreground"><X size={22} /></button>
      </header>
      <div className="px-6 mt-2">
        <div className="card-premium accent-thought p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80 font-semibold">Question</p>
          <h2 className="mt-3 text-2xl font-bold leading-snug">{MOST_LIKELY_Q}</h2>
        </div>
      </div>
      {!voted ? (
        <>
          <p className="text-center text-xs text-muted-foreground mt-8">Tap who you'd vote for</p>
          <div className="px-5 mt-5 grid grid-cols-4 gap-3 overflow-y-auto">
            {pool.map((f) => (
              <button key={f.id} onClick={() => setVoted(f.id)} className="flex flex-col items-center gap-1.5">
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={62} />
                <span className="text-[11px] truncate w-full text-center">{f.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="px-6 mt-10 flex-1 flex flex-col">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">Results</p>
          <div className="mt-6 flex flex-col items-center">
            <Avatar src={winner.avatar} initials={winner.initials} color={winner.color} size={96} ring="active" />
            <p className="mt-4 text-xl font-bold">{winner.name}</p>
            <p className="text-xs text-muted-foreground">48% of your 25 agreed</p>
          </div>
          <button onClick={onClose} className="mt-auto mb-8 w-full rounded-full fab-gradient text-white py-4 font-semibold">
            Next question
          </button>
        </div>
      )}
    </div>
  );
}

function GenericGameScreen({ game, onClose }: { game: Game; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-soft-in p-6">
      <header className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{game.emoji} {game.name}</span>
        <button onClick={onClose} className="text-muted-foreground"><X size={22} /></button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-7xl mb-6">{game.emoji}</div>
        <h2 className="text-2xl font-bold">{game.name}</h2>
        <p className="mt-3 text-muted-foreground text-sm max-w-xs">{game.description}</p>
        <button className="mt-10 rounded-full fab-gradient text-white px-10 py-4 font-semibold">
          Start playing
        </button>
      </div>
    </div>
  );
}

const FRIENDSHIP_GRADIENTS: Record<string, string> = {
  "know-me":     "linear-gradient(135deg,#3b1d6e,#7F77DD)",
  "most-likely": "linear-gradient(135deg,#0e4a73,#5BCFC1)",
  "truth-jar":   "linear-gradient(135deg,#7a1c3a,#D4537E)",
  "rapid-fire":  "linear-gradient(135deg,#7c4d05,#E4B86C)",
};

function Games() {
  const [active, setActive] = useState<Game | null>(null);
  const [judgement, setJudgement] = useState(false);
  const [trivia, setTrivia] = useState<TriviaPack | null>(null);

  return (
    <>
      <header className="px-5 pt-7 pb-2 relative z-10">
        <h1 className="font-display text-4xl font-black tracking-tight">Play</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Games with your 25 — no strangers, ever.</p>
      </header>

      {/* Active games */}
      <section className="mt-5">
        <div className="px-5 flex items-center justify-between mb-2">
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Active</h2>
          <span className="text-[10px] text-muted-foreground">{ACTIVE_GAMES.length} in play</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ACTIVE_GAMES.map((ag) => {
            const players = ag.players.map((id) => FRIENDS.find((f) => f.id === id)!).filter(Boolean);
            const yourTurn = ag.status === "Your turn";
            return (
              <button
                key={ag.id}
                onClick={() => ag.gameId === "judgement" && setJudgement(true)}
                className="shrink-0 w-60 card-premium p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{ag.title}</span>
                  <ChevronRight size={16} className="text-primary" />
                </div>
                <div className="mt-3 flex -space-x-2">
                  {players.slice(0, 4).map((f) => (
                    <div key={f.id} className="ring-2 ring-background rounded-full">
                      <Avatar src={f.avatar} initials={f.initials} color={f.color} size={30} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-background/60 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${ag.progress * 100}%`,
                      background: "linear-gradient(90deg, #7F77DD, #A39CFF)",
                    }}
                  />
                </div>
                <p
                  className="mt-2 text-[10px] font-semibold"
                  style={{ color: yourTurn ? "#E4B86C" : "var(--muted-foreground)" }}
                >
                  {ag.status}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* India Games — feature row */}
      <section className="px-5 mt-7">
        <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">India Games</h2>
        <div className="grid grid-cols-1 gap-3">
          {/* Judgement card */}
          <button
            onClick={() => setJudgement(true)}
            className="card-premium accent-thought p-5 text-left relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#1a3320 0%, #22222A 60%, #1A1A1F 100%)" }}
          >
            <span
              className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(186,117,23,0.18)", color: "#E4B86C", border: "1px solid rgba(186,117,23,0.4)" }}
            >
              🇮🇳 Most played in India
            </span>
            <div className="text-4xl">🃏</div>
            <h3 className="mt-3 text-lg font-bold">Judgement</h3>
            <p className="text-xs text-muted-foreground">Call Break · 4 players · 5 rounds</p>
            <p className="mt-2 text-[12px] text-foreground/70 leading-snug">
              Bid your tricks. Spades are trump. Five rounds to glory.
            </p>
            <div className="mt-3 inline-block text-xs font-semibold text-primary">Open lobby →</div>
          </button>

          {/* Trivia row */}
          <div>
            <div className="flex items-center justify-between mt-2 mb-2">
              <h3 className="text-sm font-bold">Trivia packs</h3>
              <span className="text-[10px] text-muted-foreground">{TRIVIA_PACKS.length} packs</span>
            </div>
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TRIVIA_PACKS.map((p) => {
                const isFree = p.price === "Free";
                return (
                  <button
                    key={p.id}
                    onClick={() => isFree && setTrivia(p)}
                    className="shrink-0 w-44 rounded-2xl border border-white/10 overflow-hidden text-left"
                    style={{ background: p.gradient }}
                  >
                    <div className="p-4 h-32 flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <span className="text-3xl">{p.emoji}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: isFree ? "rgba(29,158,117,0.25)" : "rgba(255,255,255,0.18)",
                            color: isFree ? "#9BE49E" : "#fff",
                          }}
                        >
                          {p.price}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{p.name}</div>
                        <div className="text-[11px] text-white/75">{p.questions} questions</div>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 bg-black/40 backdrop-blur-md border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] text-white/85 truncate pr-2">{p.tagline}</span>
                      <span className="flex gap-0.5">
                        {[1,2,3].map((d) => (
                          <span key={d} className="h-1 w-1 rounded-full" style={{ background: d <= p.difficulty ? "#fff" : "rgba(255,255,255,0.25)" }} />
                        ))}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Friendship Games */}
      <section className="px-5 mt-7">
        <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Friendship Games</h2>
        <div className="grid grid-cols-2 gap-3">
          {FRIENDSHIP_GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => setActive(g)}
              className="rounded-2xl border border-white/10 p-4 flex flex-col items-start text-left active:scale-[0.98] transition"
              style={{ background: FRIENDSHIP_GRADIENTS[g.id] ?? "linear-gradient(135deg,#22222A,#1A1A1F)" }}
            >
              <div className="text-[34px] leading-none">{g.emoji}</div>
              <h3 className="mt-3 text-sm font-bold text-white">{g.name}</h3>
              <p className="text-[11px] text-white/70 mt-0.5">{g.players}</p>
              <span className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white">
                {g.price}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Coming soon */}
      <section className="px-5 mt-7">
        <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Coming soon</h2>
        <div className="grid grid-cols-2 gap-3">
          {[{ emoji: "♟️", name: "Chess" }, { emoji: "🎳", name: "Bowling" }].map((g) => (
            <div key={g.name} className="rounded-2xl border border-dashed border-border p-4 flex flex-col items-start text-left opacity-70">
              <div className="text-[30px] leading-none">{g.emoji}</div>
              <h3 className="mt-3 text-sm font-bold">{g.name}</h3>
              <button className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary font-semibold">
                <Bell size={11} /> Notify me
              </button>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground/70 px-6 py-8">
        Small things. Played slowly. With the same 25.
      </p>

      {active && active.id === "most-likely" && <MostLikelyGame onClose={() => setActive(null)} />}
      {active && active.id !== "most-likely" && <GenericGameScreen game={active} onClose={() => setActive(null)} />}
      {judgement && <JudgementGame onClose={() => setJudgement(false)} />}
      {trivia && <TriviaGame pack={trivia} onClose={() => setTrivia(null)} />}
    </>
  );
}
