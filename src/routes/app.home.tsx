import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useState } from "react";
import {
  Camera,
  ChevronRight,
  Dices,
  Heart,
  ImagePlus,
  MessageCircle,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AddMomentSheet } from "@/components/AddMomentSheet";
import { FRIENDS, ME, RELATIONSHIP_MOMENTS, MOMENTS, THOUGHTS, getSeatMeta } from "@/lib/data";
import { seatedFriends, useSocial, type Person } from "@/lib/social";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const INNER_COUNT = 6;
const OUTER_DOTS = 19;

type RollResult = { friend: Person; phase: "spinning" | "settled" } | null;

function Orbit({ rolling }: { rolling: boolean }) {
  const s = useSocial();
  const inner = seatedFriends().slice(0, INNER_COUNT);

  return (
    <section className="px-5 pt-2">
      <div
        className="relative mx-auto"
        style={{ width: "100%", maxWidth: 340, aspectRatio: "1 / 1" }}
      >
        <div
          className="absolute inset-0 rounded-full breathe pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(216,182,114,0.10) 0%, rgba(216,182,114,0.04) 38%, transparent 70%)",
          }}
        />

        <div className={`absolute inset-0 orbit-slow ${rolling ? "orbit-fast" : ""}`}>
          {Array.from({ length: OUTER_DOTS }).map((_, i) => {
            const angle = (i / OUTER_DOTS) * Math.PI * 2 - Math.PI / 2;
            const r = 48;
            const x = 50 + r * Math.cos(angle);
            const y = 50 + r * Math.sin(angle);
            return (
              <span
                key={i}
                className="absolute soft-pulse"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(216,182,114,0.55)",
                  boxShadow: "0 0 8px rgba(216,182,114,0.45)",
                  transform: "translate(-50%, -50%)",
                  animationDelay: `${(i % 6) * 0.4}s`,
                }}
              />
            );
          })}
        </div>

        {inner.map((f, i) => {
          const angle = (i / INNER_COUNT) * Math.PI * 2 - Math.PI / 2;
          const r = 32;
          const x = 50 + r * Math.cos(angle);
          const y = 50 + r * Math.sin(angle);
          const meta = getSeatMeta(f.id);
          const reserved = meta.state === "RESERVED";
          return (
            <Link
              key={f.id}
              to="/app/seat/$id"
              params={{ id: f.id }}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div
                className="rounded-full transition-transform active:scale-95"
                style={{
                  padding: reserved ? 3 : 0,
                  border: reserved ? "1px dashed rgba(216,182,114,0.55)" : "none",
                  boxShadow: reserved
                    ? "0 0 18px rgba(216,182,114,0.18)"
                    : f.postedToday
                      ? "0 0 0 1px rgba(216,182,114,0.45), 0 0 22px rgba(216,182,114,0.35)"
                      : "0 0 0 3px var(--page), 0 4px 12px -4px rgba(14,42,69,0.3)",
                  opacity: reserved ? 0.7 : 1,
                  filter: reserved ? "grayscale(0.3)" : "none",
                }}
              >
                <Avatar
                  src={f.avatar}
                  initials={f.initials}
                  color={f.color}
                  size={reserved ? 54 : 60}
                />
              </div>
            </Link>
          );
        })}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="candle-glow candle-flicker absolute"
            style={{ width: 130, height: 130 }}
          />
          <Avatar
            src={s.me ? s.me.avatar : ME.avatar}
            initials={s.me?.initials ?? ME.initials}
            size={64}
            ring="gold"
          />
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link to="/app/my25" className="btn-secondary px-4 min-h-[40px] text-sm">
          See all {seatedFriends().length} seats
        </Link>
      </div>
    </section>
  );
}

const ICONS: Record<string, LucideIcon> = {
  post: ImagePlus,
  snap: Camera,
  seat: UserPlus,
  roll: Dices,
  moment: ImagePlus,
  thought: Heart,
};

