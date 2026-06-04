import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, THOUGHTS } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/thoughts")({
  component: ThoughtsPage,
});

function ThoughtsPage() {
  const from = THOUGHTS.filter((t) => t.direction === "from");
  const to   = THOUGHTS.filter((t) => t.direction === "to");

  return (
    <div className="pb-8">
      <header className="px-6 pt-9 pb-2 text-center">
        <p className="label-caps">{VOICE.thoughts.header}</p>
        <h1 className="font-display italic text-cream mt-3" style={{ fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          {VOICE.thoughts.headline}
        </h1>
        <p className="font-display italic mt-3" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {VOICE.thoughts.sub}
        </p>
      </header>

      {/* Let-someone-know card */}
      <section className="px-5 mt-7">
        <button className="w-full card-editorial p-5 flex items-center gap-4 text-left active:scale-[0.995] transition"
                style={{ borderLeft: "3px solid var(--accent-bronze)" }}>
          <div className="die-tile" aria-hidden>♡</div>
          <div className="flex-1">
            <div className="font-display italic text-cream" style={{ fontSize: 18 }}>{VOICE.thoughts.sendCTA}</div>
            <div className="font-display italic" style={{ color: "var(--text-muted)", fontSize: 12 }}>{VOICE.thoughts.sendHint}</div>
          </div>
        </button>
      </section>


      <section className="px-6 mt-10">
        <p className="seat-chip text-center tracking-[0.3em] uppercase mb-5"
           style={{ fontStyle: "normal", fontSize: 10 }}>
          They thought of you
        </p>
        <ul className="space-y-7">
          {from.map((t) => {
            const f = FRIENDS.find((x) => x.id === t.friendId)!;
            return (
              <li key={t.id}>
                <Link to="/app/seat/$id" params={{ id: f.id }} className="flex items-start gap-4">
                  <Avatar src={f.avatar} initials={f.initials} color={f.color} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-cream" style={{ fontSize: 17, lineHeight: 1.35 }}>
                      <span className="italic">{f.name}</span> thought of you.
                    </p>
                    {t.note && (
                      <p className="font-display italic mt-1" style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.45 }}>
                        “{t.note}”
                      </p>
                    )}
                    <p className="font-display italic mt-1" style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {t.when}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="hairline mx-12 mt-12" />

      <section className="px-6 mt-12">
        <p className="seat-chip text-center tracking-[0.3em] uppercase mb-5"
           style={{ fontStyle: "normal", fontSize: 10 }}>
          You thought of them
        </p>
        <ul className="space-y-5">
          {to.map((t) => {
            const f = FRIENDS.find((x) => x.id === t.friendId)!;
            return (
              <li key={t.id} className="flex items-center gap-4">
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-display italic text-cream" style={{ fontSize: 15 }}>
                    you reached for <span className="text-cream">{f.name}</span>
                  </p>
                  <p className="font-display italic" style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {t.when}
                  </p>
                </div>
                <Link to="/app/seat/$id" params={{ id: f.id }} className="font-display italic"
                      style={{ color: "var(--accent-gold)", fontSize: 13 }}>
                  sit with them →
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-center font-display italic mt-14 px-8"
         style={{ color: "var(--text-muted)", fontSize: 12 }}>
        No likes. No reads. Just a hand on your shoulder.
      </p>
    </div>
  );
}
