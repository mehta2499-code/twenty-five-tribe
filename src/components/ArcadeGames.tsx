import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Calculator,
  Eye,
  Palette,
  Repeat,
  Target,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { Confetti, FriendPicker, Toast, buzz } from "@/components/SocialUI";
import { friendById, social } from "@/lib/social";
import {
  TRIES,
  best,
  dayRanking,
  finishTry,
  startTry,
  today,
  useDaily,
  type DailyId,
} from "@/lib/daily";

type RoundProps = { onFinish: (score: number) => void; onClose: () => void };

export const GAMES: Record<
  DailyId,
  {
    name: string;
    emoji: string;
    Icon: LucideIcon;
    tone: string;
    blurb: string;
    how: string;
    unit: string;
    Round: (p: RoundProps) => React.ReactElement;
  }
> = {
  "tap-rush": {
    name: "Tap Rush",
    emoji: "🎯",
    Icon: Target,
    tone: "var(--pink)",
    blurb: "20 seconds. Tap the dot wherever it lands.",
    how: "The clock starts on your first tap. Every hit is a point.",
    unit: "taps",
    Round: TapRush,
  },
  "quick-math": {
    name: "Quick Maths",
    emoji: "🧮",
    Icon: Calculator,
    tone: "var(--sky)",
    blurb: "30 seconds of mental maths. No calculators, Sharma ji.",
    how: "Pick the right answer. One point each.",
    unit: "correct",
    Round: QuickMath,
  },
  "colour-clash": {
    name: "Colour Clash",
    emoji: "🎨",
    Icon: Palette,
    tone: "var(--sun)",
    blurb: "Does the word match its colour? Your brain will lie to you.",
    how: "Match if the word and its ink colour agree. 30 seconds.",
    unit: "correct",
    Round: ColourClash,
  },
  "pair-up": {
    name: "Pair Up",
    emoji: "🃏",
    Icon: Brain,
    tone: "var(--lime)",
    blurb: "Find all 8 pairs. Time left is bonus points.",
    how: "10 points a pair, plus every second left on the clock.",
    unit: "points",
    Round: PairUp,
  },
  "odd-one-out": {
    name: "Odd One Out",
    emoji: "👀",
    Icon: Eye,
    tone: "var(--pink)",
    blurb: "One emoji is different. Find it. Then again. Faster.",
    how: "Tap the odd one. The grid gets bigger. Wrong taps cost a point. 30 seconds.",
    unit: "found",
    Round: OddOneOut,
  },
  pattern: {
    name: "Pattern Recall",
    emoji: "🧠",
    Icon: Repeat,
    tone: "var(--sky)",
    blurb: "Watch the pads light up. Repeat it. It keeps getting longer.",
    how: "Repeat the sequence. One mistake and it's over. Score = longest pattern.",
    unit: "long",
    Round: Pattern,
  },
  reflex: {
    name: "Reflex",
    emoji: "⚡",
    Icon: Timer,
    tone: "var(--sun)",
    blurb: "Wait for green. Tap. Jump early and you get nothing.",
    how: "5 rounds. The faster you tap after it turns green, the more points.",
    unit: "points",
    Round: Reflex,
  },
};

// ---------- Shared pieces ----------

