/**
 * Chat and emoji reactions during a live game. Sent over a Realtime broadcast
 * channel for that game: everyone in the game sees them live; nothing is saved.
 */
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buzz } from "@/components/SocialUI";
import { Glyph3D } from "@/components/Glyph3D";

const REACTIONS = ["😂", "🔥", "😭", "👀", "😤", "🎉", "🫡", "💀"];

type Msg = { id: string; from: string; name: string; text?: string; emoji?: string; at: number };
type Burst = { id: string; emoji: string; name: string; x: number };

export function GameChat({
  gameId,
  meId,
  myName,
  spot = "corner",
}: {
  gameId: string;
  meId: string;
  myName: string;
  /** "side": right edge, mid-screen (for games with cards/keyboard at the bottom). */
  spot?: "corner" | "side";
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [text, setText] = useState("");
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const endRef = useRef<HTMLDivElement>(null);

  const receive = (m: Msg) => {
    // Reactions only float up; the chat list is for words.
    if (m.text) setMsgs((list) => [...list.slice(-49), m]);
    if (m.emoji) {
      const b = { id: m.id, emoji: m.emoji, name: m.name, x: 15 + Math.random() * 70 };
      setBursts((bs) => [...bs, b]);
      setTimeout(() => setBursts((bs) => bs.filter((x) => x.id !== b.id)), 2200);
    }
    if (m.from !== meId && !openRef.current && m.text) setUnread((n) => n + 1);
    if (m.from !== meId) buzz(8);
  };

  useEffect(() => {
    const ch = supabase.channel(`gamechat:${gameId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "m" }, ({ payload }) => receive(payload as Msg)).subscribe();
    chan.current = ch;
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, msgs.length]);

  const send = (m: Partial<Msg>) => {
    const full: Msg = {
      id: `${meId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: meId,
      name: myName.split(" ")[0],
      at: Date.now(),
      ...m,
    };
    void chan.current?.send({ type: "broadcast", event: "m", payload: full });
    receive(full);
  };

  return (
    <>
      {/* Reactions floating up */}
      <div className="fixed inset-0 z-[61] pointer-events-none overflow-hidden" aria-hidden="true">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="absolute bottom-24 flex flex-col items-center game-burst"
            style={{ left: `${b.x}%` }}
          >
            <Glyph3D emoji={b.emoji} size={52} />
            <span
              className="text-[11px] font-bold px-1.5 rounded-full"
              style={{ background: "var(--edge)", color: "#fff" }}
            >
              {b.name}
            </span>
          </span>
        ))}
      </div>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={unread ? `Game chat, ${unread} new` : "Game chat"}
          className={`fixed z-[60] right-3 rounded-full flex items-center justify-center ${
            spot === "side"
              ? "top-[42%] w-12 h-12"
              : "bottom-[max(1rem,env(safe-area-inset-bottom))] w-14 h-14"
          }`}
          style={{
            background: "var(--lime)",
            color: "var(--on-accent)",
            border: "var(--bd)",
            boxShadow: "var(--pop)",
          }}
        >
          <MessageCircle size={24} />
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full text-[12px] font-extrabold flex items-center justify-center"
              style={{
                background: "var(--pink)",
                color: "var(--on-accent)",
                border: "var(--bd)",
              }}
            >
              {unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed z-[60] inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl flex flex-col"
          style={{ background: "var(--surface)", border: "var(--bd)", height: "52vh" }}
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="font-bold text-cream">Game chat</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="w-9 h-9 flex items-center justify-center text-cool"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar">
            {REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  buzz(10);
                  send({ emoji: e });
                }}
                className="text-2xl w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-90"
                style={{ background: "var(--fill)" }}
                aria-label={`React ${e}`}
              >
                <Glyph3D emoji={e} size={24} />
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 grid content-start gap-1.5">
            {msgs.length === 0 && (
              <p className="meta text-center mt-6">Talk your trash here. Nothing is saved.</p>
            )}
            {msgs.map((m) => (
              <p key={m.id} className="text-[14px] text-cream" style={{ overflowWrap: "anywhere" }}>
                <b style={{ color: m.from === meId ? "var(--lime)" : "var(--sky)" }}>
                  {m.from === meId ? "You" : m.name}
                </b>{" "}
                {m.text}
              </p>
            ))}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = text.trim();
              if (!t) return;
              send({ text: t.slice(0, 200) });
              setText("");
            }}
            className="flex gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Message the game chat"
              className="input flex-1"
              style={{ borderRadius: 22 }}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Send"
              className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              <Send size={19} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
