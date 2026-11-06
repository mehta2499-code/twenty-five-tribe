import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Paperclip, Send, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, Toast, clientOnly } from "@/components/SocialUI";
import {
  GrowingInput,
  useStickToBottom,
  MediaBubble,
  Reactable,
  VoicePlayer,
  VoiceRecorder,
  parseMedia,
} from "@/components/ChatExtras";
import { dayKey, mutualFriends } from "@/lib/social";
import {
  addMembers,
  leaveGroup,
  markSeen,
  member,
  mentionQuery,
  sendGroupMedia,
  splitMentions,
  sendGroupVoice,
  sendToGroup,
  useGroups,
} from "@/lib/groups";

export const Route = createFileRoute("/app/group/$id")({
  component: clientOnly(GroupThread),
});

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const NAME_TONES = ["var(--lime)", "var(--pink)", "var(--sky)", "var(--sun)"];

function GroupThread() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const st = useGroups();
  const g = st.groups.find((x) => x.id === id);
  const msgs = st.msgs[id] ?? [];
  const [text, setText] = useState("");
  const [info, setInfo] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    markSeen(id);
  }, [id, msgs.length]);
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
    void sendToGroup(id, t).catch((e) => setToast((e as Error).message));
  };
  const tone = (who: string) =>
    NAME_TONES[g.members.indexOf(who) % NAME_TONES.length] ?? "var(--ink-2)";
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
              m.name.toLowerCase().split(" ").some((w) => w.startsWith(q)),
          )
          .slice(0, 6);
  const pickMention = (m: (typeof everyone)[number]) => {
    setText((t) => t.replace(/@([\w.]*)$/, `@${m.username} `));
    boxRef.current?.focus();
  };

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
            className="w-10 h-10 rounded-full flex items-center justify-center text-cool"
          >
            <ArrowLeft size={22} />
          </button>
          <button
            onClick={() => setInfo(true)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
              style={{ background: "var(--fill)", border: "2px solid var(--edge)" }}
            >
              {g.emoji}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-cream truncate">{g.name}</span>
              <span className="block meta truncate">
                {g.members.map((m) => member(m, st).name.split(" ")[0]).join(", ")}
              </span>
            </span>
          </button>
        </header>

        <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-4" role="log" aria-live="polite">
          {msgs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <p className="text-6xl">{g.emoji}</p>
              <p className="heading mt-3">{g.name}</p>
              <p className="meta mt-1">Say something. Someone has to go first.</p>
            </div>
          ) : (
            <ol className="space-y-1.5">
              {msgs.map((m, i) => {
                const mine = m.from === "me";
                const prev = msgs[i - 1];
                const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
                const grouped =
                  prev && !newDay && prev.from === m.from && m.at - prev.at < 5 * 60_000;
                const who = member(m.from, st);
                return (
                  <li key={m.id}>
                    {newDay && (
                      <p className="text-center meta my-3" style={{ fontSize: 12 }}>
                        {new Date(m.at).toLocaleDateString([], { day: "numeric", month: "short" })}
                      </p>
                    )}
                    <div
                      className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "" : "mt-2"}`}
                    >
                      {!mine && (
                        <span className="w-7 shrink-0">
                          {!grouped && (
                            <Avatar
                              src={who.avatar}
                              initials={who.initials}
                              color={who.color}
                              size={28}
                            />
                          )}
                        </span>
                      )}
                      <Reactable id={m.id} mine={mine}>
                        <div
                          className="px-3.5 py-2"
                          style={{
                            background: mine ? "var(--accent)" : "var(--surface)",
                            border: mine
                              ? "1px solid transparent"
                              : m.text && splitMentions(m.text, everyone).some((x) => x.who?.id === "me")
                                ? "2px solid var(--sun)"
                                : "1px solid var(--line)",
                            color: mine ? "var(--on-accent)" : "var(--ink)",
                            borderRadius: 18,
                            borderBottomRightRadius: mine ? 6 : 18,
                            borderBottomLeftRadius: mine ? 18 : 6,
                          }}
                        >
                          {!mine && !grouped && (
                            <p
                              className="text-[12px] font-extrabold mb-0.5"
                              style={{ color: tone(m.from) }}
                            >
                              {who.name.split(" ")[0]}
                            </p>
                          )}
                          {m.ref?.startsWith("voice:") ? (
                            <VoicePlayer value={m.ref} mine={mine} />
                          ) : parseMedia(m.ref) ? (
                            <MediaBubble value={m.ref!} />
                          ) : (
                            <p
                              style={{
                                fontSize: 15,
                                lineHeight: 1.4,
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
                                        ? { background: "var(--sun)", color: "var(--on-dark-fill)" }
                                        : { color: mine ? "inherit" : tone(x.who.id), textDecoration: mine ? "underline" : undefined }
                                    }
                                  >
                                    {x.text}
                                  </b>
                                ) : (
                                  <span key={k}>{x.text}</span>
                                ),
                              )}
                            </p>
                          )}
                          <p
                            className="text-right tabular-nums"
                            style={{ fontSize: 11.5, opacity: 0.7 }}
                          >
                            {clock(m.at)}
                          </p>
                        </div>
                      </Reactable>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="relative flex items-end gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}
        >
          {picks.length > 0 && (
            <ul
              className="absolute left-3 right-3 bottom-full mb-2 rounded-2xl overflow-hidden py-1 z-10"
              style={{
                background: "var(--surface)",
                border: "2px solid var(--edge)",
                boxShadow: "3px 3px 0 var(--edge)",
              }}
              role="listbox"
              aria-label="Mention someone"
            >
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
          <button
            type="button"
            onClick={() => attachRef.current?.click()}
            aria-label="Send a photo or video"
            className="w-11 h-12 shrink-0 rounded-full flex items-center justify-center text-cool"
          >
            <Paperclip size={21} />
          </button>
          <input
            ref={attachRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file)
                void sendGroupMedia(id, file).catch((err) => setToast((err as Error).message));
            }}
          />
          <GrowingInput
            value={text}
            onChange={setText}
            onSend={send}
            inputRef={boxRef}
            placeholder={`Message ${g.name} · @ to tag`}
          />
          {text.trim() ? (
            <button
              type="submit"
              aria-label="Send"
              // Keep the keyboard up: the tap shouldn't take focus from the text box.
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              <Send size={19} />
            </button>
          ) : (
            <VoiceRecorder
              onSend={(blob, secs) =>
                void sendGroupVoice(id, blob, secs).catch((e) => setToast((e as Error).message))
              }
              onUnavailable={(why) => setToast(why)}
            />
          )}
        </form>
      </div>

      {info && (
        <Sheet title={`${g.emoji} ${g.name}`} onClose={() => setInfo(false)}>
          <p className="meta">{g.members.length} of 25 members</p>
          <ul className="mt-3 grid gap-2.5">
            {g.members.map((mId) => {
              const m = member(mId, st);
              return (
                <li key={mId} className="flex items-center gap-3">
                  <Avatar src={m.avatar} initials={m.initials} color={m.color} size={36} />
                  <span className="flex-1 font-semibold text-cream">{m.name}</span>
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
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
