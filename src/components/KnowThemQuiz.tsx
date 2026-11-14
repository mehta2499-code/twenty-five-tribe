import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, buzz } from "@/components/SocialUI";
import { QuizBadge } from "@/components/QuizBadges";
import { badgeOf, refreshQuiz } from "@/lib/quiz";
import type { Person } from "@/lib/social";
import {
  DEMO_ANSWERS,
  MONTHS,
  PASS_MARK,
  QUIZ_SIZE,
  VIBE_QUESTIONS,
  questionById,
  startQuiz,
  submitQuiz,
} from "@/lib/vibes";

type Phase =
  | { kind: "loading" }
  | {
      kind: "error";
      message: string;
      retry?: { attempt: string; questions: string[]; guesses: Record<string, string> };
    }
  | {
      kind: "asking";
      attempt: string;
      questions: string[];
      index: number;
      guesses: Record<string, string>;
    }
  | { kind: "checking" }
  | { kind: "result"; score: number; total: number; passed: boolean };

/**
 * "How well do you know them?" Guess 6 of their vibe-check answers (5 this-or-that
 * plus their birthday month). 4 right gets you in.
 * `demo` runs locally with sample answers so it can be tried without an account.
 */
export function KnowThemQuiz({
  person,
  onClose,
  onPassed,
  demo = false,
  actionLabel = "Save their seat",
}: {
  person: Person;
  onClose: () => void;
  onPassed: () => void | Promise<void>;
  demo?: boolean;
  actionLabel?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // Ignore a second tap while the answers are being sent (double taps sent it twice).
  const busy = useRef(false);
  const first = person.name.split(" ")[0];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (demo) {
          const ids = [
            ...VIBE_QUESTIONS.map((q) => q.id)
              .sort(() => Math.random() - 0.5)
              .slice(0, QUIZ_SIZE - 1),
            "bday_month",
          ];
          setPhase({
            kind: "asking",
            attempt: "demo",
            questions: ids,
            index: 0,
            guesses: {},
          });
          return;
        }
        const r = await startQuiz(person.id);
        if (!alive) return;
        if (r.passed) {
          // Already proved it earlier: go straight to the action.
          await onPassed();
          onClose();
        } else
          setPhase({
            kind: "asking",
            attempt: r.attempt,
            questions: r.questions,
            index: 0,
            guesses: {},
          });
      } catch (e) {
        if (alive)
          setPhase({
            kind: "error",
            message: (e as Error)?.message || "Something went wrong. Try again.",
          });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id, demo]);

  const answer = async (value: string) => {
    if (phase.kind !== "asking" || busy.current) return;
    buzz(8);
    const qid = phase.questions[phase.index];
    if (!qid) return;
    const guesses = { ...phase.guesses, [qid]: value };
    if (phase.index + 1 < phase.questions.length) {
      setPhase({ ...phase, guesses, index: phase.index + 1 });
      return;
    }
    await finish(phase.attempt, phase.questions, guesses);
  };

  const finish = async (attempt: string, questions: string[], guesses: Record<string, string>) => {
    if (busy.current) return;
    busy.current = true;
    const phase = { attempt, questions };
    setPhase({ kind: "checking" });
    try {
      let result: { score: number; total: number; passed: boolean };
      if (demo) {
        const truth = DEMO_ANSWERS[person.id] ?? DEMO_ANSWERS["2"];
        const score = phase.questions.filter((q) =>
          q === "bday_month" ? Number(guesses[q]) === truth.month : guesses[q] === truth.answers[q],
        ).length;
        result = { score, total: phase.questions.length, passed: score >= PASS_MARK };
      } else {
        result = await submitQuiz(phase.attempt, guesses);
      }
      if (result.passed) {
        buzz(40);
        await onPassed();
      }
      setPhase({ kind: "result", ...result });
      void refreshQuiz();
    } catch (e) {
      // Keep the answers so "Try again" doesn't start the quiz over.
      setPhase({
        kind: "error",
        message: (e as Error)?.message || "Something went wrong. Try again.",
        retry: { attempt, questions, guesses },
      });
    } finally {
      busy.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col"
      style={{ background: "var(--page)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`How well do you know ${first}?`}
    >
      <div className="mx-auto w-full max-w-md flex flex-col h-full px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-3">
          <Avatar
            src={person.avatar || undefined}
            initials={person.initials}
            color={person.color}
            size={44}
          />
          <div className="flex-1 min-w-0">
            <p className="meta">How well do you know</p>
            <p className="font-extrabold truncate" style={{ fontSize: 17 }}>
              {person.name}?
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-secondary btn-icon"
            style={{ minHeight: 42, width: 42, minWidth: 42 }}
          >
            <X size={18} />
          </button>
        </header>

        {phase.kind === "asking" && (
          <div className="mt-5 flex gap-1.5" aria-hidden="true">
            {phase.questions.map((_, i) => (
              <span
                key={i}
                className="flex-1 h-2.5 rounded-full"
                style={{
                  border: "1px solid var(--line-2)",
                  background:
                    i < phase.index
                      ? "var(--accent)"
                      : i === phase.index
                        ? "var(--ink-3)"
                        : "var(--fill)",
                }}
              />
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">
          {phase.kind === "loading" || phase.kind === "checking" ? (
            <p className="text-center heading">
              {phase.kind === "loading" ? "Shuffling their answers…" : "Checking…"}
            </p>
          ) : phase.kind === "error" ? (
            <div className="text-center">
              <span className="sticker pink">hold up</span>
              <p className="heading mt-4">{phase.message}</p>
              <div className="mt-6 flex justify-center gap-3">
                {phase.retry && (
                  <button
                    onClick={() => {
                      const r = phase.retry!;
                      void finish(r.attempt, r.questions, r.guesses);
                    }}
                    className="btn-primary px-6"
                  >
                    Try again
                  </button>
                )}
                <button onClick={onClose} className="btn-secondary px-6">
                  {phase.retry ? "Close" : "OK"}
                </button>
              </div>
            </div>
          ) : phase.kind === "result" ? (
            <div className="text-center animate-soft-in">
              {badgeOf(phase) ? (
                <span className="inline-block pop">
                  <QuizBadge badge={badgeOf(phase)} />
                </span>
              ) : (
                <span className={`sticker ${phase.passed ? "" : "pink"}`}>
                  {phase.passed ? "certified bestie" : "not quite"}
                </span>
              )}
              <p
                className="display mt-4"
                style={{ fontSize: 84, lineHeight: 1, color: "var(--lime)" }}
              >
                {phase.score}/{phase.total}
              </p>
              <h2 className="title mt-3" style={{ fontSize: 28 }}>
                {badgeOf(phase) === "ride"
                  ? `Perfect. You're ${first}'s Ride or Die.`
                  : badgeOf(phase) === "real"
                    ? `One off. A Real One.`
                    : phase.passed
                      ? `You know ${first}.`
                      : `Do you even know ${first}?`}
              </h2>
              {badgeOf(phase) && !demo && (
                <p className="meta mt-1">
                  {first} gets told, and you get a badge on each other's profiles.
                </p>
              )}
              <p className="mt-2 text-cool">
                {phase.passed
                  ? demo
                    ? "That's how it works. In the real app, this unlocks their seat."
                    : `${actionLabel === "Seat them back" ? "Mutual. Chats, blinks and games unlocked." : "They're in your 25 now. They'll get pinged 👀"}`
                  : `You need ${PASS_MARK} right. Try again in 30 minutes, or ask ${first} something IRL.`}
              </p>
              <button
                onClick={onClose}
                className={`${phase.passed ? "btn-fun" : "btn-secondary"} w-full mt-8`}
              >
                {phase.passed ? "Yay" : "OK"}
              </button>
              <Confetti fire={phase.passed ? 1 : 0} />
              {/* Extra bursts for a 6/7 or a perfect score. */}
              {badgeOf(phase) && <BigConfetti perfect={badgeOf(phase) === "ride"} />}
            </div>
          ) : (
            <Question
              key={phase.index}
              qid={phase.questions[phase.index]}
              name={first}
              onAnswer={answer}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Question({
  qid,
  name,
  onAnswer,
}: {
  qid: string;
  name: string;
  onAnswer: (v: string) => void;
}) {
  // A double tap shouldn't also answer the next question: ignore taps for a moment.
  const [shownAt] = useState(() => Date.now());
  const pick = (v: string) => {
    if (Date.now() - shownAt < 300) return;
    onAnswer(v);
  };
  if (qid === "bday_month") {
    return (
      <div className="animate-soft-in">
        <span className="sticker sun">birthday round</span>
        <h2 className="title mt-4">Which month is {name}'s birthday?</h2>
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              onClick={() => pick(String(i + 1))}
              className="btn-secondary"
              style={{ minHeight: 48, fontSize: 14 }}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const q = questionById(qid);
  if (!q) return null;
  return (
    <div className="animate-soft-in">
      <span className="sticker">what would {name} pick?</span>
      <h2 className="title mt-4" style={{ fontSize: 40 }}>
        {q.ask}
      </h2>
      <div className="mt-7 grid grid-cols-2 gap-4">
        {(["a", "b"] as const).map((c, i) => (
          <button key={c} onClick={() => pick(c)} className="choice">
            <span style={{ fontSize: 50, lineHeight: 1 }} aria-hidden="true">
              {q[c].emoji}
            </span>
            <span className="font-extrabold" style={{ fontSize: 18 }}>
              {q[c].label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A few more confetti bursts, staggered, for a top score. */
function BigConfetti({ perfect }: { perfect: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const times = perfect ? [500, 1100, 1700] : [600];
    const ids = times.map((t, i) => setTimeout(() => setN(i + 2), t));
    if (typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate?.([30, 60, 30]);
    return () => ids.forEach(clearTimeout);
  }, [perfect]);
  return <Confetti fire={n} />;
}
