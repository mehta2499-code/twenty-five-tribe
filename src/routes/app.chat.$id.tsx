import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Lock,
  Send,
  Spade,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SnapViewer, StreakBadge, Toast, clientOnly } from "@/components/SocialUI";
import { Reactable, VoicePlayer, VoiceRecorder, sendVoice } from "@/components/ChatExtras";
import { sendTyping } from "@/lib/live";
import {
  clock,
  dayKey,
  friendById,
  isMutual,
  social,
  useSocial,
  type ChatMessage,
  type Snap,
} from "@/lib/social";

export const Route = createFileRoute("/app/chat/$id")({
  component: clientOnly(ChatThread),
});

function Ticks({ status }: { status?: ChatMessage["status"] }) {
  const common = { size: 15, "aria-hidden": true } as const;
  if (status === "sent") return <Check {...common} style={{ opacity: 0.75 }} />;
  if (status === "delivered") return <CheckCheck {...common} style={{ opacity: 0.75 }} />;
  return <CheckCheck {...common} style={{ color: "#1F5FA8" }} />;
}
const statusLabel = (s?: ChatMessage["status"]) =>
  s === "sent" ? "Sent" : s === "delivered" ? "Delivered" : "Read";

function dayLabel(at: number) {
  const k = dayKey(at);
  if (k === dayKey()) return "Today";
  if (k === dayKey(Date.now() - 86_400_000)) return "Yesterday";
  return new Date(at).toLocaleDateString([], { day: "numeric", month: "short" });
}

