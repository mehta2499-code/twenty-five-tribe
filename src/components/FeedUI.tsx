import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/SocialUI";
import { ME } from "@/lib/data";
import { friendById, social, timeAgo, type Comment } from "@/lib/social";

export function personOf(id: string) {
  if (id === "me")
    return {
      name: "You",
      avatar: ME.avatar,
      initials: ME.initials,
      color: undefined as string | undefined,
    };
  const f = friendById(id);
  return {
    name: f?.name ?? "Someone",
    avatar: f?.avatar,
    initials: f?.initials ?? "?",
    color: f?.color,
  };
}

export function FeedTabs({ active }: { active: "posts" | "reels" }) {
  const tab = (on: boolean) => ({
    fontSize: 14,
    fontWeight: 700,
    color: on ? "#fff" : "var(--blue-deep)",
    background: on ? "var(--blue-deep)" : "transparent",
    transition: "background-color 260ms var(--spring), color 200ms",
  });
  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{ background: "#fff", boxShadow: "var(--shadow-card)" }}
    >
      <Link to="/app/feed" className="rounded-full px-5 py-1.5" style={tab(active === "posts")}>
        Posts
      </Link>
      <Link to="/app/reels" className="rounded-full px-5 py-1.5" style={tab(active === "reels")}>
        Reels
      </Link>
    </div>
  );
}

export function CommentsSheet({
  kind,
  id,
  comments,
  onClose,
}: {
  kind: "post" | "reel";
  id: string;
  comments: Comment[];
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <Sheet title="comments · your 25 only" onClose={onClose}>
      {comments.length === 0 && (
        <p
          className="font-display italic text-center py-6"
          style={{ color: "var(--text-muted)", fontSize: 14 }}
        >
          No comments yet. Be the first.
        </p>
      )}
      <ul className="space-y-4">
        {comments.map((c) => {
          const p = personOf(c.by);
          return (
            <li key={c.id} className="flex gap-3">
              <Avatar src={p.avatar} initials={p.initials} color={p.color} size={32} />
              <div className="min-w-0">
                <p
                  style={{ fontSize: 14, lineHeight: 1.45, overflowWrap: "anywhere" }}
                  className="text-cream"
                >
                  <span className="font-semibold mr-1.5">{p.name}</span>
                  {c.text}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(c.at)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          social.comment(kind, id, text);
          setText("");
        }}
        className="flex gap-2 mt-6"
      >
        <input
          id="comment-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment"
          className="flex-1 rounded-full px-4 py-3 outline-none text-cream"
          autoComplete="off"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-cool)",
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-full px-4 font-display italic disabled:opacity-40"
          style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)", fontSize: 14 }}
        >
          Post
        </button>
      </form>
    </Sheet>
  );
}
