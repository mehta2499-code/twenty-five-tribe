import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CAPSULES, FRIENDS, ME, type Capsule, type MomentTag } from "@/lib/data";

export const Route = createFileRoute("/app/capsules")({
  component: CapsulesScreen,
});

// Uppercase and letter-spacing come from the .label-caps style.
function spaced(s: string) {
  return s;
}

const TAG_COLOR: Record<MomentTag, string> = {
  Milestone: "var(--blue-deep)",
  "Life Update": "var(--mint)",
  Mood: "var(--blue)",
  Thought: "var(--text-muted)",
  "Remember When": "var(--blue)",
};

function CapsuleList({ onOpen }: { onOpen: (c: Capsule) => void }) {
  return (
    <>
      <header className="px-5 pt-7 pb-3 flex items-center gap-3">
        <Link to="/app/profile" className="text-cool">
          <ChevronLeft size={22} />
        </Link>
        <div>
          <p className="label-caps text-cool">{spaced("Profile · Capsules")}</p>
          <h1 className="font-display italic text-warm mt-1" style={{ fontSize: 26 }}>
            Memory Capsules
          </h1>
        </div>
      </header>
      <p
        className="px-5 font-display italic text-cool mb-5"
        style={{ fontSize: 13, lineHeight: 1.55 }}
      >
        One per person you've been friends with for 3+ months. A keepsake — yours, and theirs.
      </p>

      <section className="px-5 space-y-3 pb-10">
        {CAPSULES.map((c) => {
          const f = FRIENDS.find((x) => x.id === c.friendId)!;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c)}
              className="w-full card-editorial accent-bar-purple p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
            >
              <Avatar src={f.avatar} initials={f.initials} color={f.color} size={52} ring="gold" />
              <div className="flex-1 min-w-0">
                <div className="label-caps" style={{ color: "var(--blue)" }}>
                  {spaced("✦ Memory Capsule")}
                </div>
                <div className="font-display italic text-warm mt-1" style={{ fontSize: 18 }}>
                  {f.name}
                </div>
                <div className="font-display italic text-cool" style={{ fontSize: 12 }}>
                  {c.years}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="font-display font-bold text-warm"
                  style={{ fontSize: 22, lineHeight: 1 }}
                >
                  {c.score}
                </div>
                <div className="label-caps text-cool mt-1">{spaced("Score")}</div>
              </div>
            </button>
          );
        })}
      </section>
    </>
  );
}

