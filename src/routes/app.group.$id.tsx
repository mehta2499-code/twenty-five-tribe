import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bubble,
  ChatHeader,
  ChatWallpaper,
  Composer,
  DayPill,
  dayLabel,
} from "@/components/ChatChrome";
import { useEffect, useRef, useState } from "react";
import { BarChart3, ImagePlus, Megaphone, Plus, Star, Trash2, Users, X } from "lucide-react";
import {
  DeleteSheet,
  DeletedNote,
  ForwardSheet,
  JumpToLatest,
  Quote,
  ReplyBar,
  fileFromMessage,
  hideForMe,
  jumpTo,
  messageActions,
  snippetOf,
  toggleStar,
  useChatPrefs,
  type ForwardTarget,
} from "@/components/MessageActions";
import { account } from "@/lib/live";
import { PollView } from "@/components/SceneParts";
import { GifPicker, RichBubble, isRich, sendRichToFriend } from "@/components/GifPicker";
import { GroupFace } from "@/components/GroupFace";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/PersonLink";
import { FriendPicker, Sheet, Toast, clientOnly } from "@/components/SocialUI";
import {
  EarlierButton,
  useRecent,
  useStickToBottom,
  MediaBubble,
  Reactable,
  VoicePlayer,
  parseMedia,
  sendMedia,
  sendVoice,
} from "@/components/ChatExtras";
import { dayKey, mutualFriends, social } from "@/lib/social";
import {
  addMembers,
  deleteGroup,
  deleteGroupMessage,
  leaveGroup,
  markSeen,
  member,
  seenBy,
  mentionQuery,
  sendGroupMedia,
  splitMentions,
  sendGroupVoice,
  sendToGroup,
  sendGroupRich,
  sendGroupPoll,
  setGroupPhoto,
  voteGroupPoll,
  useGroups,
} from "@/lib/groups";

export const Route = createFileRoute("/app/group/$id")({
  component: clientOnly(GroupThread),
});

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
// 25 different name colours, one per person in a group (groups max out at 25).
// Hues are spread around the colour wheel, jumping so neighbours look different,
// and kept light enough to read on the dark bubbles.
const NAME_TONES = Array.from({ length: 25 }, (_, k) => {
  const hue = Math.round(((k * 7) % 25) * (360 / 25) + 78) % 360;
  return `hsl(${hue} ${k % 2 ? 70 : 85}% ${k % 3 === 2 ? 80 : 70}%)`;
});

