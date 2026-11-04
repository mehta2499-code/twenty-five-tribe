import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  friendById,
  seatedFriends,
  social,
  streakStatus,
  useSocial,
  type Snap,
} from "@/lib/social";
import { ME } from "@/lib/data";

/** Bottom sheet in the app's walnut-and-bronze style. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(14,42,69,0.45)", backdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card-editorial p-6 animate-soft-in"
        style={{
          background: "var(--bg-card)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex justify-between items-center mb-4">
          <p className="label-caps">{title}</p>
          <button onClick={onClose} className="label-caps text-cool">
            close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Pick one or more people from your 25. */
export function FriendPicker({
  title,
  cta,
  onClose,
  onPick,
  single = false,
  showStreaks = false,
}: {
  title: string;
  cta: string;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  single?: boolean;
  showStreaks?: boolean;
}) {
  const s = useSocial();
  const [picked, setPicked] = useState<string[]>([]);
  const people = seatedFriends();
  const toggle = (id: string) => {
    if (single) return onPick([id]);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  return (
    <Sheet title={title} onClose={onClose}>
      {!single && (
        <button
          onClick={() => setPicked(picked.length === people.length ? [] : people.map((p) => p.id))}
          className="label-caps text-bronze mb-3"
        >
          {picked.length === people.length ? "clear all" : `all ${people.length} of your people`}
        </button>
      )}
      <div className="grid grid-cols-4 gap-3">
        {people.map((f) => {
          const on = picked.includes(f.id);
          const st = streakStatus(s.streaks[f.id]);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              className="flex flex-col items-center active:scale-95 transition"
            >
              <div
                className="rounded-full"
                style={{
                  padding: 2,
                  background: on ? "var(--accent-bronze)" : "transparent",
                  boxShadow: on ? "0 0 16px rgba(43,138,196,0.45)" : "none",
                }}
              >
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={52} />
              </div>
              <span
                className="font-display italic mt-1.5 text-cool truncate w-full text-center"
                style={{ fontSize: 11 }}
              >
                {f.name}
              </span>
              {showStreaks && st.count > 0 && (
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 10,
                    color: st.atRisk ? "var(--accent-ember)" : "var(--text-muted)",
                  }}
                >
                  🔥 {st.count}
                  {st.atRisk ? " ⏳" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!single && (
        <button
          disabled={picked.length === 0}
          onClick={() => onPick(picked)}
          className="mt-6 w-full rounded-full py-3.5 font-display italic disabled:opacity-40 active:scale-[0.99] transition"
          style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)", fontSize: 15 }}
        >
          {picked.length ? `${cta} · ${picked.length}` : cta}
        </button>
      )}
    </Sheet>
  );
}

/** Full-screen snap with a countdown. It's gone once the timer ends or you tap. */
export function SnapViewer({ snap, onClose }: { snap: Snap; onClose: () => void }) {
  const [left, setLeft] = useState(snap.seconds);
  const closed = useRef(false);
  const sender = snap.from === "me" ? null : friendById(snap.from);

  const done = () => {
    if (closed.current) return;
    closed.current = true;
    if (snap.from !== "me") social.openSnap(snap.id);
    onClose();
  };

  useEffect(() => {
    if (left <= 0) return done();
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: "#000" }}
      onClick={done}
      role="dialog"
      aria-label="Snap"
    >
      <div className="absolute top-0 inset-x-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.2)" }}
        >
          <div
            className="h-full"
            style={{
              background: "#fff",
              width: `${(left / snap.seconds) * 100}%`,
              transition: "width 1s linear",
            }}
          />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Avatar
            src={sender?.avatar ?? ME.avatar}
            initials={sender?.initials ?? ME.initials}
            color={sender?.color}
            size={34}
          />
          <span className="font-semibold text-white" style={{ fontSize: 15 }}>
            {sender?.name ?? "You"}
          </span>
          <span className="ml-auto tabular-nums text-white" style={{ fontSize: 13 }}>
            {left}s
          </span>
          <X size={20} className="text-white" />
        </div>
      </div>
      <div
        className="flex-1 relative flex items-center justify-center"
        style={{ background: snap.bg ?? "#000" }}
      >
        {snap.image && (
          <img src={snap.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {snap.caption && (
          <p
            className="relative font-display italic text-center px-6 py-3 mx-6"
            style={{
              fontSize: snap.image ? 20 : 30,
              color: "#fff",
              textShadow: "0 2px 12px rgba(0,0,0,0.35)",
              background: snap.image ? "rgba(0,0,0,0.45)" : "transparent",
              borderRadius: 14,
            }}
          >
            {snap.caption}
          </p>
        )}
      </div>
    </div>
  );
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-32 z-[80] px-5 py-3 rounded-full animate-soft-in font-semibold text-white"
      style={{
        background: "var(--navy)",
        border: "1px solid var(--border-cool)",
        fontSize: 14,
      }}
      role="status"
    >
      {text}
    </div>
  );
}

export function StreakBadge({ friendId, size = 12 }: { friendId: string; size?: number }) {
  const s = useSocial();
  const st = streakStatus(s.streaks[friendId]);
  if (!st.count) return null;
  return (
    <span
      className="tabular-nums whitespace-nowrap"
      style={{ fontSize: size, color: st.atRisk ? "var(--accent-ember)" : "var(--text-secondary)" }}
      title={st.atRisk ? "Snap them today to keep your streak" : "Snap streak"}
    >
      🔥 {st.count}
      {st.atRisk ? " ⏳" : ""}
    </span>
  );
}

/**
 * Social screens show times and streak states that depend on the viewer's clock,
 * so they render in the browser only (avoids server/browser mismatches).
 */
export function clientOnly<P extends object>(Screen: ComponentType<P>) {
  return function ClientOnlyScreen(props: P) {
    const [ready, setReady] = useState(false);
    useEffect(() => setReady(true), []);
    return ready ? <Screen {...props} /> : <div className="min-h-screen" />;
  };
}

/** Light tap feedback on phones that support it. */
export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported; no-op.
  }
}

