import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set your table — 25" },
      { name: "description", content: "Build a table of people, not a profile." },
    ],
  }),
  component: Onboarding,
});

// ---------- Types ----------
type Seat = {
  name: string;
  // playful answers: which prompts this person was tagged for
  tags: string[];
  // optional free-text "the one thing"
  oneThing?: string;
};

type Vibe = "chaos" | "calm" | "loyal" | "mystery" | null;

// ---------- Playful prompts ----------
// User taps a prompt then types a name. We attach the prompt as a "tag" on that seat.
const PROMPTS: { id: string; q: string; aside: string }[] = [
  { id: "2am",      q: "Who would you call at 2 AM?",                        aside: "No judgement. We've all been there." },
  { id: "zombie",   q: "Who survives the zombie apocalypse with you?",       aside: "Pick someone with cardio." },
  { id: "real",     q: "Who knows the real you?",                            aside: "Like, the embarrassing real you." },
  { id: "shows",    q: "Who always shows up?",                               aside: "Even when it's raining. Even when it's far." },
  { id: "chaos",    q: "Who is pure chaos (and you love them for it)?",      aside: "Every table needs one." },
  { id: "honest",   q: "Who tells you the truth when you don't want it?",    aside: "The friend with the eyebrow raise." },
  { id: "laugh",    q: "Who makes you laugh until it hurts?",                aside: "You're smiling thinking about them. Don't lie." },
  { id: "home",     q: "Who feels like home?",                               aside: "The one whose silence isn't awkward." },
];

const VIBES: { id: NonNullable<Vibe>; emoji: string; label: string; line: string }[] = [
  { id: "chaos",   emoji: "🎲", label: "A little chaos", line: "Plot twists welcome." },
  { id: "calm",    emoji: "🌿", label: "Mostly calm",    line: "Soft hours. Long phone calls." },
  { id: "loyal",   emoji: "🛟", label: "Ride-or-die",    line: "Few people. Held tight." },
  { id: "mystery", emoji: "🌙", label: "Bit of mystery", line: "Inside jokes only." },
];

