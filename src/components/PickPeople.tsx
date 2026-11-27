/**
 * Pick people from your 25 for a game: a grid of faces (no sideways
 * scrolling). Picked ones get a lime ring and a tick; once you hit the
 * limit the rest dim. Long lists show the first two rows, then "Show all".
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { Avatar } from "@/components/Avatar";

type P = { id: string; name: string; avatar?: string | null; initials: string; color?: string };

export function PickPeople({
  people,
  picked,
  onToggle,
  max,
}: {
  people: P[];
  picked: string[];
  onToggle: (id: string) => void;
  max: number;
}) {
  const [all, setAll] = useState(false);
  const ROWS = 10; // two rows of five
  // Keep anyone you've picked visible even when the list is folded.
  const shown = all ? people : people.filter((p, i) => i < ROWS || picked.includes(p.id));
  const full = picked.length >= max;
  return (
    <div>
      <p className="meta mb-2" style={{ fontSize: 12.5 }} aria-live="polite">
        {picked.length ? `${picked.length} of ${max} picked` : `Pick up to ${max}`}
      </p>
      <div className="grid grid-cols-5 gap-x-2 gap-y-3">
        {shown.map((p) => {
          const on = picked.includes(p.id);
          const off = full && !on;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => !off && onToggle(p.id)}
              aria-pressed={on}
              aria-disabled={off}
              aria-label={`${p.name}${on ? ", picked" : ""}`}
              className="flex flex-col items-center min-w-0"
              style={{ opacity: off ? 0.35 : 1 }}
            >
              <span
                className="relative rounded-full p-[2px]"
                style={{ background: on ? "var(--lime)" : "transparent" }}
              >
                <Avatar
                  src={p.avatar || undefined}
                  initials={p.initials}
                  color={p.color}
                  size={48}
                />
                {on && (
                  <span
                    className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--lime)",
                      color: "var(--on-accent)",
                      border: "2px solid var(--surface)",
                    }}
                    aria-hidden="true"
                  >
                    <Check size={12} strokeWidth={3.5} />
                  </span>
                )}
              </span>
              <span className="text-[11px] mt-1 truncate w-full text-center text-cream">
                {p.name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
      {people.length > ROWS && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 w-full min-h-[40px] text-[13.5px] font-bold"
          style={{ color: "var(--ink-2)" }}
        >
          {all ? "Show fewer" : `Show all ${people.length}`}
        </button>
      )}
    </div>
  );
}
