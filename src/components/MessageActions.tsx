/**
 * WhatsApp-style message actions: long-press a message and the chat blurs,
 * the message lifts, with reactions above and actions below (Reply, Forward,
 * Copy, Star, Report, Delete). Also: the quoted message in a reply, the
 * forward sheet, and the jump-to-latest button.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Copy,
  Forward,
  Plus,
  Reply,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { buzz } from "@/components/SocialUI";

// ---------- Starred and "deleted for me" (kept on this phone) ----------
type Prefs = { starred: string[]; hidden: string[] };
const KEY = "tf.chat.prefs.v1";
let prefs: Prefs = { starred: [], hidden: [] };
let loaded = false;
const subs = new Set<() => void>();
function loadPrefs() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    prefs = { starred: [], hidden: [], ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    // keep defaults
  }
}
function savePrefs(next: Prefs) {
  prefs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  subs.forEach((f) => f());
}
export function useChatPrefs() {
  loadPrefs();
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => prefs,
    () => prefs,
  );
}
export function toggleStar(id: string) {
  loadPrefs();
  const on = prefs.starred.includes(id);
  savePrefs({
    ...prefs,
    starred: on ? prefs.starred.filter((x) => x !== id) : [id, ...prefs.starred].slice(0, 500),
  });
  return !on;
}
export function hideForMe(id: string) {
  loadPrefs();
  savePrefs({ ...prefs, hidden: [id, ...prefs.hidden].slice(0, 2000) });
}

// ---------- What a message is, in a few words ----------
/** "📷 Photo", "🎤 Voice note"… for quotes and previews. */
export function snippetOf(text?: string, ref?: string, deleted?: boolean) {
  if (deleted) return "🚫 This message was deleted";
  const r = ref ?? "";
  if (r.startsWith("img:")) return `📷 ${text || "Photo"}`;
  if (r.startsWith("vid:")) return `🎥 ${text || "Video"}`;
  if (r.startsWith("voice:")) return "🎤 Voice note";
  if (r.startsWith("gif:")) return "GIF";
  if (r.startsWith("sticker:")) return "Sticker";
  if (r === "poll") return `📊 ${text ?? "Poll"}`;
  if (r.startsWith("game:")) return `🎮 ${text ?? "Game invite"}`;
  if (r.startsWith("wordup:")) return "🟩 Word Up result";
  if (r.startsWith("post:") || r.startsWith("reel:")) return "📸 Shared a scene";
  return text ?? "Message";
}

// ---------- The quoted message inside a reply ----------
export function Quote({
  name,
  color,
  text,
  onTap,
  inComposer,
}: {
  name: string;
  color: string;
  text: string;
  onTap?: () => void;
  inComposer?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`w-full text-left flex rounded-xl overflow-hidden ${inComposer ? "" : "mb-1"}`}
      style={{ background: "rgba(0,0,0,0.22)", minWidth: inComposer ? undefined : 160 }}
    >
      <span className="w-1 shrink-0" style={{ background: color }} />
      <span className="min-w-0 px-2.5 py-1.5">
        <span className="block font-bold truncate" style={{ fontSize: 13, color }}>
          {name}
        </span>
        <span
          className="block truncate"
          style={{ fontSize: 13.5, color: "rgba(244,242,248,0.72)" }}
        >
          {text}
        </span>
      </span>
    </button>
  );
}

