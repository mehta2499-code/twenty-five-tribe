import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Heart, ImagePlus, MessageCircle, Plus, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, Toast, clientOnly } from "@/components/SocialUI";
import { CommentsSheet, FeedTabs, personOf } from "@/components/FeedUI";
import { fileToImage, friendById, social, timeAgo, useSocial, type Post } from "@/lib/social";

export const Route = createFileRoute("/app/feed")({
  component: clientOnly(Feed),
});

function PostCard({
  post,
  onComments,
  onShare,
}: {
  post: Post;
  onComments: () => void;
  onShare: () => void;
}) {
  const by = personOf(post.by);
  const liked = post.likes.includes("me");
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const likers = post.likes
    .filter((x) => x !== "me")
    .map((x) => friendById(x)?.name)
    .filter(Boolean) as string[];

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      social.like("post", post.id);
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  };

  return (
    <article className="pb-2">
      <div className="flex items-center gap-3 px-5 py-3">
        <Avatar src={by.avatar} initials={by.initials} color={by.color} size={36} />
        <span className="font-display text-cream" style={{ fontSize: 15 }}>
          {by.name}
        </span>
        <span className="ml-auto" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {timeAgo(post.at)}
        </span>
      </div>
      <div className="relative select-none" onClick={onTap}>
        <img
          src={post.image}
          alt={post.caption}
          loading="lazy"
          draggable={false}
          className="w-full aspect-square object-cover"
        />
        {burst > 0 && (
          <Heart
            key={burst}
            size={96}
            fill="var(--bg-cream)"
            className="absolute left-1/2 top-1/2 heart-burst"
            style={{ color: "var(--bg-cream)" }}
          />
        )}
      </div>
      <div className="flex items-center gap-5 px-5 pt-3">
        <button
          onClick={() => social.toggleLike("post", post.id)}
          aria-label={liked ? "Unlike" : "Like"}
          className={liked ? "animate-heart-pop" : ""}
        >
          <Heart
            size={24}
            fill={liked ? "var(--accent-oxblood)" : "none"}
            style={{ color: liked ? "var(--accent-oxblood)" : "var(--text-primary)" }}
          />
        </button>
        <button onClick={onComments} aria-label="Comments">
          <MessageCircle size={23} className="text-warm" />
        </button>
        <button onClick={onShare} aria-label="Share to a friend">
          <Send size={22} className="text-warm" />
        </button>
      </div>
      <div className="px-5 pt-2.5 space-y-1">
        {post.likes.length > 0 && (
          <p className="text-cream" style={{ fontSize: 13 }}>
            Liked by <span className="font-semibold">{liked ? "you" : likers[0]}</span>
            {post.likes.length > 1 && (
              <>
                {" "}
                and <span className="font-semibold">{post.likes.length - 1} of your 25</span>
              </>
            )}
          </p>
        )}
        <p className="text-cream" style={{ fontSize: 14, lineHeight: 1.45 }}>
          <span className="font-semibold mr-1.5">{by.name}</span>
          {post.caption}
        </p>
        {post.comments.length > 0 && (
          <button onClick={onComments} style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {post.comments.length === 1
              ? "View 1 comment"
              : `View all ${post.comments.length} comments`}
          </button>
        )}
      </div>
    </article>
  );
}

function NewPostSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="new post" onClose={onClose}>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
        style={{
          border: image ? "none" : "1px dashed rgba(196,149,96,0.4)",
          background: "var(--bg-surface)",
        }}
      >
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-cool">
            <ImagePlus size={28} />
            <span className="font-display italic" style={{ fontSize: 14 }}>
              Choose a photo
            </span>
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            setImage(await fileToImage(f));
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && (
        <p className="mt-2" style={{ color: "var(--accent-ember)", fontSize: 13 }}>
          {error}
        </p>
      )}
      <textarea
        id="post-caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 280))}
        placeholder="Write a caption…"
        rows={2}
        className="mt-4 w-full rounded-2xl p-4 text-cream outline-none resize-none"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-cool)",
          fontSize: 15,
        }}
      />
      <p className="text-right tabular-nums" style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {caption.length}/280
      </p>
      <button
        disabled={!image}
        onClick={() => {
          social.addPost(image!, caption);
          onDone();
        }}
        className="mt-4 w-full rounded-full py-3.5 font-display italic disabled:opacity-40"
        style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)", fontSize: 15 }}
      >
        Share with your 25
      </button>
    </Sheet>
  );
}

function Feed() {
  const s = useSocial();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const open = s.posts.find((p) => p.id === commentsFor);

  return (
    <>
      <header className="px-6 pt-12 pb-6 text-center">
        <p className="label-caps">feed</p>
        <h1
          className="font-display italic text-cream mt-4 mb-6"
          style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em" }}
        >
          Just your people.
        </h1>
        <FeedTabs active="posts" />
      </header>

      <div className="space-y-6">
        {s.posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onComments={() => setCommentsFor(p.id)}
            onShare={() => setShareFor(p.id)}
          />
        ))}
      </div>

      <p
        className="text-center font-display italic mt-12 mb-4 px-8"
        style={{ color: "var(--text-muted)", fontSize: 12 }}
      >
        You're all caught up. That's the whole feed.
      </p>

      <button
        onClick={() => setCreating(true)}
        aria-label="New post"
        className="fixed z-30 active:scale-95 transition flex items-center gap-2 rounded-full pl-4 pr-5 py-3"
        style={{
          right: "max(1.25rem, calc(50% - 13rem))",
          bottom: "6.5rem",
          background: "var(--accent-bronze)",
          color: "var(--bg-primary)",
          boxShadow: "0 10px 30px rgba(216,123,60,0.45)",
        }}
      >
        <Plus size={18} strokeWidth={2.4} />
        <span className="font-display italic" style={{ fontSize: 13 }}>
          Post
        </span>
      </button>

      {open && (
        <CommentsSheet
          kind="post"
          id={open.id}
          comments={open.comments}
          onClose={() => setCommentsFor(null)}
        />
      )}
      {shareFor && (
        <FriendPicker
          title="share with"
          cta="Send"
          onClose={() => setShareFor(null)}
          onPick={(ids) => {
            social.share(shareFor, ids, "post");
            setShareFor(null);
            setToast(`Shared with ${ids.length}`);
          }}
        />
      )}
      {creating && (
        <NewPostSheet
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            setToast("Posted. Your 25 can see it.");
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
