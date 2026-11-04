import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, CheckCheck, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SnapViewer, StreakBadge, clientOnly } from "@/components/SocialUI";
import { sendTyping } from "@/lib/live";
import { clock, friendById, social, useSocial, type ChatMessage, type Snap } from "@/lib/social";

export const Route = createFileRoute("/app/chat/$id")({
  component: clientOnly(ChatThread),
});

function Ticks({ status }: { status?: ChatMessage["status"] }) {
  if (status === "sent")
    return <Check size={14} style={{ color: "var(--text-muted)" }} aria-label="Sent" />;
  if (status === "delivered")
    return <CheckCheck size={14} style={{ color: "var(--text-muted)" }} aria-label="Delivered" />;
  return <CheckCheck size={14} style={{ color: "var(--accent-bronze)" }} aria-label="Read" />;
}

function ChatThread() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const s = useSocial();
  const f = friendById(id);
  const [text, setText] = useState("");
  const [viewing, setViewing] = useState<Snap | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = s.chats[id] ?? [];
  const typing = s.typing[id];

  useEffect(() => {
    social.markRead(id);
  }, [id, msgs.length]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, typing]);

  if (!f) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="font-display italic text-cream" style={{ fontSize: 20 }}>
          That seat is empty.
        </p>
        <Link to="/app/chats" className="label-caps text-bronze mt-6 inline-block">
          back to chats
        </Link>
      </div>
    );
  }

  const send = () => {
    social.sendMessage(id, text);
    setText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="mx-auto w-full max-w-md flex flex-col h-full">
        <header
          className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3"
          style={{ borderBottom: "1px solid var(--border-cool)", background: "var(--bg-primary)" }}
        >
          <button
            onClick={() => navigate({ to: "/app/chats" })}
            aria-label="Back"
            className="text-cool p-1"
          >
            <ArrowLeft size={22} />
          </button>
          <Link
            to="/app/seat/$id"
            params={{ id }}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <Avatar src={f.avatar} initials={f.initials} color={f.color} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-cream truncate" style={{ fontSize: 17 }}>
                  {f.name}
                </span>
                <StreakBadge friendId={id} />
              </div>
              <p
                style={{ fontSize: 12, color: typing ? "var(--accent-sage)" : "var(--text-muted)" }}
              >
                {typing ? "typing…" : f.daysQuiet <= 2 ? "online" : "one of your 25"}
              </p>
            </div>
          </Link>
          <Link
            to="/app/snap"
            search={{ to: id }}
            aria-label={`Send ${f.name} a snap`}
            className="p-2 rounded-full"
            style={{ background: "var(--bg-surface)", color: "var(--accent-bronze)" }}
          >
            <Camera size={20} />
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2">
          {msgs.length === 0 && (
            <p
              className="text-center font-display italic mt-16"
              style={{ color: "var(--text-muted)", fontSize: 14 }}
            >
              Send {f.name} something dumb. They'll like it more than you think.
            </p>
          )}
          {msgs.map((m) => {
            const mine = m.from === "me";
            const snap = m.snapId ? s.snaps.find((x) => x.id === m.snapId) : undefined;
            const [shareKind, shareId] = m.sharedPostId?.split(":") ?? [];
            const shared =
              shareKind === "post"
                ? s.posts.find((p) => p.id === shareId)
                : shareKind === "reel"
                  ? s.reels.find((r) => r.id === shareId)
                  : undefined;
            const bubble = {
              background: mine ? "var(--blue-deep)" : "var(--bg-surface)",
              border: mine ? "none" : "1px solid var(--border-cool)",
              color: mine ? "#fff" : "var(--text-primary)",
              boxShadow: mine ? "var(--shadow-pop)" : "var(--shadow-card)",
              borderRadius: 18,
              borderBottomRightRadius: mine ? 6 : 18,
              borderBottomLeftRadius: mine ? 18 : 6,
            } as const;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[78%] px-3.5 py-2.5" style={bubble}>
                  {m.text && (
                    <p
                      className=""
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
                      <p className="font-semibold" style={{ fontSize: 14 }}>
                        ▶ Snap sent{snap?.openedBy.includes(id) ? " · opened" : ""}
                      </p>
                    ) : snap && !snap.openedBy.includes("me") ? (
                      <button
                        onClick={() => setViewing(snap)}
                        className="font-display italic"
                        style={{ fontSize: 14, color: "var(--accent-ember)" }}
                      >
                        ■ New snap · tap to view
                      </button>
                    ) : (
                      <p
                        className="font-display italic"
                        style={{ fontSize: 14, color: "var(--text-muted)" }}
                      >
                        □ Snap opened
                      </p>
                    ))}
                  {shared && (
                    <Link to={shareKind === "reel" ? "/app/reels" : "/app/feed"} className="block">
                      <img
                        src={shared.image}
                        alt=""
                        className="rounded-xl w-48 aspect-square object-cover"
                      />
                      <p className="mt-1.5 truncate w-48" style={{ fontSize: 12 }}>
                        {shared.caption}
                      </p>
                    </Link>
                  )}
                  {shareKind === "game" && shareId && (
                    <Link
                      to="/app/play/$id"
                      params={{ id: shareId }}
                      className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 font-semibold"
                      style={{
                        background: mine ? "rgba(255,255,255,0.18)" : "var(--bg-surface)",
                        fontSize: 14,
                      }}
                    >
                      🃏 {mine ? "Open the game" : "Join the game"} →
                    </Link>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 10,
                        color: mine ? "rgba(255,255,255,0.8)" : "var(--text-muted)",
                      }}
                    >
                      {clock(m.at)}
                    </span>
                    {mine && <Ticks status={m.status} />}
                  </div>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="flex justify-start">
              <div
                className="px-4 py-3 rounded-2xl flex gap-1"
                style={{ background: "var(--bg-surface)" }}
                aria-label={`${f.name} is typing`}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full soft-pulse-dot"
                    style={{ background: "var(--text-secondary)", animationDelay: `${i * 0.18}s` }}
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
          className="flex items-center gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ borderTop: "1px solid var(--border-cool)", background: "var(--bg-primary)" }}
        >
          <input
            id="chat-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (s.mode === "live") sendTyping(id);
            }}
            placeholder={`Message ${f.name}`}
            className="flex-1 rounded-full px-4 py-3 outline-none text-cream"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-cool)",
              fontSize: 15,
            }}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send"
            className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40"
            style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)" }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
      {viewing && <SnapViewer snap={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
