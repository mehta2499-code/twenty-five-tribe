/**
 * 25 Sec, one of the daily games in the rotation: tap Start, count 25 seconds
 * in your head (no clock on screen), tap Stop. Closest to 25.000 s wins.
 * Score = 25,000 minus how many milliseconds off you were (higher is better).
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { GameArt } from "@/components/GameArt";
import { buzz } from "@/components/SocialUI";
import { sfx } from "@/lib/sfx";

const LIME = "#B8F25C";
const PURPLE = "#8C6CF0";
export const SEC_TARGET = 25_000;

/** A 25 Sec score as people read it: "0.347s off". */
export const secOff = (score: number) =>
  `${(Math.max(0, SEC_TARGET - score) / 1000).toFixed(3)}s off`;

export function Sec25Round({
  onFinish,
  onClose,
}: {
  onFinish: (score: number) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"ready" | "counting" | "result">("ready");
  const [held, setHeld] = useState(0);
  const t0 = useRef(0);
  const stopped = useRef(false);

  const stop = () => {
    if (stopped.current) return;
    stopped.current = true;
    const ms = Math.round(performance.now() - t0.current);
    setHeld(ms);
    setPhase("result");
    buzz(35);
    const off = Math.abs(ms - SEC_TARGET);
    if (off <= 300) sfx.win();
    else sfx.land();
    setTimeout(() => onFinish(Math.max(0, SEC_TARGET - off)), 2600);
  };
  // Way past it (a minute): stop for them.
  useEffect(() => {
    if (phase !== "counting") return;
    const t = setTimeout(stop, 60_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const off = Math.abs(held - SEC_TARGET);
  const verdict =
    off <= 50
      ? "Inhuman. Are you a clock? 🤖"
      : off <= 250
        ? "So close! 🔥"
        : off <= 1000
          ? "Nice internal clock ⏱️"
          : off <= 3000
            ? "Not bad. Breathe and count 🧘"
            : held < SEC_TARGET
              ? "Too fast! Slow down 🐇"
              : "Way too slow 🐢";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto select-none"
      style={{
        background: `radial-gradient(120% 70% at 50% -10%, ${PURPLE}55 0%, transparent 60%), linear-gradient(180deg, #121019 0%, #09080D 100%)`,
        color: "#fff",
      }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col min-h-full">
        <header className="flex items-center justify-between">
          <span className="label-caps">25 Sec</span>
          {phase === "ready" && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              <X size={22} />
            </button>
          )}
        </header>

        {phase === "counting" ? (
          // The whole screen is the Stop button. No clock: count in your head.
          <button
            onPointerDown={stop}
            className="flex-1 flex flex-col items-center justify-center text-center mt-4 rounded-[32px]"
            aria-label="Stop the clock"
          >
            <span
              className="w-52 h-52 rounded-full flex items-center justify-center"
              style={{
                background: `radial-gradient(circle at 35% 30%, #A98BFF, ${PURPLE})`,
                boxShadow: `0 0 0 10px rgba(140,108,240,0.18), 0 0 60px rgba(140,108,240,0.6)`,
              }}
            >
              <span className="font-black" style={{ fontSize: 44 }}>
                STOP
              </span>
            </span>
            <p className="mt-8 font-extrabold" style={{ fontSize: 20 }}>
              Counting… 🤫
            </p>
            <p className="mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
              Tap anywhere at exactly 25 seconds
            </p>
          </button>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <GameArt kind="sec25" size={96} />
            {phase === "result" ? (
              <>
                <p className="display mt-6 tabular-nums" style={{ fontSize: 58, color: LIME }}>
                  {(held / 1000).toFixed(3)}s
                </p>
                <p className="mt-1 font-extrabold tabular-nums" style={{ fontSize: 18 }}>
                  {off === 0
                    ? "Exactly 25! 🤯"
                    : `${(off / 1000).toFixed(3)}s ${held < SEC_TARGET ? "early" : "late"}`}
                </p>
                <p className="mt-2" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {verdict}
                </p>
              </>
            ) : (
              <>
                <p className="font-black mt-4" style={{ fontSize: 30 }}>
                  25 Sec
                </p>
                <p
                  className="mt-3 max-w-[300px]"
                  style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}
                >
                  Tap Start and count 25 seconds in your head. No clock. Tap Stop when you think
                  it's 25. Closest wins.
                </p>
                <button
                  onClick={() => {
                    stopped.current = false;
                    t0.current = performance.now();
                    setPhase("counting");
                    sfx.tick(0);
                    buzz(20);
                  }}
                  className="mt-8 w-full rounded-2xl font-black"
                  style={{ background: LIME, color: "#14200A", minHeight: 58, fontSize: 18 }}
                >
                  Start
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
