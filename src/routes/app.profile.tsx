import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ME, SEATS_FILLED, SEATS_TOTAL, FRIENDSHIP_SCORE } from "@/lib/data";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
});

const ITEMS = [
  { label: "Memory Capsules", note: "Save a Moment forever." },
  { label: "Privacy", note: "Everything here is private. Promise." },
  { label: "Notifications", note: "Only when it matters." },
  { label: "Reshuffle your 25", note: "It's allowed. Encouraged, even." },
];

function FriendshipScoreCard() {
  const pct = (FRIENDSHIP_SCORE.value / FRIENDSHIP_SCORE.max) * 100;
  return (
    <div className="glass-strong p-5 mt-7" style={{ boxShadow: "0 0 32px rgba(247,168,160,0.35)" }}>
      <div className="flex items-center gap-2">
        <Sparkles size={14} style={{ color: "#F7A8A0" }} />
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: "#F7A8A0" }}>
          Friendship Score
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="font-display font-black tabular-nums text-glow-coral"
          style={{ fontSize: 56, color: "#FFFFFF", lineHeight: 1 }}
        >
          {FRIENDSHIP_SCORE.value}
        </span>
        <span className="text-base font-semibold text-white/70"> / {FRIENDSHIP_SCORE.max}</span>
      </div>
      <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.18)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #F7A8A0, #FFC4BC)",
            boxShadow: "0 0 14px rgba(247,168,160,0.85)",
          }}
        />
      </div>
      <p className="text-xs text-white/70 mt-3 leading-snug">
        Grows when you play trivia, send capsules, or surface a Remember When.
        <span className="text-white"> +24 this week.</span>
      </p>
    </div>
  );
}

function Profile() {
  return (
    <div className="px-5 pt-8 pb-4">
      <div className="flex flex-col items-center text-center">
        <div className="ring-active inline-block">
          <div className="rounded-full p-[3px]" style={{ background: "#2B8AC4" }}>
            <Avatar src={ME.avatar} initials={ME.initials} size={92} />
          </div>
        </div>
        <h1 className="mt-4 font-display text-3xl font-black">You</h1>
        <p className="text-xs text-white/75 mt-1">
          {SEATS_FILLED} of {SEATS_TOTAL} seats filled
        </p>
      </div>

      <FriendshipScoreCard />

      <div className="mt-6 glass overflow-hidden">
        {ITEMS.map((i, idx) => (
          <button
            key={i.label}
            className="w-full text-left px-4 py-4 hover:bg-white/10 transition flex items-center"
            style={{ borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.18)" }}
          >
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{i.label}</div>
              <div className="text-xs text-white/70 mt-0.5">{i.note}</div>
            </div>
            <ChevronRight size={16} className="text-white/60" />
          </button>
        ))}
      </div>

      <Link
        to="/"
        className="block text-center text-xs text-white/70 mt-8 underline-offset-4 hover:underline"
      >
        Sign out
      </Link>
      <p className="text-center text-[10px] text-white/55 mt-6">
        No followers. No likes. Just 25 humans.
      </p>
    </div>
  );
}
