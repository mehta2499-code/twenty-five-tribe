import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Ban, Flag } from "lucide-react";
import { Sheet, Toast } from "@/components/SocialUI";
import { account } from "@/lib/live";
import { useSocial, type Person } from "@/lib/social";

const REASONS = [
  "Bullying or harassment",
  "Pretending to be someone",
  "Nudity or sexual content",
  "Hate or threats",
  "Spam or scam",
  "They're under 13",
  "Something else",
];

/** "•••" on someone's page: report or block them. */
export function PersonMenu({ person, onClose }: { person: Person; onClose: () => void }) {
  const s = useSocial();
  const navigate = useNavigate();
  const [view, setView] = useState<"menu" | "report" | "block">("menu");
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const first = person.name.split(" ")[0];
  const live = s.mode === "live";

  const run = async (fn: () => Promise<void>, done: string, leave = false) => {
    if (!live) return setToast("Sign in to use this.");
    setBusy(true);
    try {
      await fn();
      setToast(done);
      setTimeout(() => {
        onClose();
        if (leave) navigate({ to: "/app/home" });
      }, 1200);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={view === "report" ? `Report ${first}` : view === "block" ? `Block ${first}?` : person.name}
      onClose={onClose}
    >
      {view === "menu" && (
        <div className="grid gap-2.5">
          <button onClick={() => setView("report")} className="btn-secondary justify-start gap-3">
            <Flag size={18} aria-hidden="true" /> Report {first}
          </button>
          <button onClick={() => setView("block")} className="btn-danger justify-start gap-3">
            <Ban size={18} aria-hidden="true" /> Block {first}
          </button>
          <p className="meta mt-1">They won't know you reported them.</p>
        </div>
      )}

      {view === "report" && (
        <div>
          <p className="text-cool text-sm">What's going on? Only the 25 team sees this.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
            placeholder="Anything else we should know? (optional)"
            rows={3}
            className="input mt-3 w-full"
            style={{ minHeight: 90, paddingTop: 12 }}
          />
          <button
            disabled={!reason || busy}
            onClick={() =>
              run(() => account.report(person.id, reason!, details), "Thanks. We'll look into it.")
            }
            className="btn-primary w-full mt-3"
          >
            {busy ? "Sending…" : "Send report"}
          </button>
          <button onClick={() => setView("block")} className="btn-quiet w-full mt-2">
            Block {first} too
          </button>
        </div>
      )}

      {view === "block" && (
        <div>
          <ul className="grid gap-2 text-sm text-cool">
            <li>• {first} leaves your 25, and you leave theirs.</li>
            <li>• Chats, snaps and games with them stop.</li>
            <li>• They can't find you in search or seat you again.</li>
            <li>• They aren't told. You can unblock in Profile → Privacy.</li>
          </ul>
          <button
            disabled={busy}
            onClick={() => run(() => account.block(person.id), `${first} is blocked.`, true)}
            className="btn-danger w-full mt-4"
          >
            {busy ? "Blocking…" : `Block ${first}`}
          </button>
          <button onClick={onClose} className="btn-quiet w-full mt-2">
            Cancel
          </button>
        </div>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </Sheet>
  );
}

/** Profile → Privacy: people you've blocked. */
export function BlockedList() {
  const s = useSocial();
  const [list, setList] = useState<{ id: string; name: string; username: string }[] | null>(null);
  const live = s.mode === "live";
  useEffect(() => {
    if (live) void account.blockedPeople().then(setList, () => setList([]));
  }, [live]);
  if (!live) return null;
  return (
    <section className="px-5 mt-8">
      <h2 className="heading" style={{ fontSize: 18 }}>
        Blocked
      </h2>
      {list === null ? (
        <p className="meta mt-2">Loading…</p>
      ) : list.length === 0 ? (
        <p className="meta mt-2">Nobody. Love that for you.</p>
      ) : (
        <ul className="mt-2 card divide-y" style={{ borderColor: "var(--line)" }}>
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <span>
                <span className="block font-semibold text-cream">{p.name}</span>
                <span className="meta">@{p.username}</span>
              </span>
              <button
                className="btn-quiet min-h-[38px] px-3 text-sm"
                onClick={() =>
                  void account.unblock(p.id).then(() => setList((l) => (l ?? []).filter((x) => x.id !== p.id)))
                }
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Profile: delete your account for good. */
export function DeleteAccount() {
  const s = useSocial();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (s.mode !== "live") return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-quiet w-full mt-3" style={{ color: "var(--pink)" }}>
        Delete my account
      </button>
      {open && (
        <Sheet title="Delete your account?" onClose={() => setOpen(false)}>
          <p className="text-cool text-sm leading-relaxed">
            This deletes your profile, posts, reels, snaps, chats, streaks, scores and photos. Your
            seats in other people's 25 go too. <b className="text-cream">This can't be undone.</b>
          </p>
          <label className="meta block mt-4" htmlFor="del-confirm">
            Type DELETE to confirm
          </label>
          <input
            id="del-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            className="input mt-1.5 w-full"
          />
          {error && <p className="mt-2 text-sm" style={{ color: "var(--pink)" }}>{error}</p>}
          <button
            disabled={typed !== "DELETE" || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await account.deleteAccount();
                navigate({ to: "/" });
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
            className="btn-danger w-full mt-4"
          >
            {busy ? "Deleting…" : "Delete everything"}
          </button>
        </Sheet>
      )}
    </>
  );
}
