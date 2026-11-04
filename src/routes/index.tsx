import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "25 — A social app for the only people that matter." },
      { name: "description", content: "25 seats. Choose wisely. The social app built around Dunbar's number — for the only people that matter." },
    ],
  }),
  component: Landing,
});

// ----- Design tokens (page-local) -----
const C = {
  blue: "#121019",
  blueDeep: "#1A1626",
  navy: "#16121F",
  coral: "#B5DB5E",
};

const serif = { fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" };
const sans = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

// ----- Reveal on scroll -----
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
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

function Landing() {
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
        .h-serif { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-style: normal !important; letter-spacing: -0.03em; }
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
        {/* soft floating orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.6), transparent 70%)", animation: "floatY 9s ease-in-out infinite" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${C.coral}, transparent 70%)`, animation: "floatY 11s ease-in-out infinite" }}
        />

        <div
          className="relative z-10 flex flex-col items-center text-center"
          style={{ transform: `translateY(${scrollY * 0.25}px)`, opacity: Math.max(0, 1 - scrollY / 600) }}
        >
          <h1 className="leading-none" style={{ animation: "floatY 7s ease-in-out infinite" }}>
            <Logo height={260} color={C.coral} title="25" />
          </h1>

          <p
            className="mt-8 italic text-white/90 h-serif"
            style={{ fontSize: "clamp(1.25rem, 2.6vw, 1.875rem)" }}
          >
            A social app for the only people that matter.
          </p>

          <p
            className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 font-extrabold"
            style={{ background: C.coral, color: C.navy, border: "2px solid #07060B", boxShadow: "3px 3px 0 #07060B", transform: "rotate(-3deg)" }}
          >
            Are you in my 25?
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--violet)", color: "#fff", border: "2px solid #07060B", boxShadow: "4px 4px 0 #07060B" }}
            >
              Claim your 25
            </Link>
            <Link
              to="/app/home"
              className="inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold text-white"
              style={{ border: "1.5px solid rgba(255,255,255,0.6)" }}
            >
              Try the demo
            </Link>
          </div>
        </div>

        {/* scroll arrow */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2" style={{ animation: "arrowBob 2s ease-in-out infinite" }}>
          <svg width="22" height="34" viewBox="0 0 22 34" fill="none">
            <path d="M11 2v28M2 22l9 9 9-9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
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
              { tag: "WhatsApp",  line: "47 groups. 43 muted." },
              { tag: "BeReal",    line: "73M users. Dead in 2 years." },
            ].map((s, i) => (
              <Reveal key={s.tag} delay={i * 120}>
                <div className="glass rounded-2xl p-7 h-full">
                  <p
                    className="uppercase mb-4"
                    style={{ color: C.coral, fontSize: "0.7rem", letterSpacing: "0.28em", fontWeight: 600 }}
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
            <p className="mt-10 h-serif italic text-white/95" style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)" }}>
              The number of close relationships the human brain can sustain.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <p
              className="mt-6 uppercase"
              style={{ color: C.coral, letterSpacing: "0.32em", fontSize: "0.72rem", fontWeight: 500 }}
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
            <h2 className="h-serif text-white text-center" style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.1 }}>
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
              { icon: "◍", tag: "The Seats",      line: "25 seats at your table. Who sits there is everything." },
              { icon: "✓", tag: "Prove it",       line: "Pizza or pasta? Cats or dogs? Guess 4 of their 6 answers or no seat." },
              { icon: "❍", tag: "Chats",          line: "Message your 25. Nobody else can reach you." },
              { icon: "↯", tag: "Snaps & Streaks", line: "Photos that disappear after one look. Keep the streak alive." },
              { icon: "✦", tag: "Feed & Reels",   line: "Posts and reels from your people only. It ends when you're caught up." },
              { icon: "◆", tag: "Games",          line: "Quick rounds, trivia and Judgement, with a weekly leaderboard." },
            ].map((f, i) => (
              <Reveal key={f.tag} delay={i * 90}>
                <div className="glass rounded-3xl p-8 h-full flex gap-5">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl"
                    style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: C.coral }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <p
                      className="uppercase mb-3"
                      style={{ color: C.coral, fontSize: "0.7rem", letterSpacing: "0.28em", fontWeight: 600 }}
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

      {/* ============ SECTION 5 — AI THAT CARES ============ */}
      <section className="px-6 py-32 md:py-40" style={{ background: C.navy }}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="h-serif text-white text-center max-w-4xl mx-auto" style={{ fontSize: "clamp(2rem, 4.4vw, 3.25rem)", lineHeight: 1.15 }}>
              AI that doesn't optimize for time spent.
              <br />
              <span className="italic" style={{ color: C.coral }}>It optimizes for friendships kept.</span>
            </h2>
          </Reveal>

          <div className="mt-20 grid gap-6 md:grid-cols-2">
            {[
              { icon: "◐", title: "Drift Prediction",   line: "Catches fading friendships before you lose them." },
              { icon: "◑", title: "Vibe Match",         line: "Connects you with the friend who needs you right now." },
              { icon: "◓", title: "Capsule Narrator",   line: "Writes the story of your friendship — in your style." },
              { icon: "◒", title: "Friendship Wrapped", line: "Spotify Wrapped, but for the people you love." },
            ].map((a, i) => (
              <Reveal key={a.title} delay={i * 90}>
                <div className="glass rounded-3xl p-8 h-full">
                  <div
                    className="mb-5 flex h-11 w-11 items-center justify-center rounded-full text-lg"
                    style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: C.coral }}
                  >
                    {a.icon}
                  </div>
                  <h3 className="h-serif text-white text-2xl mb-2">{a.title}</h3>
                  <p className="text-white/80 leading-relaxed">{a.line}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CLOSING — CLAIM YOUR 25 ============ */}
      <section className="relative px-6 py-32 md:py-44 overflow-hidden" style={{ background: C.blue }}>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${C.coral}, transparent 70%)` }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="h-serif italic text-white" style={{ fontSize: "clamp(1.75rem, 4.4vw, 3.25rem)", lineHeight: 1.2 }}>
              You have 500 followers.
              <br />
              You'd call 25 of them at 3 AM.
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-8 h-serif text-white/90 text-xl md:text-2xl">This app is for the 25.</p>
          </Reveal>
          <Reveal delay={250}>
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full px-9 py-4 font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--violet)", color: "#fff", border: "2px solid #07060B", boxShadow: "4px 4px 0 #07060B" }}
              >
                Claim your 25
              </Link>
              <Link to="/app/home" className="text-white/90 hover:text-white text-sm font-semibold underline underline-offset-4 decoration-white/40">
                Try the demo first →
              </Link>
            </div>
          </Reveal>
          <p className="mt-16 text-white/70 text-xs uppercase" style={{ letterSpacing: "0.28em" }}>
            © 2026 25
          </p>
        </div>
      </section>
    </main>
  );
}
