/**
 * The chat screen's look, shared by 1:1 and group chats: wallpaper, header,
 * date pills, bubbles with tails, and the composer (+ · message · camera · mic).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Camera, ChevronLeft, Images, Plus, Send, Sticker } from "lucide-react";
import { GrowingInput, VoiceRecorder } from "@/components/ChatExtras";
import { Sheet, useVisibleViewport } from "@/components/SocialUI";
import { dayKey } from "@/lib/social";

export const BUBBLE_ME = "#33471A";
export const BUBBLE_THEM = "#26232F";

/**
 * The whole chat screen. When the keyboard opens, iPhones slide the page up
 * instead of shrinking it, which pushed the header off the top. This fits the
 * screen to the part above the keyboard instead, so the name stays put and the
 * newest messages sit right above the message box.
 */
export function ChatScreen({ children, logId }: { children: React.ReactNode; logId: string }) {
  const vv = useVisibleViewport();
  // Keyboard opening or closing: keep the newest messages in view if you were there.
  const wasNearBottom = useRef(true);
  useEffect(() => {
    const el = document.getElementById(logId);
    if (!el) return;
    if (wasNearBottom.current) el.scrollTop = el.scrollHeight;
    const on = () => {
      wasNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, [vv?.height, logId]);
  // Don't let the page underneath scroll (that's what moved the header).
  useEffect(() => {
    const settle = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", settle, { passive: true });
    window.visualViewport?.addEventListener("resize", settle);
    return () => {
      window.removeEventListener("scroll", settle);
      window.visualViewport?.removeEventListener("resize", settle);
    };
  }, []);
  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col"
      style={{
        top: vv ? vv.top : 0,
        height: vv ? vv.height : "100%",
        background: "#0B0A0D",
        overscrollBehavior: "none",
      }}
    >
      {children}
    </div>
  );
}

/** The doodle wallpaper behind every chat. It stays put while messages scroll. */
export function ChatWallpaper() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundColor: "#0B0A0D",
        backgroundImage: "url(/chat-wallpaper.webp)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}

/** Top bar: back (with how many unread elsewhere), who it is, and an optional action. */
export function ChatHeader({
  onBack,
  unread,
  children,
}: {
  onBack: () => void;
  unread?: number;
  children: React.ReactNode;
}) {
  return (
    <header
      className="relative z-[2] flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2"
      style={{
        background: "rgba(14,13,18,0.78)",
        backdropFilter: "blur(18px) saturate(1.4)",
        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <button
        onClick={onBack}
        aria-label={unread ? `Back to chats, ${unread} unread` : "Back to chats"}
        className="h-11 shrink-0 rounded-full flex items-center pl-1.5 pr-3 font-semibold"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--ink)",
          fontSize: 16,
        }}
      >
        <ChevronLeft size={26} aria-hidden="true" />
        {unread ? <span className="tabular-nums -ml-0.5">{unread}</span> : null}
      </button>
      {children}
    </header>
  );
}

