import { Tour } from "@/components/Tour";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Camera, MessageCircle, Search, UserPlus, Users } from "lucide-react";
import { GroupFace } from "@/components/GroupFace";
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
    <section className="mt-3">
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
        <p className="px-5 mt-2 meta">
          No groups yet. Make one for the trip, the gang, the gossip.
        </p>
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
                  <GroupFace avatar={g.avatar} emoji={g.emoji} size={48} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-cream truncate">{g.name}</span>
                    <span
                      className="block meta truncate"
                      style={{ color: n ? "var(--ink)" : undefined, fontWeight: n ? 700 : 400 }}
                    >
                      {last
                        ? `${last.from === "me" ? "You" : member(last.from, st).name.split(" ")[0]}: ${last.text ?? (last.ref?.startsWith("gif:") ? "GIF" : last.ref?.startsWith("sticker:") ? "Sticker" : "")}`
                        : `${g.members.length} members`}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    {last && (
                      <span className="block meta" style={{ fontSize: 12 }}>
                        {timeAgo(last.at)}
                      </span>
                    )}
                    {n > 0 && (
                      <span
                        className="pop inline-flex min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold items-center justify-center mt-0.5"
                        style={{ background: "var(--pink)", color: "var(--on-accent)" }}
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
                style={{
                  background: emoji === e ? "var(--lime)" : "var(--fill)",
                  border: "var(--bd)",
                }}
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
          <button
            disabled={!name.trim()}
            onClick={() => setStep("pick")}
            className="btn-primary w-full mt-4"
          >
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
  if (m.snapId) return m.from === "me" ? "You sent a blink" : "Sent you a blink";
  if (m.sharedPostId?.startsWith("wordup:"))
    return `${m.from === "me" ? "You: " : ""}Word Up result`;
  if (m.sharedPostId?.startsWith("game:")) return m.text ?? `${who}game invite`;
  if (m.sharedPostId?.startsWith("voice:")) return `${who}Voice note`;
  if (m.sharedPostId?.startsWith("img:")) return `${who}Photo`;
  if (m.sharedPostId?.startsWith("gif:")) return `${who}GIF`;
  if (m.sharedPostId?.startsWith("sticker:")) return `${who}Sticker`;
  if (m.sharedPostId?.startsWith("vid:")) return `${who}Video`;
  if (m.sharedPostId)
    return `${who}shared a ${m.sharedPostId.startsWith("reel") ? "reel" : "post"}`;
  return who + (m.text ?? "");
}

function TabBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="ml-1.5 inline-flex min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold items-center justify-center"
      style={{ background: "var(--pink)", color: "var(--on-accent)" }}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function Chats() {
  const s = useSocial();
  const newBlinks = s.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me")).length;
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Snap | null>(null);
  const everyone = mutualFriends();
  const term = q.trim().toLowerCase();
  const gs = useGroups();
  const [tab, setTab] = useState<"private" | "groups">(() => {
    try {
      return localStorage.getItem("tf.chats.tab") === "groups" ? "groups" : "private";
    } catch {
      return "private";
    }
  });
  const pick = (t: "private" | "groups") => {
    setTab(t);
    try {
      localStorage.setItem("tf.chats.tab", t);
    } catch {
      // ignore
    }
  };
  const privateUnread = Object.values(s.unread).reduce((a, n) => a + n, 0);
  const groupUnread = gs.groups.reduce((a, g) => a + unreadIn(gs, g.id), 0);

  // Only recompute when the list or messages change (not on every typing ping).
  const rows = useMemo(
    () =>
      everyone
        .filter((f) => !term || f.name.toLowerCase().includes(term) || f.username?.includes(term))
        .map((f) => {
          const msgs = s.chats[f.id] ?? [];
          return { f, last: msgs[msgs.length - 1] };
        })
        .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.people, s.chats, term],
  );

  const unopened = s.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me"));

  return (
    <div className="pb-6">
      <Tour
        id="chats"
        steps={[
          {
            at: 'div[role="tablist"][aria-label="Chats"]',
            title: "Private and group chats",
            body: "Chats open once you're in each other's 25. No randoms, ever. Make groups with people from your 25.",
          },
          {
            at: 'a[aria-label="New blink"]',
            title: "Send a Blink",
            body: "A photo or note that disappears after one look.",
          },
        ]}
      />
      <PageBand
        ring
        title="Chats"
        sub="Mutual seats only. No randoms in your DMs."
        actions={
          <Link
            to="/app/snap"
            search={{ to: undefined }}
            aria-label={newBlinks ? `Blinks, ${newBlinks} new` : "Blinks"}
            className="btn-secondary relative gap-1.5 px-3.5 min-h-[40px]"
          >
            <Camera size={18} aria-hidden="true" /> Blinks
            {newBlinks > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center tabular-nums"
                style={{
                  background: "var(--pink)",
                  color: "var(--on-dark-fill)",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "2px solid var(--surface)",
                }}
              >
                {newBlinks > 99 ? "99+" : newBlinks}
              </span>
            )}
          </Link>
        }
      />

      <div className="px-5 mt-1 mb-2">
        <div className="segmented w-full" role="tablist" aria-label="Chats">
          <button
            className="flex-1 gap-1.5"
            role="tab"
            aria-pressed={tab === "private"}
            onClick={() => pick("private")}
          >
            <MessageCircle size={16} aria-hidden="true" /> Private
            <TabBadge n={privateUnread} />
          </button>
          <button
            className="flex-1 gap-1.5"
            role="tab"
            aria-pressed={tab === "groups"}
            onClick={() => pick("groups")}
          >
            <Users size={16} aria-hidden="true" /> Groups
            <TabBadge n={groupUnread} />
          </button>
        </div>
      </div>

      {tab === "groups" ? (
        <GroupsSection />
      ) : s.loading ? (
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
            <Section title="New blinks" aside={`${unopened.length} to open`} className="mt-2">
              <ul className="flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
                {unopened.map((snap) => {
                  const f = everyone.find((x) => x.id === snap.from);
                  if (!f) return null;
                  return (
                    <li key={snap.id}>
                      <button
                        onClick={() => setViewing(snap)}
                        className="flex flex-col items-center w-16"
                        aria-label={`Open blink from ${f.name}`}
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

          <div className="px-5 mt-3">
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
                        style={{ fontSize: 12, color: unread ? "var(--pink)" : undefined }}
                      >
                        {last ? timeAgo(last.at) : ""}
                      </span>
                      {unread > 0 && (
                        <span
                          className="pop min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center tabular-nums"
                          style={{
                            background: "var(--pink)",
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
