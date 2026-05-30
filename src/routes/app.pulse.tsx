import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, ROASTS, TOASTS, type Friend } from "@/lib/data";

export const Route = createFileRoute("/app/pulse")({
  component: PulseScreen,
});

type Mode = "roast" | "toast";

function useTypewriter(text: string, speed = 18) {
  const [out, setOut] = useState("");
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setOut("");
    if (!text) return;
    let i = 0;
    const tick = () => {
      i++;
      setOut(text.slice(0, i));
      if (i < text.length) tRef.current = setTimeout(tick, speed);
    };
    tick();
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [text, speed]);
  return out;
}

const PULSE_COLORS = [
  { word: "tired",    color: "#7B6FD4" },
  { word: "grateful", color: "#D4A96A" },
  { word: "anxious",  color: "#C94040" },
  { word: "lit",      color: "#1D9E75" },
  { word: "meh",      color: "#8A9CAA" },
];

function spaced(s: string) { return s.toUpperCase().split("").join(" "); }

function PulseScreen() {
  const [word, setWord] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Roast/Toast
  const [selected, setSelected] = useState<Friend>(FRIENDS[0]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [seed, setSeed] = useState(0);
  const text = (() => {
    if (!mode) return "";
    const pool = mode === "roast" ? ROASTS.default : TOASTS.default;
    return pool[seed % pool.length].replaceAll("{name}", selected.name);
  })();
  const typed = useTypewriter(text);
  function run(next: Mode) { setMode(next); setSeed((s) => s + 1); }

  function sendPulse() {
    if (!word.trim() && !picked) return;
    setSent(true);
    setTimeout(() => setSent(false), 3200);
  }

  return (
    <>
      <header className="px-6 pt-10 pb-2 text-center">
        <p className="label-caps text-cool">{spaced("Pulse · Just for your 25")}</p>
        <h1 className="font-display italic text-warm mt-4" style={{ fontSize: 30, lineHeight: 1.2 }}>
          How are you<br />actually doing?
        </h1>
      </header>

      <section className="px-8 mt-6">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value.slice(0, 18))}
          placeholder="one word"
          className="input-letterpress"
        />

        <div className="mt-7 flex justify-center gap-4 flex-wrap">
          {PULSE_COLORS.map((p) => {
            const active = picked === p.word;
            return (
              <button
                key={p.word}
                onClick={() => { setPicked(p.word); if (!word) setWord(p.word); }}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="rounded-full transition"
                  style={{
                    width: 46,
                    height: 46,
                    background: p.color,
                    boxShadow: active
                      ? `0 0 0 3px #0D1820, 0 0 0 5px ${p.color}, 0 0 24px ${p.color}`
                      : `0 0 14px ${p.color}55`,
                    transform: active ? "scale(1.06)" : "scale(1)",
                  }}
                />
                <span className="label-caps text-cool" style={{ fontSize: 9 }}>{spaced(p.word)}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={sendPulse}
          className="btn-capsule mt-9 w-full py-4 font-display italic"
          style={{ fontSize: 16 }}
        >
          Send pulse to your 25
        </button>

        {sent && (
          <div className="relative mt-8 flex justify-center animate-soft-in">
            <div
              className="absolute inset-0 -m-6 rounded-full animate-purple-pulse"
              style={{ pointerEvents: "none" }}
            />
            <p className="font-display italic text-warm text-glow-purple text-center" style={{ fontSize: 22 }}>
              Your 25 can feel you.
            </p>
          </div>
        )}
      </section>

      {/* Divider */}
      <hr className="hr-thin mx-8 my-10" />

      {/* Roast & Toast */}
      <section className="px-5">
        <div className="flex items-center gap-2 px-1">
          <Sparkles size={14} style={{ color: "#7B6FD4" }} />
          <span className="label-caps text-cool">{spaced("AI · Roast & Toast")}</span>
        </div>
        <h2 className="font-display italic text-warm mt-3 px-1" style={{ fontSize: 22 }}>
          Pick someone. Let AI do the rest.
        </h2>

        <div className="mt-5 rounded-2xl px-3 py-3" style={{ background: "#132030", border: "1px solid var(--border-cool)" }}>
          <div className="flex gap-3 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FRIENDS.slice(0, 18).map((f) => {
              const active = f.id === selected.id;
              return (
                <button
                  key={f.id}
                  onClick={() => { setSelected(f); setMode(null); }}
                  className="flex flex-col items-center gap-1.5 shrink-0 transition"
                  style={{ transform: active ? "scale(1.06)" : "scale(1)" }}
                >
                  <Avatar src={f.avatar} initials={f.initials} color={f.color} size={52} ring={active ? "active" : "none"} />
                  <span className="font-display italic max-w-[64px] truncate" style={{ fontSize: 11, color: active ? "#F2F0EB" : "#8A9CAA" }}>
                    {f.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => run("roast")}
            className="rounded-full py-3 font-display italic"
            style={{ background: "transparent", border: "1px solid var(--border-cool)", color: "#F2F0EB" }}
          >
            🔥 Roast {selected.name}
          </button>
          <button onClick={() => run("toast")} className="btn-capsule py-3 font-display italic">
            🥂 Toast {selected.name}
          </button>
        </div>

        {mode && (
          <div className="card-editorial accent-bar-purple mt-5 p-5 animate-soft-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar src={selected.avatar} initials={selected.initials} color={selected.color} size={36} />
                <div>
                  <div className="font-display text-warm" style={{ fontSize: 14 }}>{selected.name}</div>
                  <div className="label-caps text-cool">{spaced(mode === "roast" ? "Roast · AI" : "Toast · AI")}</div>
                </div>
              </div>
              <button
                onClick={() => run(mode)}
                aria-label="Regenerate"
                className="h-9 w-9 rounded-full flex items-center justify-center"
                style={{ background: "#1A2D3E", border: "1px solid var(--border-cool)" }}
              >
                <RotateCcw size={15} />
              </button>
            </div>
            <p className="mt-4 font-display italic caret" style={{ fontSize: 16, lineHeight: 1.7, color: "#F2F0EB" }}>
              {typed}
            </p>
          </div>
        )}
      </section>

      <p className="px-8 text-center font-display italic text-cool mt-10 mb-6" style={{ fontSize: 12 }}>
        Pulses and Toasts stay inside your 25. Never shared. Never trained on.
      </p>
    </>
  );
}
