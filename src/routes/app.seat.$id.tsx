import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { PersonMenu } from "@/components/Safety";
import { bdayLabel, daysUntil, useBirthdays } from "@/lib/birthdays";
import { Avatar } from "@/components/Avatar";
import { clientOnly } from "@/components/SocialUI";
import { friendById, isMutual, streakStatus, useSocial } from "@/lib/social";
import { GAMES } from "@/components/ArcadeGames";
import { dayRanking, gameFor, thisWeek, today, useDaily, weekStandings } from "@/lib/daily";

export const Route = createFileRoute("/app/seat/$id")({
  component: clientOnly(LiveSeat),
});

/** A real person at your table: who they are, your streak, and what you can do together. */
function LiveSeat() {
  const { id } = Route.useParams();
  const s = useSocial();
  const navigate = useNavigate();
  const f = friendById(id);
  const daily = useDaily();
  const [menu, setMenu] = useState(false);
  const bday = useBirthdays().find((b) => b.id === id);
  if (!f) {
    return (
      <div className="px-6 pt-24 text-center">
        <p className="font-semibold text-cream">That seat is empty.</p>
        <Link to="/app/people" className="btn-bronze inline-block mt-5 px-6 py-3">
          Your 25
        </Link>
      </div>
    );
  }
  const st = streakStatus(s.streaks[id]);
  const inMine = s.mode !== "live" || s.people.some((p) => p.id === id);
  const mutual = isMutual(f) && inMine;
  const posts =
    s.posts.filter((p) => p.by === id).length + s.reels.filter((r) => r.by === id).length;
  const week = weekStandings(daily, thisWeek());
  const pts = (who: string) => week.find((r) => r.id === who);
  const todayRows = dayRanking(daily, today());
  const avg = (who: string) => todayRows.find((r) => r.id === who)?.avg;
  const rivalry = [
    { label: "This week's points", you: pts("me")?.points, them: pts(id)?.points },
    { label: "Days won 👑", you: pts("me")?.wins, them: pts(id)?.wins },
    { label: `Today · ${GAMES[gameFor(today())].name}`, you: avg("me"), them: avg(id) },
  ];
  return (
    <div className="pb-10">
      <header className="band px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 text-center">
        <div className="flex justify-between">
          <button
            onClick={() => navigate({ to: "/app/home" })}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={() => setMenu(true)}
            aria-label={`More options for ${f.name}`}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className="flex justify-center -mt-2">
          <span className="rounded-full" style={{ boxShadow: "0 0 0 4px rgba(255,255,255,0.7)" }}>
            <Avatar src={f.avatar || undefined} initials={f.initials} color={f.color} size={104} />
          </span>
        </div>
        <h1 className="font-display mt-4" style={{ fontSize: 34 }}>
          {f.name}
        </h1>
        {f.username && <p className="sub mt-1">@{f.username}</p>}
        {bday && (
          <Link to="/app/card/$id" params={{ id }} className="sub mt-1 inline-block underline underline-offset-4">
            🎂 {bdayLabel(bday)}
            {daysUntil(bday) === 0 ? " · today! Sign the card" : daysUntil(bday) <= 7 ? ` · in ${daysUntil(bday)}d` : ""}
          </Link>
        )}
        <p className="mt-3">
          <span
            className={`sticker ${mutual ? "" : inMine ? "sun" : "pink"}`}
            style={{ transform: "rotate(-3deg)" }}
          >
            {mutual
              ? "🤝 in each other's 25"
              : inMine
                ? "👀 in your 25 · not seated you back"
                : "👀 has you in their 25"}
          </span>
        </p>
        <p className="sub mt-2 text-sm">
          {inMine ? "In your 25 for " : "You've been in theirs for "}
          {f.joinedDaysAgo <= 0
            ? "less than a day"
            : `${f.joinedDaysAgo} day${f.joinedDaysAgo > 1 ? "s" : ""}`}
          .
        </p>
      </header>

      <div className="px-5 -mt-5 relative grid grid-cols-3 gap-3">
        {[
          { n: st.count ? `🔥 ${st.count}` : "–", l: st.atRisk ? "snap today!" : "snap streak" },
          { n: String((s.chats[id] ?? []).length), l: "messages" },
          { n: String(posts), l: "posts" },
        ].map((x) => (
          <div key={x.l} className="card-editorial py-3 text-center">
            <p className="font-bold text-cream tabular-nums" style={{ fontSize: 20 }}>
              {x.n}
            </p>
            <p
              className="text-xs"
              style={{ color: x.l === "snap today!" ? "var(--accent-ember)" : "var(--text-muted)" }}
            >
              {x.l}
            </p>
          </div>
        ))}
      </div>

      {!mutual && (
        <div className="mx-5 mt-6 card p-4">
          <p className="font-bold text-cream">
            {inMine ? "Waiting on them 👀" : "Your move 👀"}
          </p>
          <p className="meta mt-1">
            {inMine
              ? `${f.name.split(" ")[0]} can see your posts. Chats, snaps and games unlock when they seat you back.`
              : `You can see ${f.name.split(" ")[0]}'s posts. Seat them back to unlock chats, snaps and games.`}
          </p>
          {!inMine && (
            <Link to="/app/people" className="btn-primary mt-3 px-5">
              Seat them back
            </Link>
          )}
        </div>
      )}

      <div className={`px-5 mt-6 grid grid-cols-2 gap-3 ${mutual ? "" : "hidden"}`}>
        <Link to="/app/chat/$id" params={{ id }} className="btn-bronze py-3.5 text-center">
          Message
        </Link>
        <Link
          to="/app/snap"
          search={{ to: id }}
          className="rounded-full py-3.5 text-center font-semibold card-editorial"
        >
          Send a snap
        </Link>
      </div>

      <section className="px-5 mt-8">
        <p className="label-caps mb-2">this week's rivalry</p>
        <ul className="card-editorial divide-y" style={{ borderColor: "var(--border-cool)" }}>
          {rivalry.map(({ label, them, you }) => (
            <li key={label} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-semibold text-cream">{label}</span>
              <span className="tabular-nums text-cool">
                You {you ?? "–"} · {f.name.split(" ")[0]} {them ?? "–"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {menu && <PersonMenu person={f} onClose={() => setMenu(false)} />}
    </div>
  );
}
