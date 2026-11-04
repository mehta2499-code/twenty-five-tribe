import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { StreakBadge, SnapViewer, clientOnly, PageBand } from "@/components/SocialUI";
import { seatedFriends, timeAgo, useSocial, type ChatMessage, type Snap } from "@/lib/social";

export const Route = createFileRoute("/app/chats")({
  component: clientOnly(Chats),
});

function preview(m?: ChatMessage, typing?: boolean) {
  if (typing) return "typing…";
  if (!m) return "Say hi. It's been a minute.";
  const who = m.from === "me" ? "You: " : "";
  if (m.snapId) return m.from === "me" ? "You sent a snap" : "New snap · tap to open";
  if (m.sharedPostId?.startsWith("game:")) return m.text ?? `${who}invited you to a game`;
  if (m.sharedPostId)
    return `${who}shared a ${m.sharedPostId.startsWith("reel") ? "reel" : "post"}`;
  return who + (m.text ?? "");
}

function Chats() {
  const s = useSocial();
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Snap | null>(null);

  const people = seatedFriends()
    .filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()))
    .map((f) => {
      const msgs = s.chats[f.id] ?? [];
      return { f, last: msgs[msgs.length - 1] };
    })
    .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));

  const unopened = s.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me"));

  return (
    <div className="pb-6">
      <PageBand
        eyebrow="chats"
        title="Only your 25 can text you."
        sub="Streaks, snaps and the group gossip. Nobody else."
      />

      {unopened.length > 0 && (
        <section className="mt-8">
          <p className="label-caps px-6 mb-3">new snaps</p>
          <div className="flex gap-4 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {unopened.map((snap) => {
              const f = seatedFriends().find((x) => x.id === snap.from);
              if (!f) return null;
              return (
                <button
                  key={snap.id}
                  onClick={() => setViewing(snap)}
                  className="flex flex-col items-center shrink-0 active:scale-95 transition"
                  style={{ width: 64 }}
                >
                  <div
                    className="rounded-full p-[2px]"
                    style={{
                      background:
                        "linear-gradient(135deg,var(--accent-oxblood),var(--accent-ember))",
                    }}
                  >
                    <div
                      className="rounded-full p-[2px]"
                      style={{ background: "var(--bg-primary)" }}
                    >
                      <Avatar src={f.avatar} initials={f.initials} color={f.color} size={52} />
                    </div>
                  </div>
                  <span
                    className="font-display italic mt-1.5 text-cream truncate w-full text-center"
                    style={{ fontSize: 11 }}
                  >
                    {f.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="px-6 mt-8">
        <label
          className="flex items-center gap-2 rounded-full px-4 py-2.5"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-cool)" }}
        >
          <Search size={16} className="text-faint" />
          <input
            id="chat-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find one of your people"
            className="bg-transparent outline-none flex-1 text-cream"
            style={{ fontSize: 14 }}
          />
        </label>
      </div>

      {s.mode === "live" && people.length === 0 && !q && (
        <div className="px-6 mt-8 text-center">
          <p className="text-cream font-semibold" style={{ fontSize: 16 }}>
            No one at your table yet.
          </p>
          <p className="mt-1" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Save a seat for someone and you can start talking.
          </p>
          <Link to="/app/people" className="btn-bronze inline-block mt-4 px-5 py-2.5">
            Find your people
          </Link>
        </div>
      )}

      <ul className="mt-4">
        {people.map(({ f, last }) => {
          const unread = s.unread[f.id] ?? 0;
          const typing = s.typing[f.id];
          return (
            <li key={f.id}>
              <Link
                to="/app/chat/$id"
                params={{ id: f.id }}
                className="flex items-center gap-4 px-6 py-3.5 active:bg-white/[0.03] transition"
              >
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={50} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-cream truncate" style={{ fontSize: 16 }}>
                      {f.name}
                    </span>
                    <StreakBadge friendId={f.id} />
                  </div>
                  <p
                    className="truncate mt-0.5"
                    style={{
                      fontSize: 13,
                      color: typing
                        ? "var(--accent-sage)"
                        : unread
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                      fontWeight: unread ? 500 : 400,
                    }}
                  >
                    {preview(last, typing)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: 11,
                      color: unread ? "var(--accent-bronze)" : "var(--text-muted)",
                    }}
                  >
                    {last ? timeAgo(last.at) : ""}
                  </span>
                  {unread > 0 && (
                    <span
                      className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center tabular-nums"
                      style={{
                        background: "var(--accent-bronze)",
                        color: "var(--bg-primary)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <p
        className="text-center font-display italic mt-10 px-8"
        style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}
      >
        🔥 is your snap streak. ⏳ means snap them today or it resets.
      </p>

      {viewing && <SnapViewer snap={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
