import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { PageBand, demoOnly } from "@/components/SocialUI";
import { FRIENDS, THOUGHTS } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/thoughts")({
  component: demoOnly(ThoughtsPage, "Thought of You"),
});

function ThoughtsPage() {
  const incoming = THOUGHTS.filter((t) => t.direction === "from");

  return (
    <div className="pb-8">
      <PageBand
        eyebrow="thought of you"
        title="Quiet pings."
        sub="Sometimes someone just thinks of you. That counts."
      />

      <section className="px-6 mt-14 space-y-14">
        {incoming.map((t) => {
          const f = FRIENDS.find((x) => x.id === t.friendId)!;
          return (
            <Link
              key={t.id}
              to="/app/seat/$id"
              params={{ id: f.id }}
              className="block text-center active:scale-[0.99] transition"
            >
              <div className="flex justify-center">
                <div
                  className="rounded-full"
                  style={{
                    boxShadow: "0 0 0 1px rgba(111,87,240,0.25), 0 0 28px rgba(111,87,240,0.18)",
                  }}
                >
                  <Avatar src={f.avatar} initials={f.initials} color={f.color} size={112} />
                </div>
              </div>
              <p className="font-display italic text-cream mt-5" style={{ fontSize: 20 }}>
                {f.name} thought of you.
              </p>
              {t.note && (
                <p
                  className="font-display italic mx-auto mt-3 max-w-[20rem]"
                  style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.5 }}
                >
                  "{t.note}"
                </p>
              )}
              <p
                className="font-display italic mt-3"
                style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}
              >
                {t.when}
              </p>
            </Link>
          );
        })}
      </section>

      <p
        className="text-center font-display italic mt-16 px-8"
        style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}
      >
        {VOICE.thoughts.footer}
      </p>
    </div>
  );
}
