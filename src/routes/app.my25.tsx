import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, SEATS_FILLED, SEATS_TOTAL, WAITING_ROOM, type Friend } from "@/lib/data";

export const Route = createFileRoute("/app/my25")({
  component: My25,
});

function driftMeta(days: number) {
  if (days >= 21) return { label: "21+ days quiet", color: "var(--drift-gone)", note: `You haven't talked in ${days} days. Just saying.` };
  if (days >= 14) return { label: "14 days quiet", color: "var(--drift-quiet)", note: "It's been a minute. Send a vibe?" };
  return { label: "Active", color: "var(--drift-active)", note: "You two have been talking. Nice." };
}

function My25() {
  const [selected, setSelected] = useState<Friend | null>(null);
  const [waitingOpen, setWaitingOpen] = useState(false);
  const seats: (Friend | null)[] = Array.from({ length: SEATS_TOTAL }, (_, i) => FRIENDS[i] ?? null);

  return (
    <>
      <header className="px-5 pt-6 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">My 25</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {SEATS_FILLED} / {SEATS_TOTAL} seats filled
          </p>
        </div>
        <button
          onClick={() => setWaitingOpen(true)}
          className="relative rounded-full bg-surface border border-border px-3 py-1.5 text-xs font-medium"
        >
          Waiting Room
          <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
            {WAITING_ROOM.length}
          </span>
        </button>
      </header>

      {SEATS_FILLED === SEATS_TOTAL && (
        <p className="px-5 text-xs text-muted-foreground italic mb-2">
          All 25 taken. Someone's gotta go for someone new to come in. That's just life.
        </p>
      )}

      <section className="px-4 grid grid-cols-5 gap-2.5">
        {seats.map((f, i) => (
          <button
            key={i}
            onClick={() => f && setSelected(f)}
            className="aspect-square rounded-2xl flex flex-col items-center justify-center text-center p-1.5 transition"
            style={
              f
                ? { background: "var(--surface)", border: "1px solid var(--border)" }
                : {
                    background: "transparent",
                    border: "1.5px dashed color-mix(in oklab, var(--primary) 45%, transparent)",
                  }
            }
          >
            {f ? (
              <>
                <Avatar initials={f.initials} color={f.color} size={36} />
                <span className="text-[10px] mt-1 truncate w-full">{f.name}</span>
              </>
            ) : (
              <Plus size={20} className="text-primary/60" />
            )}
          </button>
        ))}
      </section>

      <p className="px-6 text-center text-xs text-muted-foreground/70 italic mt-6">
        {SEATS_FILLED < SEATS_TOTAL ? "An empty seat. Someone's missing." : "Every seat is taken. For now."}
      </p>

      {/* Seat detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-surface rounded-t-3xl p-6 border-t border-border animate-soft-in">
            <div className="flex items-center gap-4">
              <Avatar initials={selected.initials} color={selected.color} size={64} />
              <div className="flex-1">
                <h3 className="text-xl font-bold">{selected.name}</h3>
                <p className="text-xs text-muted-foreground">
                  In your 25 for {Math.round(selected.joinedDaysAgo / 30)} months
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground"><X size={20} /></button>
            </div>

            {(() => {
              const d = driftMeta(selected.daysQuiet);
              return (
                <div className="mt-5 rounded-2xl bg-background/60 border border-border p-4 flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color, boxShadow: `0 0 12px ${d.color}` }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: d.color }}>{d.label}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.note}</p>
                  </div>
                </div>
              );
            })()}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button className="rounded-full bg-primary text-primary-foreground py-3 font-semibold hover:bg-primary-glow transition">
                Send a vibe
              </button>
              <button className="rounded-full bg-transparent border border-border text-foreground/80 py-3 font-medium hover:bg-surface-2 transition">
                Remove from 25
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting room sheet */}
      {waitingOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setWaitingOpen(false)} />
          <div className="relative w-full max-w-md bg-surface rounded-t-3xl p-6 border-t border-border animate-soft-in">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold">Waiting Room</h3>
              <button onClick={() => setWaitingOpen(false)} className="text-muted-foreground"><X size={20} /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              They want in. Your seats are full — for now.
            </p>
            <ul className="space-y-2">
              {WAITING_ROOM.map((w) => (
                <li key={w.id} className="flex items-center gap-3 rounded-2xl bg-background/60 border border-border p-3">
                  <Avatar initials={w.initials} size={44} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{w.name}</div>
                    <div className="text-xs text-muted-foreground">{w.mutuals} mutuals</div>
                  </div>
                  <button className="text-xs font-semibold text-primary px-3 py-1.5 rounded-full border border-primary/40">
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
