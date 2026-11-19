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
  kind,
  hideTab = false,
}: {
  gameId: string;
  meId: string;
  myName: string;
  /** The game (each remembers where you put the chat tab). */
  kind: string;
  /** The game has its own chat button (it sends "gamechat:open"). */
  hideTab?: boolean;
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

  // A game's own chat button opens this, and shows how many are new.
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("gamechat:open", on);
    return () => window.removeEventListener("gamechat:open", on);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("gamechat:unread", { detail: unread }));
  }, [unread]);
  // A board's chat strip shows the latest messages and can send.
  useEffect(() => {
    const share = () =>
      window.dispatchEvent(
        new CustomEvent("gamechat:msgs", {
          detail: msgs.slice(-40).map((m) => ({ ...m, mine: m.from === meId })),
        }),
      );
    share();
    window.addEventListener("gamechat:hello", share);
    return () => window.removeEventListener("gamechat:hello", share);
  }, [msgs, meId]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = String((e as CustomEvent<string>).detail ?? "").trim();
      if (t) send({ text: t.slice(0, 200) });
    };
    window.addEventListener("gamechat:send", on);
    return () => window.removeEventListener("gamechat:send", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, myName]);
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

      {!open && !hideTab && (
        <ChatTab
          kind={kind}
          unread={unread}
          onOpen={() => setOpen(true)}
          label={unread ? `Game chat, ${unread} new` : "Game chat"}
        />
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

/** Where the tab starts in each game: clear of boards, cards and scores. */
const START_Y: Record<string, number> = {
  chess: 0.8, // under the board, beside "Your move"
  connect4: 0.86, // under the board
  ludo: 0.82, // under the board and the dice card
};

/**
 * The way into game chat: a slim tab tucked against the screen edge, so it
 * doesn't sit on cards, scores or buttons. Drag it up or down (or to the other
 * edge) and it stays there for that game.
 */
function ChatTab({
  kind,
  unread,
  onOpen,
  label,
}: {
  kind: string;
  unread: number;
  onOpen: () => void;
  label: string;
}) {
  const key = `tf.gamechat.spot.${kind}`;
  const [spot, setSpot] = useState<{ side: "left" | "right"; y: number }>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "null");
      if (v && (v.side === "left" || v.side === "right") && typeof v.y === "number") return v;
    } catch {
      // ignore
    }
    return { side: "right", y: START_Y[kind] ?? 0.34 };
  });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const H = 52;
  const clampY = (py: number) => Math.max(0.08, Math.min(0.9, py / window.innerHeight));
  const top = drag
    ? drag.y - H / 2
    : spot.y * (typeof window === "undefined" ? 800 : window.innerHeight) - H / 2;
  return (
    <button
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const st = start.current;
        if (!st) return;
        if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
        st.moved = true;
        setDrag({ x: e.clientX, y: e.clientY });
      }}
      onPointerUp={(e) => {
        const st = start.current;
        start.current = null;
        if (!st?.moved) {
          setDrag(null);
          onOpen();
          return;
        }
        const next = {
          side: (e.clientX < window.innerWidth / 2 ? "left" : "right") as "left" | "right",
          y: clampY(e.clientY),
        };
        setSpot(next);
        setDrag(null);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore
        }
      }}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      aria-label={label}
      title="Game chat (drag to move)"
      className={`fixed z-[60] flex items-center justify-center ${unread ? "chat-tab-ping" : ""}`}
      style={{
        top,
        ...(drag ? { left: drag.x - 17 } : spot.side === "right" ? { right: 0 } : { left: 0 }),
        width: 34,
        height: H,
        borderRadius: drag ? 17 : spot.side === "right" ? "16px 0 0 16px" : "0 16px 16px 0",
        background: "rgba(193,239,98,0.92)",
        color: "var(--on-accent)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        touchAction: "none",
        transition: drag ? "none" : "top 0.2s ease, border-radius 0.2s ease",
      }}
    >
      <MessageCircle size={18} />
      {unread > 0 && (
        <span
          className="absolute -top-2 min-w-[20px] h-[20px] px-1 rounded-full text-[11px] font-extrabold flex items-center justify-center"
          style={{
            [spot.side === "right" ? "left" : "right"]: -6,
            background: "var(--pink)",
            color: "var(--on-accent)",
            border: "2px solid #0B0A10",
          }}
        >
          {unread}
        </span>
      )}
    </button>
  );
}

type StripMsg = Msg & { mine: boolean };
/**
 * A small chat box for under a game board: the last few messages and a text
 * box, so you can talk while you play. Only shows in online games (where the
 * game chat is running). Tap the messages to open the full chat.
 */
export function ChatStrip({
  lines = 4,
  dark = true,
  openable = true,
}: {
  lines?: number;
  dark?: boolean;
  /** Tap the messages to open the full chat. */
  openable?: boolean;
}) {
  const [msgs, setMsgs] = useState<StripMsg[] | null>(null);
  const [text, setText] = useState("");
  useEffect(() => {
    const on = (e: Event) => setMsgs((e as CustomEvent<StripMsg[]>).detail ?? []);
    window.addEventListener("gamechat:msgs", on);
    window.dispatchEvent(new Event("gamechat:hello"));
    return () => window.removeEventListener("gamechat:msgs", on);
  }, []);
  // Scroll to the newest message whenever one arrives (you can scroll up to read back).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs?.length]);
  if (!msgs) return null;
  return (
    <div
      className="w-full rounded-2xl px-2.5 pt-1.5 pb-2"
      style={{
        background: dark ? "rgba(7,6,11,0.55)" : "var(--surface)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        ref={box}
        onClick={() => openable && window.dispatchEvent(new Event("gamechat:open"))}
        className="w-full overflow-y-auto grid content-start gap-1 pr-1"
        style={{
          height: lines * 22 + 6,
          cursor: openable ? "pointer" : "default",
          overscrollBehavior: "contain",
        }}
        role="log"
        aria-label="Game chat"
      >
        {msgs.length === 0 ? (
          <span className="text-[14px] self-center" style={{ color: "rgba(255,255,255,0.55)" }}>
            Game chat · talk your trash here
          </span>
        ) : (
          msgs.map((m) => (
            <p
              key={m.id}
              className="text-[14.5px] leading-snug"
              style={{ color: "rgba(255,255,255,0.95)", overflowWrap: "anywhere" }}
            >
              <b style={{ color: m.mine ? "var(--lime)" : "var(--sky)" }}>
                {m.mine ? "You" : m.name}
              </b>{" "}
              {m.text}
            </p>
          ))
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          window.dispatchEvent(new CustomEvent("gamechat:send", { detail: t }));
          setText("");
        }}
        className="mt-1.5 flex gap-1.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          aria-label="Message the game chat"
          className="flex-1 min-w-0 rounded-full px-3.5 outline-none"
          style={{
            height: 40,
            fontSize: 16,
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ background: "var(--lime)", color: "#14200A" }}
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
