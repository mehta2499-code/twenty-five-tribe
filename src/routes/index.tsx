import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "25 — Everyone else is noise." },
      {
        name: "description",
        content:
          "25 seats. Choose wisely. The social app built around Dunbar's number — for the only people that matter.",
      },
    ],
  }),
  component: Landing,
});

// ----- Design tokens (page-local) -----
const C = {
  blue: "#121019",
  blueDeep: "#1A1626",
  navy: "#17151F",
  coral: "#C1EF62",
};

const serif = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };
const sans = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

// ----- Reveal on scroll -----
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 900ms ease ${delay}ms, transform 900ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Opened from the Home Screen, or already signed in: go straight into the app. */
function useOpenApp() {
  const navigate = useNavigate();
  useEffect(() => {
    const standalone =
      !!(window as unknown as { Capacitor?: unknown }).Capacitor ||
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      navigate({ to: "/app/home", replace: true });
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app/home", replace: true });
    });
  }, [navigate]);
}

function Landing() {
  useOpenApp();
  // Hero parallax
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main
      className="min-h-screen w-full text-white"
      style={{ ...sans, background: C.blue, scrollBehavior: "smooth" }}
    >
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.15); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes arrowBob {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50%      { transform: translateY(8px); opacity: 1; }
        }
        .h-serif { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-weight: 800; font-style: normal !important; letter-spacing: -0.03em; }
        .glass {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
      `}</style>

      {/* ============ SECTION 1 — HERO ============ */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
        style={{ background: C.blue }}
      >
        <Link
          to="/login"
          className="absolute z-20 right-5 top-[max(1.25rem,env(safe-area-inset-top))] rounded-full px-5 py-2 font-bold text-white"
          style={{ border: "1.5px solid rgba(255,255,255,0.7)" }}
        >
          Log in
        </Link>

        {/* soft floating orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(closest-side, rgba(255,255,255,0.6), transparent 70%)",
            animation: "floatY 9s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(closest-side, ${C.coral}, transparent 70%)`,
            animation: "floatY 11s ease-in-out infinite",
          }}
        />

        <div
          className="relative z-10 flex flex-col items-center text-center"
          style={{
            transform: `translateY(${scrollY * 0.25}px)`,
            opacity: Math.max(0, 1 - scrollY / 600),
          }}
        >
          <h1 className="leading-none" style={{ animation: "floatY 7s ease-in-out infinite" }}>
            <Logo height={260} color={C.coral} title="25" />
          </h1>

          <p
            className="mt-8 h-serif font-extrabold text-white"
            style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.5rem)", letterSpacing: "-0.02em" }}
          >
            Everyone else is noise.
          </p>
          <p className="mt-3 text-white/80" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)" }}>
            A social app for the only people that matter.
          </p>

          <p
            className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 font-extrabold"
            style={{
              background: C.coral,
              color: C.navy,
              border: "2px solid #0B0A10",
              boxShadow: "3px 3px 0 #0B0A10",
              transform: "rotate(-3deg)",
            }}
          >
            Are you in my 25?
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold transition-transform hover:-translate-y-0.5"
              style={{
                background: "var(--lime)",
                color: "var(--on-dark-fill)",
                border: "2px solid #0B0A10",
                boxShadow: "4px 4px 0 #0B0A10",
              }}
            >
              Claim your 25
            </Link>
          </div>
        </div>

        {/* scroll arrow */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          style={{ animation: "arrowBob 2s ease-in-out infinite" }}
        >
          <svg width="22" height="34" viewBox="0 0 22 34" fill="none">
            <path
              d="M11 2v28M2 22l9 9 9-9"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          </svg>
        </div>
      </section>

      {/* ============ SECTION 2 — THE PROBLEM ============ */}
      <section className="px-6 py-32 md:py-40" style={{ background: C.blue }}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p
              className="h-serif italic text-center text-white"
              style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.25 }}
            >
              "Social media was supposed to bring us closer.
              <br className="hidden md:block" /> It brought us an audience instead."
            </p>
          </Reveal>

          <div className="mt-20 grid gap-6 md:grid-cols-3">
            {[
              { tag: "Instagram", line: "You follow 500 people. You know 12." },
              { tag: "WhatsApp", line: "47 groups. 43 muted." },
              { tag: "BeReal", line: "73M users. Dead in 2 years." },
            ].map((s, i) => (
              <Reveal key={s.tag} delay={i * 120}>
                <div className="glass rounded-2xl p-7 h-full">
                  <p
                    className="uppercase mb-4"
                    style={{
                      color: C.coral,
                      fontSize: "0.7rem",
                      letterSpacing: "0.28em",
                      fontWeight: 600,
                    }}
                  >
                    {s.tag}
                  </p>
                  <p className="h-serif text-white text-2xl leading-snug">{s.line}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="mt-20 text-center text-white/80 max-w-3xl mx-auto text-lg leading-relaxed">
              The gap between who you follow and who you actually love has never been wider.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ SECTION 3 — THE SCIENCE ============ */}
      <section className="px-6 py-32 md:py-44 text-center" style={{ background: C.blueDeep }}>
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div
              className="h-serif font-black leading-none mx-auto"
              style={{ fontSize: "clamp(10rem, 32vw, 22rem)", letterSpacing: "-0.05em" }}
            >
              25
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p
              className="mt-10 h-serif italic text-white/95"
              style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)" }}
            >
              The number of close relationships the human brain can sustain.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <p
              className="mt-6 uppercase"
              style={{
                color: C.coral,
                letterSpacing: "0.32em",
                fontSize: "0.72rem",
                fontWeight: 500,
              }}
            >
              Robin Dunbar · Oxford University · 1992
            </p>
          </Reveal>
          <Reveal delay={300}>
            <p className="mt-16 h-serif text-white text-2xl md:text-3xl max-w-2xl mx-auto leading-snug">
              We didn't invent the number. We built the app around it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ SECTION 4 — THE PRODUCT ============ */}
      <section className="px-6 py-32 md:py-40" style={{ background: C.blue }}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2
              className="h-serif text-white text-center"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.1 }}
            >
              One rule. Everything else follows.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 text-center text-white/80 text-lg italic h-serif">
              You get 25 seats. Choose wisely.
            </p>
          </Reveal>

          <div className="mt-20 grid gap-6 md:grid-cols-2">
            {[
              {
                icon: "◍",
                tag: "The Seats",
                line: "25 seats at your table. Who sits there is everything.",
              },
              {
                icon: "✓",
                tag: "Prove it",
                line: "Pizza or pasta? Cats or dogs? Get 4 of 7 right about them or no seat.",
              },
              {
                icon: "❍",
                tag: "Chats",
                line: "Seat anyone you know. DMs only open when it's mutual.",
              },
              {
                icon: "↯",
                tag: "Blinks & Streaks",
                line: "Photos that disappear after one look. Keep the streak alive.",
              },
              {
                icon: "✦",
                tag: "Feed & Reels",
                line: "Posts and reels from your people only. It ends when you're caught up.",
              },
              {
                icon: "◆",
                tag: "Games",
                line: "Quick rounds, trivia and Judgement, with a weekly leaderboard.",
              },
            ].map((f, i) => (
              <Reveal key={f.tag} delay={i * 90}>
                <div className="glass rounded-3xl p-8 h-full flex gap-5">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl"
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      color: C.coral,
                    }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <p
                      className="uppercase mb-3"
                      style={{
                        color: C.coral,
                        fontSize: "0.7rem",
                        letterSpacing: "0.28em",
                        fontWeight: 600,
                      }}
                    >
                      {f.tag}
                    </p>
                    <p className="h-serif text-white text-xl md:text-2xl leading-snug">{f.line}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ GET IT ON YOUR PHONE ============ */}
      <InstallSection />

      {/* ============ CLOSING — CLAIM YOUR 25 ============ */}
      <section
        className="relative px-6 py-32 md:py-44 overflow-hidden"
        style={{ background: C.blue }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${C.coral}, transparent 70%)` }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <Reveal>
            <h2
              className="h-serif italic text-white"
              style={{ fontSize: "clamp(1.75rem, 4.4vw, 3.25rem)", lineHeight: 1.2 }}
            >
              You have 500 followers.
              <br />
              You'd call 25 of them at 3 AM.
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-8 h-serif text-white/90 text-xl md:text-2xl">
              This app is for the 25. Everyone else is noise.
            </p>
          </Reveal>
          <Reveal delay={250}>
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full px-9 py-4 font-semibold transition-transform hover:-translate-y-0.5"
                style={{
                  background: "var(--lime)",
                  color: "var(--on-dark-fill)",
                  border: "2px solid #0B0A10",
                  boxShadow: "4px 4px 0 #0B0A10",
                }}
              >
                Claim your 25
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full px-9 py-4 font-semibold text-white"
                style={{ border: "1.5px solid rgba(255,255,255,0.6)" }}
              >
                I already have an account · Log in
              </Link>
            </div>
          </Reveal>
          <p className="mt-16 text-white/70 text-xs uppercase" style={{ letterSpacing: "0.28em" }}>
            © 2026 25 · Everyone else is noise.
          </p>
        </div>
      </section>
    </main>
  );
}

const IOS_STEPS = [
  { n: "1", t: "Open in Safari", d: "Go to the25.world in Safari (not Chrome or Instagram)." },
  { n: "2", t: "Tap Share", d: "The square with the arrow, at the bottom of the screen." },
  { n: "3", t: "Add to Home Screen", d: "Scroll down the share menu and tap it, then Add." },
  { n: "4", t: "Open 25 from your Home Screen", d: "Sign in once, then turn on notifications. That's it." },
];

function InstallSection() {
  return (
    <section className="px-6 py-28 md:py-36" style={{ background: C.navy }}>
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <h2
            className="h-serif text-white text-center font-extrabold"
            style={{ fontSize: "clamp(2rem, 4.6vw, 3.25rem)", lineHeight: 1.1 }}
          >
            Get 25 on your phone
          </h2>
          <p className="mt-4 text-center text-white/80 text-lg">
            No App Store needed. Takes 20 seconds.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="glass rounded-3xl p-7 h-full">
              <p className="text-white font-extrabold text-xl"> iPhone</p>
              <ol className="mt-5 grid gap-4">
                {IOS_STEPS.map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-extrabold"
                      style={{ background: C.coral, color: C.navy, border: "2px solid #0B0A10" }}
                    >
                      {s.n}
                    </span>
                    <span>
                      <span className="block text-white font-bold">{s.t}</span>
                      <span className="block text-white/75 text-sm mt-0.5">{s.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="glass rounded-3xl p-7 h-full flex flex-col">
              <p className="text-white font-extrabold text-xl">Android</p>
              <span
                className="mt-5 self-start rounded-full px-4 py-1.5 font-extrabold text-sm"
                style={{
                  background: C.coral,
                  color: C.navy,
                  border: "2px solid #0B0A10",
                  boxShadow: "3px 3px 0 #0B0A10",
                  transform: "rotate(-3deg)",
                }}
              >
                Coming soon
              </span>
              <p className="mt-5 text-white/80">
                The Android app is on its way. Until then, open 25 in Chrome and tap ⋮ →{" "}
                <b className="text-white">Add to Home screen</b>.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