function QuickActions({ onRoll, onAddMoment }: { onRoll: () => void; onAddMoment: () => void }) {
  const s = useSocial();
  const live = s.mode === "live";
  const items: { icon: string; label: string; hint: string; to?: string; onClick?: () => void }[] =
    live
      ? [
          { icon: "post", label: "Share a post", hint: "Photo for your 25", to: "/app/feed" },
          { icon: "snap", label: "Send a snap", hint: "Gone after one look", to: "/app/snap" },
          { icon: "seat", label: "Save a seat", hint: "Add someone", to: "/app/people" },
          { icon: "roll", label: "Roll the table", hint: "Surprise someone", onClick: onRoll },
        ]
      : [
          {
            icon: "moment",
            label: "Share a moment",
            hint: "A small life update",
            onClick: onAddMoment,
          },
          { icon: "thought", label: "Send a thought", hint: "A quiet ping", to: "/app/thoughts" },
          { icon: "seat", label: "Save a seat", hint: "Add someone", to: "/app/people" },
          { icon: "roll", label: "Roll the table", hint: "Surprise someone", onClick: onRoll },
        ];
  return (
    <section className="px-5 mt-8" aria-labelledby="quick-title">
      <h2 id="quick-title" className="text-[15px] font-semibold text-cream mb-2.5">
        Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const inner = (
            <>
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--fill)", color: "var(--blue-deep)" }}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-cream text-[15px] leading-tight">
                  {it.label}
                </span>
                <span className="block meta mt-0.5" style={{ fontSize: 12.5 }}>
                  {it.hint}
                </span>
              </span>
            </>
          );
          const cls = "card flex items-center gap-3 p-3 text-left hover:bg-[var(--fill)]";
          return it.to ? (
            <Link key={it.label} to={it.to} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={it.label} onClick={it.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StartHere() {
  const s = useSocial();
  const acceptedCount = seatedFriends().length;
  const hasMoments = MOMENTS.length > 0;
  const hasSentThought = THOUGHTS.some((t) => t.direction === "to");

  let nudge: { headline: string; body: string; cta: string; to: string } | null = null;
  if (acceptedCount < 5) {
    nudge = {
      headline: "Fill your first seats",
      body: "Your table comes alive with a few people at it. Add the ones you'd call at 3 AM.",
      cta: "Save a seat",
      to: "/app/people",
    };
  } else if (s.mode === "demo" && !hasMoments) {
    nudge = {
      headline: "Share your first moment",
      body: "A photo, a thought, a small life update.",
      cta: "Add a moment",
      to: "/app/moments",
    };
  } else if (s.mode === "demo" && !hasSentThought) {
    nudge = {
      headline: "Send your first thought",
      body: "Let someone know you noticed.",
      cta: "Send a thought",
      to: "/app/thoughts",
    };
  }
  if (!nudge) return null;

  return (
    <section className="px-5 mt-8">
      <div className="card p-5">
        <p className="heading" style={{ fontSize: 18 }}>
          {nudge.headline}
        </p>
        <p className="mt-1.5 text-cool" style={{ fontSize: 14, lineHeight: 1.5 }}>
          {nudge.body}
        </p>
        <Link to={nudge.to} className="btn-primary mt-4 px-5">
          {nudge.cta}
        </Link>
      </div>
    </section>
  );
}

function RollPanel({ result, onClose }: { result: NonNullable<RollResult>; onClose: () => void }) {
  const f = result.friend;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-28"
      style={{ background: "rgba(14,42,69,0.45)", backdropFilter: "blur(14px)" }}
    >
      <div
        className="w-full max-w-md card-editorial p-7 animate-soft-in text-center"
        style={{ background: "var(--bg-card)" }}
      >
        <Avatar src={f.avatar} initials={f.initials} color={f.color} size={92} ring="gold" />
        <h3 className="font-display italic text-cream mt-5" style={{ fontSize: 30 }}>
          {f.name}
        </h3>
        <p
          className="font-display italic text-cool mt-3 mx-auto max-w-[18rem]"
          style={{ fontSize: 14, lineHeight: 1.5 }}
        >
          Send them something that has nothing to do with anything.
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <Link
            to="/app/snap"
            search={{ to: f.id }}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-cool)" }}
          >
            <Camera size={22} className="text-bronze" />
            <span className="font-semibold text-cream" style={{ fontSize: 13 }}>
              Send a snap
            </span>
          </Link>
          <Link
            to="/app/chat/$id"
            params={{ id: f.id }}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-cool)" }}
          >
            <MessageCircle size={22} className="text-bronze" />
            <span className="font-semibold text-cream" style={{ fontSize: 13 }}>
              Message
            </span>
          </Link>
        </div>
        <button onClick={onClose} className="mt-6 label-caps text-cool">
          close
        </button>
      </div>
    </div>
  );
}

