/** Chat extras: emoji reactions, voice notes. Used by 1:1 and group chats. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { _get, _set, fileToImage, useSocial } from "@/lib/social";
import { signedMedia, uploadMediaAt } from "@/lib/live";
import { uuid } from "@/lib/uuid";
import { buzz } from "@/components/SocialUI";

export const REACTIONS = ["❤️", "😂", "😮", "😭", "🔥", "👍"];

// ---------- Reactions store ----------
type RState = Record<string, Record<string, string>>; // msg -> person ("me") -> emoji
let rstore: RState = {};
const rlisteners = new Set<() => void>();
const rset = (s: RState) => {
  rstore = s;
  rlisteners.forEach((l) => l());
  if (_get().mode !== "live") {
    try {
      localStorage.setItem("tf.reactions.v1", JSON.stringify(rstore));
    } catch {
      // ignore
    }
  }
};
let rFor: string | null = null;
let rChannel: ReturnType<typeof supabase.channel> | null = null;
let rTimer: ReturnType<typeof setTimeout> | null = null;

async function loadReactions(me: string) {
  const { data } = await supabase.from("reactions").select("msg_id,user_id,emoji").limit(5000);
  const next: RState = {};
  for (const r of (data ?? []) as { msg_id: string; user_id: string; emoji: string }[])
    (next[r.msg_id] ??= {})[r.user_id === me ? "me" : r.user_id] = r.emoji;
  if (rFor === me) {
    rstore = next;
    rlisteners.forEach((l) => l());
  }
}

export function useReactions() {
  const s = useSocial();
  const st = useSyncExternalStore(
    (l) => {
      rlisteners.add(l);
      return () => rlisteners.delete(l);
    },
    () => rstore,
    () => rstore,
  );
  useEffect(() => {
    if (s.mode === "live" && s.me) {
      if (rFor === s.me.id) return;
      const me = s.me.id;
      rFor = me;
      void loadReactions(me);
      if (rChannel) void supabase.removeChannel(rChannel);
      rChannel = supabase
        .channel(`reactions:${me}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => {
          if (rTimer) clearTimeout(rTimer);
          rTimer = setTimeout(() => void loadReactions(me), 400);
        })
        .subscribe();
    } else if (s.mode === "demo" && rFor !== "demo") {
      rFor = "demo";
      try {
        rstore = JSON.parse(localStorage.getItem("tf.reactions.v1") ?? "{}");
      } catch {
        rstore = {};
      }
      rlisteners.forEach((l) => l());
    }
  }, [s.mode, s.me]);
  return st;
}

export async function react(msgId: string, emoji: string | null) {
  const cur = { ...(rstore[msgId] ?? {}) };
  if (emoji) cur.me = emoji;
  else delete cur.me;
  rset({ ...rstore, [msgId]: cur });
  const s = _get();
  if (s.mode !== "live" || !s.me) return;
  if (emoji)
    await supabase
      .from("reactions")
      .upsert({ msg_id: msgId, user_id: s.me.id, emoji }, { onConflict: "msg_id,user_id" });
  else await supabase.from("reactions").delete().eq("msg_id", msgId).eq("user_id", s.me.id);
}

/** Wraps a message bubble: double-tap for ❤️, long-press for the emoji bar. */
export function Reactable({
  id,
  mine,
  children,
}: {
  id: string;
  mine: boolean;
  children: React.ReactNode;
}) {
  const all = useReactions();
  const here = all[id] ?? {};
  const myEmoji = here.me;
  const [open, setOpen] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  const counts = Object.values(here).reduce<Record<string, number>>((a, e) => {
    a[e] = (a[e] ?? 0) + 1;
    return a;
  }, {});

  return (
    <div className={`relative flex flex-col max-w-[80%] ${mine ? "items-end" : "items-start"}`}>
      {open && (
        <div
          className={`absolute -top-12 z-10 flex gap-1 rounded-full px-2 py-1.5 pop ${mine ? "right-0" : "left-0"}`}
          style={{
            background: "var(--surface)",
            border: "2px solid var(--edge)",
            boxShadow: "var(--pop)",
          }}
          role="menu"
        >
          {REACTIONS.map((e) => (
            <button
              key={e}
              role="menuitem"
              aria-label={`React ${e}`}
              onClick={() => {
                void react(id, myEmoji === e ? null : e);
                setOpen(false);
                buzz(10);
              }}
              className="w-9 h-9 rounded-full text-xl flex items-center justify-center active:scale-90"
              style={{ background: myEmoji === e ? "var(--fill-2)" : "transparent" }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div
        onPointerDown={() => {
          press.current = setTimeout(() => {
            setOpen(true);
            buzz(15);
          }, 420);
        }}
        onPointerUp={() => press.current && clearTimeout(press.current)}
        onPointerLeave={() => press.current && clearTimeout(press.current)}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        onClick={() => {
          const now = Date.now();
          if (now - lastTap.current < 300) {
            void react(id, myEmoji === "❤️" ? null : "❤️");
            buzz(10);
          }
          lastTap.current = now;
          if (open) setOpen(false);
        }}
        className="max-w-full"
        style={{ touchAction: "manipulation", WebkitUserSelect: "none", userSelect: "none" }}
      >
        {children}
      </div>
      {Object.keys(counts).length > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="-mt-1.5 px-1.5 rounded-full text-[13px] flex gap-0.5 items-center relative"
          style={{ background: "var(--surface)", border: "1.5px solid var(--edge)" }}
          aria-label="Reactions"
        >
          {Object.entries(counts).map(([e, n]) => (
            <span key={e}>
              {e}
              {n > 1 && <span className="text-[11px] font-bold ml-0.5">{n}</span>}
            </span>
          ))}
        </button>
      )}
    </div>
  );
}

// ---------- Voice notes ----------

export const canRecord = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";

/** "voice:<path or url>|<seconds>" */
export const voiceRef = (src: string, secs: number) => `voice:${src}|${Math.round(secs)}`;
export function parseVoice(ref?: string) {
  if (!ref?.startsWith("voice:")) return null;
  const [src, secs] = ref.slice(6).split("|");
  return { src, secs: Number(secs) || 0 };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function VoicePlayer({ value, mine }: { value: string; mine: boolean }) {
  const v = parseVoice(value);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!v) return;
    if (/^(blob:|https?:|data:)/.test(v.src)) setUrl(v.src);
    else void signedMedia([v.src]).then((m) => setUrl(m[v.src] ?? null));
  }, [v?.src]);
  if (!v) return null;
  const toggle = () => {
    if (!url) return;
    if (!audio.current) {
      audio.current = new Audio(url);
      audio.current.ontimeupdate = () => setT(audio.current!.currentTime);
      audio.current.onended = () => {
        setPlaying(false);
        setT(0);
      };
    }
    if (playing) audio.current.pause();
    else void audio.current.play();
    setPlaying(!playing);
  };
  const pct = v.secs ? Math.min(100, (t / v.secs) * 100) : 0;
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2.5 py-1 min-w-[170px]"
      aria-label={playing ? "Pause voice note" : "Play voice note"}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: mine ? "rgba(0,0,0,0.15)" : "var(--lime)", color: "var(--on-accent)" }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </span>
      <span className="flex-1 flex items-center gap-[3px] h-6" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: `${30 + ((i * 37) % 70)}%`,
              background:
                (i / 22) * 100 < pct
                  ? mine
                    ? "var(--on-accent)"
                    : "var(--lime)"
                  : mine
                    ? "rgba(0,0,0,0.3)"
                    : "var(--ink-3)",
            }}
          />
        ))}
      </span>
      <span className="text-[12px] font-bold tabular-nums">{fmt(playing ? t : v.secs)}</span>
    </button>
  );
}

