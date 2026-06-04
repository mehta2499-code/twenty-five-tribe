import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Avatar } from "@/components/Avatar";
import {
  FRIENDS, ME, SEATS_TOTAL,
  RELATIONSHIP_TAGS, RELATIONSHIP_MOMENTS, SAVED_SEATS,
} from "@/lib/data";
import { VOICE } from "@/lib/copy";
import { MomentSheet } from "@/components/MomentSheet";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const SEATS = 22; // visible seats around the oval; centre is "you"

/** Curated set of seat indices that show a role label (max ~5 — keeps the table from feeling like a name tag wall) */
const LABELED_SEAT_INDICES = new Set([0, 4, 9, 13, 18]);

type RollResult = { friend: typeof FRIENDS[number]; phase: "spinning" | "settled" } | null;

function TheTable({ onRoll, rolling }: { onRoll: () => void; rolling: boolean }) {
  const seated = FRIENDS.slice(0, 14);
  const cx = 50, cy = 50, rx = 42, ry = 36;

  // Build the ring: each position is either a seated friend, a saved-seat (ghost label), or an empty chair.
  const ring = useMemo(() => {
    const arr: ({ kind: "filled"; friend: typeof FRIENDS[number] } | { kind: "saved"; note: string } | { kind: "empty" })[] = [];
    let f = 0;
    for (let i = 0; i < SEATS; i++) {
      const saved = SAVED_SEATS.find((s) => s.seatIndex === i);
      if (saved) { arr.push({ kind: "saved", note: saved.note }); continue; }
      if (f < seated.length) { arr.push({ kind: "filled", friend: seated[f++] }); continue; }
      arr.push({ kind: "empty" });
    }
    return arr;
  }, [seated]);

  return (
    <section className="px-5 pt-3">
      <div className="text-center mb-7">
        <p className="label-caps">{VOICE.table.header}</p>
        <h1 className="font-display italic mt-4 text-cream"
            style={{ fontSize: 38, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          {VOICE.table.headline}
        </h1>
        <p className="font-display italic mt-3" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {VOICE.table.subhead(seated.length, SEATS_TOTAL - seated.length)}
        </p>
      </div>

      <div
        className={`relative mx-auto table-felt ${rolling ? "orbit-spinning" : ""}`}
        style={{
          width: "100%",
          maxWidth: 380,
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.55), 0 30px 80px -20px rgba(0,0,0,0.6)",
        }}
      >
        {/* You — the candle at the centre */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="candle-glow candle-flicker absolute" style={{ width: 160, height: 160 }} />
          <div className="relative flex flex-col items-center">
            <Avatar src={ME.avatar} initials={ME.initials} size={58} ring="gold" />
            <p className="font-display italic mt-2 text-cream" style={{ fontSize: 13, opacity: 0.85 }}>
              you
            </p>
          </div>
        </div>

        {ring.map((slot, i) => {
          const angle = (i / SEATS) * Math.PI * 2 - Math.PI / 2;
          const x = cx + rx * Math.cos(angle);
          const y = cy + ry * Math.sin(angle);

          const wrapStyle = { left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" } as const;

          if (slot.kind === "filled") {
            const f = slot.friend;
            const tag = RELATIONSHIP_TAGS[f.id];
            const showLabel = LABELED_SEAT_INDICES.has(i) && !!tag;
            return (
              <Link
                key={`f-${f.id}`}
                to="/app/seat/$id"
                params={{ id: f.id }}
                className="absolute"
                style={wrapStyle}
              >
                <div className="flex flex-col items-center">
                  <Avatar
                    src={f.avatar}
                    initials={f.initials}
                    color={f.color}
                    size={40}
                    ring={f.postedToday ? "gold" : "none"}
                  />
                  {showLabel && (
                    <span className="seat-chip mt-1 whitespace-nowrap">
                      {tag}
                    </span>
                  )}
                </div>
              </Link>
            );
          }

          if (slot.kind === "saved") {
            return (
              <div key={`s-${i}`} className="absolute" style={wrapStyle}>
                <div className="flex flex-col items-center">
                  <div className="empty-chair empty-chair-labeled" />
                  <span className="seat-chip mt-1 whitespace-nowrap" style={{ maxWidth: 110, fontSize: 10, color: "var(--text-secondary)" }}>
                    {slot.note}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={`e-${i}`} className="absolute" style={wrapStyle}>
              <div className="empty-chair" />
            </div>
          );
        })}
      </div>

      {/* Roll the Table — the playful core loop, ambient on the Table */}
      <div className="mt-7 flex items-center justify-center gap-3">
        <button
          onClick={onRoll}
          aria-label={VOICE.table.rollPrompt}
          className={`die-tile ${rolling ? "die-spinning" : ""} active:scale-95 transition`}
        >
          ⚄
        </button>
        <div className="text-left">
          <button
            onClick={onRoll}
            className="font-display italic text-cream block"
            style={{ fontSize: 17, letterSpacing: "-0.01em" }}
          >
            {VOICE.table.rollPrompt}
          </button>
          <p className="font-display italic text-cool" style={{ fontSize: 12 }}>
            {VOICE.table.rollHint}
          </p>
        </div>
      </div>

      <p className="text-center font-display italic mt-6"
         style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {VOICE.table.tableTooltip}
      </p>
    </section>
  );
}

function RollPanel({ result, onClose }: { result: NonNullable<RollResult>; onClose: () => void }) {
  const f = result.friend;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-24"
         style={{ background: "rgba(20,16,12,0.78)", backdropFilter: "blur(14px)" }}>
      <div className="w-full max-w-md card-editorial p-6 animate-soft-in"
           style={{ background: "var(--bg-card)", border: "1px solid var(--border-cool)" }}>
        <div className="flex items-center gap-4">
          <Avatar src={f.avatar} initials={f.initials} color={f.color} size={56} ring="gold" />
          <div className="flex-1">
            <p className="label-caps">the table chose</p>
            <h3 className="font-display italic text-cream mt-1" style={{ fontSize: 26, lineHeight: 1.1 }}>
              {f.name}.
            </h3>
          </div>
        </div>
        <p className="font-display italic text-cool mt-4" style={{ fontSize: 15, lineHeight: 1.5 }}>
          Send them something that has nothing to do with anything.
        </p>

        <div className="mt-5 grid gap-2">
          {VOICE.rollActions.map((a) => (
            <button key={a.id}
                    className="text-left px-4 py-3 rounded-xl transition active:scale-[0.99]"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-cool)" }}>
              <div className="font-display text-cream" style={{ fontSize: 16 }}>{a.label}</div>
              <div className="font-display italic text-cool" style={{ fontSize: 12 }}>{a.hint}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button onClick={onClose} className="label-caps text-cool">close</button>
          <Link to="/app/seat/$id" params={{ id: f.id }} onClick={onClose}
                className="font-display italic" style={{ color: "var(--accent-bronze)", fontSize: 14 }}>
            sit with them →
          </Link>
        </div>
      </div>
    </div>
  );
}

function RelationshipMoments() {
  return (
    <section className="px-7 mt-10">
      <p className="label-caps text-center mb-5">{VOICE.table.momentsHeader}</p>
      <ul className="space-y-6">
        {RELATIONSHIP_MOMENTS.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          return (
            <li key={m.id}>
              <Link to="/app/seat/$id" params={{ id: f.id }} className="flex items-start gap-4">
                <div className="pt-1 shrink-0">
                  <Avatar src={f.avatar} initials={f.initials} color={f.color} size={36} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-cream" style={{ fontSize: 17, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
                    {m.text}
                  </p>
                  <p className="font-display italic mt-1"
                     style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {m.when}
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
  const [sheet, setSheet] = useState(false);
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
      <header className="px-6 pt-9 pb-2 flex items-center justify-center">
        <span className="font-display italic text-cream"
              style={{ fontSize: 26, letterSpacing: "0.01em" }}>
          {VOICE.brand}
        </span>
      </header>

      <TheTable onRoll={onRoll} rolling={rolling} />

      <div className="hairline mx-12 mt-12" />

      <RelationshipMoments />

      <div className="px-8 mt-12 text-center">
        <p className="font-display italic" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {VOICE.table.reserveAside}
        </p>
        <button
          onClick={() => setSheet(true)}
          className="mt-3 font-display italic underline underline-offset-4 decoration-1"
          style={{ color: "var(--accent-bronze)", fontSize: 18 }}
        >
          {VOICE.table.reserve}
        </button>
      </div>

      <p className="text-center font-display italic mt-14 mb-4"
         style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}>
        {VOICE.brandLine}
      </p>

      {roll?.phase === "settled" && (
        <RollPanel result={roll} onClose={() => setRoll(null)} />
      )}

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
