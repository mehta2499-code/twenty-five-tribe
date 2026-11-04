import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PageBand } from "@/components/SocialUI";
import {
  FRIENDSHIP_GAMES,
  ACTIVE_GAMES,
  FRIENDS,
  TRIVIA_PACKS,
  type Game,
  type TriviaPack,
} from "@/lib/data";
import { JudgementGame } from "@/components/JudgementGame";
import { TriviaGame } from "@/components/TriviaGame";
import { ARCADE, Leaderboard, QuickMath, TapRush } from "@/components/ArcadeGames";
import { leaderboard, useSocial } from "@/lib/social";

export const Route = createFileRoute("/app/games")({
  component: Games,
});

// Uppercase and letter-spacing come from the .label-caps style.
function spaced(s: string) {
  return s;
}

const MOST_LIKELY_Q = "Most likely to drop everything and travel tomorrow";

function MostLikelyGame({ onClose }: { onClose: () => void }) {
  const [voted, setVoted] = useState<string | null>(null);
  const winner = FRIENDS[3];
  const pool = FRIENDS.slice(0, 12);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col animate-soft-in"
      style={{ background: "var(--bg-surface)" }}
    >
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <span className="label-caps text-cool">{spaced("Most Likely To")}</span>
        <button onClick={onClose} className="text-cool">
          <X size={22} />
        </button>
      </header>
      <div className="px-6 mt-2">
        <div className="card-editorial accent-bar-purple p-6">
          <p className="label-caps text-cool">{spaced("Question")}</p>
          <h2
            className="mt-3 font-display italic text-warm"
            style={{ fontSize: 24, lineHeight: 1.3 }}
          >
            {MOST_LIKELY_Q}
          </h2>
        </div>
      </div>
      {!voted ? (
        <>
          <p className="text-center label-caps text-cool mt-8">
            {spaced("Tap who you'd vote for")}
          </p>
          <div className="px-5 mt-5 grid grid-cols-4 gap-3 overflow-y-auto">
            {pool.map((f) => (
              <button
                key={f.id}
                onClick={() => setVoted(f.id)}
                className="flex flex-col items-center gap-1.5"
              >
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={60} />
                <span
                  className="font-display italic truncate w-full text-center"
                  style={{ fontSize: 11, color: "var(--text-primary)" }}
                >
                  {f.name}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="px-6 mt-10 flex-1 flex flex-col">
          <p className="text-center label-caps text-cool">{spaced("Results")}</p>
          <div className="mt-6 flex flex-col items-center">
            <Avatar
              src={winner.avatar}
              initials={winner.initials}
              color={winner.color}
              size={96}
              ring="active"
            />
            <p className="mt-4 font-display italic text-warm" style={{ fontSize: 22 }}>
              {winner.name}
            </p>
            <p className="label-caps text-cool mt-1">{spaced("48% of your 25 agreed")}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-auto mb-8 w-full btn-capsule py-4 font-display italic"
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
    <div
      className="fixed inset-0 z-50 flex flex-col animate-soft-in p-6"
      style={{ background: "var(--bg-surface)" }}
    >
      <header className="flex items-center justify-between">
        <span className="label-caps text-cool">{spaced(`${game.emoji} ${game.name}`)}</span>
        <button onClick={onClose} className="text-cool">
          <X size={22} />
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-7xl mb-6">{game.emoji}</div>
        <h2 className="font-display italic text-warm" style={{ fontSize: 26 }}>
          {game.name}
        </h2>
        <p className="mt-3 font-display italic text-cool max-w-xs" style={{ fontSize: 14 }}>
          {game.description}
        </p>
        <button className="mt-10 btn-capsule px-10 py-4 font-display italic">Start playing</button>
      </div>
    </div>
  );
}

const FRIENDSHIP_GRADIENTS: Record<string, string> = {
  "know-me": "linear-gradient(150deg,#FFFFFF,#E3F0FA)",
  "most-likely": "linear-gradient(150deg,#FFFFFF,#DDF3EC)",
  "truth-jar": "linear-gradient(150deg,#FFFFFF,#FDE6E3)",
  "rapid-fire": "linear-gradient(150deg,#FFFFFF,#FFF2D1)",
};

function Games() {
  const [active, setActive] = useState<Game | null>(null);
  const [judgement, setJudgement] = useState(false);
  const [trivia, setTrivia] = useState<TriviaPack | null>(null);
  const [arcade, setArcade] = useState<"tap-rush" | "quick-math" | null>(null);
  const social = useSocial();

  return (
    <>
      <PageBand
        eyebrow="games · your 25 only"
        title="Play."
        sub="Quick rounds, long rivalries. Top the table by Monday."
      />

      {/* Active games */}
      <section className="mt-6">
        <div className="px-5 flex items-center justify-between mb-2">
          <h2 className="label-caps text-cool">{spaced("Active")}</h2>
          <span className="label-caps text-cool">{spaced(`${ACTIVE_GAMES.length} in play`)}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ACTIVE_GAMES.map((ag) => {
            const players = ag.players
              .map((id) => FRIENDS.find((f) => f.id === id)!)
              .filter(Boolean);
            const yourTurn = ag.status === "Your turn";
            return (
              <button
                key={ag.id}
                onClick={() => ag.gameId === "judgement" && setJudgement(true)}
                className="shrink-0 w-60 card-editorial p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-warm" style={{ fontSize: 14 }}>
                    {ag.title}
                  </span>
                  <ChevronRight size={16} style={{ color: "var(--blue)" }} />
                </div>
                <div className="mt-3 flex -space-x-2">
                  {players.slice(0, 4).map((f) => (
                    <div key={f.id} className="rounded-full" style={{ outline: "2px solid #fff" }}>
                      <Avatar src={f.avatar} initials={f.initials} color={f.color} size={28} />
                    </div>
                  ))}
                </div>
                <div
                  className="mt-3 h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${ag.progress * 100}%`,
                      background: "linear-gradient(90deg,var(--blue),var(--coral))",
                    }}
                  />
                </div>
                <p
                  className="mt-2 label-caps"
                  style={{ color: yourTurn ? "var(--blue-deep)" : "var(--text-muted)" }}
                >
                  {spaced(ag.status)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick games with scores */}
      <section className="px-5 mt-7">
        <h2 className="label-caps text-cool mb-2">{spaced("Quick games")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {ARCADE.map((g) => {
            const best = social.scores[g.id]?.me;
            const board = leaderboard(social, g.id);
            const rank = board.findIndex((r) => r.id === "me") + 1;
            return (
              <button
                key={g.id}
                onClick={() => setArcade(g.id)}
                className="rounded-2xl p-4 text-left active:scale-[0.98] transition card-editorial"
                style={{ border: "1px solid rgba(43,138,196,0.22)" }}
              >
                <span className="die-tile" style={{ width: 40, height: 40, fontSize: 20 }}>
                  {g.glyph}
                </span>
                <h3 className="mt-3 font-display italic text-warm" style={{ fontSize: 17 }}>
                  {g.name}
                </h3>
                <p
                  className="font-display italic text-cool mt-1"
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                >
                  {g.blurb}
                </p>
                <p
                  className="label-caps mt-3"
                  style={{ color: best != null ? "var(--accent-bronze)" : "var(--text-muted)" }}
                >
                  {best != null ? `best ${best} · #${rank} of ${board.length}` : "not played yet"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <Leaderboard />

      {/* Judgement — feature */}
      <section className="px-5 mt-8">
        <h2 className="label-caps text-cool mb-2">{spaced("India Games")}</h2>
        <button
          onClick={() => setJudgement(true)}
          className="w-full rounded-2xl text-left p-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #FFFFFF 0%, #E3F0FA 100%)",
            border: "1px solid var(--border-cool)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <span className="label-caps" style={{ color: "var(--blue-deep)" }}>
            {spaced("🇮🇳 Most played in India")}
          </span>
          <div className="text-5xl mt-2">🃏</div>
          <h3 className="mt-2 font-display italic text-warm" style={{ fontSize: 28 }}>
            Judgement
          </h3>
          <p className="label-caps text-cool mt-1">{spaced("Call Break · 4 players · 5 rounds")}</p>
          <p
            className="mt-3 font-display italic text-cool"
            style={{ fontSize: 14, lineHeight: 1.6 }}
          >
            Bid your tricks. Spades are trump. Five rounds to glory.
          </p>
          <div
            className="mt-4 inline-block btn-gold px-4 py-2 font-display italic"
            style={{ fontSize: 13 }}
          >
            Open lobby →
          </div>
        </button>
      </section>

      {/* Trivia row */}
      <section className="mt-7">
        <div className="px-5 flex items-center justify-between mb-2">
          <h2 className="label-caps text-cool">{spaced("India Trivia")}</h2>
          <span className="label-caps text-cool">{spaced(`${TRIVIA_PACKS.length} packs`)}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TRIVIA_PACKS.map((p) => {
            const isFree = p.price === "Free";
            return (
              <button
                key={p.id}
                onClick={() => isFree && setTrivia(p)}
                className="shrink-0 w-44 rounded-2xl overflow-hidden text-left"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-cool)" }}
              >
                <div className="p-4 h-32 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{p.emoji}</span>
                    <span
                      className="label-caps px-2 py-0.5 rounded-full"
                      style={{
                        background: isFree ? "rgba(29,158,117,0.18)" : "rgba(43,138,196,0.18)",
                        color: isFree ? "#9BE49E" : "var(--blue-deep)",
                      }}
                    >
                      {p.price}
                    </span>
                  </div>
                  <div>
                    <div className="font-display italic text-warm" style={{ fontSize: 16 }}>
                      {p.name}
                    </div>
                    <div className="label-caps text-cool mt-0.5">
                      {spaced(`${p.questions} questions`)}
                    </div>
                  </div>
                </div>
                <div
                  className="px-4 py-2.5 border-t flex items-center justify-between"
                  style={{ borderColor: "var(--border-cool)", background: "var(--bg-surface)" }}
                >
                  <span
                    className="font-display italic text-cool truncate pr-2"
                    style={{ fontSize: 12 }}
                  >
                    {p.tagline}
                  </span>
                  <span className="flex gap-0.5">
                    {[1, 2, 3].map((d) => (
                      <span
                        key={d}
                        className="h-1 w-1 rounded-full"
                        style={{
                          background:
                            d <= p.difficulty ? "var(--blue-deep)" : "rgba(138,156,170,0.25)",
                        }}
                      />
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Friendship games */}
      <section className="px-5 mt-7">
        <h2 className="label-caps text-cool mb-2">{spaced("Friendship Games")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {FRIENDSHIP_GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => setActive(g)}
              className="rounded-2xl p-4 flex flex-col items-start text-left active:scale-[0.98] transition"
              style={{
                background: FRIENDSHIP_GRADIENTS[g.id] ?? "var(--bg-card)",
                border: "1px solid var(--border-cool)",
              }}
            >
              <div className="text-[30px] leading-none">{g.emoji}</div>
              <h3 className="mt-3 font-display italic text-warm" style={{ fontSize: 15 }}>
                {g.name}
              </h3>
              <p className="label-caps text-cool mt-1">{spaced(g.players)}</p>
              <span
                className="mt-2 label-caps px-2 py-0.5 rounded-full"
                style={{ background: "var(--sky-100)", color: "var(--text-primary)" }}
              >
                {g.price}
              </span>
            </button>
          ))}
        </div>
      </section>

      <p className="text-center font-display italic text-cool px-6 py-10" style={{ fontSize: 13 }}>
        No strangers. Just your 25, keeping score.
      </p>

      {active && active.id === "most-likely" && <MostLikelyGame onClose={() => setActive(null)} />}
      {active && active.id !== "most-likely" && (
        <GenericGameScreen game={active} onClose={() => setActive(null)} />
      )}
      {judgement && <JudgementGame onClose={() => setJudgement(false)} />}
      {trivia && <TriviaGame pack={trivia} onClose={() => setTrivia(null)} />}
      {arcade === "tap-rush" && <TapRush onClose={() => setArcade(null)} />}
      {arcade === "quick-math" && <QuickMath onClose={() => setArcade(null)} />}
    </>
  );
}
