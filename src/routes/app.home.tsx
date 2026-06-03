import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  FRIENDS, ME, SEATS_TOTAL,
  RELATIONSHIP_TAGS, RELATIONSHIP_MOMENTS,
} from "@/lib/data";
import { MomentSheet } from "@/components/MomentSheet";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

/**
 * The Table — a digital living room.
 * Avatars arranged around an oval, viewed from above.
 * No dashboard, no feed. Just your people.
 */
function TheTable() {
  // Seat the first 14 friends around the oval. Empty seats stay empty — the table is never full.
  const seated = FRIENDS.slice(0, 14);
  const SEATS = 14;

  // Oval geometry (percent of the container box)
  const cx = 50;
  const cy = 50;
  const rx = 42; // horizontal radius
  const ry = 36; // vertical radius

  return (
    <section className="px-5 pt-2">
      <div className="text-center mb-6">
        <p className="seat-chip tracking-[0.3em] uppercase" style={{ fontStyle: "normal", fontSize: 10 }}>
          The Table
        </p>
        <h1 className="font-display italic mt-3 text-cream"
            style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
          These are your people.
        </h1>
        <p className="font-display italic mt-2" style={{ color: "var(--text-secondary)", fontSize: 15 }}>
          {seated.length} seats taken · {SEATS_TOTAL - seated.length} kept open
        </p>
      </div>

      {/* The oval table */}
      <div
        className="relative mx-auto table-felt"
        style={{
          width: "100%",
          maxWidth: 380,
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          boxShadow:
            "inset 0 0 60px rgba(0,0,0,0.55), 0 30px 80px -20px rgba(0,0,0,0.6)",
        }}
      >
        {/* Candle in the center — you */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="candle-glow absolute" style={{ width: 140, height: 140 }} />
          <div className="relative flex flex-col items-center">
            <Avatar src={ME.avatar} initials={ME.initials} size={56} ring="gold" />
            <p className="font-display italic mt-2 text-cream" style={{ fontSize: 14 }}>
              you
            </p>
          </div>
        </div>

        {/* Seats around the oval */}
        {seated.map((f, i) => {
          const angle = (i / SEATS) * Math.PI * 2 - Math.PI / 2;
          const x = cx + rx * Math.cos(angle);
          const y = cy + ry * Math.sin(angle);
          const tag = RELATIONSHIP_TAGS[f.id];
          const showLabel = !!tag && i % 2 === 0; // only label a few — feels handmade
          return (
            <Link
              key={f.id}
              to="/app/my25"
              className="absolute"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="flex flex-col items-center">
                <Avatar
                  src={f.avatar}
                  initials={f.initials}
                  color={f.color}
                  size={42}
                  ring={f.postedToday ? "gold" : "none"}
                />
                {showLabel && (
                  <span className="seat-chip mt-1 whitespace-nowrap"
                        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                    {tag}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <p className="text-center font-display italic mt-6"
         style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        Tap a seat to sit with them.
      </p>
    </section>
  );
}

function RelationshipMoments() {
  return (
    <section className="px-8 mt-12">
      <p className="seat-chip text-center tracking-[0.3em] uppercase mb-6"
         style={{ fontStyle: "normal", fontSize: 10 }}>
        From your table today
      </p>
      <ul className="space-y-7">
        {RELATIONSHIP_MOMENTS.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          return (
            <li key={m.id} className="flex items-start gap-4">
              <div className="pt-1 shrink-0">
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={36} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-cream" style={{ fontSize: 18, lineHeight: 1.35 }}>
                  {m.text}
                </p>
                <p className="font-display italic mt-1"
                   style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  {m.when}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Home() {
  const [sheet, setSheet] = useState(false);

  return (
    <>
      {/* Quiet header — almost not there */}
      <header className="px-6 pt-8 pb-2 flex items-center justify-center">
        <span className="font-display italic text-cream"
              style={{ fontSize: 28, letterSpacing: "0.02em" }}>
          twenty&nbsp;five
        </span>
      </header>

      <TheTable />

      <div className="hairline mx-12 mt-12" />

      <RelationshipMoments />

      {/* A gentle invitation, not a CTA */}
      <div className="px-8 mt-14 text-center">
        <p className="font-display italic" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Someone missing?
        </p>
        <button
          onClick={() => setSheet(true)}
          className="mt-3 font-display italic underline underline-offset-4"
          style={{ color: "var(--accent-gold)", fontSize: 18 }}
        >
          Reserve a seat
        </button>
      </div>

      <p className="text-center font-display italic mt-14 mb-4"
         style={{ color: "var(--text-muted)", fontSize: 12 }}>
        Twenty-five chairs. No more, no less.
      </p>

      <button
        onClick={() => setSheet(true)}
        aria-label="Share a moment"
        className="fab-gradient fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition"
      >
        <Plus size={26} strokeWidth={2.2} />
      </button>

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
