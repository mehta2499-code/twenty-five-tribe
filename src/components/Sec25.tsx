/**
 * 25 Sec, a daily game: tap Start, count 25 seconds in your head (no clock on
 * screen), tap Stop. Whoever lands closest to 25.000 s wins the day. 3 tries,
 * the best one counts. Leaving mid-try uses that try up.
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { GameArt } from "@/components/GameArt";
import { buzz } from "@/components/SocialUI";
import { sfx } from "@/lib/sfx";
import {
  SEC_TARGET,
  TRIES,
  finishSec,
  mySecs,
  secBest,
  secRanking,
  startSec,
  today,
  useDaily,
} from "@/lib/daily";

const LIME = "#B8F25C";
const PURPLE = "#8C6CF0";

/** 0.347 → "0.347s" */
export const fmtOff = (ms: number) => `${(ms / 1000).toFixed(3)}s`;

type Phase = "ready" | "starting" | "counting" | "result";

export function Sec25({ onClose }: { onClose: () => void }) {
  const d = useDaily();
  const [phase, setPhase] = useState<Phase>("ready");
  const [err, setErr] = useState<string | null>(null);
  const [held, setHeld] = useState(0);
  const [day, setDay] = useState(today());
  const t0 = useRef(0);
  const stopping = useRef(false);

  const tries = mySecs(day);
  const left = TRIES - tries.length;
  const best = secBest(tries);
  const me = secRanking(d, day).find((r) => r.id === "me");

  // Way past it (a minute): stop for them.
  useEffect(() => {
    if (phase !== "counting") return;
    const t = setTimeout(() => void stop(), 60_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = async () => {
    setErr(null);
    setPhase("starting");
    try {
      const k = await startSec();
      setDay(k);
      stopping.current = false;
      t0.current = performance.now();
      setPhase("counting");
      sfx.tick(0);
      buzz(20);
    } catch (e) {
      setErr((e as Error).message);
      setPhase("ready");
    }
  };

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    const ms = performance.now() - t0.current;
    setHeld(ms);
    setPhase("result");
    buzz(35);
    const off = Math.abs(Math.round(ms) - SEC_TARGET);
    if (off <= 300) sfx.win();
    else sfx.land();
    try {
      await finishSec(day, ms);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const off = Math.abs(Math.round(held) - SEC_TARGET);
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
          <span className="label-caps">daily game</span>
          {phase !== "counting" && (
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
            onPointerDown={() => void stop()}
            className="flex-1 flex flex-col items-center justify-center text-center mt-4 rounded-[32px]"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(140,108,240,0.35), transparent 65%)",
            }}
            aria-label="Stop the clock"
          >
            <span
              className="w-52 h-52 rounded-full flex items-center justify-center"
              style={{
                background: `radial-gradient(circle at 35% 30%, #A98BFF, ${PURPLE})`,
                boxShadow: `0 0 0 10px rgba(140,108,240,0.18), 0 0 60px rgba(140,108,240,0.6)`,
                animation: "breathe 2s ease-in-out infinite",
              }}
            >
              <span className="font-black" style={{ fontSize: 44, letterSpacing: "0.02em" }}>
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
            <p className="font-black mt-4" style={{ fontSize: 30 }}>
              25 Sec
            </p>
            {phase === "result" ? (
              <>
                <p className="display mt-6 tabular-nums" style={{ fontSize: 58, color: LIME }}>
                  {(held / 1000).toFixed(3)}s
                </p>
                <p className="mt-1 font-extrabold tabular-nums" style={{ fontSize: 18 }}>
                  {off === 0
                    ? "Exactly 25! 🤯"
                    : `${fmtOff(off)} ${held < SEC_TARGET ? "early" : "late"}`}
                </p>
                <p className="mt-2" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {verdict}
                </p>
              </>
            ) : (
              <p
                className="mt-4 max-w-[300px]"
                style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}
              >
                Tap Start and count 25 seconds in your head. No clock. Tap Stop when you think it's
                25. Closest in your 25 wins. 3 tries, the best one counts.
              </p>
            )}

            {best != null && (
              <p className="mt-6 font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>
                Your best today: <span className="tabular-nums">{fmtOff(best)}</span> off
                {me ? ` · #${me.rank}` : ""}
              </p>
            )}
            <div className="mt-3 flex gap-1.5" aria-label={`${left} of ${TRIES} tries left`}>
              {Array.from({ length: TRIES }, (_, i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: i < tries.length ? "rgba(255,255,255,0.25)" : LIME }}
                />
              ))}
            </div>
            {err && (
              <p className="mt-4" style={{ color: "#FF8A98" }}>
                {err}
              </p>
            )}
            {left > 0 ? (
              <button
                onClick={() => void start()}
                disabled={phase === "starting"}
                className="mt-8 w-full rounded-2xl font-black disabled:opacity-60"
                style={{ background: LIME, color: "#14200A", minHeight: 58, fontSize: 18 }}
              >
                {phase === "starting"
                  ? "Get ready…"
                  : phase === "result"
                    ? `Try again (${left} left)`
                    : "Start"}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="mt-8 w-full rounded-2xl font-black"
                style={{ background: LIME, color: "#14200A", minHeight: 58 }}
              >
                See today's board
              </button>
            )}
            {phase !== "ready" && left > 0 && (
              <button
                onClick={onClose}
                className="mt-2 w-full min-h-[44px] font-bold"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Done for now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