const CONFETTI_COLOURS = ["#2B8AC4", "#F7A8A0", "#FFC542", "#1A5276", "#17926F", "#ffffff"];

/** A one-shot burst of confetti from the middle of the screen. Change `fire` to replay. */
export function Confetti({ fire }: { fire: number }) {
  if (!fire) return null;
  return (
    <div
      key={fire}
      className="fixed inset-0 z-[90] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-1/2">
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i / 36) * Math.PI * 2;
          const dist = 140 + ((i * 37) % 120);
          const style = {
            background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
            border: i % 6 === 5 ? "1px solid #C9E2F4" : "none",
            ["--dx" as string]: `${Math.cos(angle) * dist}px`,
            ["--dy" as string]: `${Math.sin(angle) * dist + 160}px`,
            ["--rot" as string]: `${((i * 97) % 720) - 360}deg`,
            animationDelay: `${(i % 5) * 20}ms`,
          } as CSSProperties;
          return <span key={i} className="confetti-piece" style={style} />;
        })}
      </div>
    </div>
  );
}

/** The blue band from the homepage, used at the top of each tab. */
export function PageBand({
  eyebrow,
  title,
  sub,
  align = "center",
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
  children?: ReactNode;
}) {
  return (
    <header
      className={`band px-6 pt-[max(2.75rem,calc(env(safe-area-inset-top)+1.5rem))] pb-7 ${align === "center" ? "text-center" : ""}`}
    >
      <p className="label-caps">{eyebrow}</p>
      <h1
        className="font-display mt-3"
        style={{ fontSize: 34, lineHeight: 1.05, textWrap: "balance" }}
      >
        {title}
      </h1>
      {sub && (
        <p className="sub mt-2" style={{ fontSize: 14, lineHeight: 1.45 }}>
          {sub}
        </p>
      )}
      {children}
    </header>
  );
}
