import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "25 — Your world. All 25 of them." },
      { name: "description", content: "A social app for your 25 closest people. No more, no less." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--primary), transparent 70%)" }}
      />
      <div className="relative z-10 flex flex-col items-center text-center animate-soft-in">
        <h1
          className="font-display font-black text-primary text-glow leading-none"
          style={{ fontSize: "clamp(8rem, 38vw, 12rem)", letterSpacing: "-0.06em" }}
        >
          25
        </h1>
        <p className="mt-6 text-muted-foreground text-lg">Your world. All 25 of them.</p>
        <p className="mt-3 text-muted-foreground/80 text-sm max-w-xs leading-relaxed">
          Pick your 25. Choose wisely. Or don't — you can always reshuffle.
        </p>

        <Link
          to="/app/home"
          className="mt-12 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-7 py-3.5 text-sm font-semibold shadow-[0_10px_40px_-10px_var(--primary)] hover:bg-primary-glow transition"
        >
          Claim your 25
        </Link>
        <p className="mt-6 text-xs text-muted-foreground/60">No followers. No metrics. Just people.</p>
      </div>
    </main>
  );
}