export function dayLabel(at: number) {
  const k = dayKey(at);
  if (k === dayKey()) return "Today";
  if (k === dayKey(Date.now() - 86_400_000)) return "Yesterday";
  const d = new Date(at);
  return Date.now() - at < 6 * 86_400_000
    ? d.toLocaleDateString([], { weekday: "long" })
    : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/** "Today", "Yesterday", "12 Nov": a little pill between days. */
export function DayPill({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span
        className="rounded-xl px-3 py-1 font-semibold"
        style={{
          fontSize: 12.5,
          background: "rgba(30,28,38,0.92)",
          color: "rgba(255,255,255,0.85)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** The little curl at the bottom corner of the last bubble in a run. */
function Tail({ mine, color }: { mine: boolean; color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="18"
      viewBox="0 0 12 18"
      className="absolute bottom-0"
      style={mine ? { right: -6 } : { left: -6, transform: "scaleX(-1)" }}
    >
      <path d="M0 0 C0 9 3 15 12 18 L0 18 Z" fill={color} />
    </svg>
  );
}

/**
 * A message bubble. Text messages get the time (and ticks) tucked into the
 * last line's corner, like WhatsApp; other content gets it underneath.
 */
export function Bubble({
  mine,
  tail,
  children,
  meta,
  inline = true,
  bare,
  ring,
  width,
}: {
  mine: boolean;
  /** Last bubble in a run from the same person: draw the tail. */
  tail: boolean;
  children: React.ReactNode;
  /** Time and ticks. */
  meta: React.ReactNode;
  /** Tuck the time into the text's last line (text messages). */
  inline?: boolean;
  /** No bubble at all (stickers, GIFs). */
  bare?: boolean;
  /** A coloured outline (e.g. you were @mentioned). */
  ring?: string;
  width?: number;
}) {
  if (bare)
    return (
      <div className="relative">
        {children}
        <div className="flex justify-end mt-0.5">
          <span
            className="rounded-full px-2 py-0.5 flex items-center gap-1"
            style={{ background: "rgba(14,13,18,0.7)", color: "rgba(255,255,255,0.8)" }}
          >
            {meta}
          </span>
        </div>
      </div>
    );
  const bg = mine ? BUBBLE_ME : BUBBLE_THEM;
  return (
    <div
      className="relative px-2.5 pt-1.5 pb-1.5"
      style={{
        background: bg,
        color: "#F4F2F8",
        borderRadius: 18,
        [mine ? "borderBottomRightRadius" : "borderBottomLeftRadius"]: tail ? 4 : 18,
        boxShadow: ring ? `0 0 0 2px ${ring}` : "0 1px 1.5px rgba(0,0,0,0.3)",
        width,
        maxWidth: "100%",
      }}
    >
      {tail && <Tail mine={mine} color={bg} />}
      {inline ? (
        <div className="relative px-1">
          {children}
          {/* Room for the time on the last line; it sits in the corner. */}
          <span aria-hidden="true" className="inline-block" style={{ width: mine ? 74 : 52 }} />
          <span
            className="absolute right-0 bottom-0 flex items-center gap-1"
            style={{ color: "rgba(244,242,248,0.6)" }}
          >
            {meta}
          </span>
        </div>
      ) : (
        <>
          {children}
          <div
            className="flex items-center justify-end gap-1 mt-0.5 px-1"
            style={{ color: "rgba(244,242,248,0.6)" }}
          >
            {meta}
          </div>
        </>
      )}
    </div>
  );
}

/** The composer: + (photos, GIFs, polls) · message box · camera · mic/send. */
export function Composer({
  value,
  onChange,
  onSend,
  label,
  inputId,
  inputRef,
  onFile,
  onGif,
  onPoll,
  onVoice,
  onUnavailable,
  above,
  replyBar,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  label: string;
  inputId?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onFile: (file: File) => void;
  onGif: () => void;
  /** Groups only. */
  onPoll?: () => void;
  onVoice: (blob: Blob, secs: number) => void;
  onUnavailable: (why: string) => void;
  /** Pop-ups that sit just above the composer (the @mention picker). */
  above?: React.ReactNode;
  /** "Replying to…", shown above the message box. */
  replyBar?: React.ReactNode;
}) {
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const typing = !!value.trim();
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFile(file);
  };
  const iconBtn =
    "w-10 h-11 shrink-0 rounded-full flex items-center justify-center active:bg-white/10";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="relative z-[2] flex flex-wrap items-end gap-1 px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      style={{
        background: "rgba(14,13,18,0.86)",
        backdropFilter: "blur(18px) saturate(1.4)",
        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {above}
      {replyBar && <div className="basis-full min-w-0 msg-lift">{replyBar}</div>}
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-label="Send a photo, GIF or poll"
        className={iconBtn}
        style={{ color: "var(--ink)" }}
      >
        <Plus size={26} strokeWidth={2} />
      </button>
      <input ref={pickRef} type="file" accept="image/*,video/*" hidden onChange={pick} />
      <input
        ref={camRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={pick}
      />
      {/* The message box, a pill with the sticker button inside. */}
      <div
        className="flex-1 basis-0 min-w-0 flex items-end rounded-[22px]"
        style={{ background: "#2A2733", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <GrowingInput
          id={inputId}
          value={value}
          onChange={onChange}
          onSend={onSend}
          inputRef={inputRef}
          label={label}
          bare
        />
        <button
          type="button"
          onClick={onGif}
          aria-label="Send a GIF or sticker"
          className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          <Sticker size={21} />
        </button>
      </div>
      {typing ? (
        <button
          type="submit"
          aria-label="Send"
          // Keep the keyboard up: the tap shouldn't take focus from the text box.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center ml-0.5"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <Send size={19} />
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => camRef.current?.click()}
            aria-label="Take a photo or video"
            className={iconBtn}
            style={{ color: "var(--ink)" }}
          >
            <Camera size={23} />
          </button>
          <VoiceRecorder onSend={onVoice} onUnavailable={onUnavailable} />
        </>
      )}
      {menu &&
        createPortal(
          <div className="relative z-[70]">
            <Sheet title="Share" onClose={() => setMenu(false)}>
              <div className="grid grid-cols-3 gap-3 pb-2">
                {[
                  {
                    label: "Photos & videos",
                    icon: <Images size={24} />,
                    tone: "#5B8CFF",
                    on: () => pickRef.current?.click(),
                  },
                  {
                    label: "Camera",
                    icon: <Camera size={24} />,
                    tone: "#F2507B",
                    on: () => camRef.current?.click(),
                  },
                  {
                    label: "GIFs & stickers",
                    icon: <Sticker size={24} />,
                    tone: "#F2A93B",
                    on: onGif,
                  },
                  ...(onPoll
                    ? [
                        {
                          label: "Poll",
                          icon: <BarChart3 size={24} />,
                          tone: "#C1EF62",
                          on: onPoll,
                        },
                      ]
                    : []),
                ].map((x) => (
                  <button
                    key={x.label}
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      x.on();
                    }}
                    className="flex flex-col items-center gap-2 py-2 rounded-2xl active:bg-white/5"
                  >
                    <span
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ background: `${x.tone}22`, color: x.tone }}
                    >
                      {x.icon}
                    </span>
                    <span className="font-semibold text-center" style={{ fontSize: 13 }}>
                      {x.label}
                    </span>
                  </button>
                ))}
              </div>
            </Sheet>
          </div>,
          document.body,
        )}
    </form>
  );
}
