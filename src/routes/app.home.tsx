import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, AlertCircle, Sparkles, ChevronRight, Cake, Gamepad2, Archive } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  FRIENDS, MOMENTS, ME, DRIFTING, ACTIVE_GAMES, CAPSULES,
  SEATS_FILLED, SEATS_TOTAL, FRIENDSHIP_SCORE, type MomentTag,
} from "@/lib/data";
import { MomentSheet } from "@/components/MomentSheet";

export const Route = createFileRoute("/app/home")({
  component: Home,
});

const TAG_META: Record<MomentTag, { color: string; bar: string; italic: boolean }> = {
  "Milestone":     { color: "#D4A96A", bar: "accent-bar-gold",   italic: false },
  "Life Update":   { color: "#1D9E75", bar: "accent-bar-teal",   italic: false },
  "Mood":          { color: "#7B6FD4", bar: "accent-bar-purple", italic: true  },
  "Thought":       { color: "#8A9CAA", bar: "accent-bar-muted",  italic: true  },
  "Remember When": { color: "#7B6FD4", bar: "accent-bar-purple", italic: true  },
};

function spaced(label: string) { return label.toUpperCase().split("").join(" "); }

// Synthetic "birthdays this week" — first two friends as a stand-in
const BIRTHDAYS = [
  { friend: FRIENDS[6], when: "Today" },
  { friend: FRIENDS[11], when: "Friday" },
];