function CapsuleDetail({ c, onBack }: { c: Capsule; onBack: () => void }) {
  const f = FRIENDS.find((x) => x.id === c.friendId)!;
  return (
    <>
      <header className="px-5 pt-7 pb-3 flex items-center justify-between">
        <button onClick={onBack} className="text-cool">
          <ChevronLeft size={22} />
        </button>
        <span className="label-caps text-cool">{spaced("✦ Memory Capsule")}</span>
        <div style={{ width: 22 }} />
      </header>

      {/* Hero */}
      <section className="px-6 pt-2 text-center">
        <div className="relative inline-flex items-center justify-center" style={{ height: 80 }}>
          <div className="rounded-full" style={{ outline: "3px solid #fff", borderRadius: 9999 }}>
            <Avatar src={f.avatar} initials={f.initials} color={f.color} size={72} />
          </div>
          <div
            className="absolute left-1/2 ml-3 rounded-full"
            style={{ outline: "3px solid #fff", borderRadius: 9999 }}
          >
            <Avatar src={ME.avatar} initials={ME.initials} size={56} />
          </div>
        </div>
        <h2
          className="font-display italic text-warm text-glow-purple mt-5"
          style={{ fontSize: 34, lineHeight: 1.05 }}
        >
          {f.name}
        </h2>
        <p className="font-display italic text-cool mt-1.5" style={{ fontSize: 13 }}>
          {c.years}
        </p>
      </section>

      {/* Stats */}
      <section className="px-5 mt-7 grid grid-cols-3 gap-2.5">
        {[
          { v: c.stats.pulses, l: "Pulses shared" },
          { v: c.stats.milestones, l: "Milestones" },
          { v: c.stats.games, l: "Games played" },
        ].map((s) => (
          <div key={s.l} className="card-editorial p-4 text-center">
            <div
              className="font-display font-bold text-warm"
              style={{ fontSize: 28, lineHeight: 1 }}
            >
              {s.v}
            </div>
            <div className="label-caps text-cool mt-2">{spaced(s.l)}</div>
          </div>
        ))}
      </section>

      {/* Story timeline */}
      <section className="px-5 mt-8">
        <h3 className="font-display italic text-warm" style={{ fontSize: 20 }}>
          Your story, together
        </h3>
        <p className="label-caps text-cool mt-1">{spaced("Timeline")}</p>

        <ol className="mt-4 relative">
          <span
            className="absolute left-[7px] top-1 bottom-1 w-px"
            style={{ background: "var(--border-cool)" }}
          />
          {c.story.map((e, i) => (
            <li key={i} className="pl-7 pb-5 relative">
              <span
                className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full"
                style={{
                  background: TAG_COLOR[e.tag],
                  boxShadow: `0 0 10px ${TAG_COLOR[e.tag]}66`,
                }}
              />
              <div className="label-caps" style={{ color: TAG_COLOR[e.tag] }}>
                {spaced(e.tag)}
              </div>
              <p
                className="font-display italic text-warm mt-1"
                style={{ fontSize: 13, lineHeight: 1.6 }}
              >
                {e.text}
              </p>
              <div className="label-caps text-cool mt-1">{spaced(e.date)}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* Pulses */}
      <section className="px-5 mt-2">
        <h3 className="font-display italic text-warm" style={{ fontSize: 20 }}>
          Pulses you both felt
        </h3>
        <p className="label-caps text-cool mt-1">{spaced("Same day · same mood")}</p>
        <ul className="mt-4 space-y-2.5">
          {c.pulses.map((p, i) => (
            <li key={i} className="card-editorial p-3 flex items-center gap-3">
              <Avatar src={f.avatar} initials={f.initials} color={f.color} size={36} />
              <span
                className="rounded-full px-3 py-1.5 font-display italic"
                style={{
                  fontSize: 13,
                  background: `${p.color}22`,
                  color: "var(--text-primary)",
                  border: `1px solid ${p.color}55`,
                }}
              >
                {p.word} {p.emoji}
              </span>
              <span
                className="h-2.5 w-2.5 rounded-full ml-auto"
                style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }}
              />
              <span className="label-caps text-cool">{spaced(p.date)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Photos */}
      <section className="px-5 mt-8">
        <h3 className="font-display italic text-warm" style={{ fontSize: 20 }}>
          Moments you shared
        </h3>
        <p className="label-caps text-cool mt-1">{spaced("Captured · 2023–2025")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {c.photos.map((src, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border-cool)" }}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* Friendship Score */}
      <section className="px-5 mt-9">
        <h3 className="font-display italic text-warm" style={{ fontSize: 20 }}>
          Friendship Score
        </h3>
        <div className="card-editorial accent-bar-purple p-5 mt-3">
          <div className="flex items-baseline gap-2">
            <span
              className="font-display font-bold text-warm text-glow-purple"
              style={{ fontSize: 56, lineHeight: 1 }}
            >
              {c.score}
            </span>
            <span className="font-display italic text-cool" style={{ fontSize: 16 }}>
              / 100
            </span>
          </div>
          <div
            className="mt-4 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-surface)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${c.score}%`,
                background: "linear-gradient(90deg,var(--blue),var(--coral))",
              }}
            />
          </div>
          <p
            className="font-display italic text-cool mt-3"
            style={{ fontSize: 13, lineHeight: 1.6 }}
          >
            {c.scoreNote}
          </p>
        </div>
      </section>

      {/* Send capsule */}
      <section className="px-5 mt-8">
        <button className="btn-capsule w-full py-4 font-display italic" style={{ fontSize: 16 }}>
          Send this capsule to {f.name} ✦
        </button>
      </section>

      <p
        className="text-center label-caps text-cool mt-10 mb-6"
        style={{ letterSpacing: "0.32em" }}
      >
        {spaced("Made on 25 · 25.app")}
      </p>
    </>
  );
}

function CapsulesScreen() {
  const [open, setOpen] = useState<Capsule | null>(null);
  return open ? (
    <CapsuleDetail c={open} onBack={() => setOpen(null)} />
  ) : (
    <CapsuleList onOpen={setOpen} />
  );
}
