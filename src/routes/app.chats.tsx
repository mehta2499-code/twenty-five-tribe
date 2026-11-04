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
import { mutualFriends, timeAgo, useSocial, type ChatMessage, type Snap } from "@/lib/social";
import { FriendPicker, Sheet, Toast } from "@/components/SocialUI";
import { useNavigate } from "@tanstack/react-router";
import { createGroup, member, unreadIn, useGroups } from "@/lib/groups";

const GROUP_EMOJIS = ["💬", "🏖️", "🎉", "🍕", "🎮", "📚", "💪", "🎬", "✈️", "🔥", "🫶", "🏏"];

function GroupsSection() {
  const st = useGroups();
  const navigate = useNavigate();
  const [step, setStep] = useState<"closed" | "name" | "pick">("closed");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [toast, setToast] = useState<string | null>(null);
  const groups = [...st.groups].sort((a, b) => {
    const la = st.msgs[a.id]?.at(-1)?.at ?? 0;
    const lb = st.msgs[b.id]?.at(-1)?.at ?? 0;
    return lb - la;
  });
  return (
    <section className="mt-5">
      <div className="px-5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-cream">Groups</h2>
        <button
          onClick={() => {
            setName("");
            setEmoji("💬");
            setStep("name");
          }}
          className="chip"
          style={{ background: "var(--lime)", color: "var(--on-accent)" }}
        >
          ＋ New group
        </button>
      </div>
      {groups.length === 0 ? (
        <p className="px-5 mt-2 meta">No groups yet. Make one for the trip, the gang, the gossip.</p>
      ) : (
        <ul className="mt-1">
          {groups.map((g) => {
            const last = st.msgs[g.id]?.at(-1);
            const n = unreadIn(st, g.id);
            return (
              <li key={g.id}>
                <Link
                  to="/app/group/$id"
                  params={{ id: g.id }}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-[var(--fill)]"
                >
                  <span
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                    style={{ background: "var(--fill)", border: "2px solid var(--edge)" }}
                  >
                    {g.emoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-cream truncate">{g.name}</span>
                    <span className="block meta truncate" style={{ color: n ? "var(--ink)" : undefined, fontWeight: n ? 700 : 400 }}>
                      {last
                        ? `${last.from === "me" ? "You" : member(last.from, st).name.split(" ")[0]}: ${last.text ?? ""}`
                        : `${g.members.length} members`}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    {last && <span className="block meta" style={{ fontSize: 12 }}>{timeAgo(last.at)}</span>}
                    {n > 0 && (
                      <span
                        className="inline-flex min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold items-center justify-center mt-0.5"
                        style={{ background: "var(--lime)", color: "var(--on-accent)" }}
                      >
                        {n}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {step === "name" && (
        <Sheet title="New group" onClose={() => setStep("closed")}>
          <div className="flex flex-wrap gap-2">
            {GROUP_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                className="w-11 h-11 rounded-full text-2xl flex items-center justify-center"
                style={{ background: emoji === e ? "var(--lime)" : "var(--fill)", border: "2px solid var(--edge)" }}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="Goa gang, Flatmates, Chaos club…"
            className="input mt-4 w-full"
            autoFocus
          />
          <button disabled={!name.trim()} onClick={() => setStep("pick")} className="btn-primary w-full mt-4">
            Pick who's in
          </button>
        </Sheet>
      )}
      {step === "pick" && (
        <FriendPicker
          title={`${emoji} ${name}`}
          cta="Create group"
          onClose={() => setStep("closed")}
          onPick={async (ids) => {
            setStep("closed");
            try {
              const id = await createGroup(name.trim(), emoji, ids);
              navigate({ to: "/app/group/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </section>
  );
}

export const Route = createFileRoute("/app/chats")({
  component: clientOnly(Chats),
});

function preview(m?: ChatMessage, typing?: boolean) {
  if (typing) return "Typing…";
  if (!m) return "No messages yet";
  const who = m.from === "me" ? "You: " : "";
  if (m.snapId) return m.from === "me" ? "You sent a snap" : "Sent you a snap";
  if (m.sharedPostId?.startsWith("game:")) return m.text ?? `${who}game invite`;
  if (m.sharedPostId?.startsWith("voice:")) return `${who}🎤 Voice note`;
  if (m.sharedPostId)
    return `${who}shared a ${m.sharedPostId.startsWith("reel") ? "reel" : "post"}`;
  return who + (m.text ?? "");
}

function Chats() {
  const s = useSocial();
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Snap | null>(null);
  const everyone = mutualFriends();
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
        sub="Mutual seats only. No randoms in your DMs."
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
          body="Chats unlock when you're in each other's 25. Seat your people and get them to seat you back."
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

          <GroupsSection />

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
