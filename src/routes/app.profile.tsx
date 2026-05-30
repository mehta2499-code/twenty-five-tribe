import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ME, SEATS_FILLED, SEATS_TOTAL, FRIENDSHIP_SCORE } from "@/lib/data";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
});

function spaced(s: string) { return s.toUpperCase().split("").join(" "); }

const ITEMS: { label: string; note: string; to?: "/app/capsules" }[] = [
  { label: "Memory Capsules", note: "Save a friendship forever.", to: "/app/capsules" },
  { label: "Privacy", note: "Everything here is private. Promise." },
  { label: "Notifications", note: "Only when it matters." },
  { label: "Reshuffle your 25", note: "It's allowed. Encouraged, even." },
];

function FriendshipScoreCard() {
  const pct = (FRIENDSHIP_SCORE.value / FRIENDSHIP_SCORE.max) * 100;
  return (
    <div className="card-editorial accent-bar-purple p-5 mt-7">
      <div className="flex items-center gap-2">
        <Sparkles size={12} style={{ color: "#7B6FD4" }} />
        <span className="label-caps" style={{ color: "#7B6FD4" }}>{spaced("Friendship Score")}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display font-bold text-warm text-glow-purple" style={{ fontSize: 56, lineHeight: 1 }}>
          {FRIENDSHIP_SCORE.value}
        </span>
        <span className="font-display italic text-cool" style={{ fontSize: 16 }}> / {FRIENDSHIP_SCORE.max}</span>
      </div>
      <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: "#0D1820" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#7B6FD4,#A29AE5)" }}
        />
      </div>
      <p className="font-display italic text-cool mt-3" style={{ fontSize: 13, lineHeight: 1.55 }}>
        Grows with trivia, capsules, and rematches. <span className="text-warm">+24 this week.</span>
      </p>
    </div>
  );
}

function Profile() {
  return (
    <div className="px-5 pt-8 pb-4">
      <div className="flex flex-col items-center text-center">
        <div className="ring-active inline-block">
          <div className="rounded-full p-[3px]" style={{ background: "#0D1820" }}>
            <Avatar src={ME.avatar} initials={ME.initials} size={92} />
          </div>
        </div>
        <h1 className="mt-4 font-display italic text-warm" style={{ fontSize: 30 }}>You</h1>
        <p className="label-caps text-cool mt-1.5">{spaced(`${SEATS_FILLED} of ${SEATS_TOTAL} seats filled`)}</p>
      </div>

      <FriendshipScoreCard />

      <div className="mt-6 card-editorial overflow-hidden">
        {ITEMS.map((i, idx) => {
          const inner = (
            <>
              <div className="flex-1">
                <div className="font-display text-warm" style={{ fontSize: 15 }}>{i.label}</div>
                <div className="font-display italic text-cool mt-0.5" style={{ fontSize: 12 }}>{i.note}</div>
              </div>
              <ChevronRight size={16} className="text-cool" />
            </>
          );
          const cls = "w-full text-left px-4 py-4 hover:bg-white/5 transition flex items-center";
          const style = { borderTop: idx === 0 ? "none" : "1px solid var(--border-cool)" } as const;
          return i.to ? (
            <Link key={i.label} to={i.to} className={cls} style={style}>{inner}</Link>
          ) : (
            <button key={i.label} className={cls} style={style}>{inner}</button>
          );
        })}
      </div>

      <Link to="/" className="block text-center label-caps text-cool mt-8 underline-offset-4 hover:underline">
        {spaced("Sign out")}
      </Link>
      <p className="text-center font-display italic text-cool mt-6" style={{ fontSize: 11 }}>
        No followers. No likes. Just 25 humans.
      </p>
    </div>
  );
}
