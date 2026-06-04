import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, ME, RELATIONSHIP_MOMENTS, getSeatMeta } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const INNER_COUNT = 6;   // close circle, large faces
const OUTER_DOTS  = 19;  // soft glowing dots

type RollResult = { friend: typeof FRIENDS[number]; phase: "spinning" | "settled" } | null;

function Orbit({ onRoll, rolling }: { onRoll: () => void; rolling: boolean }) {
  const inner = useMemo(() => FRIENDS.slice(0, INNER_COUNT), []);

  return (
    <section className="px-5 pt-2">
      <div
        className="relative mx-auto"
        style={{
          width: "100%",
          maxWidth: 360,
          aspectRatio: "1 / 1",
        }}
      >
        {/* breathing aura */}
        <div className="absolute inset-0 rounded-full breathe pointer-events-none"
             style={{
               background: "radial-gradient(circle at 50% 50%, rgba(216,123,60,0.10) 0%, rgba(196,149,96,0.04) 38%, transparent 70%)",
             }}
        />

        {/* outer dots — slow drift */}
        <div className={`absolute inset-0 orbit-slow ${rolling ? "orbit-fast" : ""}`}>
          {Array.from({ length: OUTER_DOTS }).map((_, i) => {
            const angle = (i / OUTER_DOTS) * Math.PI * 2 - Math.PI / 2;
            const r = 48; // % radius
            const x = 50 + r * Math.cos(angle);
            const y = 50 + r * Math.sin(angle);
            const delay = (i % 6) * 0.4;
            return (
              <span
                key={i}
                className="absolute soft-pulse"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(196,149,96,0.55)",
                  boxShadow: "0 0 8px rgba(216,123,60,0.45)",
                  transform: "translate(-50%, -50%)",
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>

        {/* inner 6 — large, breathing room */}
        {inner.map((f, i) => {
          const angle = (i / INNER_COUNT) * Math.PI * 2 - Math.PI / 2;
          const r = 32;
          const x = 50 + r * Math.cos(angle);
          const y = 50 + r * Math.sin(angle);
          const meta = getSeatMeta(f.id);
          const reserved = meta.state === "RESERVED";
          return (
            <Link
              key={f.id}
              to="/app/seat/$id"
              params={{ id: f.id }}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div
                className="rounded-full transition-transform active:scale-95"
                style={{
                  padding: reserved ? 3 : 0,
                  border: reserved ? "1px dashed rgba(196,149,96,0.55)" : "none",
                  boxShadow: reserved
                    ? "0 0 18px rgba(196,149,96,0.18)"
                    : f.postedToday
                      ? "0 0 0 1px rgba(196,149,96,0.45), 0 0 22px rgba(216,123,60,0.35)"
                      : "0 8px 24px rgba(0,0,0,0.5)",
                  opacity: reserved ? 0.7 : 1,
                  filter: reserved ? "grayscale(0.3)" : "none",
                }}
              >
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={reserved ? 56 : 62} />
              </div>
            </Link>
          );
        })}

        {/* You — quiet centre */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="candle-glow candle-flicker absolute" style={{ width: 130, height: 130 }} />
          <Avatar src={ME.avatar} initials={ME.initials} size={64} ring="gold" />
        </div>
      </div>

      {/* tap to expand */}
      <div className="mt-6 text-center">
        <Link
          to="/app/my25"
          className="font-display italic"
          style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.04em" }}
        >
          {INNER_COUNT} close · {OUTER_DOTS} more · open the table
        </Link>
      </div>

      {/* floating dice — small, elegant */}
      <button
        onClick={onRoll}
        aria-label={VOICE.table.rollPrompt}
        className={`fixed z-30 die-tile active:scale-95 transition ${rolling ? "die-spinning" : ""}`}
        style={{
          right: "calc(50% - 11rem)",
          bottom: "6.5rem",
          width: 48, height: 48,
          fontSize: 22,
        }}
      >
        ⚄
      </button>
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
          Send him something that has nothing to do with anything.
        </p>

        <div className="mt-6 flex items-center justify-center gap-5 text-2xl">
          {[
            { id: "song",  glyph: "♪" },
            { id: "photo", glyph: "◐" },
            { id: "voice", glyph: "◍" },
            { id: "msg",   glyph: "✎" },
          ].map((a) => (
            <button key={a.id}
                    className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition"
                    style={{ background: "var(--bg-surface)", color: "var(--accent-bronze)" }}>
              {a.glyph}
            </button>
          ))}
        </div>

        <button onClick={onClose}
                className="mt-7 label-caps text-cool">
          close
        </button>
      </div>
    </div>
  );
}

function TodayAtTheTable() {
  // Maximum 3 cards. No counts, no times beyond a quiet line.
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

      <Orbit onRoll={onRoll} rolling={rolling} />

      <TodayAtTheTable />

      <p className="text-center font-display italic mt-16 mb-4 px-8"
         style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.05em" }}>
        {VOICE.brandLine}
      </p>

      {roll?.phase === "settled" && (
        <RollPanel result={roll} onClose={() => setRoll(null)} />
      )}
    </>
  );
}
