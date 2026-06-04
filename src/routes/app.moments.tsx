import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MomentSheet } from "@/components/MomentSheet";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, MOMENTS, type MomentTag } from "@/lib/data";
import { VOICE } from "@/lib/copy";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/moments")({
  component: MomentsScreen,
});

const TAG_VAR: Record<MomentTag, string> = {
  "Life Update":   "var(--accent-sage)",
  "Milestone":     "var(--accent-bronze)",
  "Mood":          "var(--accent-ember)",
  "Thought":       "var(--text-muted)",
  "Remember When": "var(--accent-oxblood)",
};

function MomentsScreen() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="px-6 pt-9 pb-4 text-center">
        <p className="label-caps">{VOICE.moments.header}</p>
        <h1 className="font-display italic text-cream mt-3" style={{ fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          {VOICE.moments.headline}
        </h1>
        <p className="font-display italic mt-3" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>
          {VOICE.moments.sub}
        </p>
      </header>

      <section className="px-5 space-y-3 mt-4">
        {MOMENTS.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          const c = TAG_VAR[m.tag];
          return (
            <article key={m.id} className="card-editorial p-4 flex gap-3"
                     style={{ borderLeft: `3px solid ${c}` }}>
              <Avatar src={f.avatar} initials={f.initials} color={f.color} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-cream" style={{ fontSize: 15 }}>{f.name}</span>
                  <span className="font-display italic" style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    · {m.timeAgo} · {m.tag.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1.5 font-display text-cream" style={{ fontSize: 15, lineHeight: 1.5, letterSpacing: "-0.005em" }}>
                  {m.text}
                </p>
                {m.photo && (
                  <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-cool)" }}>
                    <img src={m.photo} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy"
                         style={{ filter: "saturate(0.92) brightness(0.96)" }} />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="text-center font-display italic mt-10 mb-4"
         style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}>
        Nothing here will be here in 72 hours. Look while it's warm.
      </p>

      <button
        onClick={() => setOpen(true)}
        className="fab-gradient fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full flex items-center justify-center hover:scale-105 transition"
        aria-label="Share a moment"
      >
        <Plus size={24} strokeWidth={2} />
      </button>

      <MomentSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
