import { useEffect, useState } from "react";
import { X, Crown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, ME, TRIVIA_PACKS, TRIVIA_QUESTIONS, type TriviaPack } from "@/lib/data";
import { social } from "@/lib/social";

export function TriviaGame({ pack, onClose }: { pack: TriviaPack; onClose: () => void }) {
  const questions = TRIVIA_QUESTIONS[pack.id] ?? [];
  const opponent = FRIENDS[1]; // Priya
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [time, setTime] = useState(10);
  const [meScore, setMeScore] = useState(0);
  const [opScore, setOpScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[idx];

  // Your best trivia score this week goes on the leaderboard.
  useEffect(() => {
    if (done) social.recordScore("trivia", meScore);
  }, [done, meScore]);

  useEffect(() => {
    if (revealed || done) return;
    if (time <= 0) { reveal(null); return; }
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [time, revealed, done]);

  function pick(i: number) {
    if (revealed) return;
    setPicked(i);
    reveal(i);
  }

  function reveal(i: number | null) {
    setRevealed(true);
    const correct = i === q.answer;
    if (correct) setMeScore((s) => s + 1);
    // simulated opponent
    if (Math.random() > 0.45) setOpScore((s) => s + 1);
    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true);
      else {
        setIdx((n) => n + 1);
        setPicked(null);
        setRevealed(false);
        setTime(10);
      }
    }, 1500);
  }

  if (done) {
    const won = meScore > opScore;
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 animate-soft-in">
        <button onClick={onClose} className="absolute top-5 right-5 text-muted-foreground"><X size={22} /></button>
        <div className="text-6xl mb-2 animate-soft-in">
          {won ? <Crown size={64} className="text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" /> : "🥈"}
        </div>
        <h2 className="text-2xl font-bold">{won ? "You won!" : meScore === opScore ? "It's a tie" : `${opponent.name} won`}</h2>
        <p className="text-sm text-muted-foreground mt-1">{pack.emoji} {pack.name}</p>

        <div className="mt-8 flex items-center gap-6">
          <div className="flex flex-col items-center">
            <Avatar src={ME.avatar} initials="YO" size={68} ring={won ? "active" : "none"} />
            <span className="mt-2 text-sm font-semibold">You</span>
            <span className="text-2xl font-black text-primary tabular-nums">{meScore}</span>
          </div>
          <span className="text-muted-foreground text-xl">vs</span>
          <div className="flex flex-col items-center">
            <Avatar src={opponent.avatar} initials={opponent.initials} size={68} ring={!won && opScore > meScore ? "active" : "none"} />
            <span className="mt-2 text-sm font-semibold">{opponent.name}</span>
            <span className="text-2xl font-black text-primary tabular-nums">{opScore}</span>
          </div>
        </div>

        <div className="mt-8 card-premium accent-thought p-4 w-full max-w-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Shareable</p>
          <p className="mt-1 text-sm">
            "I {won ? "beat" : "played"} {opponent.name} in {pack.name} on <span className="font-bold text-primary">25</span> · {meScore}/{questions.length} vs {opScore}/{questions.length}"
          </p>
          <button className="mt-3 w-full fab-gradient text-white rounded-full py-2.5 text-sm font-bold">
            Share to Instagram
          </button>
        </div>

        <div className="mt-4 flex gap-2 w-full max-w-sm">
          <button onClick={onClose} className="flex-1 rounded-full bg-surface-2 border border-border py-3 text-sm font-semibold">
            Try different pack
          </button>
          <button
            onClick={() => { setIdx(0); setMeScore(0); setOpScore(0); setDone(false); setPicked(null); setRevealed(false); setTime(10); }}
            className="flex-1 rounded-full fab-gradient text-white py-3 text-sm font-bold"
          >
            Challenge again
          </button>
        </div>
      </div>
    );
  }

  const ringPct = (time / 10) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-soft-in">
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{pack.emoji} {pack.name}</span>
        <button onClick={onClose} className="text-muted-foreground"><X size={22} /></button>
      </header>

      {/* Scoreboard */}
      <div className="px-5 mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar src={ME.avatar} initials="YO" size={36} />
          <span className="text-sm font-semibold">{meScore}</span>
        </div>
        <div className="text-xs text-muted-foreground">Q {idx + 1} / {questions.length}</div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{opScore}</span>
          <Avatar src={opponent.avatar} initials={opponent.initials} size={36} />
        </div>
      </div>

      {/* Timer ring */}
      <div className="mt-6 flex justify-center">
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#22222A" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke="#7F77DD" strokeWidth="3"
              strokeDasharray={`${ringPct} 100`}
              pathLength={100}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 1s linear", filter: "drop-shadow(0 0 6px rgba(127,119,221,0.6))" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-primary">
            {time}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="px-6 mt-6 text-center">
        <h3 className="text-xl font-bold leading-snug">{q.q}</h3>
      </div>

      {/* Options */}
      <div className="px-5 mt-7 grid gap-3">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          let bg = "rgba(255,255,255,0.04)";
          let border = "var(--border)";
          let color = "var(--foreground)";
          if (revealed) {
            if (isAnswer) { bg = "rgba(29,158,117,0.20)"; border = "#1D9E75"; color = "#1D9E75"; }
            else if (isPicked) { bg = "rgba(224,76,76,0.20)"; border = "#E04C4C"; color = "#E04C4C"; }
          }
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => pick(i)}
              className="rounded-2xl py-4 px-4 text-left text-[15px] font-semibold border transition active:scale-[0.98]"
              style={{ background: bg, borderColor: border, color }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {revealed && (
        <p className="mt-auto mb-8 text-center text-xs text-muted-foreground animate-soft-in">
          Waiting for {opponent.name}…
        </p>
      )}
    </div>
  );
}
