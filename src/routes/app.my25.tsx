import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, SEATS_FILLED, SEATS_TOTAL, WAITING_ROOM, type Friend } from "@/lib/data";

export const Route = createFileRoute("/app/my25")({
  component: My25,
});

function spaced(s: string) { return s.toUpperCase().split("").join(" "); }

function driftMeta(days: number) {
  if (days >= 21) return { label: "21+ days quiet", color: "#C94040", note: `You haven't talked in ${days} days. Just saying.` };
  if (days >= 14) return { label: "14 days quiet", color: "#D4A96A", note: "It's been a minute. Send a vibe?" };
  return { label: "Active", color: "#1D9E75", note: "You two have been talking. Nice." };
}

function My25() {
  const [_selected, _setSelected] = useState<Friend | null>(null);
  void _selected; void _setSelected;
  const [waitingOpen, setWaitingOpen] = useState(false);
  const seats: (Friend | null)[] = Array.from({ length: SEATS_TOTAL }, (_, i) => FRIENDS[i] ?? null);

  return (
    <>
      <header className="px-5 pt-7 pb-4">
        <p className="label-caps text-cool">{spaced(`${SEATS_FILLED} of ${SEATS_TOTAL}`)}</p>
        <h1 className="font-display italic text-warm mt-2" style={{ fontSize: 34, lineHeight: 1.1 }}>
          The Seats
        </h1>
        <div className="mt-3 flex items-center justify-between">
          <p className="font-display italic text-cool" style={{ fontSize: 13 }}>
            Twenty-five people. No more.
          </p>
          <button
            onClick={() => setWaitingOpen(true)}
            className="rounded-full px-3 py-1.5 label-caps text-warm"
            style={{ background: "#1A2D3E", border: "1px solid var(--border-cool)" }}
          >
            Waiting · <span style={{ color: "#D4A96A" }}>{WAITING_ROOM.length}</span>
          </button>
        </div>
      </header>

      <section className="px-5 grid grid-cols-5 gap-y-5 gap-x-3 mt-2">
        {seats.map((f, i) => (
          <button
            key={i}
            onClick={() => f && setSelected(f)}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            {f ? (
              <>
                <Avatar
                  src={f.avatar}
                  initials={f.initials}
                  color={f.color}
                  size={56}
                  ring={f.postedToday ? "gold" : "none"}
                />
                <span
                  className="font-display italic truncate w-full"
                  style={{ fontSize: 11, color: "#F2F0EB" }}
                >
                  {f.name}
                </span>
              </>
            ) : (
              <>
                <div
                  className="rounded-full"
                  style={{
                    width: 56,
                    height: 56,
                    border: "1.5px dashed #3D5060",
                    background: "transparent",
                  }}
                />
                <span className="font-display italic" style={{ fontSize: 10, color: "#3D5060" }}>
                  empty
                </span>
              </>
            )}
          </button>
        ))}
      </section>

      <p className="px-8 text-center font-display italic text-cool mt-8" style={{ fontSize: 14 }}>
        {SEATS_FILLED < SEATS_TOTAL ? "An empty seat. Someone's missing." : "Every seat is taken. For now."}
      </p>

      {/* Seat detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md rounded-t-3xl p-6 animate-soft-in" style={{ background: "#132030", borderTop: "1px solid var(--border-cool)" }}>
            <div className="flex items-center gap-4">
              <Avatar src={selected.avatar} initials={selected.initials} color={selected.color} size={64} />
              <div className="flex-1">
                <h3 className="font-display italic text-warm" style={{ fontSize: 22 }}>{selected.name}</h3>
                <p className="label-caps text-cool mt-1">
                  {spaced(`In your 25 · ${Math.round(selected.joinedDaysAgo / 30)} months`)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-cool"><X size={20} /></button>
            </div>

            {(() => {
              const d = driftMeta(selected.daysQuiet);
              return (
                <div className="mt-5 rounded-2xl p-4 flex items-start gap-3" style={{ background: "#0D1820", border: "1px solid var(--border-cool)" }}>
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color, boxShadow: `0 0 12px ${d.color}` }} />
                  <div>
                    <div className="label-caps" style={{ color: d.color }}>{spaced(d.label)}</div>
                    <p className="font-display italic text-cool mt-1" style={{ fontSize: 13 }}>{d.note}</p>
                  </div>
                </div>
              );
            })()}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button className="rounded-full btn-capsule py-3 font-display italic">Send a vibe</button>
              <button className="rounded-full py-3 font-display italic text-warm" style={{ background: "transparent", border: "1px solid var(--border-cool)" }}>
                Remove from 25
              </button>
            </div>
          </div>
        </div>
      )}

      {waitingOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setWaitingOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl p-6 animate-soft-in" style={{ background: "#132030" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display italic text-warm" style={{ fontSize: 20 }}>Waiting Room</h3>
              <button onClick={() => setWaitingOpen(false)} className="text-cool"><X size={20} /></button>
            </div>
            <p className="font-display italic text-cool mb-4" style={{ fontSize: 13 }}>
              They want in. Your seats are full — for now.
            </p>
            <ul className="space-y-2">
              {WAITING_ROOM.map((w) => (
                <li key={w.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "#0D1820", border: "1px solid var(--border-cool)" }}>
                  <Avatar src={w.avatar} initials={w.initials} size={44} />
                  <div className="flex-1">
                    <div className="font-display text-warm" style={{ fontSize: 14 }}>{w.name}</div>
                    <div className="label-caps text-cool mt-0.5">{spaced(`${w.mutuals} mutuals`)}</div>
                  </div>
                  <button className="label-caps px-3 py-1.5 rounded-full" style={{ color: "#D4A96A", border: "1px solid rgba(212,169,106,0.45)" }}>
                    Hold
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
