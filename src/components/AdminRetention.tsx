/**
 * Admin panel: the Retention cohort table.
 *
 * Everything is worked out in the database (admin_retention): cohorts by
 * India-time signup day (or rolling 7-day weeks), and per column only the
 * people old enough for it to be over. Immature cells show "-" and are left
 * out of the weighted average. Tap a number to see the people behind it.
 */
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Group = "daily" | "weekly";
type Mode = "exact" | "window";
type Filter = "all" | "activated";
type Col = { returned: number; eligible: number };
type Row = { start: string; end: string; people: number; cols: Col[] };
type Data = { today: string; rows: Row[]; total: { people: number; cols: Col[] } };
type Person = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  signed_up: string;
  last_active: string | null;
  seats: number;
  mutuals: number;
  returned: boolean;
};

const COLS: Record<Mode, string[]> = {
  exact: ["Day 1", "Day 7", "Day 14"],
  window: ["Days 1–3", "Days 4–7", "Days 8–14"],
};
const SUB: Record<Mode, string> = {
  exact: "Of each cohort: active exactly on day 1, day 7 and day 14 after signing up.",
  window: "Of each cohort: active at least once in days 1–3, 4–7 and 8–14 after signing up.",
};
const IST = "Asia/Kolkata";
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const label = (r: Row, g: Group) => {
  if (g === "daily") return day(r.start);
  const [a, b] = [day(r.start), day(r.end)];
  const sameMonth = a.split(" ")[1] === b.split(" ")[1];
  return sameMonth ? `${a.split(" ")[0]}–${b}` : `${a} – ${b}`;
};
const rate = (c: Col) => (c.eligible ? c.returned / c.eligible : null);
/** A subtle green tint that deepens with the rate (none for 0 or not yet). */
const heat = (p: number | null) =>
  p ? `rgba(16, 185, 129, ${(0.1 + 0.5 * Math.min(1, p)).toFixed(3)})` : "transparent";

