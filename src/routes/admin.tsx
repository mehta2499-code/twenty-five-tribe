/**
 * /admin — usage analytics for the owner.
 *
 * Who can see it is decided on the server: admin_stats() in the database
 * checks the app_admins table and refuses everyone else. Without that answer
 * this page shows the normal 404, so it reveals nothing to other people.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clientOnly } from "@/components/SocialUI";
import { NotFoundComponent } from "@/routes/__root";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "25" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: clientOnly(Admin),
});

type Stats = {
  generated_at: string;
  cards: {
    visitors: number;
    signups: number;
    home_screen_users: number;
    mutual_users: number;
    active_today: number;
    active_7d: number;
  };
  funnel: { step: string; n: number }[];
  retention: {
    day: string;
    signed_up: number;
    d1: number | null;
    d7: number | null;
    d14: number | null;
  }[];
  features_7d: Record<string, number>;
  games_7d: Record<string, number>;
  daily: { day: string; signups: number; active: number; visitors: number }[];
  recent: {
    name: string;
    username: string;
    created_at: string;
    seats: number;
    home_screen: boolean;
  }[];
};

function Admin() {
  const [state, setState] = useState<"checking" | "denied" | Stats>("checking");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return setState("denied");
      const { data, error } = await supabase.rpc("admin_stats" as never);
      setState(error || !data ? "denied" : (data as Stats));
    } catch {
      setState("denied");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (state === "checking") return <div className="min-h-screen bg-background" aria-busy="true" />;
  if (state === "denied") return <NotFoundComponent />;
  const s = state;
  const c = s.cards;

  return (
    <main className="min-h-screen bg-background text-cream">
      <div className="mx-auto max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-16">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="display" style={{ fontSize: 30 }}>
              25 · Admin
            </h1>
            <p className="meta">
              Updated{" "}
              {new Date(s.generated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={busy}
            className="btn-secondary px-4 min-h-[40px]"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Refresh
          </button>
        </header>

        {/* Top cards */}
        <section className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card label="Visitors" value={c.visitors} hint="unique browsers" />
          <Card label="Sign-ups" value={c.signups} />
          <Card
            label="Home-screen users"
            value={c.home_screen_users}
            hint="opened as an app"
            accent
          />
          <Card label="With a mutual seat" value={c.mutual_users} accent />
          <Card label="Active today" value={c.active_today} />
          <Card label="Active 7 days" value={c.active_7d} />
        </section>

        {/* Funnel */}
        <Section title="Funnel" note="Visitors are counted from when tracking went live.">
          <Funnel steps={s.funnel} />
        </Section>

        {/* Daily chart */}
        <Section title="Last 30 days" note="Bars: sign-ups. Line: active signed-in users.">
          <DailyChart rows={s.daily} />
        </Section>

        {/* Feature usage */}
        <Section title="Feature usage · last 7 days">
          <Features f={s.features_7d} games={s.games_7d} />
        </Section>

        {/* Retention */}
        <Section
          title="Retention"
          note="Of people who signed up that day: came back exactly on day 1, 7 and 14."
        >
          <Retention rows={s.retention} />
        </Section>

        {/* Recent sign-ups */}
        <Section title="Recent sign-ups">
          <Recent rows={s.recent} />
        </Section>
      </div>
    </main>
  );
}

