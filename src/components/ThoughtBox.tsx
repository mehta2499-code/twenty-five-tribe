/** Top of the Feed: today's thought from you and your 25. */
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { personOf } from "@/components/FeedUI";
import { buzz } from "@/components/SocialUI";
import { timeAgo } from "@/lib/social";
import { useThoughts } from "@/lib/thoughts";

const PROMPTS = [
  "What's on your mind today?",
  "Today's thought, unfiltered…",
  "Say it. Only your 25 will see.",
];

export function ThoughtBox() {
  const { list, save, remove } = useThoughts();
  const mine = list?.find((t) => t.id === "me");
  const others = (list ?? []).filter((t) => t.id !== "me");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const writing = !mine || editing;
  const me = personOf("me");

  const submit = async () => {
    if (!text.trim()) return;
    buzz(10);
    setErr(null);
    try {
      await save(text);
      setEditing(false);
      setText("");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className="mx-4 mb-5">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="label-caps">Thought of the day</p>
          <p className="meta" style={{ fontSize: 12 }}>
            Only your 25 · gone at midnight
          </p>
        </div>

        {writing ? (
          <form
            className="mt-3 flex items-start gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Avatar src={me.avatar} initials={me.initials} size={38} />
            <div className="flex-1 min-w-0">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 200))}
                placeholder={prompt}
                rows={2}
                className="input w-full resize-none"
                style={{ minHeight: 64, paddingTop: 10, fontSize: 15 }}
                aria-label="Your thought of the day"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="meta tabular-nums" style={{ fontSize: 12 }}>
                  {text.length}/200
                </span>
                <span className="flex gap-2">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="btn-quiet px-3 min-h-[38px] text-sm"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="btn-primary px-4 min-h-[38px] text-sm"
                  >
                    {editing ? "Update" : "Share"}
                  </button>
                </span>
              </div>
              {err && (
                <p className="text-sm mt-1" style={{ color: "var(--pink)" }}>
                  {err}
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-3 flex items-start gap-3">
            <Avatar src={me.avatar} initials={me.initials} size={38} />
            <div className="flex-1 min-w-0">
              <p className="text-cream" style={{ fontSize: 16, lineHeight: 1.45 }}>
                “{mine!.body}”
              </p>
              <p className="meta mt-1" style={{ fontSize: 12 }}>
                You · {timeAgo(mine!.at)}
              </p>
            </div>
            <button
              onClick={() => {
                setText(mine!.body);
                setEditing(true);
              }}
              aria-label="Edit your thought"
              className="w-9 h-9 rounded-full flex items-center justify-center text-cool"
            >
              <Pencil size={17} />
            </button>
            <button
              onClick={() => void remove()}
              aria-label="Delete your thought"
              className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-cool"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}

        {others.length > 0 && (
          <ul className="mt-4 grid gap-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
            {others.map((t) => {
              const p = personOf(t.id);
              return (
                <li key={t.id} className="flex items-start gap-3">
                  <Avatar src={p.avatar} initials={p.initials} color={p.color} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-cream" style={{ fontSize: 15, lineHeight: 1.45 }}>
                      “{t.body}”
                    </p>
                    <p className="meta mt-0.5" style={{ fontSize: 12 }}>
                      {p.name.split(" ")[0]} · {timeAgo(t.at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {list && others.length === 0 && mine && (
          <p className="meta mt-3" style={{ fontSize: 13 }}>
            Nobody else has shared one yet today.
          </p>
        )}
      </div>
    </section>
  );
}
