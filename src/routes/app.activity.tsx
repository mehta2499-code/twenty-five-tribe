import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Avatar } from "@/components/Avatar";
import { EmptyState, PageBand, clientOnly } from "@/components/SocialUI";
import { Bell, Lock } from "lucide-react";
import { describe, markAllRead, useActivity, type Activity } from "@/lib/activity";
import { friendById, timeAgo } from "@/lib/social";

export const Route = createFileRoute("/app/activity")({
  head: () => ({ meta: [{ title: "Activity · 25" }] }),
  component: clientOnly(ActivityScreen),
});

function target(a: Activity): { to: string; params?: Record<string, string> } {
  if (a.kind === "seated" || a.kind === "unseated") return { to: "/app/people" };
  if (a.kind === "seated_back" && a.actor) return { to: "/app/seat/$id", params: { id: a.actor } };
  if (a.kind === "like" || a.kind === "comment") return { to: "/app/feed" };
  if (a.kind === "word_done" && a.ref?.startsWith("game:"))
    return { to: "/app/play/$id", params: { id: a.ref.slice(5) } };
  if (a.kind === "poll") return { to: "/app/polls" };
  if (a.kind === "mention_all" && a.ref?.startsWith("group:"))
    return { to: "/app/group/$id", params: { id: a.ref.slice(6) } };
  if (a.kind === "daily_score" || a.kind === "daily_top" || a.kind === "word_daily")
    return { to: "/app/games" };
  if (a.kind === "drop" || a.kind === "drop_like" || a.kind === "drop_comment")
    return { to: "/app/drop" };
  if (a.kind === "card") return { to: "/app/card/$id", params: { id: "me" } };
  return { to: "/app/home" };
}

function ActivityScreen() {
  const st = useActivity();
  // Opening the screen marks everything as seen (after a beat, so the new dots show first).
  useEffect(() => {
    const t = setTimeout(() => void markAllRead(), 1500);
    return () => clearTimeout(t);
  }, [st.items.length]);

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
            const t = target(a);
            return (
              <li key={a.id}>
                <Link
                  to={t.to}
                  params={t.params}
                  className="card flex items-center gap-3 p-3 hover:bg-[var(--fill)]"
                  style={{ borderColor: a.read ? undefined : "var(--lime)" }}
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
                      {d.text}
                    </span>
                    <span className="meta">{timeAgo(a.at)}</span>
                  </span>
                  {!a.read && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: "var(--lime)" }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
