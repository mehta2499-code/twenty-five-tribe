import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, buzz } from "@/components/SocialUI";
import { ME, type TriviaPack } from "@/lib/data";
import { buildRound, markSeen, newSeed } from "@/lib/trivia";
import { social, useSocial } from "@/lib/social";

const SECONDS = 10;

type Opponent = { name: string; avatar?: string; initials: string; color?: string; score?: number };

/**
 * One trivia round. Solo, or against a friend's score in a challenge.
 * `opponent.score` is undefined while they haven't played yet.
 */
export function TriviaGame({
  pack,
  onClose,
  opponent,
  onFinish,
  seed,
}: {
  /** Challenges pass a shared seed so both friends get the same round. */
  seed?: number;
  pack: TriviaPack;
  onClose: () => void;
  opponent?: Opponent;
  onFinish?: (score: number, total: number) => void;
}) {
  const s = useSocial();
  const me = s.me ?? { name: "You", avatar: ME.avatar, initials: ME.initials };
  const [questions] = useState(() => buildRound(pack.id, seed ?? newSeed(), seed === undefined));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [time, setTime] = useState(SECONDS);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const finished = useRef(false);
  const q = questions[idx];

  useEffect(() => {
    if (!done || finished.current) return;
    finished.current = true;
    markSeen(pack.id, questions);
    social.recordScore("trivia", score);
    onFinish?.(score, questions.length);
  }, [done, score, questions, pack.id, onFinish]);

  useEffect(() => {
    if (revealed || done) return;
    if (time <= 0) {
      reveal(null);
      return;
    }
    const t = setTimeout(() => setTime((n) => n - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, revealed, done]);

  function reveal(i: number | null) {
    setRevealed(true);
    if (i === q.answer) {
      setScore((n) => n + 1);
      buzz(10);
    }
    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true);
      else {
        setIdx((n) => n + 1);
        setPicked(null);
        setRevealed(false);
        setTime(SECONDS);
      }
    }, 1300);
  }

  if (done) {
    const theirs = opponent?.score;
    const result =
      theirs === undefined ? null : score > theirs ? "win" : score === theirs ? "tie" : "loss";
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center animate-soft-in">
        <button onClick={onClose} aria-label="Close" className="absolute top-5 right-5 text-cool">
          <X size={22} />
        </button>
        <p className="label-caps">{pack.name}</p>
        <h2 className="font-display mt-3" style={{ fontSize: 34, lineHeight: 1.1 }}>
          {result === "win"
            ? "You win."
            : result === "tie"
              ? "Dead heat."
              : result === "loss"
                ? `${opponent!.name.split(" ")[0]} wins.`
                : opponent
                  ? "Your score is in."
                  : "Nice round."}
        </h2>
        <div className="mt-8 flex items-center gap-8">
          <div className="flex flex-col items-center">
            <Avatar
              src={me.avatar}
              initials={me.initials}
              size={72}
              ring={result === "win" ? "active" : "none"}
            />
            <span className="mt-2 text-sm font-semibold">You</span>
            <span className="text-3xl font-black tabular-nums text-bronze">
              {score}/{questions.length}
            </span>
          </div>
          {opponent && (
            <>
              <span className="text-faint">vs</span>
              <div className="flex flex-col items-center">
                <Avatar
                  src={opponent.avatar}
                  initials={opponent.initials}
                  color={opponent.color}
                  size={72}
                  ring={result === "loss" ? "active" : "none"}
                />
                <span className="mt-2 text-sm font-semibold">{opponent.name.split(" ")[0]}</span>
                <span className="text-3xl font-black tabular-nums text-bronze">
                  {theirs === undefined ? "?" : `${theirs}/${questions.length}`}
                </span>
              </div>
            </>
          )}
        </div>
        {opponent && theirs === undefined && (
          <p className="mt-6 text-sm text-cool max-w-xs">
            We've sent {opponent.name.split(" ")[0]} the same questions. You'll see who won when
            they play.
          </p>
        )}
        <button onClick={onClose} className="mt-10 btn-bronze px-8 py-3.5">
          Done
        </button>
        <Confetti fire={result === "win" ? 1 : 0} />
      </div>
    );
  }

  const ringPct = (time / SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-soft-in">
      <div className="mx-auto w-full max-w-md flex flex-col h-full">
        <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
          <span className="label-caps">{pack.name}</span>
          <button onClick={onClose} aria-label="Close" className="text-cool">
            <X size={22} />
          </button>
        </header>

        <div className="px-5 mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar src={me.avatar} initials={me.initials} size={36} />
            <span className="text-sm font-bold tabular-nums">{score}</span>
          </div>
          <div className="text-xs text-faint tabular-nums">
            Q {idx + 1} / {questions.length}
          </div>
          {opponent ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cool">
                {opponent.score === undefined ? "plays after you" : `scored ${opponent.score}`}
              </span>
              <Avatar
                src={opponent.avatar}
                initials={opponent.initials}
                color={opponent.color}
                size={36}
              />
            </div>
          ) : (
            <span className="text-xs text-faint">solo</span>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <div className="relative h-20 w-20">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="16" fill="none" stroke="var(--sky-200)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="var(--blue)"
                strokeWidth="3"
                strokeDasharray={`${ringPct} 100`}
                pathLength={100}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-black tabular-nums">
              {time}
            </span>
          </div>
        </div>

        <h2
          className="px-6 mt-6 text-center font-semibold text-cream"
          style={{ fontSize: 21, lineHeight: 1.35 }}
        >
          {q.q}
        </h2>

        <div className="px-5 mt-8 grid gap-3">
          {q.options.map((opt, i) => {
            const correct = revealed && i === q.answer;
            const wrong = revealed && picked === i && i !== q.answer;
            return (
              <button
                key={opt}
                disabled={revealed}
                onClick={() => {
                  setPicked(i);
                  reveal(i);
                }}
                className="w-full rounded-2xl px-5 py-4 text-left font-semibold transition"
                style={{
                  background: correct ? "var(--mint)" : wrong ? "var(--hot)" : "var(--fill)",
                  color: correct ? "#0B1F18" : wrong ? "#fff" : "var(--text-primary)",
                  border: "1px solid var(--border-cool)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