/** Mic button: tap to record, tap ■ to send, 🗑 to throw away. */
export function VoiceRecorder({
  onSend,
  onUnavailable,
}: {
  onSend: (blob: Blob, secs: number) => void;
  onUnavailable: (why: string) => void;
}) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const keep = useRef(true);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs((Date.now() - started.current) / 1000), 200);
    return () => clearInterval(t);
  }, [rec]);

  const start = async () => {
    if (!canRecord())
      return onUnavailable(
        typeof window !== "undefined" && !window.isSecureContext
          ? "Voice notes need the secure (https) link of 25. Open it from https://…"
          : "This browser can't record audio. Try Safari or Chrome.",
      );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      keep.current = true;
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const s = (Date.now() - started.current) / 1000;
        if (keep.current && s >= 0.8)
          onSend(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }), s);
        setRec(null);
        setSecs(0);
      };
      started.current = Date.now();
      mr.start();
      setRec(mr);
      buzz(20);
    } catch (e) {
      const name = (e as Error).name;
      onUnavailable(
        name === "NotAllowedError"
          ? "Microphone is blocked. Allow it for this site in your browser settings, then try again."
          : `Couldn't start recording (${(e as Error).message}).`,
      );
    }
  };
  const stop = (send: boolean) => {
    keep.current = send;
    rec?.stop();
  };
  useEffect(() => {
    if (rec && secs >= 120) stop(true);
  });

  if (rec)
    return (
      <div
        className="absolute inset-0 z-10 flex items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        style={{ background: "var(--surface)" }}
      >
        <button
          type="button"
          onClick={() => stop(false)}
          aria-label="Discard voice note"
          className="w-11 h-11 rounded-full flex items-center justify-center text-cool"
        >
          <Trash2 size={19} />
        </button>
        <span className="flex-1 flex items-center gap-2 font-bold" style={{ color: "var(--pink)" }}>
          <span
            className="w-2.5 h-2.5 rounded-full soft-pulse-dot"
            style={{ background: "var(--pink)" }}
          />
          {fmt(secs)} recording…
        </span>
        <button
          type="button"
          onClick={() => stop(true)}
          aria-label="Send voice note"
          className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <Square size={17} fill="currentColor" />
        </button>
      </div>
    );
  return (
    <button
      type="button"
      onClick={start}
      aria-label="Record a voice note"
      className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center"
      style={{ background: "var(--accent)", color: "var(--on-accent)" }}
    >
      <Mic size={20} />
    </button>
  );
}

