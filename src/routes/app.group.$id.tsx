import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, Toast, clientOnly } from "@/components/SocialUI";
import { Reactable, VoicePlayer, VoiceRecorder } from "@/components/ChatExtras";
import { dayKey, mutualFriends } from "@/lib/social";
import {
  addMembers,
  leaveGroup,
  markSeen,
  member,
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markSeen(id);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [id, msgs.length]);

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
    void sendToGroup(id, t).catch((e) => setToast((e as Error).message));
  };
  const tone = (who: string) => NAME_TONES[g.members.indexOf(who) % NAME_TONES.length] ?? "var(--ink-2)";
  const canAdd = mutualFriends().filter((f) => !g.members.includes(f.id));

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
          <button onClick={() => setInfo(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
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

        <div className="flex-1 overflow-y-auto px-3 py-4" role="log" aria-live="polite">
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
                const grouped = prev && !newDay && prev.from === m.from && m.at - prev.at < 5 * 60_000;
                const who = member(m.from, st);
                return (
                  <li key={m.id}>
                    {newDay && (
                      <p className="text-center meta my-3" style={{ fontSize: 12 }}>
                        {new Date(m.at).toLocaleDateString([], { day: "numeric", month: "short" })}
                      </p>
                    )}
                    <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "" : "mt-2"}`}>
                      {!mine && (
                        <span className="w-7 shrink-0">
                          {!grouped && <Avatar src={who.avatar} initials={who.initials} color={who.color} size={28} />}
                        </span>
                      )}
                      <Reactable id={m.id} mine={mine}>
                        <div
                          className="px-3.5 py-2"
                          style={{
                            background: mine ? "var(--accent)" : "var(--surface)",
                            border: mine ? "1px solid transparent" : "1px solid var(--line)",
                            color: mine ? "var(--on-accent)" : "var(--ink)",
                            borderRadius: 18,
                            borderBottomRightRadius: mine ? 6 : 18,
                            borderBottomLeftRadius: mine ? 18 : 6,
                          }}
                        >
                          {!mine && !grouped && (
                            <p className="text-[12px] font-extrabold mb-0.5" style={{ color: tone(m.from) }}>
                              {who.name.split(" ")[0]}
                            </p>
                          )}
                          {m.ref?.startsWith("voice:") ? (
                            <VoicePlayer value={m.ref} mine={mine} />
                          ) : (
                            <p style={{ fontSize: 15, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                              {m.text}
                            </p>
                          )}
                          <p className="text-right tabular-nums" style={{ fontSize: 11.5, opacity: 0.7 }}>
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
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${g.name}`}
            aria-label={`Message ${g.name}`}
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
              onSend={(blob, secs) => void sendGroupVoice(id, blob, secs).catch((e) => setToast((e as Error).message))}
              onUnavailable={() =>
                setToast("Voice notes need the secure (https) version of 25, or mic access. Coming with your domain 🔒")
              }
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
                  {g.createdBy === mId && <span className="chip" style={{ minHeight: 24, fontSize: 11 }}>made it</span>}
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
                .then(() => setToast("Added 🎉"))
                .catch((e) => setToast((e as Error).message));
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
