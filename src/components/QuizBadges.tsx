/** Quiz badge sticker and the "Knows … best" list. */
import { useEffect, useState } from "react";
import { Crown, Medal } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { friendById, meView, useSocial } from "@/lib/social";
import { badgeOf, knowsBest, type Badge, type Best } from "@/lib/quiz";

export const BADGE_NAME = { ride: "Ride or Die", real: "Real One" } as const;
/** Ring colour around a face on the Table. */
export const BADGE_RING = { ride: "var(--sun)", real: "var(--sky)" } as const;

export function QuizBadge({ badge, small }: { badge: Badge; small?: boolean }) {
  if (!badge) return null;
  const Icon = badge === "ride" ? Crown : Medal;
  return (
    <span
      className={`sticker ${badge === "ride" ? "sun" : "sky"} whitespace-nowrap`}
      style={small ? { fontSize: 11, padding: "1px 8px", transform: "rotate(-2deg)" } : undefined}
    >
      <Icon size={small ? 11 : 13} strokeWidth={2.5} aria-hidden="true" />
      {BADGE_NAME[badge]}
    </span>
  );
}

/** "Knows you best": the top 3 scores on someone's quiz. */
export function KnowsBest({ userId, title }: { userId: string; title: string }) {
  const s = useSocial();
  const [rows, setRows] = useState<{ guesser: string; score: number; total: number }[] | null>(
    null,
  );
  useEffect(() => {
    if (s.mode !== "live") return;
    void knowsBest(userId).then(setRows);
  }, [userId, s.mode]);
  if (!rows || rows.length === 0) return null;
  const myId = s.me?.id;
  return (
    <section className="px-5 mt-8">
      <h2 className="heading" style={{ fontSize: 18 }}>
        {title}
      </h2>
      <p className="meta mt-0.5">Top scores on the quiz. 7/7 is Ride or Die, 6/7 is a Real One.</p>
      <ol className="mt-3 grid gap-2.5">
        {rows.map((r, i) => {
          const me = r.guesser === myId;
          const f = me ? null : friendById(r.guesser);
          const v = me ? meView() : null;
          const name = me ? "You" : (f?.name ?? "Someone");
          const best: Best = { score: r.score, total: r.total };
          return (
            <li key={r.guesser} className="card p-3 flex items-center gap-3">
              <span className="w-6 text-center font-extrabold tabular-nums text-cool">{i + 1}</span>
              <Avatar
                src={(me ? v?.avatar : f?.avatar) || undefined}
                initials={(me ? v?.initials : f?.initials) ?? "?"}
                color={f?.color}
                size={40}
              />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-cream truncate">{name}</span>
                <span className="block meta tabular-nums">
                  {r.score}/{r.total} right
                </span>
              </span>
              <QuizBadge badge={badgeOf(best)} small />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
