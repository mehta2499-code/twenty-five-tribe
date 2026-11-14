import { SeatLogo } from "@/components/Logo";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Check, Flame, Hourglass, Lock, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  friendById,
  meView,
  mutualFriends,
  social,
  streakStatus,
  useSocial,
  type Snap,
} from "@/lib/social";

// ---------- Layout ----------

/**
 * The top of every tab: where you are (title), one line of context, and actions.
 * `eyebrow` is kept for older callers and shown as a small label above the title.
 */
export function PageBand({
  eyebrow,
  title,
  sub,
  children,
  actions,
  back,
  ring,
}: {
  /** Show the Seat Ring mark (how full your 25 is) next to the title. */
  ring?: boolean;
  eyebrow?: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
  children?: ReactNode;
  actions?: ReactNode;
  back?: boolean;
}) {
  const router = useRouter();
  return (
    <header className="topband px-5 pt-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))] pb-6">
      {back && (
        <button
          onClick={() => router.history.back()}
          aria-label="Back"
          className="-ml-2 mb-2 w-10 h-10 rounded-full flex items-center justify-center text-cool hover:bg-[var(--fill)]"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="label-caps" style={{ color: "var(--blue-deep)" }}>
              {eyebrow}
            </p>
          )}
          <h1 className="chalk-title mt-0.5 flex items-center gap-2.5" style={{ fontSize: 36 }}>
            {ring && <HeaderRing />}
            {title}
          </h1>
          {/* Page descriptions are hidden: titles speak for themselves. */}
          {sub && <span className="sr-only">{sub}</span>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 pt-1">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
export const PageHeader = PageBand;

/** A labelled group of content. */
export function Section({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-7 ${className}`}>
      <div className="px-5 mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-cream">{title}</h2>
        {aside && <span className="meta">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** What to do when there's nothing here yet. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-10">
      <span
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--fill)", color: "var(--blue-deep)" }}
      >
        <Icon size={22} />
      </span>
      <p className="mt-4 chalk-heading">{title}</p>
      {body && (
        <p className="mt-1.5 text-cool max-w-[18rem]" style={{ fontSize: 14, lineHeight: 1.5 }}>
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Placeholder rows while live data loads. */
export function SkeletonRows({ count = 4, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <ul className="px-5" aria-label="Loading" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          {avatar && <span className="skeleton w-12 h-12 shrink-0" style={{ borderRadius: 999 }} />}
          <span className="flex-1 grid gap-2">
            <span className="skeleton h-3.5 w-2/5" />
            <span className="skeleton h-3 w-4/5" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A quiet one-line reminder of who can see something. */
export function AudienceNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-1.5 meta">
      <Lock size={13} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// ---------- Sheets & pickers ----------

/** Bottom sheet. Closes on the backdrop, the Close button, or Escape. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(14,42,69,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md sheet-in"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04) 45%), rgba(33,30,43,0.94)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.16)",
          borderBottom: "none",
          borderRadius: "28px 28px 0 0",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-float)",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="sticky top-0 z-10 flex justify-between items-center px-5 pt-4 pb-3"
          style={{ background: "var(--surface)" }}
        >
          <h2 className="heading" style={{ fontSize: 18 }}>
            {title.charAt(0).toUpperCase() + title.slice(1)}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-1.5 rounded-full flex items-center justify-center text-cool hover:bg-[var(--fill)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5">{children}</div>
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
  note,
  only,
}: {
  /** Limit the list to these people (e.g. who can see a post). */
  only?: string[];
  title: string;
  cta: string;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  single?: boolean;
  showStreaks?: boolean;
  note?: string;
}) {
  const s = useSocial();
  const [picked, setPicked] = useState<string[]>([]);
  const people = only ? mutualFriends().filter((p) => only.includes(p.id)) : mutualFriends();
  const all = picked.length === people.length && people.length > 0;
  const toggle = (id: string) => {
    if (single) return onPick([id]);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  return (
    <Sheet title={title} onClose={onClose}>
      {people.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="No mutual seats yet"
          body="Chats, blinks and games unlock when you're in each other's 25. Seat your people and get them to seat you back."
          action={
            <Link to="/app/people" className="btn-primary px-5">
              Find your people
            </Link>
          }
        />
      ) : (
        <>
          {!single && (
            <div className="flex items-center justify-between mb-3">
              <span className="meta">
                {picked.length ? `${picked.length} selected` : "Choose who gets it"}
              </span>
              <button
                onClick={() => setPicked(all ? [] : people.map((p) => p.id))}
                className="text-sm font-semibold text-bronze px-1 py-1"
              >
                {all ? "Clear" : "Select all"}
              </button>
            </div>
          )}
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {people.map((f) => {
              const on = picked.includes(f.id);
              const st = streakStatus(s.streaks[f.id]);
              return (
                <button
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  aria-pressed={single ? undefined : on}
                  className="flex flex-col items-center rounded-xl py-1"
                >
                  <span
                    className="relative rounded-full p-[2px]"
                    style={{ background: on ? "var(--blue-deep)" : "transparent" }}
                  >
                    <Avatar
                      src={f.avatar || undefined}
                      initials={f.initials}
                      color={f.color}
                      size={52}
                    />
                    {on && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{
                          background: "var(--accent)",
                          color: "var(--on-accent)",
                          boxShadow: "0 0 0 2px var(--surface)",
                        }}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 text-[13px] text-cream truncate w-full text-center">
                    {f.name.split(" ")[0]}
                  </span>
                  {showStreaks && st.count > 0 && <StreakBadge friendId={f.id} size={12} />}
                </button>
              );
            })}
          </div>
          {note && (
            <div className="mt-5">
              <AudienceNote>{note}</AudienceNote>
            </div>
          )}
          {!single && (
            <button
              disabled={picked.length === 0}
              onClick={() => onPick(picked)}
              className="btn-primary w-full mt-4"
            >
              {picked.length ? `${cta} (${picked.length})` : cta}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

// ---------- Snaps ----------

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: "#000" }}
      onClick={done}
      role="dialog"
      aria-label={`Blink from ${sender?.name ?? "you"}`}
    >
      <div className="absolute top-0 inset-x-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.25)" }}
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
        <div className="flex items-center gap-3 mt-3 text-white">
          <Avatar
            src={sender ? sender.avatar || undefined : meView().avatar}
            initials={sender?.initials ?? meView().initials}
            color={sender?.color}
            size={34}
          />
          <span className="font-semibold" style={{ fontSize: 15 }}>
            {sender?.name ?? "You"}
          </span>
          <span className="ml-auto tabular-nums text-sm opacity-90">{left}s</span>
          <button
            aria-label="Close"
            onClick={done}
            className="w-9 h-9 rounded-full flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        style={{ background: snap.bg ?? "#000" }}
      >
        {snap.image && (
          <>
            {/* Whole photo, never cropped; a blurred copy fills the rest of the screen. */}
            <img
              loading="lazy"
              decoding="async"
              src={snap.image}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110"
              style={{ filter: "blur(28px) brightness(0.6)" }}
            />
            <img
              loading="lazy"
              decoding="async"
              src={snap.image}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
          </>
        )}
        {snap.caption && (
          <p
            className="relative text-center font-semibold px-5 py-3 mx-6 text-white"
            style={{
              fontSize: snap.image ? 20 : 30,
              lineHeight: 1.3,
              textShadow: "0 2px 12px rgba(0,0,0,0.35)",
              background: snap.image ? "rgba(0,0,0,0.45)" : "transparent",
              borderRadius: 16,
            }}
          >
            {snap.caption}
          </p>
        )}
      </div>
    </div>
  );
}

/** Snap streak: flame and count; amber with an hourglass when it ends today. */
export function StreakBadge({ friendId, size = 13 }: { friendId: string; size?: number }) {
  const s = useSocial();
  const st = streakStatus(s.streaks[friendId]);
  if (!st.count) return null;
  const color = st.atRisk ? "var(--amber)" : "var(--ink-2)";
  return (
    <span
      className="inline-flex items-center gap-0.5 tabular-nums font-semibold whitespace-nowrap"
      style={{ fontSize: size, color }}
      title={
        st.atRisk ? "Send them a blink today to keep your streak" : `${st.count}-day blink streak`
      }
      aria-label={st.atRisk ? `${st.count}-day streak, ends today` : `${st.count}-day streak`}
    >
      <Flame
        size={size + 1}
        fill={st.atRisk ? "var(--amber)" : "#E8743B"}
        color={st.atRisk ? "var(--amber)" : "#E8743B"}
        aria-hidden="true"
      />
      {st.count}
      {st.atRisk && <Hourglass size={size} aria-hidden="true" />}
    </span>
  );
}

// ---------- Feedback ----------

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed inset-x-0 bottom-28 z-[80] flex justify-center px-5 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className="animate-soft-in max-w-sm px-4 py-3 rounded-2xl font-semibold text-sm"
        style={{
          background: "var(--surface)",
          color: "var(--ink)",
          border: "var(--bd)",
          boxShadow: "var(--pop), 0 10px 30px rgba(0,0,0,0.45)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Light tap feedback on phones that support it. */
export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported; no-op.
  }
}

const CONFETTI_COLOURS = ["#2B8AC4", "#F7A8A0", "#F2B53A", "#1A5276", "#13805F"];

/** A one-shot burst of confetti for wins. Change `fire` to replay. */
export function Confetti({ fire }: { fire: number }) {
  if (!fire) return null;
  return (
    <div
      key={fire}
      className="fixed inset-0 z-[90] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-1/2">
        {Array.from({ length: 30 }).map((_, i) => {
          const angle = (i / 30) * Math.PI * 2;
          const dist = 130 + ((i * 37) % 110);
          const style = {
            background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
            ["--dx" as string]: `${Math.cos(angle) * dist}px`,
            ["--dy" as string]: `${Math.sin(angle) * dist + 150}px`,
            ["--rot" as string]: `${((i * 97) % 720) - 360}deg`,
            animationDelay: `${(i % 5) * 20}ms`,
          } as CSSProperties;
          return <span key={i} className="confetti-piece" style={style} />;
        })}
      </div>
    </div>
  );
}

// ---------- Rendering helpers ----------

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

/**
 * Screens that only have sample content so far. Signed in, they say so plainly
 * instead of showing made-up people.
 */
export function demoOnly<P extends object>(Screen: ComponentType<P>, title: string) {
  return function DemoOnlyScreen(props: P) {
    const s = useSocial();
    if (s.mode !== "live") return <Screen {...props} />;
    return (
      <div className="pb-8">
        <PageBand
          title={title}
          sub="Coming soon for your real 25. Here's what you can use today."
          back
        />
        <ul className="px-5 grid gap-2">
          {[
            { to: "/app/chats" as const, label: "Chats and blinks" },
            { to: "/app/feed" as const, label: "Feed and reels" },
            { to: "/app/games" as const, label: "Games" },
          ].map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="card flex items-center justify-between px-4 min-h-[52px] font-semibold text-cream"
              >
                {l.label}
                <ArrowLeft size={18} className="rotate-180 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  };
}

/** The Seat Ring in page headers: fills up as your 25 fills up. */
function HeaderRing() {
  const s = useSocial();
  const n = s.people.length;
  return (
    <Link to="/app/home" aria-label="Back to your Table" className="inline-flex">
      <SeatLogo filled={n} height={50} />
    </Link>
  );
}
