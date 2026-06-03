import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  FRIENDS,
  RELATIONSHIP_TAGS,
  SEAT_REASONS,
  MUTUAL_DESCRIPTIONS,
  FRIENDSHIP_TIMELINE,
  THOUGHTS,
  CAPSULES,
} from "@/lib/data";

export const Route = createFileRoute("/app/seat/$id")({
  component: SeatPage,
});

function spaced(s: string) { return s.toUpperCase().split("").join(" "); }

function SeatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const f = FRIENDS.find((x) => x.id === id);

  if (!f) {
    return (
      <div className="px-8 pt-24 text-center">
        <p className="font-display italic text-cool" style={{ fontSize: 18 }}>
          This seat is empty.
        </p>
        <Link to="/app/home" className="block mt-6 font-display italic" style={{ color: "var(--accent-gold)" }}>
          Back to the table
        </Link>
      </div>
    );
  }

  const tag = RELATIONSHIP_TAGS[f.id];
  const reason = SEAT_REASONS[f.id] ?? "Because they belong here.";
  const desc = MUTUAL_DESCRIPTIONS[f.id] ?? MUTUAL_DESCRIPTIONS.default;
  const timeline = FRIENDSHIP_TIMELINE[f.id] ?? FRIENDSHIP_TIMELINE.default;
  const thoughts = THOUGHTS.filter((t) => t.friendId === f.id);
  const capsule = CAPSULES.find((c) => c.friendId === f.id);
  const months = Math.round(f.joinedDaysAgo / 30);
  const years = Math.max(1, Math.round(months / 12));

  return (
    <div className="pb-12">
      {/* quiet back */}
      <header className="px-5 pt-6 pb-2 flex items-center">
        <button
          onClick={() => navigate({ to: "/app/home" })}
          className="text-cool flex items-center gap-2"
          aria-label="Back to table"
        >
          <ArrowLeft size={18} />
          <span className="font-display italic" style={{ fontSize: 14 }}>back to your table</span>
        </button>
      </header>

      {/* Portrait */}
      <section className="px-6 pt-6 text-center">
        <div className="inline-block ring-active">
          <div className="rounded-full p-[3px]" style={{ background: "var(--bg-primary)" }}>
            <Avatar src={f.avatar} initials={f.initials} color={f.color} size={132} />
          </div>
        </div>
        <h1 className="font-display italic text-cream mt-5" style={{ fontSize: 40, lineHeight: 1.05 }}>
          {f.name}
        </h1>
        {tag && (
          <p className="seat-chip mt-2" style={{ fontSize: 13 }}>
            your {tag.toLowerCase()}
          </p>
        )}
        <p className="label-caps text-cool mt-3">{spaced(`Seated ${years > 1 ? `${years} years` : `${months} months`}`)}</p>
      </section>

      {/* Why they sit at your table */}
      <section className="px-8 mt-10">
        <p className="seat-chip text-center tracking-[0.3em] uppercase mb-4"
           style={{ fontStyle: "normal", fontSize: 10 }}>
          Why they're here
        </p>
        <p className="font-display italic text-cream text-center"
           style={{ fontSize: 22, lineHeight: 1.45 }}>
          “{reason}”
        </p>
      </section>

      <div className="hairline mx-12 mt-10" />

      {/* Mutual descriptions */}
      <section className="px-8 mt-10">
        <p className="seat-chip text-center tracking-[0.3em] uppercase mb-5"
           style={{ fontStyle: "normal", fontSize: 10 }}>
          How you've named each other
        </p>
        <div className="grid grid-cols-1 gap-6">
          <div className="text-center">
            <p className="label-caps text-cool mb-2">{spaced(`${f.name} of you`)}</p>
            <ul className="space-y-1.5">
              {desc.they.map((t, i) => (
                <li key={i} className="font-display italic text-cream" style={{ fontSize: 17 }}>
                  “{t}”
                </li>
              ))}
            </ul>
          </div>
          <div className="text-center">
            <p className="label-caps text-cool mb-2">{spaced(`You of ${f.name}`)}</p>
            <ul className="space-y-1.5">
              {desc.you.map((t, i) => (
                <li key={i} className="font-display italic text-cream" style={{ fontSize: 17 }}>
                  “{t}”
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="hairline mx-12 mt-10" />

      {/* Thought of You history */}
      {thoughts.length > 0 && (
        <section className="px-8 mt-10">
          <p className="seat-chip text-center tracking-[0.3em] uppercase mb-5"
             style={{ fontStyle: "normal", fontSize: 10 }}>
            Thought of you
          </p>
          <ul className="space-y-5">
            {thoughts.map((t) => (
              <li key={t.id} className="text-center">
                <p className="font-display italic text-cream" style={{ fontSize: 17, lineHeight: 1.4 }}>
                  {t.direction === "from" ? `${f.name} thought of you` : `you thought of ${f.name}`}
                  {t.note ? <> — <span className="text-cool">“{t.note}”</span></> : null}
                </p>
                <p className="font-display italic text-cool mt-1" style={{ fontSize: 12 }}>
                  {t.when}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="hairline mx-12 mt-10" />

      {/* Friendship timeline */}
      <section className="px-8 mt-10">
        <p className="seat-chip text-center tracking-[0.3em] uppercase mb-6"
           style={{ fontStyle: "normal", fontSize: 10 }}>
          Your timeline
        </p>
        <ol className="relative ml-2 pl-6"
            style={{ borderLeft: "1px solid var(--border-cool)" }}>
          {timeline.map((e, i) => (
            <li key={i} className="mb-6 last:mb-0 relative">
              <span className="absolute -left-[29px] top-2 w-2 h-2 rounded-full"
                    style={{ background: "var(--accent-gold)", boxShadow: "0 0 8px rgba(226,184,115,0.6)" }} />
              <p className="label-caps text-cool">{spaced(e.year)}</p>
              <p className="font-display italic text-cream mt-1" style={{ fontSize: 16, lineHeight: 1.4 }}>
                {e.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Shared memories (capsule photos) */}
      {capsule && (
        <>
          <div className="hairline mx-12 mt-10" />
          <section className="px-8 mt-10">
            <p className="seat-chip text-center tracking-[0.3em] uppercase mb-5"
               style={{ fontStyle: "normal", fontSize: 10 }}>
              Shared memories
            </p>
            <div className="grid grid-cols-3 gap-2">
              {capsule.photos.slice(0, 6).map((p, i) => (
                <div key={i} className="aspect-square overflow-hidden"
                     style={{ borderRadius: 6, border: "1px solid var(--border-cool)" }}>
                  <img src={p} alt="" loading="lazy" className="w-full h-full object-cover" style={{ filter: "saturate(0.9) brightness(0.95)" }} />
                </div>
              ))}
            </div>
            <Link to="/app/capsules" className="block text-center mt-6 font-display italic"
                  style={{ color: "var(--accent-gold)", fontSize: 15 }}>
              Open the memory capsule →
            </Link>
          </section>
        </>
      )}

      {/* Soft footer */}
      <p className="text-center font-display italic mt-14 px-8"
         style={{ color: "var(--text-muted)", fontSize: 12 }}>
        One of twenty-five. Irreplaceable.
      </p>
    </div>
  );
}
