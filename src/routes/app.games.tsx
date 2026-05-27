import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GAMES, ACTIVE_GAMES, FRIENDS, type Game } from "@/lib/data";

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

      <div className="px-6 mt-6">
        <div className="rounded-3xl bg-gradient-to-br from-primary/25 via-surface to-surface p-7 border border-primary/30 shadow-[0_30px_80px_-30px_var(--primary)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80 font-semibold">Question</p>
          <h2 className="mt-3 text-2xl font-bold leading-snug">{MOST_LIKELY_Q}</h2>
        </div>
      </div>

      {!voted ? (
        <>
          <p className="text-center text-xs text-muted-foreground mt-8">Tap who you'd vote for</p>
          <div className="px-5 mt-5 grid grid-cols-4 gap-3 overflow-y-auto">
            {pool.map((f) => (
              <button
                key={f.id}
                onClick={() => setVoted(f.id)}
                className="flex flex-col items-center gap-1.5"
              >
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
          <ul className="mt-8 space-y-3">
            {[{f: winner, pct: 48}, {f: FRIENDS[1], pct: 22}, {f: FRIENDS[8], pct: 18}].map(({f, pct}, i) => (
              <li key={f.id} className="flex items-center gap-3">
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={38} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold">{f.name}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: i === 0 ? "linear-gradient(90deg, var(--primary), var(--primary-glow))" : "var(--border)",
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={onClose}
            className="mt-auto mb-8 w-full rounded-full bg-primary text-primary-foreground py-4 font-semibold hover:bg-primary-glow transition"
          >
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
        <button className="mt-10 rounded-full bg-primary text-primary-foreground px-10 py-4 font-semibold hover:bg-primary-glow transition shadow-[0_15px_40px_-10px_var(--primary)]">
          Start playing
        </button>
      </div>
    </div>
  );
}

function Games() {
  const [active, setActive] = useState<Game | null>(null);

  return (
    <>
      <header className="px-5 pt-6 pb-2">
        <h1 className="font-display text-3xl font-black">Play</h1>
        <p className="text-sm text-muted-foreground mt-1">Games with your 25.</p>
      </header>

      {/* Active games */}
      <section className="mt-4">
        <div className="px-5 flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Active</h2>
          <span className="text-[10px] text-muted-foreground">{ACTIVE_GAMES.length} in play</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ACTIVE_GAMES.map((ag) => {
            const players = ag.players.map((id) => FRIENDS.find((f) => f.id === id)!).filter(Boolean);
            return (
              <button
                key={ag.id}
                className="shrink-0 w-56 rounded-2xl bg-gradient-to-br from-primary/20 via-surface to-surface border border-primary/25 p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{ag.title}</span>
                  <ChevronRight size={16} className="text-primary" />
                </div>
                <div className="mt-3 flex -space-x-2">
                  {players.slice(0, 4).map((f) => (
                    <div key={f.id} className="ring-2 ring-surface rounded-full">
                      <Avatar src={f.avatar} initials={f.initials} color={f.color} size={30} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-background/60 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${ag.progress * 100}%`,
                      background: "linear-gradient(90deg, var(--primary), var(--primary-glow))",
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Your turn</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Game grid */}
      <section className="px-4 mt-5 grid grid-cols-2 gap-3">
        {GAMES.map((g) => {
          const isFree = g.price === "Free";
          return (
            <article
              key={g.id}
              className="rounded-2xl bg-card border border-border p-4 flex flex-col"
            >
              <div className="flex items-start justify-between">
                <div className="text-3xl">{g.emoji}</div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: isFree
                      ? "color-mix(in oklab, var(--drift-active) 20%, transparent)"
                      : "color-mix(in oklab, var(--primary) 25%, transparent)",
                    color: isFree ? "var(--drift-active)" : "var(--primary-glow)",
                  }}
                >
                  {g.price}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold leading-tight">{g.name}</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">{g.players}</p>
              <p className="mt-2 text-[11px] text-foreground/70 leading-snug flex-1">{g.description}</p>
              <button
                onClick={() => isFree && setActive(g)}
                className="mt-3 rounded-full bg-primary/15 text-primary text-xs font-semibold py-2 hover:bg-primary hover:text-primary-foreground transition"
              >
                {isFree ? "Play" : "Unlock"}
              </button>
            </article>
          );
        })}
      </section>

      <p className="text-center text-xs text-muted-foreground/70 px-6 py-8">
        Small things. Played slowly. With the same 25.
      </p>

      {active && active.id === "most-likely" && <MostLikelyGame onClose={() => setActive(null)} />}
      {active && active.id !== "most-likely" && <GenericGameScreen game={active} onClose={() => setActive(null)} />}
    </>
  );
}