const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="card p-4"
      style={
        accent ? { borderColor: "var(--lime)", boxShadow: "0 0 0 1px var(--lime)" } : undefined
      }
    >
      <p className="meta" style={{ fontSize: 12.5 }}>
        {label}
      </p>
      <p
        className="display tabular-nums mt-1"
        style={{ fontSize: 32, lineHeight: 1, color: accent ? "var(--lime)" : undefined }}
      >
        {fmt(value)}
      </p>
      {hint && (
        <p className="meta mt-1" style={{ fontSize: 11.5 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="heading" style={{ fontSize: 20 }}>
        {title}
      </h2>
      {note && <p className="meta mt-0.5">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Funnel({ steps }: { steps: Stats["funnel"] }) {
  const top = Math.max(1, ...steps.map((x) => x.n));
  return (
    <ol className="card p-4 grid gap-3">
      {steps.map((st, i) => (
        <li key={st.step}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">
              {i + 1}. {st.step}
            </span>
            <span className="tabular-nums">
              <b>{fmt(st.n)}</b>
              {i > 0 && (
                <span className="meta ml-2" style={{ fontSize: 12 }}>
                  {pct(st.n, steps[i - 1].n)} of previous
                </span>
              )}
            </span>
          </div>
          <div
            className="mt-1.5 h-3 rounded-full overflow-hidden"
            style={{ background: "var(--fill)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (st.n / top) * 100)}%`,
                background: i === 0 ? "var(--sky)" : "var(--lime)",
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function DailyChart({ rows }: { rows: Stats["daily"] }) {
  const W = 600;
  const H = 180;
  const pad = 24;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.signups, r.active)));
  const bw = (W - pad * 2) / rows.length;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = rows
    .map((r, i) => `${i ? "L" : "M"}${pad + bw * i + bw / 2},${y(r.active)}`)
    .join(" ");
  const last = rows[rows.length - 1];
  return (
    <div className="card p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Daily sign-ups and active users, last 30 days"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad}
              x2={W - pad}
              y1={y(max * t)}
              y2={y(max * t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text x={2} y={y(max * t) + 4} fontSize={10} fill="var(--ink-3)">
              {Math.round(max * t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => (
          <rect
            key={r.day}
            x={pad + bw * i + bw * 0.15}
            y={y(r.signups)}
            width={bw * 0.7}
            height={Math.max(0, H - pad - y(r.signups))}
            rx={2}
            fill="var(--lime)"
            opacity={0.85}
          >
            <title>
              {r.day}: {r.signups} sign-ups, {r.active} active, {r.visitors} visitors
            </title>
          </rect>
        ))}
        <path d={line} fill="none" stroke="var(--sky)" strokeWidth={2.5} strokeLinejoin="round" />
        {[0, Math.floor(rows.length / 2), rows.length - 1].map((i) =>
          rows[i] ? (
            <text
              key={i}
              x={pad + bw * i + bw / 2}
              y={H - 6}
              fontSize={10}
              fill="var(--ink-3)"
              textAnchor="middle"
            >
              {rows[i].day.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="flex flex-wrap gap-4 px-1 mt-1 meta" style={{ fontSize: 12 }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: "var(--lime)" }} /> Sign-ups
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ background: "var(--sky)" }} /> Active users
        </span>
        {last && (
          <span className="ml-auto">
            Today: {last.signups} sign-ups · {last.active} active · {last.visitors} visitors
          </span>
        )}
      </div>
    </div>
  );
}

const FEATURES: [string, string][] = [
  ["quizzes", "Quizzes completed"],
  ["quizzes_started", "Quizzes started"],
  ["blinks", "Blinks sent"],
  ["posts", "Posts"],
  ["games", "Games started"],
  ["leaderboard_views", "Leaderboard views"],
  ["seats", "Seats added"],
  ["mutual_seats", "New mutual seats"],
  ["installs", "App installs (Android/desktop)"],
];

function Features({ f, games }: { f: Record<string, number>; games: Record<string, number> }) {
  const max = Math.max(1, ...FEATURES.map(([k]) => f[k] ?? 0));
  const gameList = Object.entries(games).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card p-4">
      <ul className="grid gap-2.5">
        {FEATURES.map(([k, label]) => (
          <li key={k} className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
            <span className="text-[14px]">{label}</span>
            <span className="font-extrabold tabular-nums text-right">{fmt(f[k] ?? 0)}</span>
            <div
              className="col-span-2 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--fill)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${((f[k] ?? 0) / max) * 100}%`, background: "var(--lime)" }}
              />
            </div>
          </li>
        ))}
      </ul>
      {gameList.length > 0 && (
        <>
          <p className="meta mt-4 mb-2">Games started, by game</p>
          <div className="flex flex-wrap gap-2">
            {gameList.map(([g, n]) => (
              <span key={g} className="chip" style={{ minHeight: 28 }}>
                {g.replace(/[_-]/g, " ")} · <b className="tabular-nums">{n}</b>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Retention({ rows }: { rows: Stats["retention"] }) {
  const shown = rows.filter((r) => r.signed_up > 0).slice(0, 21);
  if (!shown.length) return <p className="card p-4 meta">No sign-ups in the last 30 days yet.</p>;
  const cell = (n: number | null, of: number) =>
    n === null ? (
      <span className="meta">–</span>
    ) : (
      <span className="tabular-nums">
        {n}
        <span className="meta block" style={{ fontSize: 11 }}>
          {pct(n, of)}
        </span>
      </span>
    );
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="meta text-left" style={{ fontSize: 12 }}>
            <th className="px-2 py-2 font-semibold">Signed up</th>
            <th className="px-2 py-2 font-semibold text-right">People</th>
            <th className="px-2 py-2 font-semibold text-right">Day 1</th>
            <th className="px-2 py-2 font-semibold text-right">Day 7</th>
            <th className="px-2 py-2 font-semibold text-right">Day 14</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.day} style={{ borderTop: "1px solid var(--line)" }}>
              <td className="px-2 py-2 whitespace-nowrap">
                {new Date(`${r.day}T00:00:00Z`).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </td>
              <td className="px-2 py-2 text-right tabular-nums font-bold">{r.signed_up}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{cell(r.d1, r.signed_up)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{cell(r.d7, r.signed_up)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{cell(r.d14, r.signed_up)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Recent({ rows }: { rows: Stats["recent"] }) {
  if (!rows.length) return <p className="card p-4 meta">No sign-ups yet.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="meta text-left" style={{ fontSize: 12 }}>
            <th className="px-3 py-2 font-semibold">Person</th>
            <th className="px-3 py-2 font-semibold">Joined</th>
            <th className="px-3 py-2 font-semibold text-right">Seats</th>
            <th className="px-3 py-2 font-semibold text-center">Home screen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.username} style={{ borderTop: "1px solid var(--line)" }}>
              <td className="px-3 py-2">
                <span className="block font-semibold">{r.name}</span>
                <span className="meta">@{r.username}</span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(r.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  timeZone: "Asia/Kolkata",
                })}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-bold">{r.seats}</td>
              <td className="px-3 py-2 text-center">
                {r.home_screen ? (
                  <span style={{ color: "var(--lime)" }}>✓</span>
                ) : (
                  <span className="meta">–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
