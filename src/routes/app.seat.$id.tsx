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
        <Link to="/app/home" className="block mt-6 font-display italic" style={{ color: "var(--accent-bronze)" }}>
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

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <section className="px-8 mt-14">
      <p className="label-caps text-center mb-6">{label}</p>
      {children}
    </section>
  );

  return (
    <div className="pb-16">
      <header className="px-5 pt-6 pb-2">
        <button
          onClick={() => navigate({ to: "/app/home" })}
          className="text-cool flex items-center gap-2"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
      </header>

      {/* Portrait */}
      <section className="px-6 pt-8 text-center">
        <div className="inline-block"
             style={{ boxShadow: "0 0 0 1px rgba(196,149,96,0.25), 0 0 40px rgba(216,123,60,0.18)", borderRadius: 9999 }}>
          <Avatar src={f.avatar} initials={f.initials} color={f.color} size={148} />
        </div>
        <h1 className="font-display italic text-cream mt-6" style={{ fontSize: 38, lineHeight: 1.05 }}>
          {f.name}
        </h1>
        {tag && (
          <p className="font-display italic mt-2"
             style={{ color: "var(--accent-bronze)", fontSize: 13, letterSpacing: "0.02em" }}>
            {tag.toLowerCase()}
          </p>
        )}
      </section>

      <Section label="why they're here">
        <p className="font-display italic text-cream text-center mx-auto max-w-[22rem]"
           style={{ fontSize: 22, lineHeight: 1.45 }}>
          "{reason}"
        </p>
      </Section>

      <Section label="how they see you">
        <ul className="space-y-3 text-center">
          {desc.they.map((t, i) => (
            <li key={i} className="font-display italic text-cream" style={{ fontSize: 17 }}>
              "{t}"
            </li>
          ))}
        </ul>
      </Section>

      <Section label="how you see them">
        <ul className="space-y-3 text-center">
          {desc.you.map((t, i) => (
            <li key={i} className="font-display italic text-cream" style={{ fontSize: 17 }}>
              "{t}"
            </li>
          ))}
        </ul>
      </Section>

      {thoughts.length > 0 && (
        <Section label="thoughts shared">
          <ul className="space-y-5">
            {thoughts.map((t) => (
              <li key={t.id} className="text-center">
                <p className="font-display italic text-cream" style={{ fontSize: 16, lineHeight: 1.45 }}>
                  {t.direction === "from" ? `${f.name} thought of you` : `you thought of ${f.name}`}
                  {t.note ? <> — <span className="text-cool">"{t.note}"</span></> : null}
                </p>
                <p className="font-display italic mt-1"
                   style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}>
                  {t.when}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section label="timeline">
        <ol className="relative ml-2 pl-6"
            style={{ borderLeft: "1px solid var(--border-cool)" }}>
          {timeline.map((e, i) => (
            <li key={i} className="mb-6 last:mb-0 relative">
              <span className="absolute -left-[29px] top-2 w-2 h-2 rounded-full"
                    style={{ background: "var(--accent-bronze)", boxShadow: "0 0 8px rgba(196,149,96,0.6)" }} />
              <p className="label-caps">{e.year}</p>
              <p className="font-display italic text-cream mt-1" style={{ fontSize: 16, lineHeight: 1.45 }}>
                {e.text}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {capsule && (
        <Section label="memories">
          <div className="grid grid-cols-3 gap-2">
            {capsule.photos.slice(0, 6).map((p, i) => (
              <div key={i} className="aspect-square overflow-hidden"
                   style={{ borderRadius: 8, border: "1px solid var(--border-cool)" }}>
                <img src={p} alt="" loading="lazy" className="w-full h-full object-cover"
                     style={{ filter: "saturate(0.9) brightness(0.95)" }} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <p className="text-center font-display italic mt-16 px-8"
         style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}>
        One of twenty-five. Irreplaceable.
      </p>
    </div>
  );
}
