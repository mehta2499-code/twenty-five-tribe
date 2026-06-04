import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Avatar } from "@/components/Avatar";
import { AddMomentSheet } from "@/components/AddMomentSheet";
import { FRIENDS, ME, RELATIONSHIP_MOMENTS, MOMENTS, THOUGHTS, getSeatMeta } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const INNER_COUNT = 6;
const OUTER_DOTS  = 19;

type RollResult = { friend: typeof FRIENDS[number]; phase: "spinning" | "settled" } | null;

function Orbit({ rolling }: { rolling: boolean }) {
  const inner = useMemo(() => FRIENDS.slice(0, INNER_COUNT), []);

  return (
    <section className="px-5 pt-2">
      <div className="relative mx-auto" style={{ width: "100%", maxWidth: 340, aspectRatio: "1 / 1" }}>
        <div className="absolute inset-0 rounded-full breathe pointer-events-none"
             style={{ background: "radial-gradient(circle at 50% 50%, rgba(216,123,60,0.10) 0%, rgba(196,149,96,0.04) 38%, transparent 70%)" }} />

        <div className={`absolute inset-0 orbit-slow ${rolling ? "orbit-fast" : ""}`}>
          {Array.from({ length: OUTER_DOTS }).map((_, i) => {
            const angle = (i / OUTER_DOTS) * Math.PI * 2 - Math.PI / 2;
            const r = 48;
            const x = 50 + r * Math.cos(angle);
            const y = 50 + r * Math.sin(angle);
            return (
              <span key={i} className="absolute soft-pulse"
                    style={{ left: `${x}%`, top: `${y}%`, width: 5, height: 5, borderRadius: 999,
                             background: "rgba(196,149,96,0.55)", boxShadow: "0 0 8px rgba(216,123,60,0.45)",
                             transform: "translate(-50%, -50%)", animationDelay: `${(i % 6) * 0.4}s` }} />
            );
          })}
        </div>

        {inner.map((f, i) => {
          const angle = (i / INNER_COUNT) * Math.PI * 2 - Math.PI / 2;
          const r = 32;
          const x = 50 + r * Math.cos(angle);
          const y = 50 + r * Math.sin(angle);
          const meta = getSeatMeta(f.id);
          const reserved = meta.state === "RESERVED";
          return (
            <Link key={f.id} to="/app/seat/$id" params={{ id: f.id }} className="absolute"
                  style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}>
              <div className="rounded-full transition-transform active:scale-95"
                   style={{
                     padding: reserved ? 3 : 0,
                     border: reserved ? "1px dashed rgba(196,149,96,0.55)" : "none",
                     boxShadow: reserved ? "0 0 18px rgba(196,149,96,0.18)"
                       : f.postedToday ? "0 0 0 1px rgba(196,149,96,0.45), 0 0 22px rgba(216,123,60,0.35)"
                       : "0 8px 24px rgba(0,0,0,0.5)",
                     opacity: reserved ? 0.7 : 1,
                     filter: reserved ? "grayscale(0.3)" : "none",
                   }}>
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={reserved ? 54 : 60} />
              </div>
            </Link>
          );
        })}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="candle-glow candle-flicker absolute" style={{ width: 130, height: 130 }} />
          <Avatar src={ME.avatar} initials={ME.initials} size={64} ring="gold" />
        </div>
      </div>

      <div className="mt-5 text-center">
        <Link to="/app/my25" className="font-display italic"
              style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.04em" }}>
          {INNER_COUNT} close · {OUTER_DOTS} more · Open the table
        </Link>
      </div>
    </section>
  );
}

function QuickActions({ onRoll, onAddMoment }: { onRoll: () => void; onAddMoment: () => void }) {
  const items = [
    { glyph: "📸", label: "Share a moment", onClick: onAddMoment, to: undefined as string | undefined },
    { glyph: "❤",  label: "Send a thought", onClick: undefined, to: "/app/thoughts" },
    { glyph: "➕", label: "Reserve a seat", onClick: undefined, to: "/app/my25" },
    { glyph: "🎲", label: "Roll the table", onClick: onRoll, to: undefined },
  ];
  return (
    <section className="px-6 mt-12">
      <p className="label-caps text-center mb-5">what would you like to do?</p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => {
          const inner = (
            <>
              <span style={{ fontSize: 20 }}>{it.glyph}</span>
              <span className="font-display text-cream" style={{ fontSize: 13, lineHeight: 1.2 }}>
                {it.label}
              </span>
            </>
          );
          const cls = "flex items-center gap-3 px-4 py-4 rounded-2xl active:scale-[0.99] transition text-left";
          const style = { background: "var(--bg-surface)", border: "1px solid var(--border-cool)" } as const;
          return it.to ? (
            <Link key={it.label} to={it.to} className={cls} style={style}>{inner}</Link>
          ) : (
            <button key={it.label} onClick={it.onClick} className={cls} style={style}>{inner}</button>
          );
        })}
      </div>
    </section>
  );
}

