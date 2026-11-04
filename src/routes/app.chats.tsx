import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, MessageCircle, Search, UserPlus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  EmptyState,
  PageBand,
  Section,
  SkeletonRows,
  SnapViewer,
  StreakBadge,
  clientOnly,
} from "@/components/SocialUI";
import { seatedFriends, timeAgo, useSocial, type ChatMessage, type Snap } from "@/lib/social";

export const Route = createFileRoute("/app/chats")({
  component: clientOnly(Chats),
});

function preview(m?: ChatMessage, typing?: boolean) {
  if (typing) return "Typing…";
  if (!m) return "No messages yet";
  const who = m.from === "me" ? "You: " : "";
  if (m.snapId) return m.from === "me" ? "You sent a snap" : "Sent you a snap";
  if (m.sharedPostId?.startsWith("game:")) return m.text ?? `${who}game invite`;
  if (m.sharedPostId)
    return `${who}shared a ${m.sharedPostId.startsWith("reel") ? "reel" : "post"}`;
  return who + (m.text ?? "");
}

function Chats() {
  const s = useSocial();
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Snap | null>(null);
  const everyone = seatedFriends();
  const term = q.trim().toLowerCase();

  const rows = everyone
    .filter((f) => !term || f.name.toLowerCase().includes(term) || f.username?.includes(term))
    .map((f) => {
      const msgs = s.chats[f.id] ?? [];
      return { f, last: msgs[msgs.length - 1] };
    })
    .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));

  const unopened = s.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me"));

  return (
    <div className="pb-6">
      <PageBand
        title="Chats"
        sub="Only your 25 can message you."
        actions={
          <Link
            to="/app/snap"
            search={{ to: undefined }}
            aria-label="New snap"
            className="btn-quiet btn-icon"
          >
            <Camera size={20} />
          </Link>
        }
      />

      {s.loading ? (
        <SkeletonRows count={6} />
      ) : everyone.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No one at your table yet"
          body="Save a seat for someone. Once they accept, you can message and snap each other."
          action={
            <Link to="/app/people" className="btn-primary px-5">
              <UserPlus size={18} /> Find your people
            </Link>
          }
        />
      ) : (
        <>
          {unopened.length > 0 && (
            <Section title="New snaps" aside={`${unopened.length} to open`} className="mt-2">
              <ul className="flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
                {unopened.map((snap) => {
                  const f = everyone.find((x) => x.id === snap.from);
                  if (!f) return null;
                  return (
                    <li key={snap.id}>
                      <button
                        onClick={() => setViewing(snap)}
                        className="flex flex-col items-center w-16"
                        aria-label={`Open snap from ${f.name}`}
                      >
                        <span
                          className="rounded-full p-[2.5px]"
                          style={{
                            background: "linear-gradient(135deg, var(--accent-2), var(--hot))",
                          }}
                        >
                          <span
                            className="block rounded-full p-[2px]"
                            style={{ background: "var(--page)" }}
                          >
                            <Avatar
                              src={f.avatar || undefined}
                              initials={f.initials}
                              color={f.color}
                              size={52}
                            />
                          </span>
                        </span>
                        <span className="mt-1.5 text-[13px] text-cream truncate w-full text-center">
                          {f.name.split(" ")[0]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <div className="px-5 mt-5">
            <label className="field" htmlFor="chat-search">
              <Search size={18} className="text-faint shrink-0" aria-hidden="true" />
              <input
                id="chat-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your 25"
                autoComplete="off"
              />
            </label>
          </div>

          <ul className="mt-2">
            {rows.map(({ f, last }) => {
              const unread = s.unread[f.id] ?? 0;
              const typing = s.typing[f.id];
              return (
                <li key={f.id}>
                  <Link
                    to="/app/chat/$id"
                    params={{ id: f.id }}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--fill)]"
                  >
                    <Avatar
                      src={f.avatar || undefined}
                      initials={f.initials}
                      color={f.color}
                      size={52}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="font-semibold text-cream truncate"
                          style={{ fontSize: 16 }}
                        >
                          {f.name}
                        </span>
                        <StreakBadge friendId={f.id} />
                      </div>
                      <p
                        className="truncate mt-0.5"
                        style={{
                          fontSize: 14,
                          color: typing ? "var(--mint)" : unread ? "var(--ink)" : "var(--ink-3)",
                          fontWeight: unread ? 600 : 400,
                        }}
                      >
                        {preview(last, typing)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 self-start pt-1">
                      <span
                        className="meta tabular-nums"
                        style={{ fontSize: 12, color: unread ? "var(--blue-deep)" : undefined }}
                      >
                        {last ? timeAgo(last.at) : ""}
                      </span>
                      {unread > 0 && (
                        <span
                          className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center tabular-nums"
                          style={{
                            background: "var(--blue-deep)",
                            color: "var(--on-accent)",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                          aria-label={`${unread} unread`}
                        >
                          {unread}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
            {rows.length === 0 && term && (
              <li className="px-5 py-8 text-center meta">No one in your 25 matches "{q}".</li>
            )}
          </ul>
        </>
      )}

      {viewing && <SnapViewer snap={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
