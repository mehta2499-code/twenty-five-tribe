import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AudienceNote, EmptyState, Sheet } from "@/components/SocialUI";
import { friendById, meView, social, timeAgo, type Comment } from "@/lib/social";

export function personOf(id: string) {
  if (id === "me") {
    const me = meView();
    return {
      name: "You",
      avatar: me.avatar,
      initials: me.initials,
      color: undefined as string | undefined,
    };
  }
  const f = friendById(id);
  return {
    name: f?.name ?? "Someone",
    avatar: f?.avatar || undefined,
    initials: f?.initials ?? "?",
    color: f?.color,
  };
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
    <Sheet title="Comments" onClose={onClose}>
      {comments.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No comments yet"
          body="Say something nice. Only your 25 can read it."
        />
      ) : (
        <ul className="grid gap-4 pb-2">
          {comments.map((c) => {
            const p = personOf(c.by);
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar src={p.avatar} initials={p.initials} color={p.color} size={34} />
                <div className="min-w-0">
                  <p
                    className="text-cream"
                    style={{ fontSize: 15, lineHeight: 1.45, overflowWrap: "anywhere" }}
                  >
                    <span className="font-semibold mr-1.5">{p.name}</span>
                    {c.text}
                  </p>
                  <p className="meta" style={{ fontSize: 12 }}>
                    {timeAgo(c.at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          social.comment(kind, id, text);
          setText("");
        }}
        className="flex gap-2 mt-4 sticky bottom-0 py-2"
        style={{ background: "var(--surface)" }}
      >
        <label htmlFor="comment-input" className="sr-only">
          Add a comment
        </label>
        <input
          id="comment-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment"
          className="input flex-1"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Post comment"
          className="btn-primary btn-icon"
        >
          <Send size={18} />
        </button>
      </form>
      {comments.length > 0 && <AudienceNote>Only your 25 can see comments.</AudienceNote>}
    </Sheet>
  );
}
