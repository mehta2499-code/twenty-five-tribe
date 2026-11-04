import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Target, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, FriendPicker, Toast, buzz } from "@/components/SocialUI";
import { friendById, leaderboard, social, useSocial, type GameId, meView } from "@/lib/social";

export const ARCADE = [
  {
    id: "tap-rush" as const,
    name: "Tap Rush",
    Icon: Target,
    blurb: "20 seconds. Tap the dot wherever it lands.",
    unit: "taps",
  },
  {
    id: "quick-math" as const,
    name: "Quick Maths",
    Icon: Calculator,
    blurb: "30 seconds of mental maths. No calculators, Sharma ji.",
    unit: "correct",
  },
];
export const GAME_NAMES: Record<GameId, string> = {
  "tap-rush": "Tap Rush",
  "quick-math": "Quick Maths",
  trivia: "India Trivia",
};

function GameFrame({
  title,
  timeLeft,
  score,
  onClose,
  children,
}: {
  title: string;
  timeLeft: number;
  score: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-soft-in">
      <div className="mx-auto w-full max-w-md flex flex-col h-full px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6">
        <header className="flex items-center justify-between">
          <span className="label-caps">{title}</span>
          <button onClick={onClose} aria-label="Close game" className="text-cool">
            <X size={22} />
          </button>
        </header>
        <div className="flex items-end justify-between mt-6">
          <div>
            <p className="label-caps">score</p>
            <p
              className="font-display text-cream tabular-nums"
              style={{ fontSize: 44, lineHeight: 1 }}
            >
              {score}
            </p>
          </div>
          <div className="text-right">
            <p className="label-caps">time</p>
            <p
              className="font-display tabular-nums"
              style={{
                fontSize: 44,
                lineHeight: 1,
                color: timeLeft <= 5 ? "var(--accent-ember)" : "var(--text-primary)",
              }}
            >
              {timeLeft}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function useCountdown(seconds: number, running: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(seconds);
  const ended = useRef(false);
  useEffect(() => {
    if (!running) return;
    if (left <= 0) {
      if (!ended.current) {
        ended.current = true;
        onEnd();
      }
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);
  return left;
}

function ResultCard({
  game,
  score,
  onAgain,
  onClose,
}: {
  game: GameId;
  score: number;
  onAgain: () => void;
  onClose: () => void;
}) {
  const s = useSocial();
  const [prevBest] = useState(() => s.scores[game]?.me ?? -1);
  const isBest = score > prevBest;
  useEffect(() => {
    social.recordScore(game, score);
    if (score > prevBest) buzz(40);
  }, [game, score, prevBest]);
  const [challenging, setChallenging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const board = leaderboard(s, game);
  const rank = board.findIndex((r) => r.id === "me") + 1;
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center animate-soft-in">
      <p className="label-caps">{isBest ? "new best this week" : "nice try"}</p>
      <p
        className="font-display text-cream tabular-nums mt-3"
        style={{ fontSize: 88, lineHeight: 1 }}
      >
        {score}
      </p>
      <p className="font-display italic text-cool mt-3" style={{ fontSize: 15 }}>
        {rank > 0
          ? `You're #${rank} of ${board.length} at your table this week.`
          : "Play again to get on the board."}
      </p>
      <div className="w-full mt-10 space-y-3">
        <button
          onClick={() => setChallenging(true)}
          className="w-full rounded-full py-3.5 font-display italic"
          style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)", fontSize: 15 }}
        >
          Challenge someone
        </button>
        <button
          onClick={onAgain}
          className="w-full rounded-full py-3.5 font-display italic text-cream"
          style={{ border: "1px solid var(--border-cool)", fontSize: 15 }}
        >
          Play again
        </button>
        <button onClick={onClose} className="label-caps text-cool pt-2">
          back to games
        </button>
      </div>
      {challenging && (
        <FriendPicker
          title="who's up?"
          cta="Send challenge"
          single
          onClose={() => setChallenging(false)}
          onPick={([id]) => {
            social.challenge(id, GAME_NAMES[game], score);
            setChallenging(false);
            setToast(`Challenge sent to ${friendById(id)?.name}`);
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={isBest ? 1 : 0} />
    </div>
  );
}

export function TapRush({ onClose }: { onClose: () => void }) {
  const [round, setRound] = useState(0);
  return <TapRushRound key={round} onAgain={() => setRound((r) => r + 1)} onClose={onClose} />;
}

function TapRushRound({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const left = useCountdown(20, started && !over, () => setOver(true));

  const hit = () => {
    if (!started) setStarted(true);
    setScore((n) => n + 1);
    setPos({ x: 10 + Math.random() * 80, y: 10 + Math.random() * 80 });
  };

  return (
    <GameFrame title="tap rush" timeLeft={left} score={score} onClose={onClose}>
      {over ? (
        <ResultCard game="tap-rush" score={score} onAgain={onAgain} onClose={onClose} />
      ) : (
        <div
          className="relative flex-1 mt-6 rounded-3xl table-felt overflow-hidden"
          style={{ border: "1px solid var(--border-cool)" }}
        >
          {!started && (
            <p
              className="absolute inset-x-0 top-6 text-center font-display italic text-cool"
              style={{ fontSize: 14 }}
            >
              Tap the ember to start.
            </p>
          )}
          <button
            onPointerDown={hit}
            aria-label="Target"
            className="absolute rounded-full animate-ember-pulse"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: 64,
              height: 64,
              transform: "translate(-50%,-50%)",
              background:
                "radial-gradient(circle, #F2B27A 0%, var(--accent-ember) 45%, var(--accent-oxblood) 100%)",
            }}
          />
        </div>
      )}
    </GameFrame>
  );
}

function makeQuestion() {
  const op = Math.random() < 0.6 ? "+" : "×";
  const a = op === "+" ? 5 + Math.floor(Math.random() * 60) : 2 + Math.floor(Math.random() * 11);
  const b = op === "+" ? 5 + Math.floor(Math.random() * 60) : 2 + Math.floor(Math.random() * 11);
  const answer = op === "+" ? a + b : a * b;
  const opts = new Set([answer]);
  while (opts.size < 4) opts.add(answer + (Math.floor(Math.random() * 11) - 5 || 7));
  return { text: `${a} ${op} ${b}`, answer, options: [...opts].sort(() => Math.random() - 0.5) };
}

export function QuickMath({ onClose }: { onClose: () => void }) {
  const [round, setRound] = useState(0);
  return <QuickMathRound key={round} onAgain={() => setRound((r) => r + 1)} onClose={onClose} />;
}

function QuickMathRound({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [q, setQ] = useState(makeQuestion);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const left = useCountdown(30, !over, () => setOver(true));

  const pick = (n: number) => {
    const right = n === q.answer;
    if (right) setScore((s) => s + 1);
    setFlash(right ? "right" : "wrong");
    setTimeout(() => setFlash(null), 250);
    setQ(makeQuestion());
  };

  return (
    <GameFrame title="quick maths" timeLeft={left} score={score} onClose={onClose}>
      {over ? (
        <ResultCard game="quick-math" score={score} onAgain={onAgain} onClose={onClose} />
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <p
            className="font-display text-center tabular-nums"
            style={{
              fontSize: 56,
              transition: "color 200ms",
              color:
                flash === "right"
                  ? "var(--accent-sage)"
                  : flash === "wrong"
                    ? "var(--accent-ember)"
                    : "var(--text-primary)",
            }}
          >
            {q.text}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-10">
            {q.options.map((n) => (
              <button
                key={n}
                onClick={() => pick(n)}
                className="rounded-2xl py-5 font-display text-cream tabular-nums active:scale-95 transition"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-cool)",
                  fontSize: 26,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </GameFrame>
  );
}

export function Leaderboard() {
  const s = useSocial();
  const [game, setGame] = useState<GameId>("tap-rush");
  const rows = useMemo(() => leaderboard(s, game), [s, game]);
  const onBoard = rows.some((r) => r.id === "me");
  return (
    <section className="px-5 mt-8" aria-labelledby="board-title">
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 id="board-title" className="text-[15px] font-semibold text-cream">
          This week's leaderboard
        </h2>
        <span className="meta">Resets Monday</span>
      </div>
      <div
        className="segmented mb-3 max-w-full overflow-x-auto no-scrollbar"
        role="group"
        aria-label="Choose a game"
      >
        {(Object.keys(GAME_NAMES) as GameId[]).map((g) => (
          <button
            key={g}
            onClick={() => setGame(g)}
            aria-pressed={g === game}
            className="whitespace-nowrap"
          >
            {GAME_NAMES[g]}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="card px-4 py-6 text-center">
          <p className="font-semibold text-cream">No scores yet this week</p>
          <p className="meta mt-1">Play a round and you'll be first on the board.</p>
        </div>
      ) : (
        <ol className="card overflow-hidden divide-y" style={{ borderColor: "var(--line)" }}>
          {rows.slice(0, 10).map((r, i) => {
            const me = r.id === "me";
            const f = me ? null : friendById(r.id);
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ background: me ? "var(--fill)" : "transparent" }}
              >
                <span
                  className="w-6 text-center font-bold tabular-nums"
                  style={{ fontSize: 15, color: i === 0 ? "var(--blue-deep)" : "var(--ink-3)" }}
                >
                  {i + 1}
                </span>
                <Avatar
                  src={f ? f.avatar || undefined : meView().avatar}
                  initials={f?.initials ?? meView().initials}
                  color={f?.color}
                  size={34}
                />
                <span
                  className="flex-1 min-w-0 truncate font-semibold text-cream"
                  style={{ fontSize: 15 }}
                >
                  {me ? "You" : f?.name}
                </span>
                <span className="font-bold tabular-nums text-cream" style={{ fontSize: 16 }}>
                  {r.score}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > 0 && !onBoard && (
        <p className="meta mt-2 text-center">
          You're not on this one yet. Play a round to join in.
        </p>
      )}
    </section>
  );
}
