import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Confetti, buzz, clientOnly } from "@/components/SocialUI";
import { initLive, scheduleReload } from "@/lib/live";
import { useSocial } from "@/lib/social";
import { MONTHS, VIBE_QUESTIONS, myVibe, saveVibe, type Choice } from "@/lib/vibes";

export const Route = createFileRoute("/vibe")({
  head: () => ({ meta: [{ title: "Vibe check · 25" }] }),
  component: clientOnly(VibeCheck),
});

const PENDING_INVITE = "tf.pendingInvite";

function VibeCheck() {
  const s = useSocial();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0..n-1 questions, n = birthday, n+1 = done
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [birthday, setBirthday] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Choice | null>(null);
  const n = VIBE_QUESTIONS.length;

  useEffect(() => initLive(), []);
  useEffect(() => {
    if (s.mode === "live" && s.me) {
      void myVibe(s.me.id).then((v) => {
        if (v) {
          setAnswers(v.answers);
          setBirthday(v.birthday);
        }
      });
    }
  }, [s.mode, s.me]);

  if (s.mode !== "live" && !s.loading) {
    return (
      <Shell>
        <p className="heading">Sign in to do your vibe check.</p>
        <button onClick={() => navigate({ to: "/login" })} className="btn-fun mt-6 w-full">
          Sign in
        </button>
      </Shell>
    );
  }

  const choose = (c: Choice) => {
    const q = VIBE_QUESTIONS[step];
    setPicked(c);
    buzz(10);
    setAnswers((a) => ({ ...a, [q.id]: c }));
    setTimeout(() => {
      setPicked(null);
      setStep((x) => x + 1);
    }, 260);
  };

  const finish = async () => {
    if (!s.me) return;
    if (!birthday) return setError("Pick your birthday so your people can guess it.");
    setBusy(true);
    setError(null);
    try {
      await saveVibe(s.me.id, answers, birthday);
      scheduleReload(0);
      setStep(n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const goOn = () => {
    let invite: string | null = null;
    try {
      invite = localStorage.getItem(PENDING_INVITE);
      localStorage.removeItem(PENDING_INVITE);
    } catch {
      // ignore
    }
    if (invite) navigate({ to: "/in/$username", params: { username: invite } });
    else navigate({ to: "/app/home" });
  };

  // Done
  if (step > n) {
    return (
      <Shell>
        <span className="sticker">vibe locked in</span>
        <h1 className="title mt-4">
          Your people better <span className="mark">know you</span>.
        </h1>
        <p className="mt-3 text-cool" style={{ fontSize: 16, lineHeight: 1.5 }}>
          To get a seat at your table, friends have to guess at least 4 of 6 of these. No guessing,
          no seat.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {VIBE_QUESTIONS.map((q) => {
            const c = answers[q.id];
            const o = c ? q[c] : null;
            return o ? (
              <span key={q.id} className="chip">
                <span aria-hidden="true">{o.emoji}</span> {o.label}
              </span>
            ) : null;
          })}
        </div>
        <button onClick={goOn} className="btn-primary w-full mt-8">
          Let's go
        </button>
        <Confetti fire={1} />
      </Shell>
    );
  }

  // Birthday
  if (step === n) {
    return (
      <Shell onBack={() => setStep(n - 1)} progress={1}>
        <span className="sticker sun">last one</span>
        <h1 className="title mt-4">When's your birthday?</h1>
        <p className="mt-2 text-cool">Friends have to guess the month. We never show the year.</p>
        <label htmlFor="bday" className="sr-only">
          Birthday
        </label>
        <input
          id="bday"
          type="date"
          value={birthday}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthday(e.target.value)}
          className="input mt-6 text-lg font-bold"
        />
        {birthday && (
          <p className="mt-2 meta">
            They'll need to guess:{" "}
            <strong className="text-cream">{MONTHS[Number(birthday.slice(5, 7)) - 1]}</strong>
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-bold" style={{ color: "var(--hot)" }}>
            {error}
          </p>
        )}
        <button
          onClick={() => void finish()}
          disabled={busy || !birthday}
          className="btn-primary w-full mt-8"
        >
          {busy ? "Saving…" : "Lock in my vibe"}
        </button>
      </Shell>
    );
  }

  const q = VIBE_QUESTIONS[step];
  const current = answers[q.id];
  return (
    <Shell onBack={step > 0 ? () => setStep(step - 1) : undefined} progress={step / (n + 1)}>
      <span className="sticker">
        vibe check · {step + 1} of {n}
      </span>
      <h1 className="title mt-4" style={{ fontSize: 44 }}>
        {q.ask}
      </h1>
      <div className="mt-8 grid grid-cols-2 gap-4">
        {(["a", "b"] as const).map((c, i) => {
          const o = q[c];
          const on = picked === c || (!picked && current === c);
          return (
            <button
              key={c}
              onClick={() => choose(c)}
              aria-pressed={current === c}
              className="choice"
              data-on={on || undefined}
              style={
                on
                  ? {
                      background: "linear-gradient(180deg, #E3C385 0%, #CFA95F 100%)",
                      color: "var(--on-accent)",
                      borderColor: "transparent",
                    }
                  : undefined
              }
            >
              <span style={{ fontSize: 54, lineHeight: 1 }} aria-hidden="true">
                {o.emoji}
              </span>
              <span className="font-extrabold" style={{ fontSize: 19 }}>
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-8 text-center meta">Go with your gut. You can change these later.</p>
    </Shell>
  );
}

function Shell({
  children,
  onBack,
  progress,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  progress?: number;
}) {
  return (
    <main className="min-h-screen px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3 h-12">
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Previous question"
              className="btn-secondary btn-icon"
              style={{ minHeight: 40, width: 40, minWidth: 40 }}
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className="display" style={{ fontSize: 28, fontWeight: 800 }}>
              25<span style={{ color: "var(--accent)" }}>.</span>
            </span>
          )}
          {progress !== undefined && (
            <div
              className="flex-1 h-3 rounded-full overflow-hidden"
              style={{ border: "1px solid var(--line-2)", background: "var(--fill)" }}
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full"
                style={{
                  width: `${progress * 100}%`,
                  background: "var(--lime)",
                  transition: "width 300ms var(--ease)",
                }}
              />
            </div>
          )}
        </div>
        <div className="mt-8 animate-soft-in" key={String(progress)}>
          {children}
        </div>
      </div>
    </main>
  );
}
