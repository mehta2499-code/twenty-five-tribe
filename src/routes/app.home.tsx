import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Heart, AlertCircle, Sparkles, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, MOMENTS, ME, DRIFTING, type MomentTag } from "@/lib/data";
import { MomentSheet } from "@/components/MomentSheet";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const TAG_META: Record<MomentTag, { color: string; accent: string; label?: string }> = {
  "Life Update":   { color: "#BFE9C9", accent: "accent-life" },
  "Milestone":     { color: "#FFD9A8", accent: "accent-milestone" },
  "Mood":          { color: "#F7A8A0", accent: "accent-mood" },
  "Thought":       { color: "#E8DEFF", accent: "accent-thought" },
  "Remember When": { color: "#F7A8A0", accent: "accent-mood" },
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
        <div className="absolute bottom-12 right-0 flex gap-1.5 glass-strong px-3 py-2 shadow-2xl animate-soft-in z-10 rounded-full">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => choose(e)} className="text-xl hover:scale-125 transition-transform">
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => (reacted ? choose(picked!) : setOpen((v) => !v))}
        className="h-9 px-3 rounded-full flex items-center gap-2 text-sm transition"
        style={{
          background: reacted ? "rgba(247,168,160,0.35)" : "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        <span className={`inline-flex ${pop ? "animate-heart-pop" : ""}`}>
          {reacted ? (
            <span className="text-base leading-none">{picked}</span>
          ) : (
            <Heart size={16} className="text-white/85" />
          )}
        </span>
        <span className="text-xs text-white/85 tabular-nums">{count + (reacted ? 1 : 0)}</span>
      </button>
    </div>
  );
}

function DriftAlertBanner() {
  if (DRIFTING.length === 0) return null;
  const top = DRIFTING.slice(0, 4);
  return (
    <div className="mx-4 mt-1">
      <div
        className="glass animate-coral-pulse p-4"
        style={{ borderRadius: 20, border: "1px solid rgba(247,168,160,0.65)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(247,168,160,0.25)", border: "1px solid rgba(247,168,160,0.7)" }}
          >
            <AlertCircle size={18} style={{ color: "#F7A8A0" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: "#F7A8A0" }}>
              Drift Alert · AI
            </div>
            <div className="text-sm font-semibold mt-1 leading-snug text-white">
              {DRIFTING.length} of your 25 are quietly drifting. {top[0].name}{" "}
              {top[1] ? `and ${top[1].name} ` : ""}haven't surfaced in 2+ weeks.
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {top.map((f) => (
              <div key={f.id} className="rounded-full" style={{ outline: "2px solid #2B8AC4" }}>
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={28} />
              </div>
            ))}
          </div>
          <button className="btn-coral rounded-full px-4 py-1.5 text-xs font-bold inline-flex items-center gap-1">
            See who <ChevronRight size={14} />
          </button>
        </div>
      </div>
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
          className="font-display font-black leading-none tracking-tight text-glow-25"
          style={{ fontSize: 56, color: "#FFFFFF" }}
        >
          25
        </span>
        <div className="ring-active inline-block">
          <div className="rounded-full p-[2px]" style={{ background: "#2B8AC4" }}>
            <Avatar src={ME.avatar} initials={ME.initials} size={36} />
          </div>
        </div>
      </header>

      {/* Drift Alert Banner */}
      <DriftAlertBanner />

      {/* Story row */}
      <section className="px-4 mt-4">
        <div className="glass-row rounded-3xl px-3 py-3">
          <div className="flex gap-3 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FRIENDS.map((f) => {
              const drifting = f.daysQuiet >= 14;
              const ring = drifting ? "drift" : f.postedToday ? "active" : "quiet";
              return (
                <button key={f.id} className="flex flex-col items-center gap-1.5 shrink-0">
                  <Avatar
                    src={f.avatar}
                    initials={f.initials}
                    color={f.color}
                    size={58}
                    ring={ring}
                  />
                  <span
                    className="text-[12px] max-w-[64px] truncate font-medium"
                    style={{ color: drifting ? "#F7A8A0" : "rgba(255,255,255,0.85)" }}
                  >
                    {f.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feed */}
      <section className="px-4 pt-5 flex flex-col gap-3.5">
        {MOMENTS.map((m) => {
          const friend = FRIENDS.find((f) => f.id === m.friendId)!;
          const meta = TAG_META[m.tag];
          const isRemember = m.tag === "Remember When";
          return (
            <article
              key={m.id}
              className={`glass ${meta.accent} animate-soft-in active:scale-[0.985] transition-transform`}
              style={{
                padding: "18px",
                ...(isRemember
                  ? { border: "1px solid rgba(247,168,160,0.55)", boxShadow: "0 0 24px rgba(247,168,160,0.35), inset 3px 0 0 #F7A8A0" }
                  : {}),
              }}
            >
              {isRemember && (
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} style={{ color: "#F7A8A0" }} />
                  <span className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: "#F7A8A0" }}>
                    Remember When · AI drop
                  </span>
                  {m.remember && (
                    <span className="text-[10px] text-white/65 ml-auto">{m.remember.year}</span>
                  )}
                </div>
              )}
              <header className="flex items-center gap-3">
                <Avatar
                  src={friend.avatar}
                  initials={friend.initials}
                  color={friend.color}
                  size={42}
                  ring={friend.postedToday && !isRemember ? "active" : "none"}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[15px]">{friend.name}</span>
                    <span className="text-xs text-white/70">· {m.timeAgo}</span>
                  </div>
                  <span
                    className="inline-block mt-0.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: "#1A2A3A",
                      background: meta.color,
                    }}
                  >
                    {m.tag}
                  </span>
                </div>
              </header>
              <p className={`mt-3 text-[15px] leading-relaxed text-white/95 ${isRemember ? "font-display italic" : ""}`}>
                {m.text}
              </p>
              {m.photo && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-white/20">
                  <img src={m.photo} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy" />
                </div>
              )}
              <footer className="mt-3 flex justify-end items-center gap-2">
                {isRemember && m.remember ? (
                  <button className="btn-coral rounded-full px-4 py-2 text-xs font-bold">
                    {m.remember.cta}
                  </button>
                ) : (
                  <ReactionButton count={m.reactions} />
                )}
              </footer>
            </article>
          );
        })}
        <p className="text-center text-xs text-white/65 py-6">
          That's everyone. The feed ends here — that's kind of the point.
        </p>
      </section>

      {/* FAB */}
      <button
        onClick={() => setSheet(true)}
        aria-label="New moment"
        className="fab-gradient fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