/** Send a voice note in a 1:1 chat. */
export async function sendVoice(friendId: string, blob: Blob, secs: number) {
  const s = _get();
  const id = uuid();
  const local = URL.createObjectURL(blob);
  _set((st) => ({
    ...st,
    chats: {
      ...st.chats,
      [friendId]: [
        ...(st.chats[friendId] ?? []),
        {
          id,
          from: "me",
          text: "🎤 Voice note",
          sharedPostId: voiceRef(local, secs),
          at: Date.now(),
          status: "sent",
        },
      ],
    },
  }));
  if (s.mode !== "live" || !s.me) return;
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const path = await uploadMediaAt("", blob, ext);
  const { error } = await supabase.from("messages").insert({
    id,
    sender: s.me.id,
    recipient: friendId,
    body: "🎤 Voice note",
    shared_ref: voiceRef(path, secs),
  });
  if (error) throw new Error(error.message);
}

// ---------- Photos and videos in chat ----------

/** iPhones show a black box until a video plays; asking for 0.1s in shows the first frame. */
export const firstFrame = (url: string) => (url.includes("#") ? url : `${url}#t=0.1`);

export const MAX_CHAT_VIDEO_MB = 50;
/** "img:<path or url>" / "vid:<path or url>" */
export function parseMedia(ref?: string) {
  if (!ref) return null;
  if (ref.startsWith("img:")) return { kind: "img" as const, src: ref.slice(4) };
  if (ref.startsWith("vid:")) return { kind: "vid" as const, src: ref.slice(4) };
  return null;
}

export function MediaBubble({ value }: { value: string }) {
  const m = parseMedia(value);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!m) return;
    if (/^(blob:|https?:|data:)/.test(m.src)) setUrl(m.src);
    else void signedMedia([m.src]).then((x) => setUrl(x[m.src] ?? null));
  }, [m?.src]);
  if (!m) return null;
  if (!url) return <div className="w-52 aspect-[3/4] rounded-xl skeleton" />;
  return m.kind === "vid" ? (
    <video
      src={firstFrame(url)}
      controls
      playsInline
      preload="metadata"
      className="rounded-xl w-56 max-w-full aspect-[3/4] object-cover"
      style={{ background: "#000" }}
    />
  ) : (
    <>
      <button onClick={() => setOpen(true)} className="block" aria-label="Open photo">
        <img src={url} alt="" className="rounded-xl w-56 max-w-full object-cover" />
      </button>
      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          aria-label="Close photo"
        >
          <img src={url} alt="" className="max-w-full max-h-full rounded-xl" />
        </button>
      )}
    </>
  );
}

/** Read a picked file: photos are downscaled, videos checked for size. */
export async function prepareMedia(
  file: File,
): Promise<{ blob: Blob; kind: "img" | "vid"; ext: string }> {
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_CHAT_VIDEO_MB * 1024 * 1024)
      throw new Error(`Videos can be up to ${MAX_CHAT_VIDEO_MB} MB.`);
    return { blob: file, kind: "vid", ext: file.type.includes("quicktime") ? "mov" : "mp4" };
  }
  const dataUrl = await fileToImage(file, 1600);
  const blob = await (await fetch(dataUrl)).blob();
  return { blob, kind: "img", ext: "jpg" };
}

/** Send a photo or video in a 1:1 chat. */
export async function sendMedia(friendId: string, file: File) {
  const { blob, kind, ext } = await prepareMedia(file);
  const s = _get();
  const id = uuid();
  const label = kind === "vid" ? "🎥 Video" : "📷 Photo";
  _set((st) => ({
    ...st,
    chats: {
      ...st.chats,
      [friendId]: [
        ...(st.chats[friendId] ?? []),
        {
          id,
          from: "me",
          text: label,
          sharedPostId: `${kind}:${URL.createObjectURL(blob)}`,
          at: Date.now(),
          status: "sent",
        },
      ],
    },
  }));
  if (s.mode !== "live" || !s.me) return;
  const path = await uploadMediaAt("", blob, ext);
  const { error } = await supabase.from("messages").insert({
    id,
    sender: s.me.id,
    recipient: friendId,
    body: label,
    shared_ref: `${kind}:${path}`,
  });
  if (error) throw new Error(error.message);
}

/**
 * Message box that grows with the text (up to ~5 lines, then scrolls).
 * Enter adds a new line on phones; on a keyboard, Enter sends and
 * Shift+Enter adds a line.
 */
export function GrowingInput({
  value,
  onChange,
  onSend,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value]);
  const touch = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;
  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !touch) {
          e.preventDefault();
          if (value.trim()) onSend();
        }
      }}
      placeholder={placeholder}
      aria-label={placeholder}
      className="input flex-1 resize-none py-3 leading-snug"
      style={{ borderRadius: 22, minHeight: 48, maxHeight: 128, overflowY: "auto" }}
      autoComplete="off"
    />
  );
}