function GameFrame({
  title,
  score,
  stat,
  onClose,
  children,
}: {
  title: string;
  score: number | string;
  stat: { label: string; value: number | string; warn?: boolean };
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
            <p className="font-display text-cream tabular-nums" style={{ fontSize: 44, lineHeight: 1 }}>
              {score}
            </p>
          </div>
          <div className="text-right">
            <p className="label-caps">{stat.label}</p>
            <p
              className="font-display tabular-nums"
              style={{ fontSize: 44, lineHeight: 1, color: stat.warn ? "var(--pink)" : "var(--ink)" }}
            >
              {stat.value}
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

/** Calls onFinish once, a beat after the round ends. */
function useFinish(over: boolean, score: number, onFinish: (n: number) => void) {
  const done = useRef(false);
  useEffect(() => {
    if (!over || done.current) return;
    done.current = true;
    const t = setTimeout(() => onFinish(score), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);
}

function TimeUp() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="display pop" style={{ fontSize: 56 }}>
        Time! ⏰
      </p>
    </div>
  );
}

// ---------- Tap Rush ----------
function TapRush({ onFinish, onClose }: RoundProps) {
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const left = useCountdown(20, started && !over, () => setOver(true));
  useFinish(over, score, onFinish);

  const hit = () => {
    if (over) return;
    if (!started) setStarted(true);
    setScore((n) => n + 1);
    setPos({ x: 10 + Math.random() * 80, y: 10 + Math.random() * 80 });
  };

  return (
    <GameFrame title="tap rush" score={score} stat={{ label: "time", value: left, warn: left <= 5 }} onClose={onClose}>
      {over ? (
        <TimeUp />
      ) : (
        <div className="relative flex-1 mt-6 rounded-3xl table-felt overflow-hidden">
          {!started && (
            <p className="absolute inset-x-0 top-6 text-center text-cool font-semibold">
              Tap the dot to start.
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
              background: "radial-gradient(circle, #fff 0%, var(--lime) 45%, #6E9A2A 100%)",
              border: "2px solid var(--edge)",
            }}
          />
        </div>
      )}
    </GameFrame>
  );
}

// ---------- Quick Maths ----------
function makeQuestion() {
  const op = Math.random() < 0.6 ? "+" : "×";
  const a = op === "+" ? 5 + Math.floor(Math.random() * 60) : 2 + Math.floor(Math.random() * 11);
  const b = op === "+" ? 5 + Math.floor(Math.random() * 60) : 2 + Math.floor(Math.random() * 11);
  const answer = op === "+" ? a + b : a * b;
  const opts = new Set([answer]);
  while (opts.size < 4) opts.add(answer + (Math.floor(Math.random() * 11) - 5 || 7));
  return { text: `${a} ${op} ${b}`, answer, options: [...opts].sort(() => Math.random() - 0.5) };
}

function QuickMath({ onFinish, onClose }: RoundProps) {
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [q, setQ] = useState(makeQuestion);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const left = useCountdown(30, !over, () => setOver(true));
  useFinish(over, score, onFinish);

  const pick = (n: number) => {
    const right = n === q.answer;
    if (right) setScore((s) => s + 1);
    else buzz(30);
    setFlash(right ? "right" : "wrong");
    setTimeout(() => setFlash(null), 250);
    setQ(makeQuestion());
  };

  return (
    <GameFrame title="quick maths" score={score} stat={{ label: "time", value: left, warn: left <= 5 }} onClose={onClose}>
      {over ? (
        <TimeUp />
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <p
            className="display text-center tabular-nums"
            style={{
              fontSize: 56,
              transition: "color 200ms",
              color: flash === "right" ? "var(--lime)" : flash === "wrong" ? "var(--pink)" : "var(--ink)",
            }}
          >
            {q.text}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-10">
            {q.options.map((n) => (
              <button
                key={n}
                onClick={() => pick(n)}
                className="card py-5 display tabular-nums active:scale-95 transition"
                style={{ fontSize: 26 }}
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

// ---------- Colour Clash ----------
const CLASH_COLOURS = [
  { name: "Red", value: "#E5486F" },
  { name: "Blue", value: "#63B8E6" },
  { name: "Yellow", value: "#E8BE55" },
  { name: "Green", value: "#8FD05A" },
];

function clashRound() {
  const word = CLASH_COLOURS[Math.floor(Math.random() * CLASH_COLOURS.length)];
  const match = Math.random() < 0.45;
  const ink = match ? word : CLASH_COLOURS.filter((c) => c !== word)[Math.floor(Math.random() * 3)];
  return { word: word.name, ink: ink.value, match };
}

function ColourClash({ onFinish, onClose }: RoundProps) {
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [q, setQ] = useState(clashRound);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const left = useCountdown(30, !over, () => setOver(true));
  useFinish(over, score, onFinish);

  const answer = (saysMatch: boolean) => {
    const right = saysMatch === q.match;
    if (right) setScore((n) => n + 1);
    else buzz(30);
    setFlash(right ? "right" : "wrong");
    setTimeout(() => setFlash(null), 220);
    setQ(clashRound());
  };

  return (
    <GameFrame title="colour clash" score={score} stat={{ label: "time", value: left, warn: left <= 5 }} onClose={onClose}>
      {over ? (
        <TimeUp />
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-center meta">Does the word match the colour it's written in?</p>
          <div
            className="mt-6 card flex items-center justify-center"
            style={{
              minHeight: 180,
              borderColor: flash === "right" ? "var(--lime)" : flash === "wrong" ? "var(--pink)" : undefined,
            }}
          >
            <span className="display" style={{ fontSize: 64, color: q.ink }} aria-label={`The word ${q.word} written in a colour`}>
              {q.word}
            </span>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button onClick={() => answer(false)} className="btn-secondary" style={{ minHeight: 64, fontSize: 18 }}>
              No match
            </button>
            <button onClick={() => answer(true)} className="btn-primary" style={{ minHeight: 64, fontSize: 18 }}>
              Match
            </button>
          </div>
        </div>
      )}
    </GameFrame>
  );
}

// ---------- Pair Up ----------
const PAIR_FACES = ["🍕", "🐶", "🫖", "🎬", "🌶️", "🏖️", "🦉", "🎧"];

function deal() {
  return [...PAIR_FACES, ...PAIR_FACES]
    .map((face, i) => ({ id: i, face, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort);
}

function PairUp({ onFinish, onClose }: RoundProps) {
  const [cards] = useState(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const left = useCountdown(60, started && !over, () => setOver(true));
  const pairsScore = found.length * 10;
  const score = finalScore ?? pairsScore;
  useFinish(over, score, onFinish);

  useEffect(() => {
    if (found.length === PAIR_FACES.length && !over) {
      setFinalScore(pairsScore + left);
      setOver(true);
    }
  }, [found.length, over, pairsScore, left]);

  const flip = (i: number) => {
    if (over || open.includes(i) || found.includes(cards[i].face) || open.length === 2) return;
    if (!started) setStarted(true);
    buzz(6);
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (cards[a].face === cards[b].face) {
        setTimeout(() => {
          setFound((f) => [...f, cards[a].face]);
          setOpen([]);
        }, 250);
      } else {
        setTimeout(() => setOpen([]), 650);
      }
    }
  };

  return (
    <GameFrame title="pair up" score={score} stat={{ label: "time", value: left, warn: left <= 10 }} onClose={onClose}>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-center meta mb-4">
          {over ? "Done!" : started ? `${found.length} of 8 pairs` : "Tap a card to start the clock."}
        </p>
        <div className="grid grid-cols-4 gap-2.5">
          {cards.map((c, i) => {
            const shown = open.includes(i) || found.includes(c.face);
            const done = found.includes(c.face);
            return (
              <button
                key={c.id}
                onClick={() => flip(i)}
                aria-label={shown ? c.face : "Hidden card"}
                className="aspect-square rounded-2xl flex items-center justify-center"
                style={{
                  border: "2px solid var(--edge)",
                  boxShadow: done ? "none" : "var(--pop)",
                  background: shown ? (done ? "var(--fill)" : "var(--sun)") : "var(--fill-2)",
                  opacity: done ? 0.55 : 1,
                  fontSize: 30,
                  transition: "background-color 160ms",
                }}
              >
                {shown ? c.face : <span className="text-faint" style={{ fontSize: 18 }}>?</span>}
              </button>
            );
          })}
        </div>
      </div>
    </GameFrame>
  );
}

// ---------- Odd One Out ----------
const ODD_PAIRS = [
  ["😀", "😃"],
  ["🐶", "🐕"],
  ["🍎", "🍅"],
  ["🌕", "🌝"],
  ["❤️", "🧡"],
  ["⭐", "🌟"],
  ["🙂", "🙃"],
  ["🍩", "🍪"],
  ["🐼", "🐨"],
  ["🌸", "🌺"],
  ["😺", "😸"],
  ["🍋", "🍌"],
  ["🫠", "😵"],
  ["🦊", "🐯"],
];

function oddBoard(level: number) {
  const size = Math.min(6, 3 + Math.floor(level / 3));
  const [a, b] = ODD_PAIRS[Math.floor(Math.random() * ODD_PAIRS.length)];
  const flip = Math.random() < 0.5;
  return {
    size,
    common: flip ? a : b,
    odd: flip ? b : a,
    at: Math.floor(Math.random() * size * size),
  };
}

function OddOneOut({ onFinish, onClose }: RoundProps) {
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [board, setBoard] = useState(() => oddBoard(0));
  const [shake, setShake] = useState(false);
  const left = useCountdown(30, !over, () => setOver(true));
  useFinish(over, score, onFinish);

  const tap = (i: number) => {
    if (over) return;
    if (i === board.at) {
      buzz(8);
      const next = score + 1;
      setScore(next);
      setBoard(oddBoard(next));
    } else {
      buzz(40);
      setScore((n) => Math.max(0, n - 1));
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
  };

  return (
    <GameFrame title="odd one out" score={score} stat={{ label: "time", value: left, warn: left <= 5 }} onClose={onClose}>
      {over ? (
        <TimeUp />
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-center meta mb-4">Tap the one that's different.</p>
          <div
            className={`card p-3 grid gap-1.5 ${shake ? "wiggle" : ""}`}
            style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)` }}
          >
            {Array.from({ length: board.size * board.size }).map((_, i) => (
              <button
                key={`${score}-${i}`}
                onClick={() => tap(i)}
                className="aspect-square rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: "var(--fill)", fontSize: board.size > 4 ? 26 : 34 }}
                aria-label={`Emoji ${i + 1}`}
              >
                {i === board.at ? board.odd : board.common}
              </button>
            ))}
          </div>
        </div>
      )}
    </GameFrame>
  );
}

// ---------- Pattern Recall ----------
const PADS = [
  { tone: "var(--lime)", label: "Green pad" },
  { tone: "var(--pink)", label: "Pink pad" },
  { tone: "var(--sky)", label: "Blue pad" },
  { tone: "var(--sun)", label: "Yellow pad" },
];

function Pattern({ onFinish, onClose }: RoundProps) {
  const [seq, setSeq] = useState<number[]>(() => [Math.floor(Math.random() * 4)]);
  const [lit, setLit] = useState<number | null>(null);
  const [showing, setShowing] = useState(true);
  const [step, setStep] = useState(0);
  const [over, setOver] = useState(false);
  const best = seq.length - 1;
  useFinish(over, best, onFinish);

  // Play the sequence back.
  useEffect(() => {
    if (over) return;
    setShowing(true);
    const speed = Math.max(260, 560 - seq.length * 25);
    const timers: ReturnType<typeof setTimeout>[] = [];
    seq.forEach((p, i) => {
      timers.push(setTimeout(() => setLit(p), 700 + i * speed));
      timers.push(setTimeout(() => setLit(null), 700 + i * speed + speed * 0.6));
    });
    timers.push(
      setTimeout(() => {
        setShowing(false);
        setStep(0);
      }, 700 + seq.length * speed),
    );
    return () => timers.forEach(clearTimeout);
  }, [seq, over]);

  const press = (p: number) => {
    if (showing || over) return;
    setLit(p);
    setTimeout(() => setLit(null), 160);
    if (p !== seq[step]) {
      buzz(60);
      setOver(true);
      return;
    }
    buzz(6);
    if (step + 1 === seq.length) {
      setShowing(true);
      setTimeout(() => setSeq((s) => [...s, Math.floor(Math.random() * 4)]), 450);
    } else setStep(step + 1);
  };

  return (
    <GameFrame title="pattern recall" score={best} stat={{ label: "length", value: seq.length }} onClose={onClose}>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-center font-bold text-cream mb-5" aria-live="polite">
          {over ? "Oops. That's the one 💥" : showing ? "Watch…" : "Your turn"}
        </p>
        <div className="grid grid-cols-2 gap-3 mx-auto w-full max-w-[320px]">
          {PADS.map((pad, i) => (
            <button
              key={i}
              onClick={() => press(i)}
              aria-label={pad.label}
              className="aspect-square rounded-3xl transition-all duration-100"
              style={{
                background: pad.tone,
                border: "2px solid var(--edge)",
                boxShadow: lit === i ? `0 0 0 4px #fff, 0 0 34px ${pad.tone}` : "var(--pop)",
                opacity: lit === i ? 1 : 0.45,
                transform: lit === i ? "scale(1.04)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>
    </GameFrame>
  );
}

// ---------- Reflex ----------
const REFLEX_ROUNDS = 5;
const reflexPoints = (ms: number) => Math.max(0, Math.min(100, Math.round(100 - (ms - 180) / 4)));

function Reflex({ onFinish, onClose }: RoundProps) {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"ready" | "wait" | "go" | "early" | "hit">("ready");
  const [last, setLast] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFinish(over, score, onFinish);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const next = () => {
    if (round >= REFLEX_ROUNDS) return setOver(true);
    setRound((r) => r + 1);
    arm();
  };
  const arm = () => {
    setPhase("wait");
    timer.current = setTimeout(
      () => {
        goAt.current = performance.now();
        setPhase("go");
      },
      1200 + Math.random() * 2600,
    );
  };
  const tap = () => {
    if (over) return;
    if (phase === "ready") return arm();
    if (phase === "wait") {
      if (timer.current) clearTimeout(timer.current);
      buzz(60);
      setLast(null);
      setPhase("early");
      return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now() - goAt.current);
      buzz(10);
      setLast(ms);
      setScore((s) => s + reflexPoints(ms));
      setPhase("hit");
      return;
    }
    next();
  };

  const bg =
    phase === "go" ? "var(--lime)" : phase === "early" ? "var(--pink)" : phase === "wait" ? "#2A2438" : "var(--fill)";
  const text =
    phase === "ready"
      ? "Tap to start"
      : phase === "wait"
        ? "Wait for green…"
        : phase === "go"
          ? "TAP!"
          : phase === "early"
            ? "Too soon 😬 0 points. Tap to go on."
            : `${last} ms · +${reflexPoints(last ?? 999)}. Tap to go on.`;

  return (
    <GameFrame
      title="reflex"
      score={score}
      stat={{ label: "round", value: `${Math.min(round, REFLEX_ROUNDS)}/${REFLEX_ROUNDS}` }}
      onClose={onClose}
    >
      <button
        onPointerDown={tap}
        className="flex-1 mt-6 rounded-3xl flex items-center justify-center px-6 text-center select-none"
        style={{
          background: bg,
          border: "2px solid var(--edge)",
          boxShadow: "var(--pop)",
          color: phase === "go" || phase === "early" ? "var(--on-accent)" : "var(--ink)",
          transition: "background-color 60ms",
        }}
      >
        <span className="display" style={{ fontSize: phase === "go" ? 64 : 24 }}>
          {over ? "Done ⚡" : text}
        </span>
      </button>
    </GameFrame>
  );
}

// ---------- Daily runner: tries, best score, results ----------

export function DailyRunner({ game, onClose }: { game: DailyId; onClose: () => void }) {
  const d = useDaily();
  const g = GAMES[game];
  const day = today();
  const tries = d.board[day]?.me ?? [];
  const left = TRIES - tries.length;
  const [view, setView] = useState<"intro" | "play" | "result">("intro");
  const [session, setSession] = useState<{ day: string; tryNo: number } | null>(null);
  const [last, setLast] = useState(0);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [party, setParty] = useState(0);

  const ranking = dayRanking(d, day);
  const mine = ranking.find((r) => r.id === "me");

  const practiceKey = `tf.practice.${day}`;
  const [practiced, setPracticed] = useState(() => {
    try {
      return localStorage.getItem(practiceKey) === "1";
    } catch {
      return false;
    }
  });

  const begin = async (practice: boolean) => {
    if (practice) {
      // One practice round per day.
      if (practiced) return;
      setPracticed(true);
      try {
        localStorage.setItem(practiceKey, "1");
      } catch {
        // ignore
      }
      setSession(null);
    } else {
      setBusy(true);
      try {
        setSession(await startTry());
      } catch (e) {
        setToast((e as Error).message);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setRound((r) => r + 1);
    setView("play");
  };

  const finish = async (score: number) => {
    setLast(score);
    setView("result");
    if (!session) return;
    try {
      await finishTry(session.day, score);
    } catch (e) {
      setToast((e as Error).message);
    }
    // Best try today: celebrate.
    if (score >= Math.max(0, ...tries.filter((t) => t >= 0))) {
      setParty((n) => n + 1);
      buzz(40);
    }
  };

  if (view === "play") {
    const R = g.Round;
    return <R key={round} onFinish={finish} onClose={onClose} />;
  }

  const Dots = () => (
    <div className="flex justify-center gap-2" aria-label={`${tries.length} of ${TRIES} tries used`}>
      {Array.from({ length: TRIES }).map((_, i) => (
        <span
          key={i}
          className="w-4 h-4 rounded-full"
          style={{
            border: "2px solid var(--edge)",
            background: i < tries.length ? "var(--lime)" : "var(--fill-2)",
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background animate-soft-in overflow-y-auto">
      <div className="mx-auto w-full max-w-md min-h-full flex flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
        <header className="flex items-center justify-between">
          <span className="sticker sun" style={{ transform: "rotate(-3deg)" }}>
            today's game
          </span>
          <button onClick={onClose} aria-label="Close" className="text-cool">
            <X size={22} />
          </button>
        </header>

        {view === "intro" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
              style={{ background: g.tone, border: "2px solid var(--edge)", boxShadow: "var(--pop)", transform: "rotate(-4deg)" }}
            >
              {g.emoji}
            </span>
            <h1 className="title mt-5">{g.name}</h1>
            <p className="text-cool mt-2 max-w-[19rem]" style={{ fontSize: 15, lineHeight: 1.5 }}>
              {g.how}
            </p>
            <div className="mt-6">
              <Dots />
              <p className="meta mt-2">
                {left > 0 ? `${left} ${left === 1 ? "try" : "tries"} left today` : "All tries used today"}
              </p>
            </div>
            {tries.length > 0 && (
              <div className="mt-5 card px-5 py-3">
                <p className="font-bold text-cream">
                  Your best: {best(tries)} {mine ? `· #${mine.rank} of ${ranking.length}` : ""}
                </p>
                <p className="meta mt-0.5">Tries: {tries.map((t) => (t < 0 ? "quit" : t)).join(" · ")}</p>
              </div>
            )}
            <div className="w-full mt-8 grid gap-3">
              {left > 0 ? (
                <>
                  <button onClick={() => begin(false)} disabled={busy} className="btn-primary w-full" style={{ minHeight: 56, fontSize: 18 }}>
                    {busy ? "…" : `Start try ${tries.length + 1} of ${TRIES}`}
                  </button>
                  <p className="meta">
                    {tries.length > 0
                      ? "Only your best try counts. Go again and beat it 💪"
                      : "A try counts the moment you start. Quitting = 0."}
                  </p>
                </>
              ) : (
                <>
                  {!practiced && (
                    <button onClick={() => begin(true)} className="btn-secondary w-full" style={{ minHeight: 52 }}>
                      Practice once (doesn't count)
                    </button>
                  )}
                  <p className="meta">Come back at midnight for tomorrow's game.</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="label-caps">
              {session ? `try ${session.tryNo} of ${TRIES}` : "practice · didn't count"}
            </p>
            <p className="display tabular-nums mt-2 pop" style={{ fontSize: 96, lineHeight: 1 }}>
              {last}
            </p>
            <p className="meta">{g.unit}</p>
            {session && (
              <>
                <div className="mt-6">
                  <Dots />
                </div>
                <div className="mt-5 card px-5 py-3">
                  <p className="font-bold text-cream text-lg">Today's best: {best(tries)}</p>
                  <p className="meta mt-0.5">
                    {mine
                      ? mine.rank === 1
                        ? `👑 #1 of ${ranking.length} at your table. For now.`
                        : `#${mine.rank} of ${ranking.length} at your table today`
                      : "You're on the board."}
                  </p>
                </div>
              </>
            )}
            <div className="w-full mt-8 grid gap-3">
              {session && left > 0 && (
                <button onClick={() => setView("intro")} className="btn-primary w-full" style={{ minHeight: 52 }}>
                  Another try ({left} left)
                </button>
              )}

              <button onClick={() => setChallenging(true)} className="btn-secondary w-full" style={{ minHeight: 52 }}>
                Trash talk someone 😏
              </button>
              <button onClick={onClose} className="btn-quiet w-full">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      {challenging && (
        <FriendPicker
          title="who needs to hear this?"
          cta="Send"
          single
          onClose={() => setChallenging(false)}
          onPick={([id]) => {
            social.sendMessage(
              id,
              `Today's game is ${g.name} ${g.emoji}. My best: ${best(tries) || last}. Beat that 😏`,
            );
            setChallenging(false);
            setToast(`Sent to ${friendById(id)?.name.split(" ")[0]}`);
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={party} />
    </div>
  );
}
