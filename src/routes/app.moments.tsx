import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MomentSheet } from "@/components/MomentSheet";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, MOMENTS, type MomentTag } from "@/lib/data";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/moments")({
  component: MomentsScreen,
});

const TAG_VAR: Record<MomentTag, string> = {
  "Life Update":   "#BFE9C9",
  "Milestone":     "#FFD9A8",
  "Mood":          "#F7A8A0",
  "Thought":       "#E8DEFF",
  "Remember When": "#F7A8A0",
};

function MomentsScreen() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="px-5 pt-6 pb-3">
        <h1 className="font-display text-3xl font-black">Moments</h1>
        <p className="text-xs text-white/75 mt-1">Soft updates from your 25 — gone in 72 hours.</p>
      </header>

      <section className="px-4 space-y-3">
        {MOMENTS.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          const c = TAG_VAR[m.tag];
          return (
            <div
              key={m.id}
              className="glass p-4 flex gap-3"
              style={{ borderLeft: `3px solid ${c}` }}
            >
              <Avatar src={f.avatar} initials={f.initials} color={f.color} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-semibold text-white">{f.name}</span>{" "}
                  <span className="text-white/70">· {m.timeAgo} · {m.tag}</span>
                </div>
                <p className="mt-1 text-[14px] text-white/95 leading-snug">{m.text}</p>
                {m.photo && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-white/20">
                    <img src={m.photo} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <button
        onClick={() => setOpen(true)}
        className="fab-gradient fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full flex items-center justify-center hover:scale-105 transition"
        aria-label="New moment"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      <MomentSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
