import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, PULSE_COLORS, TODAYS_PULSES } from "@/lib/data";

export const Route = createFileRoute("/app/pulse")({
  component: Pulse,
});

const EMOJIS = ["😮‍💨","🥲","🔥","🫠","✨","☕️","🌧️","💫"];

type Stage = "compose" | "sent" | "feed";

function Pulse() {
  const [stage, setStage] = useState<Stage>("compose");
  const [word, setWord] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  if (stage === "compose") {
    return (
      <div className="min-h-[calc(100vh-7rem)] px-6 pt-16 flex flex-col">
        <h1 className="text-3xl font-bold leading-tight text-center">
          How are you actually doing?
        </h1>

        <div className="mt-10">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value.split(" ")[0].slice(0, 14))}
            placeholder="one word"
            className="w-full text-center text-2xl font-semibold bg-transparent outline-none border-b border-border pb-3 placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="mt-8 flex justify-center gap-2 flex-wrap">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`h-12 w-12 rounded-2xl text-2xl flex items-center justify-center transition ${
                emoji === e ? "bg-surface border border-primary" : "bg-surface/60 border border-border"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-2.5 flex-wrap">
          {PULSE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={c}
              className="h-10 w-10 rounded-full transition"
              style={{
                background: c,
                outline: color === c ? "2px solid var(--foreground)" : "none",
                outlineOffset: 3,
              }}
            />
          ))}
        </div>

        <div className="mt-auto pt-12">
          <button
            disabled={!word || !emoji || !color}
            onClick={() => setStage("sent")}
            className="w-full rounded-full bg-primary text-primary-foreground py-4 font-semibold disabled:opacity-40 hover:bg-primary-glow transition shadow-[0_10px_30px_-10px_var(--primary)]"
          >
            Send Pulse
          </button>
        </div>
      </div>
    );
  }

  if (stage === "sent") {
    return (
      <div className="min-h-[calc(100vh-7rem)] flex flex-col items-center justify-center px-6 text-center">
        <div className="relative h-40 w-40 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" style={{ animationDelay: "0.6s" }} />
          <span className="h-20 w-20 rounded-full bg-primary shadow-[0_0_60px_var(--primary)]" />
        </div>
        <p className="mt-10 text-xl font-semibold">Your 25 can feel you.</p>
        <button
          onClick={() => setStage("feed")}
          className="mt-10 text-sm text-primary font-semibold"
        >
          See today's pulse →
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-bold">Today's Pulse</h1>
      <p className="text-xs text-muted-foreground mt-1">A small snapshot of your 25 right now.</p>
      <ul className="mt-5 space-y-2">
        {TODAYS_PULSES.map((p) => {
          const f = FRIENDS.find((x) => x.id === p.friendId)!;
          return (
            <li key={p.friendId} className="flex items-center gap-3 rounded-2xl bg-card border border-border px-3 py-2.5">
              <Avatar initials={f.initials} color={f.color} size={40} />
              <div className="flex-1">
                <div className="text-sm font-semibold">{f.name}</div>
                <div className="text-xs text-muted-foreground">{p.word}</div>
              </div>
              <span className="text-xl">{p.emoji}</span>
              <span className="h-3 w-3 rounded-full" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
            </li>
          );
        })}
      </ul>
      <button
        onClick={() => { setStage("compose"); setWord(""); setEmoji(null); setColor(null); }}
        className="mt-6 w-full rounded-full border border-border py-3 text-sm font-medium text-muted-foreground"
      >
        Update your pulse
      </button>
    </div>
  );
}
