import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Camera,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Lock,
  Spade,
  Star,
  Type,
} from "lucide-react";
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
import {
  sendGroupMedia,
  sendGroupRich,
  sendGroupVoice,
  sendToGroup,
  useGroups,
} from "@/lib/groups";
import { account } from "@/lib/live";
import {
  BUBBLE_THEM,
  Bubble,
  ChatHeader,
  ChatWallpaper,
  Composer,
  DayPill,
  dayLabel,
} from "@/components/ChatChrome";
import { GifPicker, RichBubble, isRich, sendRichToFriend } from "@/components/GifPicker";
import { Avatar } from "@/components/Avatar";
import { Toast, clientOnly } from "@/components/SocialUI";
import {
  EarlierButton,
  useRecent,
  useStickToBottom,
  MediaBubble,
  Reactable,
  VoicePlayer,
  sendMedia,
  sendVoice,
} from "@/components/ChatExtras";
import { sendTyping } from "@/lib/live";
import {
  clock,
  dayKey,
  friendById,
  isMutual,
  mutualFriends,
  social,
  useSocial,
  type ChatMessage,
} from "@/lib/social";

export const Route = createFileRoute("/app/chat/$id")({
  component: clientOnly(ChatThread),
});

function Ticks({ status }: { status?: ChatMessage["status"] }) {
  const common = { size: 15, "aria-hidden": true } as const;
  if (status === "sent") return <Check {...common} style={{ opacity: 0.75 }} />;
  if (status === "delivered") return <CheckCheck {...common} style={{ opacity: 0.75 }} />;
  return <CheckCheck {...common} style={{ color: "var(--lime)" }} />;
}
const statusLabel = (s?: ChatMessage["status"]) =>
  s === "sent" ? "Sent" : s === "delivered" ? "Delivered" : "Read";

