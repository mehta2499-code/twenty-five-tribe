import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, AlertCircle, Sparkles, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, MOMENTS, ME, DRIFTING, type MomentTag } from "@/lib/data";
import { MomentSheet } from "@/components/MomentSheet";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const TAG_META: Record<MomentTag, { color: string; bar: string; italic: boolean }> = {
  "Milestone":     { color: "#D4A96A", bar: "accent-bar-gold",   italic: false },
  "Life Update":   { color: "#1D9E75", bar: "accent-bar-teal",   italic: false },
  "Mood":          { color: "#7B6FD4", bar: "accent-bar-purple", italic: true  },
  "Thought":       { color: "#8A9CAA", bar: "accent-bar-muted",  italic: true  },
  "Remember When": { color: "#7B6FD4", bar: "accent-bar-purple", italic: true  },
};

function spaced(label: string) {
  return label.toUpperCase().split("").join(" ");
}

const REACTION_POOL = ["❤️", "🔥", "😂", "🫂", "👏", "🥲", "✨"];

function FloatingReactions({ count }: { count: number }) {
  const n = Math.min(4, Math.max(1, Math.round(count / 4)));
  const emojis = REACTION_POOL.slice(0, n);
  return (
    <div className="absolute -bottom-3 right-4 flex">
      {emojis.map((e, i) => (
        <div
          key={i}
          className="h-7 w-7 rounded-full flex items-center justify-center text-[14px]"
          style={{
            background: "#1A2D3E",
            border: "1px solid rgba(122,150,170,0.25)",
            marginLeft: i === 0 ? 0 : -8,
            zIndex: 10 - i,
          }}
        >
          {e}
        </div>
      ))}
      <div
        className="ml-2 self-center label-caps text-cool"
        style={{ fontSize: 9 }}
      >
        {count}
      </div>
    </div>
  );
}

function DriftAlertBanner() {
  if (DRIFTING.length === 0) return null;
  const top = DRIFTING.slice(0, 4);
  return (
    <div className="mx-4 mt-1">
      <div className="card-editorial accent-bar-red p-4 animate-coral-pulse" style={{ background: "#132030" }}>
        <div className="flex items-start gap-3">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(201,64,64,0.15)", border: "1px solid rgba(201,64,64,0.5)" }}
          >
            <AlertCircle size={18} style={{ color: "#C94040" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="label-caps" style={{ color: "#C94040" }}>{spaced("Drift Alert · AI")}</div>
            <div className="font-display text-[15px] mt-1.5 leading-snug text-warm">
              {DRIFTING.length} of your 25 are quietly drifting. {top[0].name}
              {top[1] ? ` and ${top[1].name} ` : " "}haven't surfaced in 2+ weeks.
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {top.map((f) => (
              <div key={f.id} className="rounded-full" style={{ outline: "2px solid #0D1820" }}>
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={28} />
              </div>
            ))}
          </div>
          <button
            className="rounded-full px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
            style={{ background: "rgba(201,64,64,0.18)", color: "#F2F0EB", border: "1px solid rgba(201,64,64,0.45)" }}
          >
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
      <header className="sticky top-0 z-20 px-5 pt-6 pb-4 flex items-center justify-between" style={{ background: "rgba(13,24,32,0.78)", backdropFilter: "blur(14px)" }}>
        <span
          className="font-display font-bold leading-none text-glow-25"
          style={{ fontSize: 56, color: "#F2F0EB", letterSpacing: "-0.02em" }}
        >
          25
        </span>
        <div className="ring-active inline-block">
          <div className="rounded-full p-[2px]" style={{ background: "#0D1820" }}>
            <Avatar src={ME.avatar} initials={ME.initials} size={36} />
          </div>
        </div>
      </header>

      <div className="px-5 -mt-1 mb-2">
        <h2 className="font-display italic text-warm" style={{ fontSize: 22 }}>
          Your circle's updates
        </h2>
        <p className="label-caps text-cool mt-1.5">{spaced("Today · The 25")}</p>
      </div>

      <DriftAlertBanner />

      {/* Story row */}
      <section className="px-4 mt-4">
        <div className="glass-row rounded-2xl px-3 py-3">
          <div className="flex gap-3 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FRIENDS.map((f) => {
              const drifting = f.daysQuiet >= 14;
              const ring = drifting ? "drift" : f.postedToday ? "active" : "quiet";
              return (
                <button key={f.id} className="flex flex-col items-center gap-1.5 shrink-0">
                  <Avatar src={f.avatar} initials={f.initials} color={f.color} size={54} ring={ring} />
                  <span
                    className="font-display italic max-w-[64px] truncate"
                    style={{
                      fontSize: 11,
                      color: drifting ? "#C94040" : "#F2F0EB",
                    }}
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
      <section className="px-4 pt-6 flex flex-col">
        {MOMENTS.map((m, idx) => {
          const friend = FRIENDS.find((f) => f.id === m.friendId)!;
          const meta = TAG_META[m.tag];
          const isRemember = m.tag === "Remember When";
          return (
            <div key={m.id} className={idx === 0 ? "" : "pt-5"}>
              {idx !== 0 && <hr className="hr-thin mb-5" />}
              <article
                className={`card-editorial ${meta.bar} animate-soft-in active:scale-[0.99] transition-transform relative`}
                style={{
                  padding: "20px 18px 22px",
                  boxShadow: isRemember ? "0 0 24px rgba(123,111,212,0.18)" : undefined,
                }}
              >
                {isRemember && (
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={12} style={{ color: "#7B6FD4" }} />
                    <span className="label-caps" style={{ color: "#7B6FD4" }}>
                      {spaced("Remember When")}
                    </span>
                    {m.remember && (
                      <span className="label-caps text-cool ml-auto" style={{ letterSpacing: "0.18em" }}>
                        {m.remember.year}
                      </span>
                    )}
                  </div>
                )}

                <div className="label-caps mb-2" style={{ color: meta.color }}>
                  {spaced(m.tag)}
                </div>

                <header className="flex items-center gap-3">
                  <Avatar
                    src={friend.avatar}
                    initials={friend.initials}
                    color={friend.color}
                    size={38}
                    ring="none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[15px] text-warm leading-tight">
                      {friend.name}
                    </div>
                    <div className="label-caps text-cool mt-0.5" style={{ letterSpacing: "0.18em" }}>
                      {m.timeAgo}
                    </div>
                  </div>
                </header>

                <p
                  className={`mt-3 font-display text-warm ${meta.italic ? "italic" : ""}`}
                  style={{ fontSize: 15, lineHeight: 1.65 }}
                >
                  {m.text}
                </p>

                {m.photo && (
                  <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(122,150,170,0.18)" }}>
                    <img src={m.photo} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy" />
                  </div>
                )}

                {isRemember && m.remember ? (
                  <button className="mt-4 btn-capsule px-4 py-2 text-[13px] font-display italic">
                    {m.remember.cta}
                  </button>
                ) : (
                  <FloatingReactions count={m.reactions ?? 5} />
                )}
              </article>
            </div>
          );
        })}
        <p className="text-center font-display italic text-cool py-10" style={{ fontSize: 13 }}>
          That's everyone. The feed ends here — that's kind of the point.
        </p>
      </section>

      <button
        onClick={() => setSheet(true)}
        aria-label="New moment"
        className="fab-gradient fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
