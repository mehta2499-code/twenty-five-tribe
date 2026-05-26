import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { MomentTag } from "@/lib/data";

const TAGS: { tag: MomentTag; color: string }[] = [
  { tag: "Life Update", color: "var(--tag-life)" },
  { tag: "Milestone",   color: "var(--tag-milestone)" },
  { tag: "Mood",        color: "var(--tag-mood)" },
  { tag: "Thought",     color: "var(--tag-thought)" },
];

export function MomentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tag, setTag] = useState<MomentTag>("Mood");
  const [text, setText] = useState("");
  const [expires, setExpires] = useState(true);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-t-3xl p-5 border-t border-border animate-soft-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">New Moment</h2>
          <button onClick={onClose} className="text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {TAGS.map((t) => {
            const active = tag === t.tag;
            return (
              <button
                key={t.tag}
                onClick={() => setTag(t.tag)}
                className="rounded-xl py-3 text-sm font-semibold border transition"
                style={{
                  color: t.color,
                  background: active
                    ? `color-mix(in oklab, ${t.color} 22%, transparent)`
                    : "transparent",
                  borderColor: active
                    ? t.color
                    : "var(--border)",
                }}
              >
                {t.tag}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl bg-background/60 border border-border p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 280))}
            placeholder="What's happening?"
            rows={4}
            className="w-full bg-transparent outline-none resize-none placeholder:text-muted-foreground/70 text-[15px]"
          />
          <div className="text-right text-xs text-muted-foreground">{text.length}/280</div>
        </div>

        <button className="mt-3 w-full rounded-2xl border border-dashed border-border py-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <ImagePlus size={18} /> Add a photo (optional)
        </button>

        <label className="mt-4 flex items-center justify-between rounded-2xl bg-background/60 border border-border px-4 py-3">
          <div>
            <div className="text-sm font-medium">Expires in 72 hours</div>
            <div className="text-xs text-muted-foreground">Moments are temporary by default.</div>
          </div>
          <button
            onClick={() => setExpires((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${expires ? "bg-primary" : "bg-border"}`}
            aria-pressed={expires}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${expires ? "left-[1.5rem]" : "left-0.5"}`} />
          </button>
        </label>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-primary text-primary-foreground py-3.5 font-semibold hover:bg-primary-glow transition shadow-[0_10px_30px_-10px_var(--primary)]"
        >
          Share with your 25
        </button>
      </div>
    </div>
  );
}
