import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Heart,
  ImagePlus,
  LayoutGrid,
  MessageCircle,
  Plus,
  Send,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  AudienceNote,
  EmptyState,
  FriendPicker,
  PageBand,
  Sheet,
  Toast,
  buzz,
  clientOnly,
} from "@/components/SocialUI";
import { CommentsSheet, personOf } from "@/components/FeedUI";
import { firstFrame } from "@/components/ChatExtras";
import { fileToImage, friendById, social, timeAgo, useSocial, type Post } from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";

const MAX_VIDEO_MB = 50;

export const Route = createFileRoute("/app/feed")({
  component: clientOnly(Feed),
});

function PostCard({
  post,
  onComments,
  onShare,
  onDeleted,
}: {
  post: Post;
  onComments: () => void;
  onShare: () => void;
  onDeleted: () => void;
}) {
  const by = personOf(post.by);
  const liked = post.likes.includes("me");
  const [burst, setBurst] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastTap = useRef(0);
  const [showLikers, setShowLikers] = useState(false);
  const likers = post.likes.filter((x) => x !== "me").map((x) => personOf(x).name.split(" ")[0]);

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      social.like("post", post.id);
      buzz();
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  };

  let likedBy = "";
  if (post.likes.length) {
    const first = liked ? "you" : likers[0];
    const others = post.likes.length - 1;
    likedBy =
      others > 0
        ? `Liked by ${first} and ${others} other${others > 1 ? "s" : ""}`
        : `Liked by ${first}`;
  }

  return (
    <article className="card overflow-hidden mx-4" aria-label={`Post by ${by.name}`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar src={by.avatar} initials={by.initials} color={by.color} size={36} />
        <span className="font-semibold text-cream" style={{ fontSize: 15 }}>
          {by.name}
        </span>
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
            It disappears for everyone, along with its likes and comments. This can't be undone.
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
      <div className="relative select-none" onClick={onTap}>
        {post.video ? (
          <video
            src={firstFrame(post.video)}
            controls
            playsInline
            loop
            preload="metadata"
            className="w-full aspect-square object-cover"
            style={{ background: "#000" }}
          />
        ) : post.image ? (
          <img
            src={post.image}
            alt={post.caption || `Photo from ${by.name}`}
            loading="lazy"
            draggable={false}
            className="w-full aspect-square object-cover"
            style={{ background: "var(--fill)" }}
          />
        ) : (
          <div className="w-full aspect-square skeleton" style={{ borderRadius: 0 }} />
        )}
        {burst > 0 && (
          <Heart
            key={burst}
            size={92}
            fill="#fff"
            className="absolute left-1/2 top-1/2 heart-burst"
            style={{ color: "#fff" }}
          />
        )}
      </div>
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <button
          onClick={() => social.toggleLike("post", post.id)}
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          className={`w-11 h-11 rounded-full flex items-center justify-center ${liked ? "animate-heart-pop" : ""}`}
        >
          <Heart
            size={24}
            fill={liked ? "var(--coral-deep)" : "none"}
            style={{ color: liked ? "var(--coral-deep)" : "var(--ink)" }}
          />
        </button>
        <button
          onClick={onComments}
          aria-label="Comments"
          className="w-11 h-11 rounded-full flex items-center justify-center text-cream"
        >
          <MessageCircle size={23} />
        </button>
        <button
          onClick={onShare}
          aria-label="Send to someone in your 25"
          className="w-11 h-11 rounded-full flex items-center justify-center text-cream"
        >
          <Send size={22} />
        </button>
      </div>
      <div className="px-4 pb-4 grid gap-1">
        {likedBy && (
          <button
            onClick={() => setShowLikers(true)}
            className="text-left text-cream font-semibold"
            style={{ fontSize: 14 }}
          >
            {likedBy}
          </button>
        )}
        {showLikers && (
          <Sheet title={`Likes · ${post.likes.length}`} onClose={() => setShowLikers(false)}>
            <ul className="grid gap-3 pb-2">
              {post.likes.map((id) => {
                const p = personOf(id);
                return (
                  <li key={id} className="flex items-center gap-3">
                    <Avatar src={p.avatar} initials={p.initials} color={p.color} size={40} />
                    <span className="flex-1 font-semibold text-cream">{p.name}</span>
                    <Heart size={16} fill="var(--coral-deep)" style={{ color: "var(--coral-deep)" }} />
                  </li>
                );
              })}
            </ul>
          </Sheet>
        )}
        {post.caption && (
          <p className="text-cream" style={{ fontSize: 15, lineHeight: 1.45 }}>
            <span className="font-semibold mr-1.5">{by.name}</span>
            {post.caption}
          </p>
        )}
        {post.comments.length > 0 && (
          <button onClick={onComments} className="text-left meta" style={{ fontSize: 14 }}>
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
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="New post" onClose={onClose}>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ border: image ? "none" : "1.5px dashed var(--line-2)", background: "var(--fill)" }}
        aria-label={image || video ? "Change photo or video" : "Choose a photo or video"}
      >
        {video ? (
          <video
            src={video.url}
            muted
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : image ? (
          <img src={image} alt="Your photo" className="w-full h-full object-cover" />
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
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [shareTo, setShareTo] = useState<string[] | undefined>(undefined);
  const startShare = async (post: Post) => {
    setShareTo(undefined);
    if (s.mode === "live" && s.me) {
      // Only people who can also see this author's posts.
      const author = post.by === "me" ? s.me.id : post.by;
      const { data } = await supabase.rpc("share_targets", { p_author: author });
      setShareTo(((data ?? []) as string[]).filter(Boolean));
    }
    setShareFor(post.id);
  };
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const open = s.posts.find((p) => p.id === commentsFor);

  return (
    <>
      <PageBand
        title="Feed"
        sub="Posts from your 25. Nobody else sees them."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="btn-primary px-4"
            aria-label="New post"
          >
            <Plus size={18} /> Post
          </button>
        }
      ></PageBand>

      {s.loading ? (
        <div className="mx-4 card overflow-hidden" aria-busy="true" aria-label="Loading posts">
          <div className="flex items-center gap-3 p-4">
            <span className="skeleton w-9 h-9" style={{ borderRadius: 999 }} />
            <span className="skeleton h-3.5 w-1/3" />
          </div>
          <div className="skeleton w-full aspect-square" style={{ borderRadius: 0 }} />
          <div className="p-4 grid gap-2">
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
          <div className="grid gap-4">
            {s.posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onComments={() => setCommentsFor(p.id)}
                onShare={() => void startShare(p)}
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
      {shareFor && (
        <FriendPicker
          title="Send to"
          cta="Send"
          note="Only people who can see this post are listed."
          only={shareTo}
          onClose={() => setShareFor(null)}
          onPick={(ids) => {
            social.share(shareFor, ids, "post");
            setShareFor(null);
            setToast(
              ids.length === 1
                ? `Sent to ${friendById(ids[0])?.name.split(" ")[0]}`
                : `Sent to ${ids.length} people`,
            );
          }}
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
