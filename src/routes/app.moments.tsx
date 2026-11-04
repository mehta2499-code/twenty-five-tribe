import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PageBand, demoOnly } from "@/components/SocialUI";
import { AddMomentSheet } from "@/components/AddMomentSheet";
import { FRIENDS, MOMENTS } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/moments")({
  component: demoOnly(MomentsScreen, "Moments"),
});

const KEEP = new Set(["Milestone", "Life Update", "Remember When"]);

function MomentsScreen() {
  const [adding, setAdding] = useState(false);
  const items = MOMENTS.filter((m) => KEEP.has(m.tag)).slice(0, 6);
  const empty = items.length === 0;

  return (
    <>
      <PageBand
        eyebrow="moments"
        title="What's worth remembering."
        sub="Everything here fades in 72 hours."
      />

      {empty ? (
        <section className="px-8 mt-20 text-center">
          <p className="font-display italic text-cream" style={{ fontSize: 18, lineHeight: 1.5 }}>
            Share your first moment.
          </p>
          <p
            className="font-display italic mt-3"
            style={{ color: "var(--text-muted)", fontSize: 13 }}
          >
            A photo. A voice note. A milestone. The small things.
          </p>
          <button
            onClick={() => setAdding(true)}
            className="mt-6 rounded-full px-5 py-3 font-display italic"
            style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)", fontSize: 13 }}
          >
            Add a moment
          </button>
        </section>
      ) : (
        <section className="px-6 mt-12 space-y-12">
          {items.map((m) => {
            const f = FRIENDS.find((x) => x.id === m.friendId)!;
            return (
              <article key={m.id}>
                <Link to="/app/seat/$id" params={{ id: f.id }} className="block">
                  {m.photo && (
                    <div
                      className="mb-5 overflow-hidden rounded-2xl"
                      style={{ border: "1px solid var(--border-cool)" }}
                    >
                      <img
                        src={m.photo}
                        alt=""
                        loading="lazy"
                        className="w-full aspect-[5/4] object-cover"
                        style={{ filter: "saturate(0.9) brightness(0.95)" }}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Avatar src={f.avatar} initials={f.initials} color={f.color} size={36} />
                    <span className="font-display italic text-cool" style={{ fontSize: 13 }}>
                      {f.name}
                    </span>
                  </div>
                  <p
                    className="mt-3 font-display text-cream"
                    style={{ fontSize: 18, lineHeight: 1.5, letterSpacing: "-0.005em" }}
                  >
                    {m.text}
                  </p>
                </Link>
              </article>
            );
          })}
        </section>
      )}

      <p
        className="text-center font-display italic mt-16 mb-4 px-8"
        style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}
      >
        {VOICE.moments.sub}
      </p>

      {/* Floating Add Moment FAB */}
      <button
        onClick={() => setAdding(true)}
        aria-label="Add Moment"
        className="fixed z-30 active:scale-95 transition flex items-center gap-2 rounded-full pl-4 pr-5 py-3"
        style={{
          right: "calc(50% - 11rem)",
          bottom: "6.5rem",
          background: "var(--accent-bronze)",
          color: "var(--bg-primary)",
          boxShadow: "0 10px 30px rgba(216,182,114,0.45)",
        }}
      >
        <Plus size={18} strokeWidth={2.4} />
        <span className="font-display italic" style={{ fontSize: 13 }}>
          Add Moment
        </span>
      </button>

      {adding && (
        <AddMomentSheet onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} />
      )}
    </>
  );
}
