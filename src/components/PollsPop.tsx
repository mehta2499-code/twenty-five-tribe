/**
 * The first time you open the app in a new poll week (and still have votes
 * to give): a pop-up that this week's spicy polls are out. Waits for any
 * birthday pop-up to close first, so only one shows at a time.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Glyph3D } from "@/components/Glyph3D";
import { buzz } from "@/components/SocialUI";
import { PER_WEEK, myVotesThisWeek, pollWeek, questionsFor } from "@/lib/polls";
import { useSocial } from "@/lib/social";

export function PollsPop() {
  const s = useSocial();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(PER_WEEK);

  useEffect(() => {
    const key = `tf.polls.pop.${pollWeek()}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      return;
    }
    let stop = false;
    let tries = 0;
    void myVotesThisWeek().then((v) => {
      const n = Math.max(0, PER_WEEK - Object.keys(v).length);
      if (!n || stop) return;
      setLeft(n);
      // Let a birthday pop-up go first.
      const show = () => {
        if (stop) return;
        const busy = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (busy && tries++ < 60) return void setTimeout(show, 1000);
        try {
          localStorage.setItem(key, "1");
        } catch {
          // ignore
        }
        setOpen(true);
        buzz(25);
      };
      setTimeout(show, 1200);
    });
    return () => {
      stop = true;
    };
  }, [s.mode]);

  if (!open) return null;
  const peek = questionsFor()[0];
  const close = () => setOpen(false);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      style={{ background: "rgba(7,6,11,0.7)", backdropFilter: "blur(6px)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="New weekly polls"
    >
      <div
        className="animate-soft-in w-full max-w-[340px] rounded-[30px] px-6 pt-7 pb-6 text-center"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(242,80,106,0.5), transparent 60%), radial-gradient(100% 70% at 50% 100%, rgba(255,140,60,0.25), transparent 60%), #1B1724",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="inline-block" style={{ lineHeight: 0 }}>
          <Glyph3D emoji="🌶️" size={72} />
        </span>
        <p
          className="mt-3 text-[13px] font-extrabold tracking-[0.18em] uppercase"
          style={{ color: "#FF8A6B" }}
        >
          New this week
        </p>
        <h2 className="title mt-1" style={{ fontSize: 27, lineHeight: 1.1 }}>
          Spicy polls are out!
        </h2>
        <p className="mt-2 text-[15px]" style={{ color: "var(--ink-2)" }}>
          {left} questions about your 25. Nobody sees who you picked.
        </p>
        {peek && (
          <p
            className="mt-4 rounded-2xl px-4 py-3 text-[15px] font-bold"
            style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
          >
            “{peek}”
          </p>
        )}
        <button
          onClick={() => {
            close();
            navigate({ to: "/app/polls" });
          }}
          className="btn-primary w-full mt-5"
        >
          Vote now
        </button>
        <button
          onClick={close}
          className="w-full mt-2 min-h-[44px] text-[14px] font-bold"
          style={{ color: "var(--ink-2)" }}
        >
          Later
        </button>
      </div>
    </div>
  );
}
