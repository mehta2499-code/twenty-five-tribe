import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ME, SEATS_FILLED, SEATS_TOTAL, ME_DESCRIPTIONS, QUIETLY } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
});

function spaced(s: string) { return s.toUpperCase().split("").join(" "); }

const ITEMS: { label: string; note: string; to?: "/app/capsules" | "/app/privacy" | "/app/thoughts" | "/app/moments" }[] = [
  { label: "Thought of You",  note: "Quiet pings from your people.", to: "/app/thoughts" },
  { label: "Moments",         note: "The 72-hour ones. Nothing accumulates.", to: "/app/moments" },
  { label: "Memory Capsules", note: "The friendships you've made permanent.", to: "/app/capsules" },
  { label: "Privacy",         note: "Screenshots, screen recording, blur.", to: "/app/privacy" },
  { label: "Notifications",   note: "Sunday at 9pm. That's it." },
  { label: "Reshuffle the room", note: "Seats are yours. Rearrange anytime." },
];

function HowTheySeeYou() {
  return (
    <section className="mt-9">
      <p className="label-caps text-center">{spaced(VOICE.you.seeingMe)}</p>
      <ul className="mt-5 space-y-4">
        {ME_DESCRIPTIONS.map((d, i) => (
          <li key={i} className="text-center px-4">
            <p className="font-display italic text-cream"
               style={{ fontSize: 19, lineHeight: 1.45, letterSpacing: "-0.01em" }}>
              "{d.quote}"
            </p>
            <p className="font-display italic mt-1"
               style={{ color: "var(--text-muted)", fontSize: 12 }}>
              — {d.from}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuietlyHappening() {
  const items = [
    { n: QUIETLY.momentsThisMonth, label: "moments this month" },
    { n: QUIETLY.thoughtsExchanged, label: "thoughts exchanged" },
    { n: QUIETLY.verdictsCast, label: "verdicts cast" },
  ];
  return (
    <section className="mt-10">
      <p className="label-caps text-center mb-5">{spaced(VOICE.you.quietly)}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.label} className="text-center">
            <div className="font-display text-cream" style={{ fontSize: 32, lineHeight: 1 }}>
              {i.n}
            </div>
            <div className="font-display italic mt-1.5" style={{ color: "var(--text-muted)", fontSize: 11, lineHeight: 1.3 }}>
              {i.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Profile() {
  return (
    <div className="px-5 pt-9 pb-4">
      <div className="flex flex-col items-center text-center">
        <div className="ring-active inline-block">
          <div className="rounded-full p-[3px]" style={{ background: "var(--bg-primary)" }}>
            <Avatar src={ME.avatar} initials={ME.initials} size={104} />
          </div>
        </div>
        <h1 className="mt-5 font-display italic text-cream" style={{ fontSize: 36, letterSpacing: "-0.01em" }}>
          {ME.name}
        </h1>
        <p className="label-caps mt-2">{spaced(`seat 0 of ${SEATS_TOTAL} · the head of your table`)}</p>
        <p className="font-display italic mt-1" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {SEATS_FILLED} seats taken so far.
        </p>
      </div>

      <div className="hairline mx-8 mt-9" />

      <HowTheySeeYou />

      <div className="hairline mx-8 mt-10" />

      <QuietlyHappening />

      <div className="mt-10 card-editorial overflow-hidden">
        {ITEMS.map((i, idx) => {
          const inner = (
            <>
              <div className="flex-1">
                <div className="font-display text-cream" style={{ fontSize: 15 }}>{i.label}</div>
                <div className="font-display italic mt-0.5" style={{ color: "var(--text-muted)", fontSize: 12 }}>{i.note}</div>
              </div>
              <ChevronRight size={16} className="text-cool" />
            </>
          );
          const cls = "w-full text-left px-4 py-4 hover:bg-white/[0.03] transition flex items-center";
          const style = { borderTop: idx === 0 ? "none" : "1px solid var(--border-cool)" } as const;
          return i.to ? (
            <Link key={i.label} to={i.to} className={cls} style={style}>{inner}</Link>
          ) : (
            <button key={i.label} className={cls} style={style}>{inner}</button>
          );
        })}
      </div>

      <Link to="/" className="block text-center label-caps mt-8 underline-offset-4 hover:underline">
        {spaced("Sign out")}
      </Link>
      <p className="text-center font-display italic mt-6" style={{ color: "var(--text-muted)", fontSize: 11 }}>
        {VOICE.you.footer}
      </p>
    </div>
  );
}
