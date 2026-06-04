import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { INCOMING_RESERVATION } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/claim")({
  head: () => ({
    meta: [
      { title: "A seat is waiting — 25" },
      { name: "description", content: "Someone reserved one of their twenty-five seats for you." },
    ],
  }),
  component: Claim,
});

function Claim() {
  const navigate = useNavigate();
  const r = INCOMING_RESERVATION;
  const [phase, setPhase] = useState<"intro" | "accepted">("intro");

  return (
    <main
      className="min-h-screen w-full relative overflow-hidden"
      style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 600px at 30% 10%, rgba(196,149,96,0.22), transparent 60%), radial-gradient(700px 700px at 80% 90%, rgba(139,45,42,0.22), transparent 60%), #14100C",
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

      <section className="relative z-10 mx-auto max-w-md px-6 py-20 text-center">
        {phase === "intro" ? (
          <>
            <p className="uppercase tracking-[0.32em] text-[0.7rem]" style={{ color: "#C49560" }}>
              {VOICE.claim.eyebrow}
            </p>

            <div className="mt-10 flex justify-center">
              <div
                className="rounded-full p-[3px]"
                style={{
                  background: "radial-gradient(circle at 50% 50%, rgba(196,149,96,0.55), rgba(196,149,96,0.05) 70%)",
                }}
              >
                <Avatar src={r.fromAvatar} initials={r.fromInitials} size={132} />
              </div>
            </div>

            <h1
              className="mt-8 leading-[1.1] text-white"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2rem, 7vw, 2.6rem)" }}
            >
              {VOICE.claim.headline(r.fromName)}
            </h1>

            <p
              className="mt-5 italic"
              style={{ color: "#E8B98A", fontFamily: "'Fraunces', Georgia, serif", fontSize: 18 }}
            >
              role: {r.role.toLowerCase()}
            </p>

            <p className="mt-6 text-white/65 leading-relaxed text-[15px]">
              {VOICE.claim.sub}
            </p>

            <p className="mt-2 text-white/35 text-xs">reserved {r.reservedAt}</p>

            <div className="mt-12 flex flex-col gap-3">
              <button
                onClick={() => setPhase("accepted")}
                className="rounded-full py-4 text-sm font-medium transition active:scale-[0.98]"
                style={{ background: "#C49560", color: "#14100C" }}
              >
                {VOICE.claim.accept}
              </button>
              <button
                onClick={() => navigate({ to: "/" })}
                className="rounded-full py-3 text-sm text-white/55 hover:text-white/80 transition"
              >
                {VOICE.claim.decline}
              </button>
            </div>

            <p className="mt-10 text-white/30 text-xs italic">{VOICE.claim.footer}</p>
          </>
        ) : (
          <>
            <p className="uppercase tracking-[0.32em] text-[0.7rem]" style={{ color: "#C49560" }}>
              seat accepted
            </p>
            <h1
              className="mt-8 leading-[1.1] text-white"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2rem, 7vw, 2.6rem)" }}
            >
              You're at <span className="italic" style={{ color: "#E8B98A" }}>{r.fromName}'s</span> table.
            </h1>
            <p className="mt-6 text-white/65 leading-relaxed">
              They'll know in a quiet way. No notification storm.
            </p>
            <button
              onClick={() => navigate({ to: "/onboarding" })}
              className="mt-12 rounded-full py-4 px-8 text-sm font-medium"
              style={{ background: "#C49560", color: "#14100C" }}
            >
              Set up your own table
            </button>
          </>
        )}
      </section>
    </main>
  );
}
