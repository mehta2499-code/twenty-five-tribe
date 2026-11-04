import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FRIENDS, getSeatMeta } from "@/lib/data";

type MomentKind = "photo" | "voice" | "thought" | "milestone" | "memory";

const KINDS: { id: MomentKind; glyph: string; label: string }[] = [
  { id: "photo", glyph: "📸", label: "Photo" },
  { id: "voice", glyph: "🎤", label: "Voice" },
  { id: "thought", glyph: "✍", label: "Thought" },
  { id: "milestone", glyph: "🏆", label: "Milestone" },
  { id: "memory", glyph: "📍", label: "Memory" },
];

export function AddMomentSheet({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (kind: MomentKind, friendIds: string[], text: string) => void;
}) {
  const [kind, setKind] = useState<MomentKind | null>(null);
  const [tagged, setTagged] = useState<string[]>([]);
  const [text, setText] = useState("");

  // Only show seated friends as taggable
  const seated = FRIENDS.filter((f) => getSeatMeta(f.id).state === "ACCEPTED");

  const toggle = (id: string) =>
    setTagged((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(14,42,69,0.45)", backdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card-editorial p-6 animate-soft-in"
        style={{
          background: "var(--bg-card)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-1">
          <p className="label-caps">add a moment</p>
          <button onClick={onClose} className="label-caps text-cool">
            close
          </button>
        </div>

        {!kind && (
          <>
            <h3
              className="font-display italic text-cream mt-2"
              style={{ fontSize: 24, lineHeight: 1.2 }}
            >
              What kind of moment?
            </h3>
            <div className="mt-6 grid grid-cols-1 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:scale-[0.99] transition"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-cool)",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{k.glyph}</span>
                  <span className="font-display text-cream" style={{ fontSize: 16 }}>
                    {k.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {kind && (
          <>
            <h3
              className="font-display italic text-cream mt-2"
              style={{ fontSize: 22, lineHeight: 1.2 }}
            >
              Say something.
            </h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A few words…"
              rows={3}
              className="mt-4 w-full rounded-2xl p-4 font-display text-cream bg-transparent outline-none resize-none"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-cool)",
                fontSize: 15,
                lineHeight: 1.5,
              }}
            />

            <p className="label-caps mt-6 mb-3">tag your people</p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {seated.map((f) => {
                const on = tagged.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggle(f.id)}
                    className="flex flex-col items-center shrink-0 active:scale-95 transition"
                    style={{ width: 60 }}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        padding: 2,
                        background: on ? "var(--accent-bronze)" : "transparent",
                        boxShadow: on ? "0 0 16px rgba(111,87,240,0.45)" : "none",
                      }}
                    >
                      <Avatar src={f.avatar} initials={f.initials} color={f.color} size={48} />
                    </div>
                    <span
                      className="font-display italic mt-1.5 text-cool truncate w-full text-center"
                      style={{ fontSize: 11 }}
                    >
                      {f.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-7">
              <button
                onClick={() => setKind(null)}
                className="flex-1 rounded-full py-3 label-caps text-cool"
                style={{ border: "1px solid var(--border-cool)" }}
              >
                back
              </button>
              <button
                onClick={() => onConfirm(kind, tagged, text)}
                disabled={!text.trim() && tagged.length === 0}
                className="flex-1 rounded-full py-3 font-display italic active:scale-[0.99] transition disabled:opacity-40"
                style={{
                  background: "var(--accent-bronze)",
                  color: "var(--bg-primary)",
                  fontSize: 14,
                }}
              >
                Share
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
