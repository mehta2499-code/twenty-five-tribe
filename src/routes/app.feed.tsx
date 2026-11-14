import { Tour } from "@/components/Tour";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  LayoutGrid,
  MessageSquareQuote,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/PersonLink";
import {
  AudienceNote,
  EmptyState,
  PageBand,
  Sheet,
  Toast,
  buzz,
  clientOnly,
} from "@/components/SocialUI";
import { CommentsSheet, personOf } from "@/components/FeedUI";
import { ThoughtBox } from "@/components/ThoughtBox";
import { WaffleMenu } from "@/components/WaffleMenu";
import { firstFrame } from "@/components/ChatExtras";
import { fileToImage, social, timeAgo, useSocial, type Post } from "@/lib/social";

const MAX_VIDEO_MB = 50;

export const Route = createFileRoute("/app/feed")({
  component: clientOnly(Feed),
});

function PostCard({
  post,
  onComments,
  onDeleted,
}: {
  post: Post;
  onComments: () => void;
  onDeleted: () => void;
}) {
  const by = personOf(post.by);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // No likes, no sharing: real friends just comment.
  const [text, setText] = useState("");
  const send = () => {
    const t = text.trim();
    if (!t) return;
    buzz(8);
    social.comment("post", post.id, t);
    setText("");
  };
  const latest = post.comments.slice(-2);

  return (
    <article className="py-3" aria-label={`Post by ${by.name}`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <PersonLink id={post.by} username={by.username} className="flex items-center gap-3 min-w-0">
          <Avatar src={by.avatar} initials={by.initials} color={by.color} size={36} />
          <span className="font-semibold text-cream truncate" style={{ fontSize: 15 }}>
            {by.name}
          </span>
        </PersonLink>
        <time className="ml-auto meta" style={{ fontSize: 13 }}>
          {timeAgo(post.at)}
        </time>
        {post.by === "me" && (
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Post options"
            className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-cool hover:bg-[var(--fill)]"
          >
            <MoreHorizontal size={20} />
          </button>
        )}
      </header>
      {confirmDelete && (
        <Sheet title="Delete this post?" onClose={() => setConfirmDelete(false)}>
          <p className="text-cool text-sm">
            It disappears for everyone, along with its comments. This can't be undone.
          </p>
          <button
            onClick={() => {
              setConfirmDelete(false);
              onDeleted();
              social.deletePost(post.id);
            }}
            className="btn-danger w-full mt-4"
          >
            <Trash2 size={18} /> Delete post
          </button>
          <button onClick={() => setConfirmDelete(false)} className="btn-quiet w-full mt-2">
            Keep it
          </button>
        </Sheet>
      )}
      <div className="relative select-none">
        {post.video ? (
          <video
            src={firstFrame(post.video)}
            controls
            playsInline
            loop
            preload="metadata"
            className="w-full aspect-[4/5] object-cover"
            style={{ background: "#000" }}
          />
        ) : post.image ? (
          <img
            src={post.image}
            alt={post.caption || `Photo from ${by.name}`}
            loading="lazy"
            draggable={false}
            className="w-full aspect-[4/5] object-cover"
            style={{ background: "var(--fill)" }}
          />
        ) : (
          <div className="w-full aspect-[4/5] skeleton" style={{ borderRadius: 0 }} />
        )}
      </div>
      <div className="px-4 pt-3 pb-2 grid gap-1.5">
        {post.caption && (
          <p className="text-cream" style={{ fontSize: 15, lineHeight: 1.45 }}>
            <span className="font-semibold mr-1.5">{by.name}</span>
            {post.caption}
          </p>
        )}
        {post.comments.length > 2 && (
          <button onClick={onComments} className="text-left meta" style={{ fontSize: 14 }}>
            View all {post.comments.length} comments
          </button>
        )}
        {latest.map((c) => (
          <button
            key={c.id}
            onClick={onComments}
            className="text-left text-cream"
            style={{ fontSize: 14.5, lineHeight: 1.4 }}
          >
            <span className="font-semibold mr-1.5">{personOf(c.by).name.split(" ")[0]}</span>
            {c.text}
          </button>
        ))}
        <form
          className="mt-1 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder={
              post.by === "me"
                ? "Reply to your friends…"
                : `Say something to ${by.name.split(" ")[0]}…`
            }
            aria-label="Write a comment"
            className="input flex-1"
            style={{ minHeight: 42, borderRadius: 999, fontSize: 14.5 }}
            enterKeyHint="send"
          />
          {text.trim() && (
            <button type="submit" className="btn-primary px-4" style={{ minHeight: 42 }}>
              Post
            </button>
          )}
        </form>
      </div>
    </article>
  );
}

function NewPostSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="New post" onClose={onClose}>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full aspect-[4/5] rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ border: image ? "none" : "1.5px dashed var(--line-2)", background: "var(--fill)" }}
        aria-label={image || video ? "Change photo or video" : "Choose a photo or video"}
      >
        {video ? (
          <video
            preload="metadata"
            src={video.url}
            muted
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : image ? (
          <img
            loading="lazy"
            decoding="async"
            src={image}
            alt="Your photo"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-cool">
            <ImagePlus size={28} aria-hidden="true" />
            <span className="font-semibold" style={{ fontSize: 15 }}>
              Choose a photo or video
            </span>
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.type.startsWith("video/")) {
              if (f.size > MAX_VIDEO_MB * 1024 * 1024)
                throw new Error(
                  `Videos can be up to ${MAX_VIDEO_MB} MB. Trim it a bit and try again.`,
                );
              setImage(null);
              setVideo({ file: f, url: URL.createObjectURL(f) });
            } else {
              setVideo(null);
              setImage(await fileToImage(f));
            }
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--coral-deep)" }} role="alert">
          {error}
        </p>
      )}
      <label htmlFor="post-caption" className="sr-only">
        Caption
      </label>
      <textarea
        id="post-caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 280))}
        placeholder="Write a caption"
        rows={2}
        className="input mt-4 resize-none"
      />
      <p className="text-right tabular-nums meta mt-1" style={{ fontSize: 12 }}>
        {caption.length}/280
      </p>
      <button
        disabled={!image && !video}
        onClick={() => {
          social.addPost(image ?? "", caption, video?.file);
          onDone();
        }}
        className="btn-primary w-full mt-3"
      >
        Share with your 25
      </button>
      <div className="mt-3">
        <AudienceNote>Only people in your 25 will see this.</AudienceNote>
      </div>
    </Sheet>
  );
}

function Feed() {
  const s = useSocial();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Posts | Thoughts tabs (remembered for this visit).
  const [tab, setTab] = useState<"posts" | "thoughts">(() => {
    try {
      return sessionStorage.getItem("tf.feed.tab") === "thoughts" ? "thoughts" : "posts";
    } catch {
      return "posts";
    }
  });
  const pickTab = (t: "posts" | "thoughts") => {
    setTab(t);
    try {
      sessionStorage.setItem("tf.feed.tab", t);
    } catch {
      // ignore
    }
  };
  const [thinkKey, setThinkKey] = useState(0);
  const [plus, setPlus] = useState<DOMRect | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const open = s.posts.find((p) => p.id === commentsFor);

  return (
    <>
      <Tour
        id="feed"
        steps={[
          {
            at: 'button[aria-label="New post or thought"]',
            title: "Post to your 25 only",
            body: "Photos and videos go to the people at your Table, nobody else. The feed ends when you're caught up.",
          },
          {
            at: 'nav[aria-label="Main"]',
            title: "Swipe or tap",
            body: "Swipe left and right to move between Table, Feed, the Drop, Chats and Games.",
          },
        ]}
      />
      <PageBand
        ring
        title="Feed"
        sub="Posts from your 25. Nobody else sees them."
        actions={
          <button
            onClick={(e) => setPlus((e.currentTarget as HTMLElement).getBoundingClientRect())}
            className="btn-primary w-12 h-12 !p-0 rounded-full"
            aria-label="New post or thought"
            aria-haspopup="menu"
          >
            <Plus size={24} strokeWidth={2.6} />
          </button>
        }
      >
        <div className="segmented segmented-sm w-full mt-3" role="tablist" aria-label="Feed">
          <button
            className="flex-1"
            role="tab"
            aria-pressed={tab === "posts"}
            onClick={() => pickTab("posts")}
          >
            Posts
          </button>
          <button
            className="flex-1"
            role="tab"
            aria-pressed={tab === "thoughts"}
            onClick={() => pickTab("thoughts")}
          >
            Thoughts
          </button>
        </div>
      </PageBand>

      {tab === "thoughts" ? <ThoughtBox focusKey={thinkKey} /> : null}
      {tab === "thoughts" ? null : s.loading ? (
        <div aria-busy="true" aria-label="Loading posts">
          {/* Same shape as a post: full-bleed 4:5 media, padded header and text. */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="skeleton w-9 h-9" style={{ borderRadius: 999 }} />
            <span className="skeleton h-3.5 w-1/3" />
          </div>
          <div className="skeleton w-full aspect-[4/5]" style={{ borderRadius: 0 }} />
          <div className="px-4 py-3 grid gap-2">
            <span className="skeleton h-3.5 w-1/2" />
            <span className="skeleton h-3 w-4/5" />
          </div>
        </div>
      ) : s.posts.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No posts yet"
          body="When you or your 25 share a photo or video, it shows up here."
          action={
            <button onClick={() => setCreating(true)} className="btn-primary px-5">
              <Plus size={18} /> Share the first post
            </button>
          }
        />
      ) : (
        <>
          {/* Full-bleed posts, separated by space and a hairline (no cards). */}
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {s.posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onComments={() => setCommentsFor(p.id)}
                onDeleted={() => setToast("Post deleted.")}
              />
            ))}
          </div>
          <p className="text-center meta mt-8 mb-2 px-8">You're all caught up.</p>
        </>
      )}

      {open && (
        <CommentsSheet
          kind="post"
          id={open.id}
          comments={open.comments}
          onClose={() => setCommentsFor(null)}
        />
      )}
      {plus && (
        <WaffleMenu
          anchor={plus}
          label="Create"
          onClose={() => setPlus(null)}
          items={[
            {
              key: "post",
              icon: <Camera size={20} />,
              label: "Post",
              hint: "Photo or video",
              onSelect: () => {
                setPlus(null);
                setCreating(true);
              },
            },
            {
              key: "thought",
              icon: <MessageSquareQuote size={20} />,
              label: "Thought",
              hint: "Gone at midnight",
              onSelect: () => {
                setPlus(null);
                pickTab("thoughts");
                setThinkKey((k) => k + 1);
              },
            },
          ]}
        />
      )}
      {creating && (
        <NewPostSheet
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            setToast("Posted. Your 25 can see it now.");
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
