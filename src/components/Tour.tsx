/**
 * First-visit tours: a spotlight on each important thing on a tab, with a
 * short line about what it does. Shown once per tab per phone.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { buzz } from "@/components/SocialUI";

export type TourStep = {
  /** CSS selector for the thing to point at (step is skipped if it's not on screen). */
  at: string;
  title: string;
  body: string;
};

const seen = (id: string) => {
  try {
    return localStorage.getItem(`tf.tour.${id}`) === "1";
  } catch {
    return true;
  }
};
const markSeen = (id: string) => {
  try {
    localStorage.setItem(`tf.tour.${id}`, "1");
  } catch {
    // ignore
  }
};

export function Tour({ id, steps, delay = 700 }: { id: string; steps: TourStep[]; delay?: number }) {
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Start once, after the page has settled (and not on top of another overlay).
  useEffect(() => {
    if (seen(id)) return;
    const t = setTimeout(() => {
      if (document.querySelector(".fixed.inset-0.z-50, [role=dialog]")) return;
      setOn(true);
    }, delay);
    return () => clearTimeout(t);
  }, [id, delay]);

  // Find the current step's target; skip steps whose target isn't there.
  useLayoutEffect(() => {
    if (!on) return;
    const step = steps[i];
    if (!step) return;
    const el = document.querySelector(step.at) as HTMLElement | null;
    if (!el) {
      if (i < steps.length - 1) setI(i + 1);
      else finish();
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, i]);

  const finish = () => {
    markSeen(id);
    setOn(false);
  };
  if (!on || !rect) return null;
  const step = steps[i];
  const pad = 8;
  const below = rect.top + rect.height / 2 < window.innerHeight / 2;
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-label={`Tour: ${step.title}`}>
      {/* Spotlight: everything dims except the thing we're talking about. */}
      <div
        className="absolute rounded-3xl pointer-events-none"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(10, 9, 15, 0.78)",
          outline: "2px solid var(--lime)",
          transition: "all 300ms var(--ease)",
        }}
      />
      <div
        className="absolute inset-x-4 mx-auto max-w-sm rounded-3xl p-5 rise-in"
        key={i}
        style={{
          ...(below
            ? { top: Math.min(rect.bottom + pad + 14, window.innerHeight - 230) }
            : { bottom: Math.min(window.innerHeight - rect.top + pad + 14, window.innerHeight - 230) }),
          background: "var(--surface)",
          border: "var(--bd)",
          boxShadow: "var(--pop-lg)",
        }}
      >
        <p className="label-caps" style={{ color: "var(--lime)" }}>
          {i + 1} of {steps.length}
        </p>
        <p className="heading mt-1">{step.title}</p>
        <p className="text-cool mt-1.5" style={{ fontSize: 14.5, lineHeight: 1.45 }}>
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-sm font-semibold text-cool py-2">
            Skip
          </button>
          <button
            onClick={() => {
              buzz(8);
              if (last) finish();
              else setI(i + 1);
            }}
            className="btn-primary px-6"
            style={{ minHeight: 42 }}
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