function ChatThread() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const s = useSocial();
  const f = friendById(id);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  // Long-press actions.
  const prefs = useChatPrefs();
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const groups = useGroups();
  const msgs = s.chats[id] ?? [];
  const typing = s.typing[id];
  const live = s.mode === "live";

  useEffect(() => {
    social.markRead(id);
  }, [id, msgs.length]);
  const recent = useRecent(msgs.length, id);
  const logRef = useStickToBottom<HTMLDivElement>(id, msgs.length, typing);

  if (!f || (live && !isMutual(f))) {
    const theySeatedMe = !!f && s.requests.some((r) => r.person.id === f.id);
    return (
      <div className="px-6 pt-24 text-center">
        <Lock
          size={44}
          strokeWidth={2}
          aria-hidden="true"
          className="mx-auto"
          style={{ color: "var(--sun)" }}
        />
        <p className="heading mt-3">
          {f ? `Chats with ${f.name.split(" ")[0]} are locked` : "This person isn't in your 25."}
        </p>
        {f && (
          <p className="text-cool mt-2 text-[15px] leading-relaxed">
            {theySeatedMe
              ? "They put you in their 25. Seat them back and you can chat."
              : "You seated them, but they haven't seated you back yet. Chats unlock when it's mutual."}
          </p>
        )}
        {f && theySeatedMe && (
          <Link to="/app/people" className="btn-primary mt-6 px-5">
            Seat them back
          </Link>
        )}
        <Link to="/app/chats" className="btn-secondary mt-6 px-5">
          Back to chats
        </Link>
      </div>
    );
  }

  const send = () => {
    if (!text.trim()) return;
    social.sendMessage(id, text, undefined, replyTo?.id);
    setText("");
    setReplyTo(null);
    document.getElementById("chat-input")?.focus();
  };
  const firstName = f.name.split(" ")[0];
  const statusLine = typing
    ? "Typing…"
    : live
      ? f.username
        ? `@${f.username}`
        : "In your 25"
      : f.daysQuiet <= 2
        ? "Active today"
        : "In your 25";

  const unreadElsewhere = Object.entries(s.unread)
    .filter(([k]) => k !== id)
    .reduce((n, [, v]) => n + (v || 0), 0);
  const list = msgs.slice(recent.start);
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const whoName = (m: ChatMessage) => (m.from === "me" ? "You" : firstName);
  const whoColor = (m: ChatMessage) => (m.from === "me" ? "var(--lime)" : "#7FD3FF");
  const reply = (m: ChatMessage) => {
    setReplyTo(m);
    document.getElementById("chat-input")?.focus();
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
    ...groups.groups.map((g) => ({
      id: g.id,
      kind: "group" as const,
      name: g.name,
      avatar: g.avatar,
      initials: g.emoji,
      emoji: g.emoji,
    })),
  ];
  // A run: back-to-back messages from the same person, a few minutes apart.
  const sameRun = (a?: ChatMessage, b?: ChatMessage) =>
    !!a && !!b && a.from === b.from && dayKey(a.at) === dayKey(b.at) && b.at - a.at < 5 * 60_000;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0B0A0D" }}>
      <div className="relative mx-auto w-full max-w-md flex flex-col h-full app-column overflow-hidden">
        <ChatWallpaper />
        <ChatHeader onBack={() => navigate({ to: "/app/chats" })} unread={unreadElsewhere}>
          <Link
            to="/app/seat/$id"
            params={{ id }}
            className="flex items-center gap-2.5 flex-1 min-w-0 rounded-xl px-1 py-0.5"
          >
            <Avatar src={f.avatar || undefined} initials={f.initials} color={f.color} size={40} />
            <div className="min-w-0">
              <p className="font-bold text-cream truncate" style={{ fontSize: 17 }}>
                {f.name}
              </p>
              <p
                className="truncate"
                style={{ fontSize: 12.5, color: typing ? "var(--lime)" : "var(--ink-3)" }}
              >
                {statusLine}
              </p>
            </div>
          </Link>
        </ChatHeader>

        <div className="relative flex-1 min-h-0 flex flex-col">
          <JumpToLatest logId="chat-log" />
          <div
            ref={logRef}
            id="chat-log"
            className="relative flex-1 overflow-y-auto px-3 pb-3 pt-2"
            role="log"
            aria-live="polite"
            aria-label={`Conversation with ${f.name}`}
          >
            {msgs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <Avatar
                  src={f.avatar || undefined}
                  initials={f.initials}
                  color={f.color}
                  size={72}
                />
                <p className="heading mt-4">Start a chat with {firstName}</p>
                <p
                  className="mt-3 flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                  style={{ fontSize: 12.5, background: "rgba(30,28,38,0.92)", color: "#E9D27A" }}
                >
                  <Lock size={13} aria-hidden="true" /> Only you and {firstName} can see this chat.
                </p>
              </div>
            ) : (
              <>
                {recent.hasMore && <EarlierButton onClick={recent.showMore} />}
                <ol>
                  {list.map((m, j) => {
                    if (prefs.hidden.includes(m.id)) return null;
                    const i = recent.start + j;
                    const mine = m.from === "me";
                    const prev = msgs[i - 1];
                    const next = msgs[i + 1];
                    const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
                    const grouped = sameRun(prev, m);
                    const tail = !sameRun(m, next);
                    const [shareKind, shareId] = m.sharedPostId?.split(":") ?? [];
                    const rich = isRich(m.sharedPostId);
                    const shared =
                      shareKind === "post" || shareKind === "reel"
                        ? s.posts.find((p) => p.id === shareId)
                        : undefined;
                    const quoted = m.replyTo ? byId.get(m.replyTo) : undefined;
                    const starred = prefs.starred.includes(m.id);
                    const media = ["img", "vid", "voice"].includes(shareKind ?? "") || rich;
                    const plainText =
                      !m.deleted &&
                      !!m.text &&
                      !rich &&
                      !shared &&
                      !m.snapId &&
                      !shareKind?.startsWith("game") &&
                      !["wordup", "voice", "img", "vid"].includes(shareKind ?? "");
                    const meta = (
                      <>
                        {starred && <Star size={11} fill="currentColor" aria-label="Starred" />}
                        <span className="tabular-nums" style={{ fontSize: 11 }}>
                          {clock(m.at)}
                        </span>
                        {mine && (
                          <span aria-label={statusLabel(m.status)} className="inline-flex">
                            <Ticks status={m.status} />
                          </span>
                        )}
                      </>
                    );
                    return (
                      <li key={m.id}>
                        {newDay && <DayPill label={dayLabel(m.at)} />}
                        <div
                          className={`flex ${mine ? "justify-end pr-1.5" : "justify-start pl-1.5"} ${grouped ? "mt-0.5" : "mt-2"}`}
                        >
                          <Reactable
                            id={m.id}
                            mine={mine}
                            onReply={m.deleted ? undefined : () => reply(m)}
                            actions={() =>
                              messageActions({
                                text: m.text,
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
                                      f.id,
                                      "Message",
                                      snippetOf(m.text, m.sharedPostId).slice(0, 900),
                                    )
                                    .then(() => setNotice("Reported. Thanks, we'll look into it."))
                                    .catch((e) => setNotice((e as Error).message)),
                                onDeleteMine: () => setDeleting(m),
                                onDeleteForMe: () => setDeleting(m),
                              })
                            }
                          >
                            <Bubble
                              mine={mine}
                              tail={tail}
                              meta={meta}
                              inline={plainText || !!m.deleted}
                              bare={rich && !quoted}
                            >
                              {quoted && (
                                <Quote
                                  name={whoName(quoted)}
                                  color={whoColor(quoted)}
                                  text={snippetOf(quoted.text, quoted.sharedPostId, quoted.deleted)}
                                  onTap={() => jumpTo(quoted.id)}
                                />
                              )}
                              {m.deleted && <DeletedNote mine={mine} />}
                              {rich && <RichBubble value={m.sharedPostId} />}
                              {shareKind === "voice" && (
                                <VoicePlayer value={m.sharedPostId!} mine={mine} />
                              )}
                              {(shareKind === "img" || shareKind === "vid") && (
                                <MediaBubble value={m.sharedPostId!} />
                              )}
                              {plainText && (
                                <span
                                  style={{
                                    fontSize: 16,
                                    lineHeight: 1.35,
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {m.text}
                                </span>
                              )}
                              {/* Old Blinks (the feature is gone): just a quiet note. */}
                              {m.snapId && (
                                <p className="flex items-center gap-2 text-sm text-faint px-1">
                                  <Camera size={16} aria-hidden="true" /> Blink (no longer
                                  available)
                                </p>
                              )}
                              {shared && (
                                <Link to="/app/feed" className="block my-0.5">
                                  {shared.image ? (
                                    <img
                                      loading="lazy"
                                      decoding="async"
                                      src={shared.image}
                                      alt=""
                                      className="rounded-xl w-52 max-w-full aspect-square object-cover"
                                    />
                                  ) : (
                                    <span
                                      className="w-52 max-w-full aspect-square rounded-xl flex items-center justify-center"
                                      style={{ background: "rgba(255,255,255,0.08)" }}
                                    >
                                      <ImageIcon size={28} aria-hidden="true" />
                                    </span>
                                  )}
                                  {shared.caption && (
                                    <p className="mt-1.5 text-[13px] line-clamp-2 w-52 max-w-full px-1">
                                      {shared.caption}
                                    </p>
                                  )}
                                </Link>
                              )}
                              {shareKind === "wordup" && m.text && (
                                <div className="px-1">
                                  <WordUpCard text={m.text} day={shareId} mine={mine} />
                                </div>
                              )}
                              {shareKind === "game" && shareId && (
                                <div className="px-1 pt-0.5">
                                  {m.text && (
                                    <p style={{ fontSize: 15.5, lineHeight: 1.4 }}>{m.text}</p>
                                  )}
                                  <Link
                                    to="/app/play/$id"
                                    params={{ id: shareId }}
                                    className="mt-2 flex items-center justify-center gap-2 rounded-xl min-h-[40px] px-3 font-semibold text-sm"
                                    style={{
                                      background: "rgba(255,255,255,0.1)",
                                      color: "var(--lime)",
                                    }}
                                  >
                                    <Spade size={16} aria-hidden="true" />{" "}
                                    {mine ? "Open game" : "Join game"}
                                  </Link>
                                </div>
                              )}
                            </Bubble>
                          </Reactable>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            {typing && (
              <div className="flex justify-start mt-2 pl-1.5">
                <div
                  className="relative px-4 py-3 flex gap-1"
                  style={{ background: BUBBLE_THEM, borderRadius: 18, borderBottomLeftRadius: 4 }}
                  aria-label={`${firstName} is typing`}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full soft-pulse-dot"
                      style={{ background: "var(--ink-3)", animationDelay: `${i * 0.18}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Composer
          replyBar={
            replyTo && (
              <ReplyBar
                name={whoName(replyTo)}
                color={whoColor(replyTo)}
                text={snippetOf(replyTo.text, replyTo.sharedPostId)}
                onCancel={() => setReplyTo(null)}
              />
            )
          }
          inputId="chat-input"
          value={text}
          onChange={(v) => {
            setText(v);
            if (live) sendTyping(id);
          }}
          onSend={send}
          label={`Message ${firstName}`}
          onFile={(file) =>
            void sendMedia(id, file).catch((err) => setNotice((err as Error).message))
          }
          onGif={() => setGifOpen(true)}
          onVoice={(blob, secs) =>
            void sendVoice(id, blob, secs).catch((e) => setNotice((e as Error).message))
          }
          onUnavailable={(why) => setNotice(why)}
        />
        {gifOpen && (
          <GifPicker
            onClose={() => setGifOpen(false)}
            onPick={(ref) => {
              setGifOpen(false);
              void sendRichToFriend(id, ref).catch((err) => setNotice((err as Error).message));
            }}
          />
        )}
      </div>
      {deleting && (
        <DeleteSheet
          mine={deleting.from === "me" && !deleting.deleted}
          onForMe={() => hideForMe(deleting.id)}
          onForEveryone={() => social.deleteMessage(id, deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
      {forwarding && (
        <ForwardSheet
          targets={forwardTargets}
          onClose={() => setForwarding(null)}
          onSend={async (to) => {
            const m = forwarding;
            const ref = m.sharedPostId ?? "";
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
                setNotice((e as Error).message);
              }
            }
            setNotice(
              to.length === 1 ? `Forwarded to ${to[0].name}` : `Forwarded to ${to.length} chats`,
            );
          }}
        />
      )}
      {notice && <Toast text={notice} onDone={() => setNotice(null)} />}
    </div>
  );
}

/** A friend's Word Up result, with a button to play the same word. */
function WordUpCard({ text, day, mine }: { text: string; day?: string; mine: boolean }) {
  const [head, ...rows] = text.split("\n");
  const today = day === dayKey(Date.now());
  return (
    <div className="w-56 max-w-full">
      <p className="flex items-center gap-1.5 font-extrabold" style={{ fontSize: 14 }}>
        <Type size={15} aria-hidden="true" /> {head}
      </p>
      <pre className="mt-1.5 leading-tight" style={{ fontSize: 18 }}>
        {rows.join("\n")}
      </pre>
      {!mine && (
        <Link
          to="/app/games"
          onClick={() => {
            try {
              localStorage.setItem("tf.open", "word");
            } catch {
              // ignore
            }
          }}
          className="mt-2.5 flex items-center justify-center gap-2 rounded-xl min-h-[40px] px-3 font-bold text-sm"
          style={{ background: "var(--lime)", color: "var(--on-accent)", border: "var(--bd)" }}
        >
          {today ? "Play today's word" : "Play today's Word Up"}
        </Link>
      )}
    </div>
  );
}
