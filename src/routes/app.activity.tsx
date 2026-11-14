import { EmojiText } from "@/components/Glyph3D";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { EmptyState, PageBand, clientOnly } from "@/components/SocialUI";
import { Bell, Lock } from "lucide-react";
import { describe, linkFor, markAllRead, markRead, useActivity } from "@/lib/activity";
import { friendById, timeAgo } from "@/lib/social";

export const Route = createFileRoute("/app/activity")({
  head: () => ({ meta: [{ title: "Activity · 25" }] }),
  component: clientOnly(ActivityScreen),
});

function ActivityScreen() {
  const st = useActivity();
  const navigate = useNavigate();
  // Opening the screen marks everything read right away (the bell clears), but
  // the ones that were new stay highlighted for this visit.
  const [fresh, setFresh] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!st.loaded) return;
    const unread = st.items.filter((i) => !i.read && i.id).map((i) => i.id!);
    setFresh((prev) => new Set([...(prev ?? []), ...unread]));
    if (unread.length) void markAllRead();
  }, [st.loaded, st.items]);

  return (
    <div className="pb-8">
      <PageBand title="Activity" sub="Who seated you, liked, commented, and picked you." back />
      {!st.loaded ? (
        <p className="meta text-center mt-10">Loading…</p>
      ) : st.items.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Bell}
            title="Quiet for now"
            body="When someone seats you, likes your post or picks you in a poll, it shows up here."
          />
        </div>
      ) : (
        <ul className="px-5 grid gap-2.5">
          {st.items.map((a) => {
            const d = describe(a);
            const f = a.actor ? friendById(a.actor) : undefined;
            const isNew = !!a.id && !!fresh?.has(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    void markRead(a.id);
                    navigate({ to: linkFor(a) as "/app/home" });
                  }}
                  className="card w-full text-left flex items-center gap-3 p-3 hover:bg-[var(--fill)]"
                  style={{ borderColor: isNew ? "var(--lime)" : undefined }}
                >
                  <span className="relative shrink-0">
                    {a.actor ? (
                      <Avatar
                        src={f?.avatar || undefined}
                        initials={f?.initials ?? a.actorName?.slice(0, 2).toUpperCase() ?? "?"}
                        color={f?.color}
                        size={44}
                      />
                    ) : (
                      <span
                        className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
                        style={{ background: "var(--sun)", border: "var(--bd)" }}
                      >
                        <Lock
                          size={20}
                          strokeWidth={2.25}
                          aria-hidden="true"
                          style={{ color: "var(--on-accent)" }}
                        />
                      </span>
                    )}
                    <span
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: d.tone, color: "var(--on-accent)", border: "var(--bd)" }}
                    >
                      <d.Icon size={12} strokeWidth={2.5} aria-hidden="true" />
                    </span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-cream text-[14.5px] leading-snug line-clamp-2">
                      <EmojiText text={d.text} />
                    </span>
                    <span className="meta">{timeAgo(a.at)}</span>
                  </span>
                  {isNew && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: "var(--lime)" }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
