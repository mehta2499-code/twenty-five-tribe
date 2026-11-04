import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MessageCircle, Search, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, EmptyState, PageBand, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { account } from "@/lib/live";
import { useSocial, type Person } from "@/lib/social";

export const Route = createFileRoute("/app/people")({
  component: clientOnly(People),
});

const SEATS = 25;

function Row({ p, children }: { p: Person; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar src={p.avatar || undefined} initials={p.initials} color={p.color} size={46} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-cream truncate" style={{ fontSize: 15 }}>
          {p.name}
        </p>
        {p.username && (
          <p className="truncate" style={{ fontSize: 13, color: "var(--text-muted)" }}>
            @{p.username}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </li>
  );
}

const pill = "min-h-[40px] text-sm px-3.5";

function People() {
  const s = useSocial();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  const taken = s.people.length + s.requests.filter((r) => r.direction === "outgoing").length;
  const incoming = s.requests.filter((r) => r.direction === "incoming");
  const outgoing = s.requests.filter((r) => r.direction === "outgoing");
  const known = new Set([...s.people.map((p) => p.id), ...s.requests.map((r) => r.person.id)]);

  useEffect(() => {
    if (s.mode !== "live" || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      account
        .search(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, s.mode]);

  const act = async (key: string, fn: () => Promise<void>, done?: string, celebrate = false) => {
    setBusy(key);
    try {
      await fn();
      if (done) setToast(done);
      if (celebrate) {
        setBurst((b) => b + 1);
        buzz(30);
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (s.mode !== "live") {
    return (
      <div className="pb-8">
        <PageBand title="Your 25" sub="The people who can message, snap and play with you." back />
        <EmptyState
          icon={UserPlus}
          title="You're looking at the demo"
          body="Sign in to find your friends and save them a seat at your table."
          action={
            <Link to="/login" className="btn-primary px-6">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageBand title="Your 25" sub="The people who can message, snap and play with you." back>
        <div className="mt-4 card px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold text-cream">
              {taken} of {SEATS} seats taken
            </p>
            <p className="meta">{taken >= SEATS ? "Table's full" : `${SEATS - taken} open`}</p>
          </div>
          <div
            className="mt-2.5 grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${SEATS}, 1fr)` }}
            role="img"
            aria-label={`${s.people.length} accepted, ${taken - s.people.length} waiting, ${SEATS - taken} open`}
          >
            {Array.from({ length: SEATS }).map((_, i) => (
              <span
                key={i}
                className="h-2 rounded-full"
                style={{
                  background:
                    i < s.people.length
                      ? "var(--blue-deep)"
                      : i < taken
                        ? "var(--coral)"
                        : "var(--fill-2)",
                }}
              />
            ))}
          </div>
          {taken >= SEATS && (
            <p className="mt-2 meta">Remove someone to make room for someone new.</p>
          )}
        </div>
      </PageBand>

      <section className="px-5 mt-6">
        <label className="field" htmlFor="people-search">
          <Search size={18} className="text-faint shrink-0" aria-hidden="true" />
          <input
            id="people-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find someone by name or @username"
            autoCapitalize="none"
            autoComplete="off"
          />
        </label>
        {q.trim().length >= 2 && (
          <ul className="mt-2 card px-4 divide-y" style={{ borderColor: "var(--border-cool)" }}>
            {searching && <li className="py-4 text-sm text-faint">Looking…</li>}
            {!searching && results.length === 0 && (
              <li className="py-4 text-sm text-faint">
                Nobody by that name yet. Ask them to sign up, then search again.
              </li>
            )}
            {results.map((p) => (
              <Row key={p.id} p={p}>
                {known.has(p.id) ? (
                  <span className="text-sm text-faint">Already at your table</span>
                ) : (
                  <button
                    disabled={busy === p.id || taken >= SEATS}
                    onClick={() =>
                      act(
                        p.id,
                        () => account.request(p.id),
                        `Seat saved for ${p.name}. Waiting for them.`,
                      )
                    }
                    className={`${pill} btn-primary`}
                  >
                    <UserPlus size={16} /> Save a seat
                  </button>
                )}
              </Row>
            ))}
          </ul>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="px-5 mt-8">
          <h2 className="text-[15px] font-semibold text-cream mb-1">
            Asking to join · {incoming.length}
          </h2>
          <ul className="divide-y" style={{ borderColor: "var(--border-cool)" }}>
            {incoming.map((r) => (
              <Row key={r.id} p={r.person}>
                <button
                  aria-label={`Decline ${r.person.name}`}
                  disabled={busy === r.id}
                  onClick={() => act(r.id, () => account.remove(r.id))}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
                >
                  <X size={18} />
                </button>
                <button
                  disabled={busy === r.id}
                  onClick={() =>
                    act(r.id, () => account.accept(r.id), `${r.person.name} is in your 25.`, true)
                  }
                  className={`${pill} btn-primary`}
                >
                  <Check size={16} /> Accept
                </button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 mt-8">
        <h2 className="text-[15px] font-semibold text-cream mb-1">
          At your table · {s.people.length}
        </h2>
        {s.people.length === 0 ? (
          <p
            className="py-6 text-center"
            style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}
          >
            An empty table. Search for your first person above, or share your username:{" "}
            <span className="font-semibold">@{s.me?.username}</span>
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border-cool)" }}>
            {s.people.map((p) =>
              confirmRemove === p.id ? (
                <li key={p.id} className="py-3 flex items-center gap-3">
                  <p className="flex-1 text-sm text-cream">
                    Give up {p.name}'s seat? Your chat and streak with them end.
                  </p>
                  <button onClick={() => setConfirmRemove(null)} className={`${pill} btn-quiet`}>
                    Keep
                  </button>
                  <button
                    onClick={() =>
                      act(p.id, () => account.remove(p.id), `${p.name}'s seat is open again.`).then(
                        () => setConfirmRemove(null),
                      )
                    }
                    className={`${pill} btn-danger`}
                  >
                    Remove
                  </button>
                </li>
              ) : (
                <Row key={p.id} p={p}>
                  <Link
                    to="/app/chat/$id"
                    params={{ id: p.id }}
                    aria-label={`Message ${p.name}`}
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: "var(--bg-surface)", color: "var(--blue-deep)" }}
                  >
                    <MessageCircle size={18} />
                  </Link>
                  <button
                    onClick={() => setConfirmRemove(p.id)}
                    className="text-sm font-semibold px-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Remove
                  </button>
                </Row>
              ),
            )}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="px-5 mt-8">
          <h2 className="text-[15px] font-semibold text-cream mb-1">
            Waiting for them to accept · {outgoing.length}
          </h2>
          <ul className="divide-y" style={{ borderColor: "var(--border-cool)" }}>
            {outgoing.map((r) => (
              <Row key={r.id} p={r.person}>
                <button
                  disabled={busy === r.id}
                  onClick={() => act(r.id, () => account.remove(r.id), "Seat released.")}
                  className="text-sm font-semibold px-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={burst} />
    </div>
  );
}
