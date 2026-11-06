import { Ico, TONE } from "@/components/Ico";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Shuffle, Vote } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, EmptyState, PageBand, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { mutualFriends, timeAgo, useSocial } from "@/lib/social";
import { untilMidnight } from "@/lib/daily";
import {
  PER_DAY,
  myPicks,
  myVotesToday,
  optionsFor,
  questionsFor,
  vote,
  type Pick,
} from "@/lib/polls";
import { Users } from "lucide-react";

export const Route = createFileRoute("/app/polls")({
  head: () => ({ meta: [{ title: "Polls · 25" }] }),
  component: clientOnly(Polls),
});

const TONES = ["var(--lime)", "var(--pink)", "var(--sky)", "var(--sun)"];

function Polls() {
  useSocial();
  const [tab, setTab] = useState<"vote" | "picked">("vote");
  const qs = questionsFor();
  const [votes, setVotes] = useState<Record<string, string> | null>(null);
  const [shuffle, setShuffle] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [party, setParty] = useState(0);

  useEffect(() => void myVotesToday().then(setVotes), []);
  useEffect(() => {
    if (tab === "picked" && !picks) void myPicks().then(setPicks);
  }, [tab, picks]);

  const enough = mutualFriends().length >= 2;
  const done = votes ? qs.filter((q) => votes[q]).length : 0;
  const current = votes ? qs.find((q) => !votes[q]) : undefined;
  const options = current ? optionsFor(current, shuffle) : [];

  const pick = async (id: string) => {
    if (!current || chosen) return;
    setChosen(id);
    buzz(15);
    try {
      await vote(current, id);
    } catch (e) {
      setToast((e as Error).message);
    }
    setTimeout(() => {
      setVotes((v) => ({ ...(v ?? {}), [current]: id }));
      setChosen(null);
      setShuffle(0);
      if (done + 1 === PER_DAY) {
        setParty((n) => n + 1);
        buzz(40);
      }
    }, 650);
  };

  return (
    <div className="pb-8">
      <PageBand title="Polls" sub="Anonymous compliments. They'll know someone picked them. Never who." back />

      <div className="px-5">
        <div className="segmented w-full" role="group" aria-label="Polls">
          <button className="flex-1" aria-pressed={tab === "vote"} onClick={() => setTab("vote")}>
            Today's polls · {done}/{PER_DAY}
          </button>
          <button className="flex-1" aria-pressed={tab === "picked"} onClick={() => setTab("picked")}>
            Picked you
          </button>
        </div>
      </div>

      {tab === "vote" && (
        <section className="px-5 mt-5">
          {!enough ? (
            <EmptyState
              icon={Users}
              title="You need a few mutual seats"
              body="Polls pick from people you're in each other's 25 with. Get 2 or more and polls unlock."
              action={
                <Link to="/app/people" className="btn-primary px-5">
                  Find your people
                </Link>
              }
            />
          ) : !votes ? (
            <p className="meta text-center mt-10">Loading…</p>
          ) : current ? (
            <div key={current} className="animate-soft-in">
              <div className="flex gap-1.5 justify-center mb-4" aria-hidden="true">
                {qs.map((q, i) => (
                  <span
                    key={q}
                    className="h-1.5 rounded-full flex-1 max-w-12"
                    style={{ background: votes[q] ? "var(--lime)" : q === current ? "var(--ink)" : "var(--fill-2)" }}
                  />
                ))}
              </div>
              <div
                className="rounded-[24px] p-6 text-center"
                style={{ background: TONES[qs.indexOf(current) % 4], color: "var(--on-accent)", border: "2px solid var(--edge)", boxShadow: "5px 5px 0 var(--edge)" }}
              >
                <p className="text-[13px] font-extrabold opacity-80">
                  Question {qs.indexOf(current) + 1} of {PER_DAY}
                </p>
                <h2 className="display mt-2" style={{ fontSize: 28, lineHeight: 1.1 }}>
                  {current}
                </h2>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {options.map((p) => {
                  const on = chosen === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => pick(p.id)}
                      disabled={!!chosen}
                      className="card p-4 flex flex-col items-center gap-2 transition-transform active:scale-95"
                      style={{
                        background: on ? "var(--lime)" : undefined,
                        color: on ? "var(--on-accent)" : undefined,
                        transform: on ? "scale(1.04)" : undefined,
                        opacity: chosen && !on ? 0.5 : 1,
                      }}
                    >
                      <Avatar src={p.avatar || undefined} initials={p.initials} color={p.color} size={56} />
                      <span className="font-bold text-[15px] truncate max-w-full">{p.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center gap-3">
                <button onClick={() => setShuffle((n) => n + 1)} className="btn-quiet inline-flex items-center gap-1.5">
                  <Shuffle size={16} /> Shuffle
                </button>
              </div>
              <p className="meta text-center mt-3"><Ico i={Lock} size={13} /> Your pick is anonymous. Always.</p>
            </div>
          ) : (
            <div className="card p-6 text-center">
              <Vote size={44} strokeWidth={2} aria-hidden="true" className="mx-auto" style={{ color: "var(--lime)" }} />
              <p className="heading mt-3">All done for today</p>
              <p className="meta mt-1">
                5 people just got a little dopamine because of you. New polls in {untilMidnight()}.
              </p>
              <button onClick={() => setTab("picked")} className="btn-primary mt-4 px-5">
                See what you got picked for
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "picked" && (
        <section className="px-5 mt-5">
          {!picks ? (
            <p className="meta text-center mt-10">Loading…</p>
          ) : picks.length === 0 ? (
            <div className="card p-6 text-center">
              <Lock size={44} strokeWidth={2} aria-hidden="true" className="mx-auto" style={{ color: "var(--sun)" }} />
              <p className="heading mt-3">Nothing yet</p>
              <p className="meta mt-1">When someone picks you in a poll, it shows up here. Never who.</p>
            </div>
          ) : (
            <ul className="grid gap-2.5">
              {picks.map((p, i) => (
                <li
                  key={p.question}
                  className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: TONES[i % 4], color: "var(--on-accent)", border: "2px solid var(--edge)", boxShadow: "3px 3px 0 var(--edge)" }}
                >
                  <span className="flex-1 font-bold text-[15px] leading-snug">{p.question}</span>
                  <span className="text-right">
                    <span className="block display text-[20px]">{p.picks}×</span>
                    <span className="block text-[11px] font-bold opacity-75">{timeAgo(p.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={party} />
    </div>
  );
}