function GroupThread() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const st = useGroups();
  const g = st.groups.find((x) => x.id === id);
  const msgs = st.msgs[id] ?? [];
  const [text, setText] = useState("");
  const [info, setInfo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // "Seen by": who has read one of my messages.
  const [seenFor, setSeenFor] = useState<(typeof msgs)[number] | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  // Long-press actions.
  const prefs = useChatPrefs();
  type M = (typeof st.msgs)[string][number];
  const [replyTo, setReplyTo] = useState<M | null>(null);
  const [forwarding, setForwarding] = useState<M | null>(null);
  const [deleting, setDeleting] = useState<M | null>(null);
  // New poll being written, and the poll whose votes are open.
  const [draft, setDraft] = useState<{ q: string; options: string[]; multi: boolean } | null>(null);
  const [votesFor, setVotesFor] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    markSeen(id);
  }, [id, msgs.length]);
  const recent = useRecent(msgs.length, id);
  const logRef = useStickToBottom<HTMLDivElement>(id, msgs.length);

  if (!g) {
    return (
      <div className="px-6 pt-24 text-center">
        <p className="heading">{st.loaded ? "This group isn't there anymore." : "Loading…"}</p>
        <Link to="/app/chats" className="btn-secondary mt-6 px-5">
          Back to chats
        </Link>
      </div>
    );
  }

  const send = () => {
    const t = text;
    setText("");
    boxRef.current?.focus();
    void sendToGroup(id, t, replyTo?.id).catch((e) => setToast((e as Error).message));
    setReplyTo(null);
  };
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const whoName = (m: M) => (m.from === "me" ? "You" : member(m.from, st).name.split(" ")[0]);
  const whoColor = (m: M) => (m.from === "me" ? "var(--lime)" : tone(m.from));
  const reply = (m: M) => {
    setReplyTo(m);
    boxRef.current?.focus();
  };
  const forwardTargets: ForwardTarget[] = [
    ...mutualFriends().map((p) => ({
      id: p.id,
      kind: "friend" as const,
      name: p.name,
      avatar: p.avatar || undefined,
      initials: p.initials,
      color: p.color,
    })),
    ...st.groups.map((x) => ({
      id: x.id,
      kind: "group" as const,
      name: x.name,
      avatar: x.avatar,
      initials: x.emoji,
      emoji: x.emoji,
    })),
  ];
  // My latest message gets a "Seen by …" line (tap it to see everyone).
  const lastMine = msgs.reduce((k, m, i) => (m.from === "me" ? i : k), -1);
  const seenLine = (m: (typeof msgs)[number]) => {
    const list = seenBy(st, id, m);
    const seen = list.filter((x) => x.at);
    if (!list.length) return null;
    if (seen.length === list.length) return "Seen by everyone";
    if (!seen.length) return "Not seen yet";
    const names = seen.map((x) => member(x.id, st).name.split(" ")[0]);
    return `Seen by ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`;
  };
  const tone = (who: string) =>
    NAME_TONES[g.members.filter((m) => m !== "me").indexOf(who) % NAME_TONES.length] ??
    "var(--ink-2)";
  const canAdd = mutualFriends().filter((f) => !g.members.includes(f.id));

  // @mentions
  const everyone = g.members.map((m) => member(m, st));
  const q = mentionQuery(text);
  const picks =
    q === null
      ? []
      : everyone
          .filter((m) => m.id !== "me" && m.username)
          .filter(
            (m) =>
              m.username!.toLowerCase().startsWith(q) ||
              m.name
                .toLowerCase()
                .split(" ")
                .some((w) => w.startsWith(q)),
          )
          .slice(0, 6);
  // "@all" pings everyone in the group.
  const showAll = q !== null && ("all".startsWith(q) || "everyone".startsWith(q));
  const pickMention = (m: (typeof everyone)[number]) => {
    setText((t) => t.replace(/@([\w.]*)$/, `@${m.username} `));
    boxRef.current?.focus();
  };
  const pickAll = () => {
    setText((t) => t.replace(/@([\w.]*)$/, "@all "));
    boxRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0B0A0D" }}>
      <div className="relative mx-auto w-full max-w-md flex flex-col h-full app-column overflow-hidden">
        <ChatWallpaper />
        <ChatHeader onBack={() => navigate({ to: "/app/chats" })}>
          <button
            onClick={() => setInfo(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left px-1 py-0.5"
          >
            <GroupFace avatar={g.avatar} emoji={g.emoji} size={40} />
            <span className="min-w-0">
              <span className="block font-bold text-cream truncate" style={{ fontSize: 17 }}>
                {g.name}
              </span>
              <span className="block truncate" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                {g.members.map((m) => member(m, st).name.split(" ")[0]).join(", ")}
              </span>
            </span>
          </button>
        </ChatHeader>

        <div className="relative flex-1 min-h-0 flex flex-col">
          <JumpToLatest logId="group-log" />
          <div
            ref={logRef}
            id="group-log"
            className="relative flex-1 overflow-y-auto px-2 pb-3 pt-2"
            role="log"
            aria-live="polite"
          >
            {msgs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <GroupFace avatar={g.avatar} emoji={g.emoji} size={96} />
                <p className="heading mt-3">{g.name}</p>
                <p className="meta mt-1">Say something. Someone has to go first.</p>
              </div>
            ) : (
              <>
                {recent.hasMore && <EarlierButton onClick={recent.showMore} />}
                <ol>
                  {msgs.slice(recent.start).map((m, j) => {
                    if (prefs.hidden.includes(m.id)) return null;
                    const i = recent.start + j;
                    const mine = m.from === "me";
                    const prev = msgs[i - 1];
                    const next = msgs[i + 1];
                    const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
                    const sameRun = (a?: typeof m, b?: typeof m) =>
                      !!a &&
                      !!b &&
                      a.from === b.from &&
                      dayKey(a.at) === dayKey(b.at) &&
                      b.at - a.at < 5 * 60_000;
                    const grouped = sameRun(prev, m);
                    const tail = !sameRun(m, next);
                    const who = member(m.from, st);
                    const rich = !m.deleted && !m.poll && isRich(m.ref);
                    const plainText =
                      !m.deleted &&
                      !m.poll &&
                      !rich &&
                      !m.ref?.startsWith("voice:") &&
                      !parseMedia(m.ref);
                    const quoted = m.replyTo ? byId.get(m.replyTo) : undefined;
                    const starred = prefs.starred.includes(m.id);
                    const media = rich || !!m.ref?.startsWith("voice:") || !!parseMedia(m.ref);
                    const mentioned =
                      !mine &&
                      !!m.text &&
                      splitMentions(m.text, everyone).some((x) => x.who?.id === "me");
                    return (
                      <li key={m.id}>
                        {newDay && <DayPill label={dayLabel(m.at)} />}
                        <div
                          className={`flex items-end gap-1.5 ${mine ? "justify-end pr-1.5" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}
                        >
                          {!mine && (
                            <span className="w-8 shrink-0 mr-1">
                              {/* Their photo beside the last message of a run, like WhatsApp. */}
                              {tail && (
                                <PersonLink id={m.from} username={who.username} label={who.name}>
                                  <Avatar
                                    src={who.avatar}
                                    initials={who.initials}
                                    color={who.color}
                                    size={30}
                                  />
                                </PersonLink>
                              )}
                            </span>
                          )}
                          <Reactable
                            id={m.id}
                            mine={mine}
                            onReply={m.deleted ? undefined : () => reply(m)}
                            actions={() =>
                              messageActions({
                                text: m.poll ? undefined : m.text,
                                starred,
                                mine,
                                deleted: m.deleted,
                                canForward: plainText || media,
                                onReply: () => reply(m),
                                onForward: () => setForwarding(m),
                                onStar: () => toggleStar(m.id),
                                onReport: () =>
                                  void account
                                    .report(
                                      m.from,
                                      "Group message",
                                      snippetOf(m.text, m.ref).slice(0, 900),
                                    )
                                    .then(() => setToast("Reported. Thanks, we'll look into it."))
                                    .catch((e) => setToast((e as Error).message)),
                                onDeleteMine: () => setDeleting(m),
                                onDeleteForMe: () => setDeleting(m),
                              })
                            }
                          >
                            <Bubble
                              mine={mine}
                              tail={tail}
                              inline={plainText || !!m.deleted}
                              bare={rich && !quoted}
                              ring={mentioned ? "var(--sun)" : undefined}
                              width={m.poll ? 280 : undefined}
                              meta={
                                <>
                                  {starred && (
                                    <Star size={11} fill="currentColor" aria-label="Starred" />
                                  )}
                                  <span className="tabular-nums" style={{ fontSize: 11 }}>
                                    {clock(m.at)}
                                  </span>
                                </>
                              }
                            >
                              {/* Sender's name on the first message of a run, in their colour. */}
                              {!mine && !grouped && !rich && (
                                <p
                                  className="text-[13px] font-extrabold px-1 mb-0.5"
                                  style={{ color: tone(m.from) }}
                                >
                                  {who.name.split(" ")[0]}
                                </p>
                              )}
                              {quoted && (
                                <Quote
                                  name={whoName(quoted)}
                                  color={whoColor(quoted)}
                                  text={snippetOf(quoted.text, quoted.ref, quoted.deleted)}
                                  onTap={() => jumpTo(quoted.id)}
                                />
                              )}
                              {m.deleted ? (
                                <DeletedNote mine={mine} />
                              ) : m.poll ? (
                                <div>
                                  <p
                                    className="flex items-center gap-1.5 meta font-bold"
                                    style={{ fontSize: 11.5 }}
                                  >
                                    <BarChart3 size={13} aria-hidden="true" /> Poll
                                  </p>
                                  <p
                                    className="font-bold text-cream mt-1"
                                    style={{
                                      fontSize: 15.5,
                                      lineHeight: 1.35,
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {m.text}
                                  </p>
                                  <PollView
                                    postId={m.id}
                                    poll={m.poll}
                                    onVote={(o) =>
                                      void voteGroupPoll(id, m.id, o).catch((e) =>
                                        setToast((e as Error).message),
                                      )
                                    }
                                    onShowVotes={() => setVotesFor(m.id)}
                                  />
                                </div>
                              ) : isRich(m.ref) ? (
                                <RichBubble value={m.ref} />
                              ) : m.ref?.startsWith("voice:") ? (
                                <VoicePlayer value={m.ref} mine={mine} />
                              ) : parseMedia(m.ref) ? (
                                <MediaBubble value={m.ref!} />
                              ) : (
                                <span
                                  style={{
                                    fontSize: 16,
                                    lineHeight: 1.35,
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {splitMentions(m.text ?? "", everyone).map((x, k) =>
                                    x.who ? (
                                      <b
                                        key={k}
                                        className="rounded px-0.5"
                                        style={
                                          x.who.id === "me"
                                            ? {
                                                background: "var(--sun)",
                                                color: "var(--on-dark-fill)",
                                              }
                                            : {
                                                color: mine ? "inherit" : tone(x.who.id),
                                                textDecoration: mine ? "underline" : undefined,
                                              }
                                        }
                                      >
                                        {x.text}
                                      </b>
                                    ) : (
                                      <span key={k}>{x.text}</span>
                                    ),
                                  )}
                                </span>
                              )}
                            </Bubble>
                          </Reactable>
                        </div>
                        {i === lastMine && seenLine(m) && (
                          <div className="flex justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => setSeenFor(m)}
                              className="meta text-[12px] px-1"
                              aria-label={`${seenLine(m)}. Show who has seen it`}
                            >
                              {seenLine(m)}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
        </div>

        <Composer
          replyBar={
            replyTo && (
              <ReplyBar
                name={whoName(replyTo)}
                color={whoColor(replyTo)}
                text={snippetOf(replyTo.text, replyTo.ref)}
                onCancel={() => setReplyTo(null)}
              />
            )
          }
          value={text}
          onChange={setText}
          onSend={send}
          inputRef={boxRef}
          label={`Message ${g.name}`}
          onFile={(file) =>
            void sendGroupMedia(id, file).catch((err) => setToast((err as Error).message))
          }
          onGif={() => setGifOpen(true)}
          onPoll={() => setDraft({ q: "", options: ["", ""], multi: false })}
          onVoice={(blob, secs) =>
            void sendGroupVoice(id, blob, secs).catch((e) => setToast((e as Error).message))
          }
          onUnavailable={(why) => setToast(why)}
          above={
            <>
              {(picks.length > 0 || showAll) && (
                <ul
                  className="absolute left-3 right-3 bottom-full mb-2 rounded-2xl overflow-hidden py-1 z-10"
                  style={{
                    background: "var(--surface)",
                    border: "var(--bd)",
                    boxShadow: "var(--pop)",
                  }}
                  role="listbox"
                  aria-label="Mention someone"
                >
                  {showAll && (
                    <li>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={pickAll}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--fill)]"
                      >
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "var(--pink)", color: "var(--on-accent)" }}
                        >
                          <Megaphone size={16} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold text-cream">@all</span>
                          <span className="block meta truncate">Notify everyone in the group</span>
                        </span>
                      </button>
                    </li>
                  )}
                  {picks.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickMention(m)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--fill)]"
                      >
                        <Avatar src={m.avatar} initials={m.initials} color={m.color} size={32} />
                        <span className="min-w-0">
                          <span className="block font-bold text-cream truncate">{m.name}</span>
                          <span className="block meta truncate">@{m.username}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          }
        />
      </div>

      {seenFor && (
        <Sheet title="Seen by" onClose={() => setSeenFor(null)}>
          <ul className="grid gap-1">
            {seenBy(st, id, seenFor)
              .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
              .map((x) => {
                const p = member(x.id, st);
                return (
                  <li key={x.id} className="flex items-center gap-3 py-1.5">
                    <Avatar src={p.avatar} initials={p.initials} color={p.color} size={36} />
                    <span className="flex-1 min-w-0 font-semibold truncate">{p.name}</span>
                    <span
                      className="meta text-[12.5px] shrink-0"
                      style={x.at ? { color: "var(--lime)" } : undefined}
                    >
                      {x.at ? `Seen ${clock(x.at)}` : "Not yet"}
                    </span>
                  </li>
                );
              })}
          </ul>
        </Sheet>
      )}
      {info && (
        <Sheet
          title={g.name}
          onClose={() => {
            setInfo(false);
            setConfirmDelete(false);
          }}
        >
          <div className="flex items-center gap-3">
            <GroupFace avatar={g.avatar} emoji={g.emoji} size={56} />
            <label className="btn-secondary px-4 min-h-[40px] cursor-pointer">
              <ImagePlus size={17} aria-hidden="true" />{" "}
              {g.avatar ? "Change photo" : "Add group photo"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void setGroupPhoto(id, file)
                    .then(() => setToast("Group photo updated"))
                    .catch((err) => setToast((err as Error).message));
                }}
              />
            </label>
          </div>
          <p className="meta mt-3">{g.members.length} of 25 members</p>
          <ul className="mt-3 grid gap-2.5">
            {g.members.map((mId) => {
              const m = member(mId, st);
              return (
                <li key={mId} className="flex items-center gap-3">
                  <PersonLink
                    id={mId}
                    username={m.username}
                    className="flex flex-1 items-center gap-3 min-w-0"
                  >
                    <Avatar src={m.avatar} initials={m.initials} color={m.color} size={36} />
                    <span className="flex-1 font-semibold text-cream truncate">{m.name}</span>
                  </PersonLink>
                  {g.createdBy === mId && (
                    <span className="chip" style={{ minHeight: 24, fontSize: 11 }}>
                      made it
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-5 grid gap-2.5">
            {canAdd.length > 0 && (
              <button
                onClick={() => {
                  setInfo(false);
                  setAdding(true);
                }}
                className="btn-primary"
              >
                <Users size={18} /> Add people
              </button>
            )}
            <button
              onClick={() => {
                void leaveGroup(id);
                navigate({ to: "/app/chats" });
              }}
              className="btn-danger"
            >
              Leave group
            </button>
            {/* Whoever made the group can delete it for everyone. */}
            {g.createdBy === "me" && (
              <button
                onClick={() => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  deleteGroup(id).then(
                    () => navigate({ to: "/app/chats" }),
                    (e) => {
                      setConfirmDelete(false);
                      setToast((e as Error).message);
                    },
                  );
                }}
                className="btn-danger"
                style={confirmDelete ? { background: "#E5484D", color: "#fff" } : undefined}
              >
                <Trash2 size={18} aria-hidden="true" />
                {confirmDelete ? "Tap again to delete for everyone" : "Delete group"}
              </button>
            )}
          </div>
        </Sheet>
      )}
      {adding && (
        <FriendPicker
          title="add who?"
          cta="Add"
          onClose={() => setAdding(false)}
          onPick={(ids) => {
            setAdding(false);
            const fresh = ids.filter((x) => !g.members.includes(x));
            if (fresh.length)
              void addMembers(id, fresh)
                .then(() => setToast("Added"))
                .catch((e) => setToast((e as Error).message));
          }}
        />
      )}
      {draft && (
        <Sheet title="New poll" onClose={() => setDraft(null)}>
          <form
            className="grid gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              const d = draft;
              setDraft(null);
              void sendGroupPoll(id, d.q, d.options, d.multi).catch((err) =>
                setToast((err as Error).message),
              );
            }}
          >
            <label className="grid gap-1">
              <span className="meta font-semibold" style={{ fontSize: 13 }}>
                Question
              </span>
              <input
                autoFocus
                value={draft.q}
                onChange={(e) => setDraft({ ...draft, q: e.target.value.slice(0, 200) })}
                placeholder="Ask something"
                className="input"
              />
            </label>
            <span className="meta font-semibold mt-1" style={{ fontSize: 13 }}>
              Options
            </span>
            {draft.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={o}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      options: draft.options.map((x, k) =>
                        k === i ? e.target.value.slice(0, 40) : x,
                      ),
                    })
                  }
                  aria-label={`Option ${i + 1}`}
                  placeholder={`Option ${i + 1}`}
                  className="input flex-1"
                />
                {draft.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, options: draft.options.filter((_, k) => k !== i) })
                    }
                    aria-label={`Remove option ${i + 1}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-cool"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            {draft.options.length < 4 && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}
                className="flex items-center gap-1.5 font-semibold self-start px-1"
                style={{ color: "var(--lime)", fontSize: 14 }}
              >
                <Plus size={16} aria-hidden="true" /> Add option
              </button>
            )}
            <label
              className="flex items-center justify-between gap-3 py-1"
              style={{ fontSize: 14 }}
            >
              <span className="text-cream font-semibold">Allow multiple answers</span>
              <input
                type="checkbox"
                checked={draft.multi}
                onChange={(e) => setDraft({ ...draft, multi: e.target.checked })}
                className="w-5 h-5 accent-[#C1EF62]"
              />
            </label>
            <button
              type="submit"
              disabled={!draft.q.trim() || draft.options.filter((o) => o.trim()).length < 2}
              className="btn-primary mt-1"
            >
              Send poll
            </button>
          </form>
        </Sheet>
      )}
      {votesFor &&
        (() => {
          const pm = msgs.find((x) => x.id === votesFor);
          if (!pm?.poll) return null;
          return (
            <Sheet title="Votes" onClose={() => setVotesFor(null)}>
              <p className="font-bold text-cream" style={{ fontSize: 15.5 }}>
                {pm.text}
              </p>
              <div className="grid gap-4 mt-3">
                {pm.poll.options.map((o, i) => {
                  const who = pm.poll!.by?.[i] ?? [];
                  return (
                    <section key={i}>
                      <p className="flex items-center justify-between font-semibold text-cream">
                        <span className="truncate">{o}</span>
                        <span className="meta tabular-nums shrink-0" style={{ fontSize: 12.5 }}>
                          {who.length} vote{who.length === 1 ? "" : "s"}
                        </span>
                      </p>
                      {who.length > 0 && (
                        <ul className="grid gap-1 mt-1.5">
                          {who.map((uid) => {
                            const p = member(uid, st);
                            return (
                              <li key={uid} className="flex items-center gap-2.5 py-0.5">
                                <Avatar
                                  src={p.avatar}
                                  initials={p.initials}
                                  color={p.color}
                                  size={28}
                                />
                                <span className="truncate" style={{ fontSize: 14.5 }}>
                                  {uid === "me" ? "You" : p.name}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            </Sheet>
          );
        })()}
      {gifOpen && (
        <GifPicker
          onClose={() => setGifOpen(false)}
          onPick={(ref) => {
            setGifOpen(false);
            void sendGroupRich(id, ref).catch((err) => setToast((err as Error).message));
          }}
        />
      )}
      {deleting && (
        <DeleteSheet
          mine={deleting.from === "me" && !deleting.deleted}
          onForMe={() => hideForMe(deleting.id)}
          onForEveryone={() =>
            void deleteGroupMessage(id, deleting.id).catch((e) => setToast((e as Error).message))
          }
          onClose={() => setDeleting(null)}
        />
      )}
      {forwarding && (
        <ForwardSheet
          targets={forwardTargets}
          onClose={() => setForwarding(null)}
          onSend={async (to) => {
            const m = forwarding;
            const ref = m.ref ?? "";
            const file = /^(img|vid|voice):/.test(ref) ? await fileFromMessage(m.id) : null;
            const secs = Number(ref.split("|")[1]) || 1;
            for (const t of to) {
              try {
                if (t.kind === "friend") {
                  if (file && ref.startsWith("voice:")) await sendVoice(t.id, file, secs);
                  else if (file) await sendMedia(t.id, file);
                  else if (isRich(ref)) await sendRichToFriend(t.id, ref);
                  else if (m.text) social.sendMessage(t.id, m.text);
                } else {
                  if (file && ref.startsWith("voice:")) await sendGroupVoice(t.id, file, secs);
                  else if (file) await sendGroupMedia(t.id, file);
                  else if (isRich(ref)) await sendGroupRich(t.id, ref);
                  else if (m.text) await sendToGroup(t.id, m.text);
                }
              } catch (e) {
                setToast((e as Error).message);
              }
            }
            setToast(
              to.length === 1 ? `Forwarded to ${to[0].name}` : `Forwarded to ${to.length} chats`,
            );
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