function ChatThread() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const s = useSocial();
  const f = friendById(id);
  const [text, setText] = useState("");
  const [viewing, setViewing] = useState<Snap | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = s.chats[id] ?? [];
  const typing = s.typing[id];
  const live = s.mode === "live";

  useEffect(() => {
    social.markRead(id);
  }, [id, msgs.length]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, typing]);

  if (!f || (live && !isMutual(f))) {
    const theySeatedMe = !!f && s.requests.some((r) => r.person.id === f.id);
    return (
      <div className="px-6 pt-24 text-center">
        <p className="text-5xl">🔒</p>
        <p className="heading mt-3">
          {f ? `Chats with ${f.name.split(" ")[0]} are locked` : "This person isn't in your 25."}
        </p>
        {f && (
          <p className="text-cool mt-2 text-[15px] leading-relaxed">
            {theySeatedMe
              ? "They put you in their 25. Seat them back and you can chat and snap."
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
    social.sendMessage(id, text);
    setText("");
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--page)" }}>
      <div className="mx-auto w-full max-w-md flex flex-col h-full app-column">
        <header
          className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}
        >
          <button
            onClick={() => navigate({ to: "/app/chats" })}
            aria-label="Back to chats"
            className="w-10 h-10 rounded-full flex items-center justify-center text-cool hover:bg-[var(--fill)]"
          >
            <ArrowLeft size={22} />
          </button>
          <Link
            to="/app/seat/$id"
            params={{ id }}
            className="flex items-center gap-3 flex-1 min-w-0 rounded-xl px-1 py-1 hover:bg-[var(--fill)]"
          >
            <Avatar src={f.avatar || undefined} initials={f.initials} color={f.color} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-cream truncate" style={{ fontSize: 16 }}>
                  {f.name}
                </span>
                <StreakBadge friendId={id} />
              </div>
              <p
                className="truncate"
                style={{ fontSize: 13, color: typing ? "var(--mint)" : "var(--ink-3)" }}
              >
                {statusLine}
              </p>
            </div>
          </Link>
          <Link
            to="/app/snap"
            search={{ to: id }}
            aria-label={`Send ${firstName} a snap`}
            className="w-10 h-10 rounded-full flex items-center justify-center text-bronze hover:bg-[var(--fill)]"
          >
            <Camera size={21} />
          </Link>
        </header>

        <div
          className="flex-1 overflow-y-auto px-3 py-4"
          role="log"
          aria-live="polite"
          aria-label={`Conversation with ${f.name}`}
        >
          {msgs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <Avatar src={f.avatar || undefined} initials={f.initials} color={f.color} size={72} />
              <p className="heading mt-4">Start a chat with {firstName}</p>
              <p className="mt-2 flex items-center gap-1.5 meta">
                <Lock size={13} aria-hidden="true" /> Only you and {firstName} can see this chat.
              </p>
            </div>
          ) : (
            <ol className="space-y-1.5">
              {msgs.map((m, i) => {
                const mine = m.from === "me";
                const prev = msgs[i - 1];
                const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
                const grouped =
                  prev && !newDay && prev.from === m.from && m.at - prev.at < 5 * 60_000;
                const snap = m.snapId ? s.snaps.find((x) => x.id === m.snapId) : undefined;
                const [shareKind, shareId] = m.sharedPostId?.split(":") ?? [];
                const shared =
                  shareKind === "post"
                    ? s.posts.find((p) => p.id === shareId)
                    : shareKind === "reel"
                      ? s.posts.find((p) => p.id === shareId)
                      : undefined;
                return (
                  <li key={m.id}>
                    {newDay && (
                      <p className="text-center meta my-3" style={{ fontSize: 12 }}>
                        {dayLabel(m.at)}
                      </p>
                    )}
                    <div
                      className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "" : "mt-2"}`}
                    >
                      <Reactable id={m.id} mine={mine}>
                      <div
                        className="px-3.5 py-2"
                        style={{
                          background: mine ? "var(--blue-deep)" : "var(--surface)",
                          border: mine ? "1px solid transparent" : "1px solid var(--line)",
                          color: mine ? "var(--on-accent)" : "var(--ink)",
                          borderRadius: 18,
                          borderBottomRightRadius: mine ? 6 : 18,
                          borderBottomLeftRadius: mine ? 18 : 6,
                        }}
                      >
                        {shareKind === "voice" && <VoicePlayer value={m.sharedPostId!} mine={mine} />}
                        {m.text && !shareKind?.startsWith("game") && shareKind !== "voice" && (
                          <p
                            style={{
                              fontSize: 15,
                              lineHeight: 1.4,
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {m.text}
                          </p>
                        )}
                        {m.snapId &&
                          (mine ? (
                            <p className="flex items-center gap-2 font-semibold text-sm">
                              <Camera size={16} aria-hidden="true" /> Snap
                              {snap?.openedBy.includes(id) ? " · opened" : " sent"}
                            </p>
                          ) : snap && !snap.openedBy.includes("me") ? (
                            <button
                              onClick={() => setViewing(snap)}
                              className="flex items-center gap-2 font-semibold text-sm"
                              style={{ color: "var(--coral-deep)" }}
                            >
                              <Camera size={16} aria-hidden="true" /> New snap · tap to view
                            </button>
                          ) : (
                            <p className="flex items-center gap-2 text-sm text-faint">
                              <Camera size={16} aria-hidden="true" /> Snap opened
                            </p>
                          ))}
                        {shared && (
                          <Link
                            to="/app/feed"
                            className="block my-0.5"
                          >
                            {shared.image ? (
                              <img
                                src={shared.image}
                                alt=""
                                className="rounded-xl w-52 max-w-full aspect-square object-cover"
                              />
                            ) : (
                              <span
                                className="w-52 max-w-full aspect-square rounded-xl flex items-center justify-center"
                                style={{
                                  background: mine ? "rgba(255,255,255,0.15)" : "var(--fill)",
                                }}
                              >
                                <ImageIcon size={28} aria-hidden="true" />
                              </span>
                            )}
                            {shared.caption && (
                              <p className="mt-1.5 text-[13px] line-clamp-2 w-52 max-w-full">
                                {shared.caption}
                              </p>
                            )}
                          </Link>
                        )}
                        {shareKind === "game" && shareId && (
                          <>
                            {m.text && <p style={{ fontSize: 15, lineHeight: 1.4 }}>{m.text}</p>}
                            <Link
                              to="/app/play/$id"
                              params={{ id: shareId }}
                              className="mt-2 flex items-center justify-center gap-2 rounded-xl min-h-[40px] px-3 font-semibold text-sm"
                              style={{
                                background: mine ? "rgba(23,19,12,0.12)" : "var(--fill)",
                                color: mine ? "var(--on-accent)" : "var(--accent)",
                              }}
                            >
                              <Spade size={16} aria-hidden="true" />{" "}
                              {mine ? "Open game" : "Join game"}
                            </Link>
                          </>
                        )}
                        <div
                          className="flex items-center justify-end gap-1 mt-0.5"
                          style={{ color: mine ? "rgba(23,19,12,0.7)" : "var(--ink-3)" }}
                        >
                          <span className="tabular-nums" style={{ fontSize: 11.5 }}>
                            {clock(m.at)}
                          </span>
                          {mine && (
                            <span aria-label={statusLabel(m.status)} className="inline-flex">
                              <Ticks status={m.status} />
                            </span>
                          )}
                        </div>
                      </div>
                      </Reactable>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {typing && (
            <div className="flex justify-start mt-2">
              <div
                className="px-4 py-3 rounded-2xl flex gap-1"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
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
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="relative flex items-end gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message {f.name}
          </label>
          <input
            id="chat-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (live) sendTyping(id);
            }}
            placeholder={`Message ${firstName}`}
            className="input flex-1"
            style={{ borderRadius: 22 }}
            autoComplete="off"
            enterKeyHint="send"
          />
          {text.trim() ? (
            <button
              type="submit"
              aria-label="Send"
              className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              <Send size={19} />
            </button>
          ) : (
            <VoiceRecorder
              onSend={(blob, secs) => void sendVoice(id, blob, secs).catch((e) => setNotice((e as Error).message))}
              onUnavailable={() =>
                setNotice("Voice notes need the secure (https) version of 25, or mic access. Coming with your domain 🔒")
              }
            />
          )}
        </form>
      </div>
      {viewing && <SnapViewer snap={viewing} onClose={() => setViewing(null)} />}
      {notice && <Toast text={notice} onDone={() => setNotice(null)} />}
    </div>
  );
}