function SeatsHero() {
  const top = FRIENDS.slice(0, 15);
  const remaining = SEATS_TOTAL - top.length;
  const pct = (FRIENDSHIP_SCORE.value / FRIENDSHIP_SCORE.max) * 100;

  return (
    <Link to="/app/my25" className="block mx-4 mt-2">
      <div
        className="card-editorial accent-bar-purple p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #16273A 0%, #132030 60%, #0F1B27 100%)",
          boxShadow: "0 0 40px rgba(123,111,212,0.12)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="label-caps" style={{ color: "#7B6FD4" }}>{spaced("Your 25")}</div>
            <h2 className="font-display italic text-warm mt-1.5" style={{ fontSize: 26, lineHeight: 1.1 }}>
              These are your people.
            </h2>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="font-display font-bold text-warm text-glow-25" style={{ fontSize: 36, lineHeight: 1 }}>
              {SEATS_FILLED}
            </div>
            <div className="label-caps text-cool mt-1">{spaced(`of ${SEATS_TOTAL}`)}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-8 gap-2">
          {top.map((f) => (
            <Avatar key={f.id} src={f.avatar} initials={f.initials} color={f.color} size={32}
              ring={f.daysQuiet >= 14 ? "drift" : f.postedToday ? "active" : "none"} />
          ))}
          {remaining > 0 && (
            <div
              className="rounded-full flex items-center justify-center font-display italic text-cool"
              style={{ width: 32, height: 32, border: "1.5px dashed #3D5060", fontSize: 11 }}
            >
              +{remaining}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={11} style={{ color: "#7B6FD4" }} />
              <span className="label-caps" style={{ color: "#7B6FD4" }}>{spaced("Friendship Score")}</span>
              <span className="ml-auto font-display text-warm" style={{ fontSize: 13 }}>
                {FRIENDSHIP_SCORE.value}<span className="text-cool"> / {FRIENDSHIP_SCORE.max}</span>
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "#0D1820" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#7B6FD4,#A29AE5)" }} />
            </div>
          </div>
          <ChevronRight size={18} className="text-cool" />
        </div>
      </div>
    </Link>
  );
}

function DriftCard() {
  if (DRIFTING.length === 0) return null;
  const top = DRIFTING.slice(0, 4);
  return (
    <Link to="/app/my25" className="block mx-4 mt-3">
      <div className="card-editorial accent-bar-red p-4 animate-coral-pulse" style={{ background: "#132030" }}>
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(201,64,64,0.15)", border: "1px solid rgba(201,64,64,0.5)" }}>
            <AlertCircle size={18} style={{ color: "#C94040" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="label-caps" style={{ color: "#C94040" }}>{spaced(`Drift · ${DRIFTING.length} quiet`)}</div>
            <div className="font-display text-[14px] mt-1.5 leading-snug text-warm">
              {top[0].name}{top[1] ? `, ${top[1].name}` : ""}{top[2] ? ` & ${DRIFTING.length - 2} more ` : " "}
              haven't surfaced in 2+ weeks.
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {top.map((f) => (
              <div key={f.id} className="rounded-full" style={{ outline: "2px solid #0D1820" }}>
                <Avatar src={f.avatar} initials={f.initials} color={f.color} size={26} />
              </div>
            ))}
          </div>
          <span className="label-caps" style={{ color: "#C94040" }}>{spaced("Reach out →")}</span>
        </div>
      </div>
    </Link>
  );
}

function BirthdayCard() {
  if (BIRTHDAYS.length === 0) return null;
  return (
    <div className="mx-4 mt-3 card-editorial accent-bar-gold p-4" style={{ background: "#132030" }}>
      <div className="flex items-center gap-2">
        <Cake size={13} style={{ color: "#D4A96A" }} />
        <span className="label-caps" style={{ color: "#D4A96A" }}>{spaced("Birthdays this week")}</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {BIRTHDAYS.map(({ friend, when }) => (
          <li key={friend.id} className="flex items-center gap-3">
            <Avatar src={friend.avatar} initials={friend.initials} color={friend.color} size={36} ring="gold" />
            <div className="flex-1 min-w-0">
              <div className="font-display text-warm" style={{ fontSize: 14 }}>{friend.name}</div>
              <div className="label-caps text-cool mt-0.5">{spaced(when)}</div>
            </div>
            <button className="btn-capsule rounded-full px-3 py-1.5 font-display italic" style={{ fontSize: 12 }}>
              Toast them
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JudgementCard() {
  const turns = ACTIVE_GAMES.filter((g) => g.status === "Your turn");
  if (turns.length === 0) return null;
  return (
    <Link to="/app/games" className="block mx-4 mt-3">
      <div className="card-editorial accent-bar-teal p-4" style={{ background: "#132030" }}>
        <div className="flex items-center gap-2">
          <Gamepad2 size={13} style={{ color: "#1D9E75" }} />
          <span className="label-caps" style={{ color: "#1D9E75" }}>{spaced(`${turns.length} rounds · your turn`)}</span>
        </div>
        <ul className="mt-3 space-y-3">
          {turns.map((g) => {
            const players = g.players.map((pid) => FRIENDS.find((f) => f.id === pid)).filter(Boolean);
            return (
              <li key={g.id} className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {players.slice(0, 3).map((p) => (
                    <div key={p!.id} className="rounded-full" style={{ outline: "2px solid #132030" }}>
                      <Avatar src={p!.avatar} initials={p!.initials} color={p!.color} size={28} />
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-warm truncate" style={{ fontSize: 14 }}>{g.title}</div>
                  <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "#0D1820" }}>
                    <div className="h-full rounded-full" style={{ width: `${g.progress * 100}%`, background: "linear-gradient(90deg,#1D9E75,#7BD4B2)" }} />
                  </div>
                </div>
                <ChevronRight size={16} className="text-cool shrink-0" />
              </li>
            );
          })}
        </ul>
      </div>
    </Link>
  );
}

function CapsuleCard() {
  const cap = CAPSULES[0];
  const friend = FRIENDS.find((f) => f.id === cap.friendId)!;
  return (
    <Link to="/app/capsules" className="block mx-4 mt-3">
      <div className="card-editorial accent-bar-purple p-4" style={{ background: "#132030" }}>
        <div className="flex items-center gap-2">
          <Archive size={13} style={{ color: "#7B6FD4" }} />
          <span className="label-caps" style={{ color: "#7B6FD4" }}>{spaced("Memory Capsule")}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Avatar src={friend.avatar} initials={friend.initials} color={friend.color} size={44} />
          <div className="flex-1 min-w-0">
            <div className="font-display italic text-warm" style={{ fontSize: 15 }}>{friend.name}</div>
            <div className="font-display italic text-cool mt-0.5" style={{ fontSize: 12 }}>{cap.years}</div>
          </div>
          <ChevronRight size={16} className="text-cool" />
        </div>
        <p className="mt-3 font-display italic text-warm" style={{ fontSize: 13, lineHeight: 1.55 }}>
          "{cap.story[0].text}"
        </p>
      </div>
    </Link>
  );
}

function Home() {
  const [sheet, setSheet] = useState(false);

  // Reduced feed — surface only Remember When + 2 highest signal moments
  const remember = MOMENTS.filter((m) => m.tag === "Remember When").slice(0, 1);
  const milestones = MOMENTS.filter((m) => m.tag === "Milestone").slice(0, 2);
  const feed = [...remember, ...milestones];

  return (
    <>
      <header className="sticky top-0 z-20 px-5 pt-6 pb-3 flex items-center justify-between"
        style={{ background: "rgba(13,24,32,0.78)", backdropFilter: "blur(14px)" }}>
        <div>
          <span className="font-display font-bold leading-none text-glow-25"
            style={{ fontSize: 44, color: "#F2F0EB", letterSpacing: "-0.02em" }}>
            25
          </span>
          <p className="label-caps text-cool mt-1.5">{spaced("Your relationship OS")}</p>
        </div>
        <div className="ring-active inline-block">
          <div className="rounded-full p-[2px]" style={{ background: "#0D1820" }}>
            <Avatar src={ME.avatar} initials={ME.initials} size={36} />
          </div>
        </div>
      </header>

      <SeatsHero />
      <DriftCard />
      <BirthdayCard />
      <JudgementCard />
      <CapsuleCard />

      <div className="px-5 mt-7 mb-1 flex items-baseline justify-between">
        <h2 className="font-display italic text-warm" style={{ fontSize: 18 }}>
          From your circle today
        </h2>
        <Link to="/app/moments" className="label-caps text-cool">{spaced("All →")}</Link>
      </div>

      <section className="px-4 pt-3 flex flex-col">
        {feed.map((m, idx) => {
          const friend = FRIENDS.find((f) => f.id === m.friendId)!;
          const meta = TAG_META[m.tag];
          const isRemember = m.tag === "Remember When";
          return (
            <div key={m.id} className={idx === 0 ? "" : "pt-4"}>
              {idx !== 0 && <hr className="hr-thin mb-4" />}
              <article className={`card-editorial ${meta.bar} animate-soft-in relative`}
                style={{ padding: "16px 16px 18px", boxShadow: isRemember ? "0 0 24px rgba(123,111,212,0.18)" : undefined }}>
                {isRemember && (
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={11} style={{ color: "#7B6FD4" }} />
                    <span className="label-caps" style={{ color: "#7B6FD4" }}>{spaced("Remember When")}</span>
                  </div>
                )}
                {!isRemember && (
                  <div className="label-caps mb-2" style={{ color: meta.color }}>{spaced(m.tag)}</div>
                )}
                <header className="flex items-center gap-3">
                  <Avatar src={friend.avatar} initials={friend.initials} color={friend.color} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[14px] text-warm leading-tight">{friend.name}</div>
                    <div className="label-caps text-cool mt-0.5" style={{ letterSpacing: "0.18em" }}>{m.timeAgo}</div>
                  </div>
                </header>
                <p className={`mt-2.5 font-display text-warm ${meta.italic ? "italic" : ""}`}
                  style={{ fontSize: 14, lineHeight: 1.6 }}>
                  {m.text}
                </p>
                {isRemember && m.remember && (
                  <button className="mt-3 btn-capsule px-4 py-2 text-[12px] font-display italic">
                    {m.remember.cta}
                  </button>
                )}
              </article>
            </div>
          );
        })}
        <p className="text-center font-display italic text-cool py-8" style={{ fontSize: 12 }}>
          That's the day. Small feed. Real lives.
        </p>
      </section>

      <button
        onClick={() => setSheet(true)}
        aria-label="New moment"
        className="fab-gradient fixed bottom-24 right-1/2 translate-x-[10rem] z-30 h-14 w-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      <MomentSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
