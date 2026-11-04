import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MessageCircle, Search, UserPlus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, EmptyState, PageBand, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { account } from "@/lib/live";
import { KnowThemQuiz } from "@/components/KnowThemQuiz";
import { ShareCard } from "@/components/ShareCard";
import { seatedFriends, useSocial, type Person } from "@/lib/social";

const SUB = "Seat anyone you know. They see your posts. Mutual seats unlock chats, snaps and games.";

export const Route = createFileRoute("/app/people")({
  component: clientOnly(People),
});

const SEATS = 25;

function Row({ p, children, note }: { p: Person; children: React.ReactNode; note?: string }) {
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
        {note && (
          <p
            className="mt-0.5 inline-block text-[12px] font-extrabold px-2 rounded-full"
            style={{
              background: "rgba(181,219,94,0.12)",
              border: "1px solid var(--gold-line)",
              color: "var(--accent)",
            }}
          >
            {note}
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
  const [quiz, setQuiz] = useState<{
    person: Person;
    mode: "request" | "accept" | "demo";
    requestId?: string;
  } | null>(null);

  const taken = s.people.length;
  const mutualCount = s.people.filter((p) => p.mutual).length;
  const incoming = s.requests.filter((r) => r.direction === "incoming");
  const inMine = new Set(s.people.map((p) => p.id));
  const seatedMe = new Set(incoming.map((r) => r.person.id));
  const seat = (p: Person) =>
    s.requests.find((r) => r.person.id === p.id)?.iPassed
      ? act(p.id, () => account.request(p.id), `🤝 ${p.name} is in your 25. Chats unlocked.`, true)
      : setQuiz({ person: p, mode: seatedMe.has(p.id) ? "accept" : "request" });

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
        <PageBand title="Your 25" sub={SUB} back />
        <div className="px-5 grid gap-4">
          <div className="card p-5">
            <span className="sticker">how it works</span>
            <p className="heading mt-3">No seat without proof.</p>
            <p className="mt-1.5 text-cool" style={{ fontSize: 15, lineHeight: 1.5 }}>
              To seat someone, guess their vibe-check answers. Get 4 of 6 right and they're in
              your 25: they see your posts. When they seat you back, it's mutual 🤝 and chats,
              snaps and games unlock.
            </p>
            <button
              onClick={() =>
                setQuiz({
                  person: seatedFriends().find((f) => f.id === "2") ?? seatedFriends()[0],
                  mode: "demo",
                })
              }
              className="btn-fun w-full mt-4"
            >
              Try it: how well do you know Priya?
            </button>
          </div>
          <EmptyState
            icon={UserPlus}
            title="Ready for your real 25?"
            body="Sign in, do your vibe check, and start proving it."
            action={
              <Link to="/login" className="btn-primary px-6">
                Sign in
              </Link>
            }
          />
        </div>
        {quiz && (
          <KnowThemQuiz
            person={quiz.person}
            demo
            onClose={() => setQuiz(null)}
            onPassed={() => undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageBand title="Your 25" sub={SUB} back>
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
            aria-label={`${mutualCount} mutual, ${taken - mutualCount} one-way, ${SEATS - taken} open`}
          >
            {Array.from({ length: SEATS }).map((_, i) => (
              <span
                key={i}
                className="h-2 rounded-full"
                style={{
                  background:
                    i < mutualCount ? "var(--lime)" : i < taken ? "var(--sun)" : "var(--fill-2)",
                }}
              />
            ))}
          </div>
          <p className="mt-2 meta flex flex-wrap gap-x-3">
            <span>🤝 {mutualCount} mutual</span>
            <span>👀 {taken - mutualCount} one-way</span>
            {taken >= SEATS && <span>Full. Remove someone to seat someone new.</span>}
          </p>
        </div>
        <div className="mt-3 flex">
          <span className="sticker pink" style={{ transform: "rotate(-2deg)" }}>
            👀 you're in {s.seatedByCount} {s.seatedByCount === 1 ? "person's" : "people's"} 25
          </span>
          <span className="meta ml-2 self-center">only you see this</span>
        </div>
      </PageBand>

      {s.me && !s.me.vibeDone && (
        <div className="mx-5 card p-4" style={{ borderColor: "var(--gold-line)" }}>
          <p className="font-extrabold">Do your vibe check first</p>
          <p className="text-sm mt-1">
            Friends need something to guess before they can join your table.
          </p>
          <Link to="/vibe" className="btn-primary mt-3 px-4">
            Start vibe check
          </Link>
        </div>
      )}
      {s.me?.vibeDone && <ShareCard />}

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
                {inMine.has(p.id) ? (
                  <span className="text-sm text-faint">In your 25</span>
                ) : (
                  <button
                    disabled={taken >= SEATS || !s.me?.vibeDone || busy === p.id}
                    onClick={() => seat(p)}
                    className={`${pill} btn-primary`}
                  >
                    <UserPlus size={16} /> {seatedMe.has(p.id) ? "Seat back" : "Prove it"}
                  </button>
                )}
              </Row>
            ))}
          </ul>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="px-5 mt-8">
          <h2 className="heading" style={{ fontSize: 18 }}>
            👀 They put you in their 25 · {incoming.length}
          </h2>
          <p className="meta mt-0.5">
            You can see their posts. Seat them back to unlock chats, snaps and games.
          </p>
          <ul className="divide-y" style={{ borderColor: "var(--border-cool)" }}>
            {incoming.map((r) => (
              <Row
                key={r.id}
                p={r.person}
                note={r.knew ? `Knew ${r.knew.score}/${r.knew.total} about you` : undefined}
              >
                <button
                  disabled={busy === r.person.id || taken >= SEATS || !s.me?.vibeDone}
                  onClick={() => seat(r.person)}
                  className={`${pill} btn-primary`}
                >
                  <Check size={16} /> {r.iPassed ? "Seat back" : "Prove it"}
                </button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 mt-8">
        <h2 className="text-[15px] font-semibold text-cream mb-1">
          In your 25 · {s.people.length}
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
                    Take {p.name.split(" ")[0]} out of your 25? They stop seeing your posts
                    {p.mutual ? ", and your chats and streak lock" : ""}.
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
                <Row key={p.id} p={p} note={p.mutual ? "🤝 mutual" : "⏳ hasn't seated you back"}>
                  {p.mutual && (
                    <Link
                      to="/app/chat/$id"
                      params={{ id: p.id }}
                      aria-label={`Message ${p.name}`}
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: "var(--bg-surface)", color: "var(--lime)" }}
                    >
                      <MessageCircle size={18} />
                    </Link>
                  )}
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

      {quiz && (
        <KnowThemQuiz
          person={quiz.person}
          demo={quiz.mode === "demo"}
          actionLabel={quiz.mode === "accept" ? "Seat them back" : "Put them in my 25"}
          onClose={() => setQuiz(null)}
          onPassed={async () => {
            if (quiz.mode === "demo") return;
            await account.request(quiz.person.id);
            setBurst((b) => b + 1);
            buzz(30);
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={burst} />
    </div>
  );
}