function Seg<T extends string>({
  value,
  options,
  onChange,
  label: aria,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={aria}
      className="inline-flex rounded-xl p-0.5"
      style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className="px-3 min-h-[34px] rounded-[10px] text-[13px] font-bold"
          style={{
            background: value === v ? "var(--lime)" : "transparent",
            color: value === v ? "var(--on-accent)" : "var(--ink-2)",
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** One cell: the rate big, the fraction small; "-" until it's mature. */
function Cell({ c, onOpen, strong }: { c: Col; onOpen?: () => void; strong?: boolean }) {
  const p = rate(c);
  if (p === null)
    return (
      <span className="meta block text-right px-2" aria-label="Not yet">
        -
      </span>
    );
  const body = (
    <>
      <span
        className="block tabular-nums"
        style={{ fontWeight: 800, fontSize: strong ? 15 : 14, color: "var(--ink)" }}
      >
        {Math.round(p * 100)}%
      </span>
      <span className="block tabular-nums meta" style={{ fontSize: 11 }}>
        {c.returned}/{c.eligible}
      </span>
    </>
  );
  return onOpen ? (
    <button
      onClick={onOpen}
      className="w-full rounded-lg px-2 py-1 text-right"
      style={{ background: heat(p) }}
      aria-label={`${Math.round(p * 100)} percent, ${c.returned} of ${c.eligible}. Show people`}
    >
      {body}
    </button>
  ) : (
    <span className="block rounded-lg px-2 py-1 text-right" style={{ background: heat(p) }}>
      {body}
    </span>
  );
}

/** `refresh` changes when the page is refreshed: reload, keeping the toggles. */
export function AdminRetention({ refresh }: { refresh?: string }) {
  const [group, setGroup] = useState<Group>("daily");
  const [mode, setMode] = useState<Mode>("exact");
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<{ row: Row; col: number } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const { data: d, error: e } = await supabase.rpc(
      "admin_retention" as never,
      { p_group: group, p_mode: mode, p_filter: filter } as never,
    );
    setBusy(false);
    setError(!!e);
    if (!e && d) setData(d as Data);
  }, [group, mode, filter]);
  useEffect(() => void load(), [load, refresh]);

  const heads = COLS[mode];
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="heading" style={{ fontSize: 20 }}>
            Retention
          </h2>
          <p className="meta mt-0.5">
            {SUB[mode]} {filter === "activated" ? "Activated users only." : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Seg
          label="Group cohorts by"
          value={group}
          onChange={setGroup}
          options={[
            ["daily", "Daily"],
            ["weekly", "Weekly"],
          ]}
        />
        <Seg
          label="Retention mode"
          value={mode}
          onChange={setMode}
          options={[
            ["exact", "Exact day"],
            ["window", "Window"],
          ]}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Which signups"
          className="rounded-xl px-3 min-h-[38px] text-[13px] font-bold"
          style={{
            background: "var(--fill)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        >
          <option value="all">All signups</option>
          <option value="activated">Activated users (≥1 mutual seat)</option>
        </select>
      </div>

      <div
        className="card mt-3 overflow-auto relative"
        style={{ maxHeight: 620, opacity: busy && data ? 0.6 : 1, transition: "opacity 150ms" }}
        aria-busy={busy}
      >
        {error ? (
          <p className="p-4 meta">Couldn't load retention. Try Refresh.</p>
        ) : !data ? (
          <p className="p-4 meta">Loading…</p>
        ) : (
          <table className="w-full text-[13.5px] border-separate" style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10" style={{ background: "var(--surface)" }}>
              <tr className="meta text-left" style={{ fontSize: 12 }}>
                <th className="px-3 py-2 font-semibold">
                  {group === "daily" ? "Signed up" : "Week"}
                </th>
                <th className="px-3 py-2 font-semibold text-right">People</th>
                {heads.map((h) => (
                  <th key={h} className="px-2 py-2 font-semibold text-right whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
              {/* Weighted average over mature people only. */}
              <tr style={{ background: "var(--fill)" }}>
                <th
                  className="px-3 py-2 text-left font-extrabold whitespace-nowrap"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  Weighted avg
                </th>
                <th
                  className="px-3 py-2 text-right tabular-nums font-extrabold"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  {data.total.people}
                </th>
                {data.total.cols.map((c, i) => (
                  <th
                    key={i}
                    className="px-1.5 py-1.5"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <Cell c={c} strong />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const empty = r.people === 0;
                return (
                  <tr key={r.start} style={{ opacity: empty ? 0.45 : 1 }}>
                    <td
                      className="px-3 py-2 whitespace-nowrap"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      {label(r, group)}
                      {r.start === data.today && group === "daily" && (
                        <span className="meta"> · today</span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      {empty ? (
                        <span className="tabular-nums meta">0</span>
                      ) : (
                        <button
                          onClick={() => setOpen({ row: r, col: 0 })}
                          className="tabular-nums font-bold underline decoration-dotted underline-offset-4"
                          aria-label={`${r.people} people. Show them`}
                        >
                          {r.people}
                        </button>
                      )}
                    </td>
                    {r.cols.map((c, i) => (
                      <td
                        key={i}
                        className="px-1.5 py-1"
                        style={{ borderTop: "1px solid var(--line)" }}
                      >
                        <Cell
                          c={c}
                          onOpen={empty ? undefined : () => setOpen({ row: r, col: i + 1 })}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="meta mt-2" style={{ fontSize: 11.5 }}>
        Days are India-time calendar days; signup day is day 0. "Active" = any real use that day
        (taps, chats, posts, Drops, games). A cell shows "-" until its day or window is over for
        everyone in it; people too new for a column are left out of it and of the average.
      </p>
      {open && data && (
        <Drawer
          row={open.row}
          col={open.col}
          heads={heads}
          group={group}
          mode={mode}
          filter={filter}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function Drawer({
  row,
  col,
  heads,
  group,
  mode,
  filter,
  onClose,
}: {
  row: Row;
  col: number;
  heads: string[];
  group: Group;
  mode: Mode;
  filter: Filter;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [tab, setTab] = useState<"returned" | "churned">("returned");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setShown(true));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  useEffect(() => {
    void supabase
      .rpc(
        "admin_retention_users" as never,
        {
          p_start: row.start,
          p_group: group,
          p_mode: mode,
          p_filter: filter,
          p_col: col,
        } as never,
      )
      .then(({ data }) => {
        const list = (data as Person[] | null) ?? [];
        setPeople(list);
        if (col > 0 && !list.some((p) => p.returned)) setTab("churned");
      });
  }, [row.start, group, mode, filter, col]);

  const back = people?.filter((p) => p.returned) ?? [];
  const gone = people?.filter((p) => !p.returned) ?? [];
  const list = col === 0 ? (people ?? []) : tab === "returned" ? back : gone;
  const notYet = col > 0 ? row.people - row.cols[col - 1].eligible : 0;
  return (
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label="Cohort people"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: "rgba(5,4,8,0.6)",
          opacity: shown ? 1 : 0,
          transition: "opacity 200ms",
        }}
      />
      <aside
        className="absolute right-0 top-0 bottom-0 w-full max-w-md flex flex-col"
        style={{
          background: "var(--page)",
          borderLeft: "1px solid var(--line)",
          transform: shown ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms var(--ease, ease-out)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="label-caps">
              {label(row, group)} cohort · {col === 0 ? "Everyone" : heads[col - 1]}
            </p>
            <p className="heading mt-1" style={{ fontSize: 19 }}>
              {col === 0
                ? `${row.people} signed up`
                : `${row.cols[col - 1].returned} of ${row.cols[col - 1].eligible} came back`}
            </p>
            {notYet > 0 && (
              <p className="meta mt-0.5" style={{ fontSize: 12 }}>
                {notYet} more too new for this column yet
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-cool"
          >
            <X size={20} />
          </button>
        </header>
        {col > 0 && (
          <div className="px-5 pb-3">
            <Seg
              label="Show"
              value={tab}
              onChange={setTab}
              options={[
                ["returned", `Returned · ${back.length}`],
                ["churned", `Didn't return · ${gone.length}`],
              ]}
            />
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {!people ? (
            <p className="meta py-6">Loading…</p>
          ) : !list.length ? (
            <p className="meta py-6">Nobody here.</p>
          ) : (
            <ul className="grid gap-2">
              {list.map((p) => (
                <PersonRow key={p.id} p={p} showReturn={col === 0} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function PersonRow({ p, showReturn }: { p: Person; showReturn: boolean }) {
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: IST,
    });
  const last = !p.last_active
    ? "never"
    : /^\d{4}-\d{2}-\d{2}$/.test(p.last_active)
      ? day(p.last_active)
      : when(p.last_active);
  const status =
    p.mutuals > 0
      ? { text: `Activated · ${p.mutuals} mutual`, bg: "rgba(193,239,98,0.16)", fg: "var(--lime)" }
      : p.seats > 0
        ? { text: `Seated ${p.seats} · no mutual yet`, bg: "rgba(247,201,72,0.14)", fg: "#F7C948" }
        : { text: "Not seated anyone", bg: "var(--fill)", fg: "var(--ink-2)" };
  return (
    <li className="card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{p.name}</p>
          <p className="meta truncate" style={{ fontSize: 12.5 }}>
            @{p.username}
            {p.email ? ` · ${p.email}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold"
          style={{ background: status.bg, color: status.fg }}
        >
          {status.text}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 text-[12.5px]">
        <dt className="meta">Signed up</dt>
        <dt className="meta">Last active</dt>
        <dd className="font-semibold">{when(p.signed_up)}</dd>
        <dd className="font-semibold">
          {last}
          {showReturn && p.returned && (
            <span style={{ color: "rgb(16,185,129)" }}> · came back</span>
          )}
        </dd>
      </dl>
    </li>
  );
}
