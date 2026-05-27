import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, MOMENTS, ME, type MomentTag } from "@/lib/data";
import { MomentSheet } from "@/components/MomentSheet";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const TAG_VAR: Record<MomentTag, string> = {
  "Life Update": "var(--drift-active)",
  "Milestone":   "var(--tag-milestone)",
  "Mood":        "var(--tag-mood)",
  "Thought":     "var(--primary)",
};

const REACTIONS = ["❤️","🔥","😂","🫂","👏"];

function ReactionButton({ count = 0 }: { count?: number }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-12 right-0 flex gap-1.5 bg-surface-2 border border-border rounded-full px-3 py-2 shadow-xl animate-soft-in">
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => { setPicked(e); setOpen(false); }}
              className="text-xl hover:scale-125 transition"
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 rounded-full bg-background/60 border border-border flex items-center gap-1.5 text-sm"
      >
        <span className="text-base leading-none">{picked ?? "🤍"}</span>
        <span className="text-xs text-muted-foreground">{count + (picked ? 1 : 0)}</span>
      </button>
    </div>
  );
}

function Home() {
  const [sheet, setSheet] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/75 backdrop-blur-xl px-5 py-4 flex items-center justify-between border-b border-border/60">
        <span className="font-display text-[34px] font-black text-primary leading-none tracking-tight text-glow">25</span>
        <Avatar src={ME.avatar} initials={ME.initials} size={36} />
      </header>

      {/* Avatar row */}
      <section className="px-4 pt-4 pb-2">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FRIENDS.map((f) => (
            <button key={f.id} className="flex flex-col items-center gap-1 shrink-0">
              <Avatar
                src={f.avatar}
                initials={f.initials}
                color={f.color}
                size={58}
                ring={f.postedToday ? "active" : "quiet"}
              />
              <span className="text-[10px] text-muted-foreground max-w-[60px] truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Feed */}
      <section className="px-4 pt-2 space-y-4">
        {MOMENTS.map((m) => {
          const friend = FRIENDS.find((f) => f.id === m.friendId)!;
          const tagColor = TAG_VAR[m.tag];
          return (
            <article
              key={m.id}
              className="rounded-2xl bg-card border border-border p-5 animate-soft-in"
              style={{ borderLeft: `3px solid ${tagColor}` }}
            >
              <header className="flex items-center gap-3">
                <Avatar src={friend.avatar} initials={friend.initials} color={friend.color} size={42} ring={friend.postedToday ? "active" : "none"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{friend.name}</span>
                    <span className="text-xs text-muted-foreground">· {m.timeAgo}</span>
                  </div>
                  <span
                    className="inline-block mt-0.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: tagColor,
                      background: `color-mix(in oklab, ${tagColor} 18%, transparent)`,
                    }}
                  >
                    {m.tag}
                  </span>
                </div>
              </header>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground/95">{m.text}</p>
              {m.photo && (
                <div className="mt-3 rounded-xl overflow-hidden border border-border">
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
        className="fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center shadow-[0_15px_40px_-10px_var(--primary)] hover:scale-105 transition"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
