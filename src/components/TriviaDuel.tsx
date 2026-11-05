/**
 * Live trivia duel (QuizUp style): both friends play the same questions at the
 * same time. Faster right answers score more; the last question counts double.
 *
 * Sync runs over a Supabase Realtime channel: presence shows who's in the room,
 * and the host's phone calls each question so both screens move together.
 * Each phone saves its own final score to the game when the duel ends.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Confetti, buzz } from "@/components/SocialUI";
import { buildRound } from "@/lib/trivia";
import type { TriviaPack } from "@/lib/data";

export const DUEL_QUESTIONS = 7;
const Q_SECONDS = 10;
const REVEAL_MS = 1800;
const MAX_POINTS = 20;

/** 10 for a right answer + up to 10 more for speed. Last question doubles. */
export function pointsFor(correct: boolean, msLeft: number, last: boolean) {
  if (!correct) return 0;
  const p = 10 + Math.round((Math.max(0, msLeft) / (Q_SECONDS * 1000)) * 10);
  return last ? p * 2 : p;
}
export const duelMax = () => MAX_POINTS * (DUEL_QUESTIONS + 1);

type Player = { id: string; name: string; avatar?: string; initials: string; color?: string };
type Answer = { choice: number; correct: boolean; points: number };
type Msg =
  | { t: "go"; i: number }
  | { t: "reveal"; i: number }
  | { t: "end" }
  | { t: "ans"; from: string; i: number; choice: number; correct: boolean; points: number };

