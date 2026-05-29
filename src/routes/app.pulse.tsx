import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Flame, Wine, Sparkles, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, ROASTS, TOASTS, type Friend } from "@/lib/data";

export const Route = createFileRoute("/app/pulse")({
  component: AiScreen,
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
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [text, speed]);
  return out;
}

function AiScreen() {
  const [selected, setSelected] = useState<Friend>(FRIENDS[0]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [seed, setSeed] = useState(0);

  const text = (() => {
    if (!mode) return "";
    const pool = mode === "roast" ? ROASTS.default : TOASTS.default;
    return pool[seed % pool.length].replaceAll("{name}", selected.name);
  })();
  const typed = useTypewriter(text);

  function run(next: Mode) {
    setMode(next);
    setSeed((s) => s + 1);
  }

  return (
    <>
      <header className="px-5 pt-7 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={20} style={{ color: "#F7A8A0" }} />
          <span className="text-[11px] uppercase tracking-[0.22em] text-white/75 font-semibold">
            AI · Roast & Toast
          </span>
        </div>
        <h1 className="font-display text-4xl font-black mt-2 leading-none">
          Pick someone. <br />
          <span className="italic font-bold" style={{ color: "#F7A8A0" }}>Let AI do the rest.</span>
        </h1>
        <p className="text-sm text-white/75 mt-3 max-w-sm">
          Personalised. Sharp. A little dangerous. Strictly for your 25.
        </p>
      </header>

      <section className="px-4 mt-5">
        <div className="glass-soft px-3 py-3">
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
                  <Avatar
                    src={f.avatar}
                    initials={f.initials}
                    color={f.color}
                    size={56}
                    ring={active ? "active" : "none"}
                  />
                  <span
                    className="text-[12px] max-w-[64px] truncate"
                    style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)" }}
                  >
                    {f.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 mt-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => run("roast")}
            className="glass-strong py-4 font-bold text-base active:scale-[0.97] transition"
            style={{ color: "#FFFFFF" }}
          >
            <span className="inline-flex items-center gap-2">
              <Flame size={18} style={{ color: "#F7A8A0" }} /> Roast {selected.name}
            </span>
          </button>
          <button
            onClick={() => run("toast")}
            className="btn-coral rounded-[20px] py-4 font-bold text-base active:scale-[0.97] transition"
          >
            <span className="inline-flex items-center gap-2">
              <Wine size={18} /> Toast {selected.name}
            </span>
          </button>
        </div>
      </section>

      {mode && (
        <section className="px-4 mt-5">
          <div className="glass p-5 animate-soft-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar src={selected.avatar} initials={selected.initials} color={selected.color} size={36} />
                <div>
                  <div className="text-sm font-bold leading-tight">{selected.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/65">
                    {mode === "roast" ? "🔥 Roast" : "🥂 Toast"} · AI
                  </div>
                </div>
              </div>
              <button
                onClick={() => run(mode)}
                aria-label="Regenerate"
                className="h-9 w-9 rounded-full glass-soft flex items-center justify-center"
              >
                <RotateCcw size={15} />
              </button>
            </div>
            <p
              className="mt-4 text-[16px] leading-relaxed font-display caret"
              style={{ color: "#FFFFFF" }}
            >
              {typed}
            </p>
            {typed.length === text.length && (
              <div className="mt-5 flex gap-2.5">
                <button className="flex-1 glass-soft py-3 text-sm font-semibold">
                  Send to {selected.name}
                </button>
                <button className="flex-1 btn-coral rounded-[14px] py-3 text-sm font-bold">
                  Save to Capsule
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <p className="px-6 text-center text-[11px] text-white/55 italic mt-10">
        AI only ever knows your 25. Never shared. Never trained on.
      </p>
    </>
  );
}
