import { createFileRoute, Link } from "@tanstack/react-router";
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
  blue: "#2B8AC4",
  blueDeep: "#1E6FA0",
  navy: "#1A5276",
  coral: "#F7A8A0",
};

const serif = { fontFamily: "'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

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
        .h-serif { font-family: 'Playfair Display', Georgia, serif; }
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
          <h1
            className="h-serif font-black leading-none"
            style={{ fontSize: "clamp(7rem, 28vw, 18rem)", letterSpacing: "-0.05em" }}
          >
            25
            <span style={{ display: "inline-block", animation: "dotPulse 2.4s ease-in-out infinite" }}>.</span>
          </h1>

          <p
            className="mt-8 italic text-white/90 h-serif"
            style={{ fontSize: "clamp(1.25rem, 2.6vw, 1.875rem)" }}
          >
            A social app for the only people that matter.
          </p>

          <p
            className="mt-10 uppercase"
            style={{ color: C.coral, letterSpacing: "0.42em", fontSize: "0.78rem", fontWeight: 500 }}
          >
            Seed Deck · 2026
          </p>
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
              { icon: "◍", tag: "The Seats",      line: "25 visual slots. Your dinner table. Who sits there is everything." },
              { icon: "❍", tag: "Pulse",          line: "One word. One emoji. One colour. Daily. The anti-Instagram post." },
              { icon: "↯", tag: "Drift Alert",    line: "\"You and Rahul haven't talked in 21 days. Just saying.\"" },
              { icon: "✦", tag: "Memory Capsule", line: "Co-authored story of your friendship. Not your camera roll." },
              { icon: "◆", tag: "Games",          line: "Judgement. Trivia. Truth Jar. Play together, stay together." },
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

      {/* ============ SECTION 6 — THE MOAT ============ */}
      <section className="px-6 py-32 md:py-40" style={{ background: C.blueDeep }}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="h-serif text-white text-center" style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.1 }}>
              What they can't copy.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 text-center text-white/80 italic h-serif max-w-2xl mx-auto text-lg">
              Instagram Close Friends exists. Nobody uses it. Features don't win. Relationships do.
            </p>
          </Reveal>

          <div className="mt-16 space-y-4">
            {[
              { n: "01", t: "Emotional data lock-in",      s: "Years of Pulses, Capsules, and shared memories. You can't export a friendship." },
              { n: "02", t: "Social graph gravity",         s: "Once your 25 is here, your circle is here. Networks compound." },
              { n: "03", t: "India in the DNA",             s: "Built for how Indians actually talk, share, and stay close." },
              { n: "04", t: "Trust as infrastructure",      s: "No ads. Ever." },
            ].map((m, i) => (
              <Reveal key={m.n} delay={i * 80}>
                <div className="glass rounded-2xl p-6 md:p-7 flex items-start gap-6">
                  <span
                    className="h-serif"
                    style={{ color: C.coral, fontSize: "1.5rem", lineHeight: 1, minWidth: "2.5rem" }}
                  >
                    {m.n}
                  </span>
                  <div>
                    <h3 className="h-serif text-white text-xl md:text-2xl">{m.t}</h3>
                    <p className="mt-2 text-white/75 leading-relaxed">{m.s}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SECTION 6.5 — WHY NOW ============ */}
      <section className="px-6 py-32 md:py-40" style={{ background: C.navy }}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="uppercase text-center" style={{ color: C.coral, letterSpacing: "0.32em", fontSize: "0.75rem", fontWeight: 600 }}>
              Why now
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-6 h-serif text-white text-center" style={{ fontSize: "clamp(2rem, 4.6vw, 3.25rem)", lineHeight: 1.15 }}>
              The shift from attention
              <br />
              <span className="italic" style={{ color: C.coral }}>to intimacy is already here.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {[
              { big: "63%", small: "of Gen Z planned a social media detox in 2025." },
              { big: "55%", small: "have taken a break to manage digital fatigue." },
              { big: "73%", small: "of young adults say social media hurts mental health." },
              { big: "61%", small: "report sleep disruption from late-night scrolling." },
            ].map((s, i) => (
              <Reveal key={s.small} delay={i * 90}>
                <div className="glass rounded-2xl p-7 h-full flex items-baseline gap-5">
                  <div className="h-serif text-white" style={{ fontSize: "clamp(2.25rem, 5vw, 3.25rem)", lineHeight: 1 }}>
                    {s.big}
                  </div>
                  <p className="text-white/80 leading-relaxed">{s.small}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="mt-16 text-center h-serif italic text-white/90 max-w-3xl mx-auto" style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)", lineHeight: 1.5 }}>
              The future of social media isn't bigger audiences.
              <br />
              It's smaller circles.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ SECTION 7 — MARKET OPPORTUNITY ============ */}
      <section className="px-6 py-32 md:py-40 text-center" style={{ background: C.blue }}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="uppercase" style={{ color: C.coral, letterSpacing: "0.32em", fontSize: "0.75rem", fontWeight: 600 }}>
              Market Opportunity
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 h-serif font-black leading-none" style={{ fontSize: "clamp(6rem, 18vw, 14rem)", letterSpacing: "-0.04em" }}>
              534M
            </div>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-4 text-white/85 text-lg md:text-xl">
              Instagram users in India — the largest Instagram market in the world.
            </p>
          </Reveal>

          <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-4 text-left">
            {[
              { big: "79.1%", small: "of Indian Instagram users are aged 18–34." },
              { big: "51M",   small: "Instagram users added in India in a single year." },
              { big: "34%",   small: "of users seek an alternative every month." },
              { big: "81%",   small: "of Indian Gen Z consume social media daily." },
            ].map((s, i) => (
              <Reveal key={s.small} delay={i * 100}>
                <div className="glass rounded-2xl p-7 h-full">
                  <div className="h-serif text-white" style={{ fontSize: "clamp(2.25rem, 5vw, 3.25rem)", lineHeight: 1 }}>
                    {s.big}
                  </div>
                  <p className="mt-3 text-white/80 leading-relaxed">{s.small}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={250}>
            <p className="mt-16 h-serif italic text-white/85 max-w-3xl mx-auto" style={{ fontSize: "clamp(1.05rem, 2vw, 1.35rem)", lineHeight: 1.55 }}>
              The market isn't small. None of these platforms are designed for meaningful relationships.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ SECTION 8 — BUSINESS MODEL ============ */}
      <section className="px-6 py-32 md:py-40" style={{ background: C.blueDeep }}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="h-serif text-white text-center" style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.1 }}>
              We charge for joy.
              <br />
              <span className="italic" style={{ color: C.coral }}>Not attention.</span>
            </h2>
          </Reveal>

          <div className="mt-20 grid gap-6 md:grid-cols-3">
            {[
              { tag: "25 Plus",          price: "₹99",     unit: "/month", line: "Archives, Friendship Score, Pulse history." },
              { tag: "Capsule Gift",     price: "₹49",     unit: "",       line: "Send the story of your friendship." },
              { tag: "Experience Packs", price: "₹29–49",  unit: "",       line: "Games, themes, festival specials." },
            ].map((p, i) => (
              <Reveal key={p.tag} delay={i * 100}>
                <div
                  className="rounded-3xl p-8 h-full flex flex-col"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.22)" }}
                >
                  <p className="uppercase mb-6" style={{ color: C.coral, fontSize: "0.7rem", letterSpacing: "0.3em", fontWeight: 600 }}>
                    {p.tag}
                  </p>
                  <div className="h-serif text-white" style={{ fontSize: "3rem", lineHeight: 1 }}>
                    {p.price}
                    <span className="text-white/60" style={{ fontSize: "1rem" }}> {p.unit}</span>
                  </div>
                  <p className="mt-6 text-white/80 leading-relaxed">{p.line}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={150}>
            <p className="mt-10 text-center text-white/70 max-w-2xl mx-auto">
              Year 2 · 100K users · 5% on 25 Plus · <span className="text-white">₹50L ARR</span>. Unit economics work at 10,000 users — not 10 million.
            </p>
          </Reveal>
        </div>
      </section>


      {/* ============ SECTION 9 — SEEKING / CTA ============ */}
      <section className="relative px-6 py-32 md:py-44 overflow-hidden" style={{ background: C.blue }}>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${C.coral}, transparent 70%)` }}
        />
        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal>
            <p className="uppercase" style={{ color: C.coral, letterSpacing: "0.42em", fontSize: "0.78rem", fontWeight: 500 }}>
              Seeking
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-6 h-serif italic text-white" style={{ fontSize: "clamp(1.75rem, 4.4vw, 3.25rem)", lineHeight: 1.2 }}>
              You have 500 followers.
              <br />
              You'd call 25 of them at 3 AM.
            </h2>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-8 h-serif text-white/90 text-xl md:text-2xl">
              We built the app for the 25 — and we're looking for the right people to build it with.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-left">
            {[
              "Incubation support",
              "Product mentorship",
              "Strategic guidance",
              "Early-stage funding opportunities",
              "Access to the startup ecosystem",
              "Partnerships & introductions",
            ].map((s, i) => (
              <Reveal key={s} delay={i * 70}>
                <div className="glass rounded-2xl p-5 h-full flex items-center gap-4">
                  <span className="h-serif" style={{ color: C.coral, fontSize: "1.25rem" }}>✦</span>
                  <span className="text-white/90">{s}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={300}>
            <div className="mt-16 flex flex-col items-center gap-4">
              <a
                href="mailto:mehta2499@gmail.com"
                className="inline-flex items-center justify-center rounded-full px-9 py-4 text-sm font-semibold uppercase transition-transform hover:-translate-y-0.5"
                style={{
                  background: C.coral,
                  color: "#1A2A33",
                  letterSpacing: "0.22em",
                  boxShadow: "0 18px 50px -12px rgba(247,168,160,0.6)",
                }}
              >
                Let's talk
              </a>
              <Link to="/app/home" className="text-white/70 hover:text-white text-sm underline underline-offset-4 decoration-white/30">
                Preview the app →
              </Link>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <p className="mt-16 text-white/80">
              Aman Mehta · <a href="tel:+917990552696" className="hover:text-white">+91 79905 52696</a> · <a href="mailto:mehta2499@gmail.com" className="underline decoration-white/30 underline-offset-4 hover:text-white">mehta2499@gmail.com</a>
            </p>
            <p className="mt-3 text-white/50 text-xs uppercase" style={{ letterSpacing: "0.28em" }}>
              © 2026 Twenty Five
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