function StartHere() {
  const acceptedCount = FRIENDS.filter((f) => getSeatMeta(f.id).state === "ACCEPTED").length;
  const hasMoments = MOMENTS.length > 0;
  const hasSentThought = THOUGHTS.some((t) => t.direction === "to");

  let nudge: { headline: string; body: string; cta: string; to: string } | null = null;

  if (acceptedCount < 5) {
    nudge = {
      headline: "Start building your table.",
      body: "Reserve your first seat.",
      cta: "Reserve a seat",
      to: "/app/my25",
    };
  } else if (!hasMoments) {
    nudge = {
      headline: "Share your first moment.",
      body: "A photo, a thought, a small life update.",
      cta: "Add a moment",
      to: "/app/moments",
    };
  } else if (!hasSentThought) {
    nudge = {
      headline: "Send your first Thought.",
      body: "Let someone know you noticed.",
      cta: "Send a thought",
      to: "/app/thoughts",
    };
  }

  if (!nudge) return null;

  return (
    <section className="px-6 mt-10">
      <div className="card-editorial p-6 text-center" style={{ background: "var(--bg-card)" }}>
        <p className="label-caps mb-3">start here</p>
        <p className="font-display italic text-cream" style={{ fontSize: 20, lineHeight: 1.3 }}>
          {nudge.headline}
        </p>
        <p className="font-display italic mt-2"
           style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {nudge.body}
        </p>
        <Link to={nudge.to}
              className="inline-block mt-5 rounded-full px-5 py-2.5 font-display italic"
              style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)", fontSize: 13 }}>
          {nudge.cta}
        </Link>
      </div>
    </section>
  );
}

function RollPanel({ result, onClose }: { result: NonNullable<RollResult>; onClose: () => void }) {
  const f = result.friend;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-28"
         style={{ background: "rgba(20,16,12,0.78)", backdropFilter: "blur(14px)" }}>
      <div className="w-full max-w-md card-editorial p-7 animate-soft-in text-center"
           style={{ background: "var(--bg-card)" }}>
        <Avatar src={f.avatar} initials={f.initials} color={f.color} size={92} ring="gold" />
        <h3 className="font-display italic text-cream mt-5" style={{ fontSize: 30 }}>
          {f.name}
        </h3>
        <p className="font-display italic text-cool mt-3 mx-auto max-w-[18rem]"
           style={{ fontSize: 14, lineHeight: 1.5 }}>
          Send them something that has nothing to do with anything.
        </p>
        <div className="mt-7 grid grid-cols-4 gap-3">
          {[
            { id: "song",  glyph: "♪", label: "Song" },
            { id: "photo", glyph: "◐", label: "Photo" },
            { id: "voice", glyph: "◍", label: "Voice note" },
            { id: "msg",   glyph: "✎", label: "Message" },
          ].map((a) => (
            <button key={a.id}
                    className="flex flex-col items-center gap-2 py-3 rounded-2xl active:scale-95 transition"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-cool)" }}>
              <span style={{ color: "var(--accent-bronze)", fontSize: 20 }}>{a.glyph}</span>
              <span className="font-display italic text-cream" style={{ fontSize: 12 }}>{a.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-6 label-caps text-cool">close</button>
      </div>
    </div>
  );
}

function TodayAtTheTable() {
  const items = RELATIONSHIP_MOMENTS.slice(0, 3);
  return (
    <section className="px-7 mt-14">
      <p className="label-caps text-center mb-8">today at your table</p>
      <ul className="space-y-9">
        {items.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          return (
            <li key={m.id}>
              <Link to="/app/seat/$id" params={{ id: f.id }} className="flex items-center gap-4">
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-cream"
                     style={{ fontSize: 16, lineHeight: 1.45, letterSpacing: "-0.005em" }}>
                    {m.text}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Home() {
  const [roll, setRoll] = useState<RollResult>(null);
  const [adding, setAdding] = useState(false);
  const rolling = roll?.phase === "spinning";

  const onRoll = () => {
    const candidates = FRIENDS.slice(0, 14);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setRoll({ friend: pick, phase: "spinning" });
    setTimeout(() => setRoll({ friend: pick, phase: "settled" }), 1400);
  };

  return (
    <>
      <header className="px-6 pt-10 pb-6 text-center">
        <span className="font-display italic text-cream"
              style={{ fontSize: 22, letterSpacing: "0.02em" }}>
          {VOICE.brand}
        </span>
      </header>

      <Orbit rolling={rolling} />

      <QuickActions onRoll={onRoll} onAddMoment={() => setAdding(true)} />

      <StartHere />

      <TodayAtTheTable />

      <p className="text-center font-display italic mt-16 mb-4 px-8"
         style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.05em" }}>
        {VOICE.brandLine}
      </p>

      {roll?.phase === "settled" && <RollPanel result={roll} onClose={() => setRoll(null)} />}
      {adding && <AddMomentSheet onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} />}
    </>
  );
}
