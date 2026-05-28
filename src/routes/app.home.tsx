import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Heart } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, MOMENTS, ME, type MomentTag } from "@/lib/data";
import { MomentSheet } from "@/components/MomentSheet";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const TAG_META: Record<MomentTag, { color: string; accent: string }> = {
  "Life Update": { color: "#1D9E75", accent: "accent-life" },
  "Milestone":   { color: "#BA7517", accent: "accent-milestone" },
  "Mood":        { color: "#D4537E", accent: "accent-mood" },
  "Thought":     { color: "#7F77DD", accent: "accent-thought" },
};

const REACTIONS = ["❤️","🔥","😂","🫂","👏"];

function ReactionButton({ count = 0 }: { count?: number }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [pop, setPop] = useState(false);

  function choose(e: string) {
    setPicked(e);
    setOpen(false);
    setPop(true);
    setTimeout(() => setPop(false), 320);
  }

  const reacted = !!picked;

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-12 right-0 flex gap-1.5 bg-surface-2/95 border border-border rounded-full px-3 py-2 shadow-2xl backdrop-blur-xl animate-soft-in z-10">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => choose(e)} className="text-xl hover:scale-125 transition-transform">
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => (reacted ? choose(picked!) : setOpen((v) => !v))}
        className="h-9 px-3 rounded-full border flex items-center gap-2 text-sm transition"
        style={{
          background: reacted
            ? "linear-gradient(135deg, rgba(212,83,126,0.18), rgba(127,119,221,0.18))"
            : "rgba(255,255,255,0.03)",
          borderColor: reacted ? "rgba(212,83,126,0.5)" : "var(--border)",
        }}
      >
        <span className={`inline-flex ${pop ? "animate-heart-pop" : ""}`}>
          {reacted ? (
            <span className="text-base leading-none">{picked}</span>
          ) : (
            <Heart size={16} className="text-muted-foreground" />
          )}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{count + (reacted ? 1 : 0)}</span>
      </button>
    </div>
  );
}

function Home() {
  const [sheet, setSheet] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-20 px-5 pt-6 pb-4 flex items-center justify-between">
        <span
          className="font-display font-black text-primary leading-none tracking-tight text-glow-25"
          style={{ fontSize: 44 }}
        >
          25
        </span>
        <div className="ring-purple inline-block">
          <div className="rounded-full bg-background p-[2px]">
            <Avatar src={ME.avatar} initials={ME.initials} size={36} />
          </div>
        </div>
      </header>

      {/* Story row */}
      <section className="px-4">
        <div className="glass-row rounded-3xl px-3 py-3">
          <div className="flex gap-3 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FRIENDS.map((f) => (
              <button key={f.id} className="flex flex-col items-center gap-1.5 shrink-0">
                <Avatar
                  src={f.avatar}
                  initials={f.initials}
                  color={f.color}
                  size={58}
                  ring={f.postedToday ? "active" : "quiet"}
                />
                <span
                  className="text-[12px] max-w-[64px] truncate"
                  style={{ color: "#8B8A9B", letterSpacing: "0.02em" }}
                >
                  {f.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Feed */}
      <section className="px-4 pt-5 flex flex-col gap-3.5">
        {MOMENTS.map((m) => {
          const friend = FRIENDS.find((f) => f.id === m.friendId)!;
          const meta = TAG_META[m.tag];
          return (
            <article
              key={m.id}
              className={`card-premium ${meta.accent} animate-soft-in active:scale-[0.985] transition-transform`}
              style={{ padding: "18px" }}
            >
              <header className="flex items-center gap-3">
                <Avatar
                  src={friend.avatar}
                  initials={friend.initials}
                  color={friend.color}
                  size={42}
                  ring={friend.postedToday ? "active" : "none"}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[15px]">{friend.name}</span>
                    <span className="text-xs text-muted-foreground">· {m.timeAgo}</span>
                  </div>
                  <span
                    className="inline-block mt-0.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: meta.color,
                      background: `color-mix(in oklab, ${meta.color} 18%, transparent)`,
                    }}
                  >
                    {m.tag}
                  </span>
                </div>
              </header>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground/95">{m.text}</p>
              {m.photo && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-border">
                  <img src={m.photo} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy" />
                </div>
              )}
              <footer className="mt-3 flex justify-end">
                <ReactionButton count={m.reactions} />
              </footer>
            </article>
          );
        })}
        <p className="text-center text-xs text-muted-foreground/70 py-6">
          That's everyone. The feed ends here — that's kind of the point.
        </p>
      </section>

      {/* FAB */}
      <button
        onClick={() => setSheet(true)}
        aria-label="New moment"
        className="fab-gradient fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full text-white flex items-center justify-center hover:scale-105 active:scale-95 transition"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