/** Scroll to a message and make it glow for a moment (tapping a quote). */
export function jumpTo(msgId: string) {
  const el = document.getElementById(`msg-${msgId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("msg-flash");
  void el.offsetWidth;
  el.classList.add("msg-flash");
}

/** The reply bar above the message box: who you're replying to, and an X. */
export function ReplyBar({
  name,
  color,
  text,
  onCancel,
}: {
  name: string;
  color: string;
  text: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 pb-2 w-full">
      <div className="flex-1 min-w-0">
        <Quote name={name} color={color} text={text} inComposer />
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center"
        style={{ color: "rgba(255,255,255,0.7)" }}
      >
        <X size={20} />
      </button>
    </div>
  );
}

// ---------- Long-press: reactions + actions ----------
export type MsgAction = {
  label: string;
  icon: React.ReactNode;
  run: () => void;
  danger?: boolean;
};

const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const MORE = [
  "🔥",
  "😍",
  "🥹",
  "😭",
  "🤣",
  "😅",
  "😎",
  "🤔",
  "😴",
  "🙄",
  "😤",
  "😡",
  "🥳",
  "🎉",
  "💯",
  "👏",
  "🙌",
  "💀",
  "🤝",
  "👀",
  "✨",
  "💔",
  "🤯",
  "😬",
  "🤡",
  "🫡",
  "🫶",
  "💪",
  "😇",
  "🤗",
  "😘",
  "🥲",
  "😳",
  "🫠",
  "✅",
  "❌",
];

/** Standard actions for a message, in WhatsApp's order. */
export function messageActions(o: {
  text?: string;
  starred: boolean;
  mine: boolean;
  deleted?: boolean;
  canForward: boolean;
  onReply: () => void;
  onForward: () => void;
  onStar: () => void;
  onReport?: () => void;
  onDeleteMine: () => void;
  onDeleteForMe: () => void;
}): MsgAction[] {
  if (o.deleted)
    return [
      { label: "Delete for me", icon: <Trash2 size={21} />, run: o.onDeleteForMe, danger: true },
    ];
  const a: MsgAction[] = [{ label: "Reply", icon: <Reply size={21} />, run: o.onReply }];
  if (o.canForward) a.push({ label: "Forward", icon: <Forward size={21} />, run: o.onForward });
  if (o.text)
    a.push({
      label: "Copy",
      icon: <Copy size={21} />,
      run: () => void navigator.clipboard?.writeText(o.text!).catch(() => {}),
    });
  a.push({
    label: o.starred ? "Unstar" : "Star",
    icon: o.starred ? <StarOff size={21} /> : <Star size={21} />,
    run: o.onStar,
  });
  if (!o.mine && o.onReport)
    a.push({ label: "Report", icon: <AlertTriangle size={21} />, run: o.onReport });
  a.push({
    label: "Delete",
    icon: <Trash2 size={21} />,
    run: o.mine ? o.onDeleteMine : o.onDeleteForMe,
    danger: true,
  });
  return a;
}

export function MessageMenu({
  rect,
  mine,
  preview,
  myEmoji,
  onReact,
  actions,
  onClose,
}: {
  rect: DOMRect;
  mine: boolean;
  preview: React.ReactNode;
  myEmoji?: string;
  onReact: (emoji: string | null) => void;
  actions: MsgAction[];
  onClose: () => void;
}) {
  const [more, setMore] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(rect.top - 66);
  // Keep everything on screen: the reactions above, the menu below.
  useLayoutEffect(() => {
    const h = box.current?.offsetHeight ?? 0;
    const vh = window.innerHeight;
    setTop(
      Math.max(12 + (window.visualViewport?.offsetTop ?? 0), Math.min(rect.top - 66, vh - h - 16)),
    );
  }, [rect.top, more]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const side = mine
    ? { right: Math.max(8, window.innerWidth - rect.right) }
    : { left: Math.max(8, rect.left) };
  const pick = (e: string) => {
    onReact(myEmoji === e ? null : e);
    buzz(10);
    onClose();
  };
  return createPortal(
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Message options"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 w-full h-full"
        style={{
          background: "rgba(8,7,11,0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      />
      <div
        ref={box}
        className={`absolute flex flex-col gap-2.5 ${mine ? "items-end" : "items-start"} msg-lift`}
        style={{ top, ...side, maxWidth: "calc(100vw - 16px)" }}
      >
        {/* Reactions: six quick ones and + for the rest. */}
        <div
          className="flex items-center gap-0.5 rounded-full px-1.5 py-1.5"
          style={{ background: "rgba(38,35,47,0.96)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
        >
          {QUICK.map((e) => (
            <button
              key={e}
              onClick={() => pick(e)}
              aria-label={`React ${e}`}
              aria-pressed={myEmoji === e}
              className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: myEmoji === e ? "rgba(255,255,255,0.14)" : "transparent" }}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>{e}</span>
            </button>
          ))}
          <button
            onClick={() => setMore((v) => !v)}
            aria-label="More reactions"
            aria-expanded={more}
            className="w-10 h-10 rounded-full flex items-center justify-center ml-0.5"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <Plus size={20} />
          </button>
        </div>
        {more ? (
          <div
            className="grid grid-cols-6 gap-1 rounded-3xl p-2.5"
            style={{
              background: "rgba(38,35,47,0.97)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              width: 300,
              maxWidth: "calc(100vw - 16px)",
            }}
          >
            {MORE.map((e) => (
              <button
                key={e}
                onClick={() => pick(e)}
                aria-label={`React ${e}`}
                className="h-11 rounded-xl flex items-center justify-center active:scale-90"
                style={{ background: myEmoji === e ? "rgba(255,255,255,0.14)" : "transparent" }}
              >
                <span style={{ fontSize: 26, lineHeight: 1 }}>{e}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* The message itself, lifted out of the chat. */}
            <div
              className="pointer-events-none overflow-hidden"
              style={{ width: rect.width, maxWidth: "calc(100vw - 16px)", maxHeight: "42vh" }}
            >
              {preview}
            </div>
            <div
              className="rounded-3xl py-1.5 overflow-hidden"
              role="menu"
              style={{
                background: "rgba(38,35,47,0.97)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
                minWidth: 240,
              }}
            >
              {actions.map((a) => (
                <button
                  key={a.label}
                  role="menuitem"
                  onClick={() => {
                    onClose();
                    a.run();
                  }}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left active:bg-white/5"
                  style={{ color: a.danger ? "#FF6B7F" : "#F4F2F8", fontSize: 17 }}
                >
                  <span aria-hidden="true" className="opacity-90">
                    {a.icon}
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Delete: for me / for everyone ----------
export function DeleteSheet({
  mine,
  onForMe,
  onForEveryone,
  onClose,
}: {
  mine: boolean;
  onForMe: () => void;
  onForEveryone: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Cancel"
        onClick={onClose}
        className="absolute inset-0 w-full h-full"
        style={{ background: "rgba(0,0,0,0.5)" }}
      />
      <div className="relative w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] grid gap-2 msg-lift">
        <div className="rounded-2xl overflow-hidden" style={{ background: "#26232F" }}>
          <p className="text-center py-3 meta" style={{ fontSize: 13 }}>
            Delete message?
          </p>
          {mine && (
            <button
              onClick={() => {
                onClose();
                onForEveryone();
              }}
              className="w-full py-3.5 font-semibold"
              style={{
                color: "#FF6B7F",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                fontSize: 17,
              }}
            >
              Delete for everyone
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              onForMe();
            }}
            className="w-full py-3.5 font-semibold"
            style={{
              color: "#FF6B7F",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              fontSize: 17,
            }}
          >
            Delete for me
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-2xl py-3.5 font-bold"
          style={{ background: "#26232F", color: "#F4F2F8", fontSize: 17 }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** What a deleted message shows. */
export function DeletedNote({ mine }: { mine: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 italic"
      style={{ fontSize: 15, color: "rgba(244,242,248,0.6)" }}
    >
      <Ban size={15} aria-hidden="true" />
      {mine ? "You deleted this message" : "This message was deleted"}
    </span>
  );
}

// ---------- Forward ----------
export type ForwardTarget = {
  id: string;
  kind: "friend" | "group";
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
  emoji?: string;
};

export function ForwardSheet({
  targets,
  onSend,
  onClose,
}: {
  targets: ForwardTarget[];
  onSend: (picked: ForwardTarget[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);
  const list = targets.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Forward to"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 w-full h-full"
        style={{ background: "rgba(0,0,0,0.55)" }}
      />
      <div
        className="relative w-full max-w-md rounded-t-3xl flex flex-col msg-lift"
        style={{ background: "#1C1A24", maxHeight: "82vh" }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={onClose} className="font-semibold" style={{ color: "var(--ink-2)" }}>
            Cancel
          </button>
          <p className="font-bold" style={{ fontSize: 17 }}>
            Forward to…
          </p>
          <span className="w-12" />
        </div>
        <div className="px-4 pb-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search people and groups"
            className="w-full rounded-xl px-3.5 py-2.5 outline-none"
            style={{ background: "rgba(255,255,255,0.07)", fontSize: 16, color: "var(--ink)" }}
          />
        </div>
        <ul className="flex-1 overflow-y-auto px-2">
          {list.map((t) => {
            const on = picked.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  onClick={() =>
                    setPicked((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id].slice(0, 10)))
                  }
                  aria-pressed={on}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl active:bg-white/5 text-left"
                >
                  {t.kind === "group" && !t.avatar ? (
                    <span
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.08)", fontSize: 20 }}
                    >
                      {t.emoji}
                    </span>
                  ) : (
                    <Avatar src={t.avatar} initials={t.initials} color={t.color} size={40} />
                  )}
                  <span className="flex-1 min-w-0 font-semibold truncate">{t.name}</span>
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      border: on ? "none" : "2px solid rgba(255,255,255,0.3)",
                      background: on ? "var(--lime)" : "transparent",
                      color: "var(--on-accent)",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            disabled={!picked.length || sending}
            onClick={async () => {
              setSending(true);
              try {
                await onSend(targets.filter((t) => picked.includes(t.id)));
              } finally {
                setSending(false);
                onClose();
              }
            }}
            className="w-full rounded-2xl font-extrabold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "var(--lime)", color: "var(--on-accent)", minHeight: 52 }}
          >
            <Forward size={18} aria-hidden="true" />
            {sending
              ? "Sending…"
              : picked.length
                ? `Send to ${picked.length}`
                : "Pick who to send to"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A forwarded photo, video or voice note: fetch what's on screen to send again. */
export async function fileFromMessage(msgId: string): Promise<File | null> {
  const el = document.getElementById(`msg-${msgId}`);
  const media = el?.querySelector("img[src], video[src], video source[src], audio[src]") as
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLAudioElement
    | HTMLSourceElement
    | null;
  const src = media?.getAttribute("src");
  if (!src) return null;
  const blob = await (await fetch(src)).blob();
  const ext = blob.type.split("/")[1]?.split(";")[0] || "bin";
  return new File([blob], `forwarded.${ext}`, { type: blob.type });
}

// ---------- Jump to the newest message ----------
export function JumpToLatest({ logId }: { logId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let el: HTMLElement | null = null;
    let raf = 0;
    const on = () => {
      if (!el) return;
      setShow(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
    };
    const attach = () => {
      el = document.getElementById(logId);
      if (!el) {
        raf = requestAnimationFrame(attach);
        return;
      }
      el.addEventListener("scroll", on, { passive: true });
      on();
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      el?.removeEventListener("scroll", on);
    };
  }, [logId]);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(logId);
        el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }}
      aria-label="Jump to the latest message"
      className="absolute right-3 bottom-3 z-[3] w-11 h-11 rounded-full flex items-center justify-center pop"
      style={{
        background: "rgba(38,35,47,0.95)",
        color: "#fff",
        boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <ChevronDown size={24} />
    </button>
  );
}