// ---------- Component ----------
function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState<Vibe>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [activePromptIdx, setActivePromptIdx] = useState(0);
  const [draftName, setDraftName] = useState("");
  const [draftOneThing, setDraftOneThing] = useState("");

  const totalSteps = 5;

  const activePrompt = PROMPTS[activePromptIdx % PROMPTS.length];

  const addSeat = () => {
    const n = draftName.trim();
    if (!n) return;
    // If this name already exists, append the tag + oneThing instead of duplicating
    setSeats((prev) => {
      const existing = prev.find((s) => s.name.toLowerCase() === n.toLowerCase());
      if (existing) {
        return prev.map((s) =>
          s === existing
            ? {
                ...s,
                tags: Array.from(new Set([...s.tags, activePrompt.id])),
                oneThing: draftOneThing.trim() || s.oneThing,
              }
            : s,
        );
      }
      return [
        ...prev,
        {
          name: n,
          tags: [activePrompt.id],
          oneThing: draftOneThing.trim() || undefined,
        },
      ];
    });
    setDraftName("");
    setDraftOneThing("");
    setActivePromptIdx((i) => i + 1);
  };

  const skipPrompt = () => {
    setDraftName("");
    setDraftOneThing("");
    setActivePromptIdx((i) => i + 1);
  };

  const finish = () => {
    try {
      localStorage.setItem(
        "twentyfive.onboarding",
        JSON.stringify({ name, vibe, seats, completedAt: Date.now() }),
      );
    } catch {}
    navigate({ to: "/app/home" });
  };

  return (
    <main
      className="min-h-screen w-full text-foreground relative overflow-hidden"
      style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" }}
    >
      {/* warm candle backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 600px at 30% 10%, rgba(196,149,96,0.18), transparent 60%), radial-gradient(700px 700px at 80% 90%, rgba(139,45,42,0.22), transparent 60%), #14100C",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        {/* progress dots */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="h-[6px] rounded-full transition-all duration-500"
              style={{
                width: i === step ? 28 : 6,
                background:
                  i <= step ? "#C49560" : "rgba(255,255,255,0.18)",
              }}
            />
          ))}
        </div>

        {/* steps */}
        <div className="flex-1 flex flex-col">
          {step === 0 && (
            <StepWrap>
              <p className="uppercase tracking-[0.32em] text-[0.7rem] text-[#C49560] mb-6">
                hi.
              </p>
              <h1
                className="font-normal leading-[1.05] text-white"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2.5rem, 8vw, 3.5rem)" }}
              >
                You're here.
                <br />
                <span className="italic text-[#E8B98A]">Let's set the table.</span>
              </h1>
              <p className="mt-8 text-white/70 leading-relaxed">
                No usernames. No followers. No "interests."
                Just the people. We'll start with a few questions —
                the kind a friend would actually ask.
              </p>
              <p className="mt-4 text-white/50 text-sm italic">
                (We promise not to make you fill out a form.)
              </p>
              <Spacer />
              <BigBtn onClick={() => setStep(1)}>Pull up a chair</BigBtn>
            </StepWrap>
          )}

          {step === 1 && (
            <StepWrap>
              <Eyebrow>first things first</Eyebrow>
              <Title>What do your people call you?</Title>
              <p className="mt-4 text-white/60 text-sm">
                Not your full government name. The one your friends use.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riya, Ro, the menace"
                className="mt-8 w-full bg-transparent border-b border-white/20 pb-3 text-white text-2xl placeholder:text-white/30 focus:outline-none focus:border-[#C49560] transition"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              />
              <Spacer />
              <BigBtn disabled={!name.trim()} onClick={() => setStep(2)}>
                Nice to meet you{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}
              </BigBtn>
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap>
              <Eyebrow>between us</Eyebrow>
              <Title>What's your table like?</Title>
              <p className="mt-3 text-white/60 text-sm">
                No wrong answer. Just curious.
              </p>
              <div className="mt-8 grid gap-3">
                {VIBES.map((v) => {
                  const active = vibe === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVibe(v.id)}
                      className="text-left rounded-2xl border px-5 py-4 transition-all"
                      style={{
                        background: active ? "rgba(196,149,96,0.12)" : "rgba(255,255,255,0.03)",
                        borderColor: active ? "#C49560" : "rgba(255,255,255,0.10)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{v.emoji}</span>
                        <span
                          className="text-white text-lg"
                          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                        >
                          {v.label}
                        </span>
                      </div>
                      <p className="mt-1 ml-9 text-white/55 text-sm">{v.line}</p>
                    </button>
                  );
                })}
              </div>
              <Spacer />
              <BigBtn disabled={!vibe} onClick={() => setStep(3)}>
                Okay, noted.
              </BigBtn>
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap>
              <Eyebrow>now the fun part</Eyebrow>
              <Title>Let's seat a few people.</Title>
              <p className="mt-3 text-white/60 text-sm">
                I'll ask. You answer with a name. Or skip — your call.
                {seats.length > 0 && (
                  <>
                    {" "}
                    <span className="text-[#C49560]">
                      {seats.length} seated so far.
                    </span>
                  </>
                )}
              </p>

              <div
                className="mt-8 rounded-3xl p-6"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="uppercase tracking-[0.28em] text-[0.65rem] text-[#C49560]">
                  question {activePromptIdx + 1}
                </p>
                <p
                  className="mt-4 text-white text-2xl leading-snug"
                  style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                >
                  {activePrompt.q}
                </p>
                <p className="mt-2 text-white/50 text-sm italic">
                  {activePrompt.aside}
                </p>

                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSeat()}
                  placeholder="A name…"
                  className="mt-6 w-full bg-transparent border-b border-white/15 pb-2 text-white text-lg placeholder:text-white/25 focus:outline-none focus:border-[#C49560] transition"
                />
                <input
                  value={draftOneThing}
                  onChange={(e) => setDraftOneThing(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSeat()}
                  placeholder="One thing only they would do… (optional)"
                  className="mt-4 w-full bg-transparent border-b border-white/10 pb-2 text-white/90 text-sm placeholder:text-white/25 focus:outline-none focus:border-[#C49560] transition"
                />

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={skipPrompt}
                    className="flex-1 rounded-full border border-white/15 text-white/70 py-3 text-sm hover:bg-white/5 transition"
                  >
                    Skip
                  </button>
                  <button
                    onClick={addSeat}
                    disabled={!draftName.trim()}
                    className="flex-[2] rounded-full py-3 text-sm font-medium disabled:opacity-40 transition"
                    style={{ background: "#C49560", color: "#14100C" }}
                  >
                    Seat them
                  </button>
                </div>
              </div>

              {seats.length > 0 && (
                <div className="mt-6">
                  <p className="uppercase tracking-[0.28em] text-[0.65rem] text-white/40 mb-3">
                    at the table
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {seats.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-white/90"
                        style={{
                          background: "rgba(196,149,96,0.10)",
                          border: "1px solid rgba(196,149,96,0.35)",
                        }}
                      >
                        <span className="h-2 w-2 rounded-full bg-[#C49560]" />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Spacer />
              <BigBtn
                disabled={seats.length < 1}
                onClick={() => setStep(4)}
              >
                {seats.length < 3
                  ? `Continue${seats.length ? ` with ${seats.length}` : ""}`
                  : "I've got my people"}
              </BigBtn>
              {seats.length === 0 && (
                <p className="mt-3 text-center text-white/40 text-xs">
                  Seat at least one person to keep going.
                </p>
              )}
            </StepWrap>
          )}

          {step === 4 && (
            <FinalStep name={name} seats={seats} onFinish={finish} />
          )}
        </div>
      </div>
    </main>
  );
}

// ---------- Final reveal ----------
function FinalStep({
  name,
  seats,
  onFinish,
}: {
  name: string;
  seats: Seat[];
  onFinish: () => void;
}) {
  const seatCount = seats.length;
  const remaining = Math.max(0, 25 - seatCount);
  const featured = useMemo(() => seats.slice(0, 6), [seats]);

  return (
    <StepWrap>
      <Eyebrow>the table is set</Eyebrow>
      <h1
        className="mt-4 font-normal leading-[1.05] text-white"
        style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2.25rem, 7vw, 3rem)" }}
      >
        Hey {name.trim().split(" ")[0] || "you"}.
        <br />
        <span className="italic text-[#E8B98A]">These are your people.</span>
      </h1>

      <p className="mt-6 text-white/70 leading-relaxed">
        {seatCount === 1
          ? "One seat taken. A start."
          : `${seatCount} seats taken.`}{" "}
        {remaining > 0 && (
          <>
            <span className="text-white/50">
              {remaining} kept open for whoever wanders in next.
            </span>
          </>
        )}
      </p>

      {/* tiny table preview */}
      <div className="mt-8 flex flex-wrap gap-2">
        {featured.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-full px-3 py-2"
            style={{
              background: "rgba(196,149,96,0.10)",
              border: "1px solid rgba(196,149,96,0.35)",
            }}
          >
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center text-[0.7rem] text-[#14100C] font-medium"
              style={{ background: "#C49560" }}
            >
              {s.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-white/90 text-sm">{s.name}</span>
          </div>
        ))}
        {Array.from({ length: Math.min(remaining, 6) }).map((_, i) => (
          <div
            key={`ghost-${i}`}
            className="h-9 w-9 rounded-full"
            style={{ border: "1px dashed rgba(255,255,255,0.18)" }}
          />
        ))}
      </div>

      <p className="mt-8 italic text-white/60 text-sm">
        We'll remember the small things you told us. They'll show up later —
        in memories, in nudges, in the moments you needed someone and
        forgot they were already here.
      </p>

      <Spacer />
      <BigBtn onClick={onFinish}>Open the table</BigBtn>
      <p className="mt-3 text-center text-white/30 text-xs">
        one of twenty-five. irreplaceable.
      </p>
    </StepWrap>
  );
}

// ---------- Small bits ----------
function StepWrap({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col animate-[fade_400ms_ease-out]">{children}</div>;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="uppercase tracking-[0.32em] text-[0.7rem] text-[#C49560] mb-4">
      {children}
    </p>
  );
}
function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="font-normal leading-[1.1] text-white"
      style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2rem, 6vw, 2.75rem)" }}
    >
      {children}
    </h1>
  );
}
function Spacer() {
  return <div className="flex-1 min-h-[32px]" />;
}
function BigBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-8 w-full rounded-full py-4 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      style={{
        background: disabled ? "rgba(255,255,255,0.08)" : "#C49560",
        color: disabled ? "rgba(255,255,255,0.5)" : "#14100C",
        fontFamily: "'Inter Tight', system-ui, sans-serif",
      }}
    >
      {children}
    </button>
  );
}
