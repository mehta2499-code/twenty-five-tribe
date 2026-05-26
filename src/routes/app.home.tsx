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
  "Life Update": "var(--tag-life)",
  "Milestone":   "var(--tag-milestone)",
  "Mood":        "var(--tag-mood)",
  "Thought":     "var(--tag-thought)",
};

const REACTIONS = ["❤️","🔥","😂","🫂","👏"];

function ReactionButton() {
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
        className="h-9 w-9 rounded-full bg-background/60 border border-border flex items-center justify-center text-lg"
      >
        {picked ?? "🤍"}
      </button>
    </div>
  );
}

function Home() {
  const [sheet, setSheet] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl px-5 py-4 flex items-center justify-between border-b border-border/60">
        <span className="font-display text-3xl font-black text-primary leading-none">25</span>
        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
          {ME.initials}
        </div>
      </header>

      {/* Avatar row */}
      <section className="px-4 pt-4 pb-2">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FRIENDS.map((f) => (
            <button key={f.id} className="flex flex-col items-center gap-1 shrink-0">
              <Avatar
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
      <section className="px-4 pt-2 space-y-3">
        {MOMENTS.map((m) => {
          const friend = FRIENDS.find((f) => f.id === m.friendId)!;
          return (
            <article
              key={m.id}
              className="rounded-2xl bg-card border border-border p-4 animate-soft-in"
            >
              <header className="flex items-center gap-3">
                <Avatar initials={friend.initials} color={friend.color} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{friend.name}</span>
                    <span className="text-xs text-muted-foreground">· {m.timeAgo}</span>
                  </div>
                  <span
                    className="inline-block mt-0.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: TAG_VAR[m.tag],
                      background: `color-mix(in oklab, ${TAG_VAR[m.tag]} 18%, transparent)`,
                    }}
                  >
                    {m.tag}
                  </span>
                </div>
              </header>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground/95">{m.text}</p>
              <footer className="mt-3 flex justify-end">
                <ReactionButton />
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
        className="fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_15px_40px_-10px_var(--primary)] hover:bg-primary-glow transition"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