function TodayAtTheTable() {
  const items = RELATIONSHIP_MOMENTS.slice(0, 3);
  return (
    <section className="px-7 mt-14">
      <p className="label-caps text-center mb-8">today at your table</p>
      <ul className="space-y-9">
        {items.map((m) => {
          const f = FRIENDS.find((x) => x.id === m.friendId)!;
          return (
            <li key={m.id}>
              <Link to="/app/seat/$id" params={{ id: f.id }} className="flex items-center gap-4">
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={44} />
                <div className="flex-1 min-w-0">
                  <p
                    className="font-display text-cream"
                    style={{ fontSize: 16, lineHeight: 1.45, letterSpacing: "-0.005em" }}
                  >
                    {m.text}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ModeBanner() {
  const s = useSocial();
  if (s.loading) {
    return (
      <div
        className="mx-5 -mt-6 relative z-10 card flex items-center gap-3 px-4 py-3"
        aria-busy="true"
      >
        <span className="skeleton w-10 h-10" />
        <span className="flex-1 grid gap-2">
          <span className="skeleton h-3.5 w-1/2" />
          <span className="skeleton h-3 w-1/3" />
        </span>
      </div>
    );
  }
  if (s.mode === "live") {
    const taken = s.people.length;
    const incoming = s.requests.filter((r) => r.direction === "incoming").length;
    return (
      <Link
        to="/app/people"
        className="mx-5 -mt-6 relative z-10 card flex items-center gap-3 px-4 py-3 hover:bg-[var(--fill)]"
      >
        <span className="die-tile tabular-nums" style={{ width: 40, height: 40, fontSize: 16 }}>
          {taken}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-cream">{taken} of 25 seats filled</span>
          <span
            className="block meta"
            style={{ color: incoming ? "var(--coral-deep)" : undefined }}
          >
            {incoming ? `${incoming} waiting for you to accept` : "Manage your 25"}
          </span>
        </span>
        <ChevronRight size={18} className="text-faint" aria-hidden="true" />
      </Link>
    );
  }
  return (
    <div className="mx-5 -mt-6 relative z-10 card flex items-center gap-3 px-4 py-3">
      <span className="flex-1 text-cool" style={{ fontSize: 14, lineHeight: 1.4 }}>
        You're viewing demo friends. Sign in to fill your table with real ones.
      </span>
      <Link to="/login" className="btn-primary shrink-0 min-h-[40px] px-4 text-sm">
        Sign in
      </Link>
    </div>
  );
}

function Home() {
  const [roll, setRoll] = useState<RollResult>(null);
  const [adding, setAdding] = useState(false);
  const rolling = roll?.phase === "spinning";

  const s = useSocial();
  const onRoll = () => {
    const candidates = seatedFriends().slice(0, 14);
    if (!candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setRoll({ friend: pick, phase: "spinning" });
    setTimeout(() => setRoll({ friend: pick, phase: "settled" }), 1400);
  };

  return (
    <>
      <header className="band px-5 pt-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))] pb-12">
        <div className="flex items-center justify-between">
          <Logo height={56} title={VOICE.brand} />
          <Link
            to="/app/profile"
            aria-label="Your profile"
            className="rounded-full"
            style={{ border: "1px solid var(--line-2)", boxShadow: "var(--pop)" }}
          >
            <Avatar
              src={s.me ? s.me.avatar : ME.avatar}
              initials={s.me?.initials ?? ME.initials}
              size={40}
            />
          </Link>
        </div>
        <p className="sub mt-3" style={{ fontSize: 16 }}>
          {s.me
            ? `Hi ${s.me.name.split(" ")[0]}. Here's your table.`
            : "The only people that matter."}
        </p>
      </header>

      <ModeBanner />

      <Orbit rolling={rolling} />

      <QuickActions onRoll={onRoll} onAddMoment={() => setAdding(true)} />

      <StartHere />

      {s.mode === "demo" && <TodayAtTheTable />}

      <p className="text-center meta mt-10 mb-2 px-8">{VOICE.brandLine}</p>

      {roll?.phase === "settled" && <RollPanel result={roll} onClose={() => setRoll(null)} />}
      {adding && (
        <AddMomentSheet onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} />
      )}
    </>
  );
}
