import { BlockedList } from "@/components/Safety";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/privacy")({
  component: Privacy,
});

function Privacy() {
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    try {
      setAllow(localStorage.getItem("tf.privacy.allowScreenshots") === "1");
    } catch {}
  }, []);

  const toggle = () => {
    const next = !allow;
    setAllow(next);
    try {
      localStorage.setItem("tf.privacy.allowScreenshots", next ? "1" : "0");
    } catch {}
  };

  return (
    <div className="pb-16">
      <header className="px-5 pt-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))]">
        <Link to="/app/profile" className="text-cool" aria-label="Back">
          <ArrowLeft size={18} />
        </Link>
      </header>

      <section className="px-7 pt-8 text-center">
        <p className="label-caps">privacy</p>
        <h1
          className="font-display italic text-cream mt-3"
          style={{ fontSize: 30, lineHeight: 1.15 }}
        >
          What's in 25 stays in 25.
        </h1>
        <p
          className="font-display italic mt-4 mx-auto"
          style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.55, maxWidth: "22rem" }}
        >
          These are private rooms. We do what we can to keep them that way.
        </p>
      </section>

      <section className="px-6 mt-12">
        <div className="card-editorial p-5 flex items-center gap-4">
          <div className="flex-1">
            <p className="font-display text-cream" style={{ fontSize: 15 }}>
              Allow screenshots
            </p>
            <p
              className="font-display italic mt-1"
              style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.45 }}
            >
              Off by default. When off, the app blurs when you leave it.
            </p>
          </div>
          <button
            onClick={toggle}
            aria-pressed={allow}
            className="relative shrink-0 transition"
            style={{
              width: 44,
              height: 26,
              borderRadius: 999,
              background: allow ? "var(--accent-bronze)" : "rgba(181,219,94,0.18)",
              border: "1px solid var(--border-cool)",
            }}
          >
            <span
              className="absolute top-0.5 transition-all"
              style={{
                left: allow ? 20 : 2,
                width: 20,
                height: 20,
                borderRadius: 999,
                background: "var(--bg-cream)",
              }}
            />
          </button>
        </div>

        <p
          className="font-display italic mt-5 px-2"
          style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.55 }}
        >
          On Android we use FLAG_SECURE to block screenshots and screen recording. On iOS we detect
          screenshots and remind both sides what this space is. On the web, we blur the screen when
          the app loses focus.
        </p>
      </section>
      <BlockedList />
    </div>
  );
}