export function TriviaDuel({
  gameId,
  pack,
  seed,
  me,
  them,
  isHost,
  onFinish,
  onPlayLater,
  onClose,
}: {
  gameId: string;
  pack: TriviaPack;
  seed: number;
  me: Player;
  them: Player;
  isHost: boolean;
  onFinish: (r: { points: number; correct: number; total: number }) => void;
  onPlayLater: () => void;
  onClose: () => void;
}) {
  const questions = useMemo(
    () => buildRound(pack.id, seed).slice(0, DUEL_QUESTIONS),
    [pack.id, seed],
  );
  const [present, setPresent] = useState<string[]>([]);
  const [phase, setPhase] = useState<"lobby" | "countdown" | "question" | "reveal" | "done">(
    "lobby",
  );
  const [i, setI] = useState(0);
  const [count, setCount] = useState(3);
  const [now, setNow] = useState(Date.now());
  const [mine, setMine] = useState<Record<number, Answer>>({});
  const [theirs, setTheirs] = useState<Record<number, Answer>>({});
  const [left, setLeft] = useState(false);
  const qStart = useRef(0);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const finished = useRef(false);
  // Latest values for the host's timers.
  const live = useRef({ phase, i, mine, theirs });
  live.current = { phase, i, mine, theirs };

  const send = (m: Msg) => void chan.current?.send({ type: "broadcast", event: "m", payload: m });

  const go = (n: number) => {
    setI(n);
    setPhase("question");
    qStart.current = Date.now();
  };

  const handle = (m: Msg) => {
    if (m.t === "go") {
      if (m.i === 0) {
        setPhase("countdown");
        setCount(3);
      } else go(m.i);
    } else if (m.t === "reveal") setPhase("reveal");
    else if (m.t === "end") setPhase("done");
    else if (m.t === "ans" && m.from !== me.id)
      setTheirs((t) => ({
        ...t,
        [m.i]: { choice: m.choice, correct: m.correct, points: m.points },
      }));
  };

  // Join the room.
  useEffect(() => {
    const ch = supabase.channel(`duel:${gameId}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    ch.on("broadcast", { event: "m" }, ({ payload }) => handle(payload as Msg))
      .on("presence", { event: "sync" }, () => setPresent(Object.keys(ch.presenceState())))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void ch.track({ at: Date.now() });
      });
    chan.current = ch;
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, me.id]);

  // Opponent left mid-duel (gone for more than 6 seconds, not just a blip).
  useEffect(() => {
    if (phase === "lobby" || phase === "done" || !present.length || present.includes(them.id))
      return;
    const t = setTimeout(() => setLeft(true), 6000);
    return () => clearTimeout(t);
  }, [present, phase, them.id]);

  // Host: start when both are in the room.
  useEffect(() => {
    if (!isHost || phase !== "lobby") return;
    if (present.includes(me.id) && present.includes(them.id)) {
      const t = setTimeout(() => {
        send({ t: "go", i: 0 });
        handle({ t: "go", i: 0 });
      }, 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, isHost, phase]);

  // Countdown 3, 2, 1 (both phones).
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      go(0);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, count]);

  // Clock for the timer ring.
  useEffect(() => {
    if (phase !== "question") return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [phase]);

  // Host: reveal when both answered or time is up, then the next question.
  useEffect(() => {
    if (!isHost || phase !== "question") return;
    const t = setInterval(() => {
      const { i: qi, mine: m, theirs: th, phase: ph } = live.current;
      if (ph !== "question") return;
      const both = m[qi] && (th[qi] || left);
      if (both || Date.now() - qStart.current >= Q_SECONDS * 1000) {
        send({ t: "reveal", i: qi });
        setPhase("reveal");
        setTimeout(() => {
          if (qi + 1 >= questions.length) {
            send({ t: "end" });
            setPhase("done");
          } else {
            send({ t: "go", i: qi + 1 });
            go(qi + 1);
          }
        }, REVEAL_MS);
      }
    }, 150);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, i, left]);

  // Guest safety net: if the host's reveal never arrives, reveal locally.
  useEffect(() => {
    if (isHost || phase !== "question") return;
    const t = setTimeout(() => setPhase("reveal"), Q_SECONDS * 1000 + 2500);
    return () => clearTimeout(t);
  }, [isHost, phase, i]);

  const total = (a: Record<number, Answer>) => Object.values(a).reduce((s, x) => s + x.points, 0);
  const myPoints = total(mine);
  const theirPoints = total(theirs);
  const correctCount = Object.values(mine).filter((a) => a.correct).length;

  // Save my result once.
  useEffect(() => {
    if (phase !== "done" && !(left && phase !== "lobby")) return;
    if (finished.current) return;
    finished.current = true;
    onFinish({ points: myPoints, correct: correctCount, total: questions.length });
    if (myPoints > theirPoints) buzz(60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left]);

  const pick = (choice: number) => {
    if (phase !== "question" || mine[i]) return;
    const q = questions[i];
    const correct = choice === q.answer;
    const points = pointsFor(
      correct,
      Q_SECONDS * 1000 - (Date.now() - qStart.current),
      i === questions.length - 1,
    );
    buzz(correct ? 15 : 50);
    setMine((m) => ({ ...m, [i]: { choice, correct, points } }));
    send({ t: "ans", from: me.id, i, choice, correct, points });
  };

  const Header = () => (
    <div className="flex items-center justify-between px-5 mt-2">
      <Side p={me} points={myPoints} answered={!!mine[i]} active={phase === "question"} />
      <span className="text-xs text-faint tabular-nums">
        {phase === "question" || phase === "reveal" ? `Q ${i + 1}/${questions.length}` : "vs"}
      </span>
      <Side
        p={them}
        points={theirPoints}
        answered={!!theirs[i]}
        active={phase === "question"}
        right
      />
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-soft-in">
      <div className="mx-auto w-full max-w-md flex flex-col h-full">
        <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
          <span className="label-caps">⚡ {pack.name} duel</span>
          <button onClick={onClose} aria-label="Close" className="text-cool">
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );

  if (phase === "lobby") {
    const theyreHere = present.includes(them.id);
    return shell(
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="flex items-center gap-6">
          <Avatar src={me.avatar} initials={me.initials} size={72} />
          <span className="display text-2xl">vs</span>
          <span className={theyreHere ? "" : "opacity-40"}>
            <Avatar src={them.avatar} initials={them.initials} color={them.color} size={72} />
          </span>
        </div>
        <h2 className="title mt-6" style={{ fontSize: 26 }}>
          {theyreHere ? "Both here. Starting…" : `Waiting for ${them.name.split(" ")[0]}…`}
        </h2>
        <p className="meta mt-2 max-w-xs">
          {theyreHere
            ? "7 questions, 10 seconds each. Faster right answers score more. Last one counts double."
            : `${them.name.split(" ")[0]} got a message to join. Keep this open.`}
        </p>
        {!theyreHere && (
          <>
            <span className="mt-6 flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="w-2.5 h-2.5 rounded-full soft-pulse-dot"
                  style={{ background: "var(--lime)", animationDelay: `${d * 0.18}s` }}
                />
              ))}
            </span>
            <button onClick={onPlayLater} className="btn-secondary mt-8 px-5">
              Can't wait? Play now, they play later
            </button>
          </>
        )}
      </div>,
    );
  }

  if (phase === "countdown") {
    return shell(
      <>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <span key={count} className="display pop" style={{ fontSize: 120 }}>
            {count || "Go!"}
          </span>
        </div>
      </>,
    );
  }

  if (phase === "done" || left) {
    const result =
      left && phase !== "done"
        ? "walkover"
        : myPoints > theirPoints
          ? "win"
          : myPoints === theirPoints
            ? "tie"
            : "loss";
    return shell(
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h2 className="title" style={{ fontSize: 34 }}>
          {result === "win"
            ? "You win 🏆"
            : result === "walkover"
              ? `${them.name.split(" ")[0]} left. You win by walkover.`
              : result === "tie"
                ? "Dead heat 🤝"
                : `${them.name.split(" ")[0]} wins 😤`}
        </h2>
        <div className="mt-8 flex items-center gap-8">
          {[
            { p: me, pts: myPoints, label: "You" },
            { p: them, pts: theirPoints, label: them.name.split(" ")[0] },
          ].map(({ p, pts, label }) => (
            <div key={p.id} className="flex flex-col items-center">
              <Avatar src={p.avatar} initials={p.initials} color={p.color} size={72} />
              <span className="mt-2 text-sm font-semibold">{label}</span>
              <span className="text-3xl font-black tabular-nums text-bronze">{pts}</span>
            </div>
          ))}
        </div>
        <p className="meta mt-4">
          {correctCount}/{questions.length} right
        </p>
        <button onClick={onClose} className="mt-10 btn-primary px-8">
          Done
        </button>
        <Confetti fire={result === "win" || result === "walkover" ? 1 : 0} />
      </div>,
    );
  }

  const q = questions[i];
  const msLeft = Math.max(0, Q_SECONDS * 1000 - (now - qStart.current));
  const revealed = phase === "reveal";
  return shell(
    <>
      <Header />
      <div
        className="mx-5 mt-5 h-2 rounded-full overflow-hidden"
        style={{ background: "var(--fill-2)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${revealed ? 0 : (msLeft / (Q_SECONDS * 1000)) * 100}%`,
            background: msLeft < 3000 ? "var(--pink)" : "var(--lime)",
            transition: "width 100ms linear",
          }}
        />
      </div>
      {i === questions.length - 1 && (
        <p className="text-center mt-3">
          <span className="sticker pink">last one · double points</span>
        </p>
      )}
      <h2
        className="px-6 mt-6 text-center font-semibold text-cream"
        style={{ fontSize: 21, lineHeight: 1.35 }}
      >
        {q.q}
      </h2>
      <div className="px-5 mt-7 grid gap-3">
        {q.options.map((opt, k) => {
          const isRight = revealed && k === q.answer;
          const myWrong = revealed && mine[i]?.choice === k && k !== q.answer;
          const theyPicked = revealed && theirs[i]?.choice === k;
          const iPicked = mine[i]?.choice === k;
          return (
            <button
              key={opt}
              disabled={!!mine[i] || revealed}
              onClick={() => pick(k)}
              className="relative w-full rounded-2xl px-5 py-4 text-left font-semibold"
              style={{
                background: isRight
                  ? "var(--lime)"
                  : myWrong
                    ? "var(--pink)"
                    : iPicked
                      ? "var(--fill-2)"
                      : "var(--fill)",
                color: isRight || myWrong ? "var(--on-accent)" : "var(--ink)",
                border: "2px solid var(--edge)",
              }}
            >
              {opt}
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                {iPicked && revealed && <Avatar src={me.avatar} initials={me.initials} size={24} />}
                {theyPicked && (
                  <Avatar src={them.avatar} initials={them.initials} color={them.color} size={24} />
                )}
              </span>
            </button>
          );
        })}
      </div>
      {mine[i] && !revealed && (
        <p className="text-center meta mt-4">
          {theirs[i] ? "Both in…" : `Waiting for ${them.name.split(" ")[0]}…`}
        </p>
      )}
      {revealed && mine[i] && (
        <p
          className="text-center mt-4 font-bold"
          style={{ color: mine[i].correct ? "var(--lime)" : "var(--pink)" }}
        >
          {mine[i].correct ? `+${mine[i].points}` : "No points"}
        </p>
      )}
    </>,
  );
}

function Side({
  p,
  points,
  answered,
  active,
  right,
}: {
  p: Player;
  points: number;
  answered: boolean;
  active: boolean;
  right?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
      <span className="relative">
        <Avatar src={p.avatar} initials={p.initials} color={p.color} size={40} />
        {active && answered && (
          <span
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center pop"
            style={{
              background: "var(--lime)",
              color: "var(--on-accent)",
              border: "2px solid var(--edge)",
            }}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="display tabular-nums" style={{ fontSize: 22 }}>
        {points}
      </span>
    </div>
  );
}
