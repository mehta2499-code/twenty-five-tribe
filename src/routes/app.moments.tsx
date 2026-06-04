import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, MOMENTS } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/moments")({
  component: MomentsScreen,
});

// Strip everything that's just status / mood / chatter.
const KEEP = new Set(["Milestone", "Life Update", "Remember When"]);

function MomentsScreen() {
  const items = MOMENTS.filter((m) => KEEP.has(m.tag)).slice(0, 6);

  return (
    <>
      <header className="px-6 pt-12 pb-2 text-center">
        <p className="label-caps">moments</p>
        <h1 className="font-display italic text-cream mt-4"
            style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          What's worth remembering.
        </h1>
      </header>

      <section className="px-6 mt-12 space-y-12">
        {items.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          return (
            <article key={m.id}>
              <Link to="/app/seat/$id" params={{ id: f.id }} className="block">
                {m.photo && (
                  <div className="mb-5 overflow-hidden rounded-2xl"
                       style={{ border: "1px solid var(--border-cool)" }}>
                    <img src={m.photo} alt="" loading="lazy"
                         className="w-full aspect-[5/4] object-cover"
                         style={{ filter: "saturate(0.9) brightness(0.95)" }} />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Avatar src={f.avatar} initials={f.initials} color={f.color} size={36} />
                  <span className="font-display italic text-cool" style={{ fontSize: 13 }}>
                    {f.name}
                  </span>
                </div>
                <p className="mt-3 font-display text-cream"
                   style={{ fontSize: 18, lineHeight: 1.5, letterSpacing: "-0.005em" }}>
                  {m.text}
                </p>
              </Link>
            </article>
          );
        })}
      </section>

      <p className="text-center font-display italic mt-16 mb-4 px-8"
         style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}>
        {VOICE.moments.sub}
      </p>
    </>
  );
}
