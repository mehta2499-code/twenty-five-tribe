/**
 * Scenes (the old Feed): what your 25 are up to. X-style rows: text, photo or
 * video (caption optional), no likes. Text posts get replies, photo and video
 * posts get comments. Tag people with @username, or everyone with @all.
 */
import { Tour } from "@/components/Tour";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/PersonLink";
import { EmptyState, PageBand, Sheet, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { personOf } from "@/components/FeedUI";
import { LazyVideo } from "@/components/LazyVideo";
import { GifPicker, RichBubble, isRich } from "@/components/GifPicker";
import { EditSheet, TagPicker, Tagged, withTag } from "@/components/SceneParts";
import { meView, social, timeAgo, useSocial, type Post } from "@/lib/social";

export const Route = createFileRoute("/app/feed")({
  // ?post=<id>: open that scene (from a notification).
  validateSearch: (s: Record<string, unknown>): { post?: string } =>
    typeof s.post === "string" ? { post: s.post } : {},
  component: clientOnly(Scenes),
});

/** "Reply" on text posts, "Comment" on photo and video posts. */
const word = (p: Post) => (p.text ? "reply" : "comment");

// ---------- One scene ----------
function SceneRow({
  post,
  onOpen,
  onDeleted,
}: {
  post: Post;
  onOpen: () => void;
  onDeleted: () => void;
}) {
  const by = personOf(post.by);
  const s = useSocial();
  const handle = post.by === "me" ? s.me?.username : by.username;
  const [sheet, setSheet] = useState<null | "options" | "edit" | "delete">(null);
  const n = post.comments.length;

  return (
    <article
      className="flex gap-3 px-4 py-3.5"
      style={{ borderBottom: "1px solid var(--line)" }}
      aria-label={`Scene by ${by.name}`}
      data-scene={post.id}
    >
      <PersonLink
        id={post.by}
        username={by.username}
        label={by.name}
        className="inline-flex shrink-0 self-start"
      >
        <Avatar src={by.avatar} initials={by.initials} color={by.color} size={42} />
      </PersonLink>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0" style={{ fontSize: 15 }}>
          <PersonLink id={post.by} username={by.username} className="min-w-0 truncate">
            <span className="font-bold text-cream">{by.name}</span>
          </PersonLink>
          {handle && <span className="meta truncate shrink">@{handle}</span>}
          <span className="meta shrink-0">
            · {timeAgo(post.at)}
            {post.edited ? " · edited" : ""}
          </span>
          {post.by === "me" && (
            <button
              onClick={() => setSheet("options")}
              aria-label="Scene options"
              className="ml-auto w-8 h-8 -mr-1.5 -my-1 rounded-full flex items-center justify-center text-cool hover:bg-[var(--fill)] shrink-0"
            >
              <MoreHorizontal size={18} />
            </button>
          )}
        </div>
        <button
          onClick={onOpen}
          className="block w-full text-left"
          aria-label={`Open ${word(post)}s`}
        >
          {post.caption && (
            <p
              className="text-cream mt-0.5"
              style={{
                fontSize: post.text ? 16 : 15,
                lineHeight: 1.42,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              <Tagged text={post.caption} />
            </p>
          )}
        </button>
        {!post.text && (
          <div
            className="mt-2.5 rounded-2xl overflow-hidden select-none"
            style={{ border: "1px solid var(--line)", background: "var(--fill)" }}
          >
            {post.video ? (
              <LazyVideo
                src={post.video}
                label={`Video from ${by.name}`}
                className="w-full aspect-[4/5]"
              />
            ) : post.image ? (
              <button onClick={onOpen} className="block w-full" aria-label={`Open ${word(post)}s`}>
                <img
                  src={post.image}
                  alt={post.caption || `Photo from ${by.name}`}
                  loading="lazy"
                  draggable={false}
                  className="w-full max-h-[560px] object-cover"
                />
              </button>
            ) : (
              <div className="w-full aspect-[4/5] skeleton" style={{ borderRadius: 0 }} />
            )}
          </div>
        )}
        <div className="mt-2 -ml-2 flex items-center">
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full meta hover:bg-[var(--fill)]"
            aria-label={`${n} ${word(post)}${n === 1 ? "" : "s"}. ${post.text ? "Reply" : "Comment"}`}
            style={{ fontSize: 13.5 }}
          >
            <MessageCircle size={17} aria-hidden="true" />
            {n > 0 ? n : <span>{post.text ? "Reply" : "Comment"}</span>}
          </button>
        </div>
      </div>
      {sheet === "options" && (
        <Sheet title="Your scene" onClose={() => setSheet(null)}>
          <div className="grid gap-2 pb-1">
            <button onClick={() => setSheet("edit")} className="btn-secondary w-full">
              <Pencil size={18} /> Edit {post.text ? "text" : "caption"}
            </button>
            <button onClick={() => setSheet("delete")} className="btn-danger w-full">
              <Trash2 size={18} /> Delete scene
            </button>
          </div>
        </Sheet>
      )}
      {sheet === "edit" && (
        <EditSheet
          title={post.text ? "Edit scene" : "Edit caption"}
          initial={post.caption}
          allowEmpty={!post.text}
          onSave={(t) => social.editPost(post.id, t)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "delete" && (
        <Sheet title="Delete this scene?" onClose={() => setSheet(null)}>
          <p className="text-cool text-sm">
            It disappears for everyone, along with its {word(post)}s. This can't be undone.
          </p>
          <button
            onClick={() => {
              setSheet(null);
              onDeleted();
              social.deletePost(post.id);
            }}
            className="btn-danger w-full mt-4"
          >
            <Trash2 size={18} /> Delete scene
          </button>
          <button onClick={() => setSheet(null)} className="btn-quiet w-full mt-2">
            Keep it
          </button>
        </Sheet>
      )}
    </article>
  );
}

// ---------- Thread: replies / comments on a scene ----------
function Thread({ post, onClose }: { post: Post; onClose: () => void }) {
  const me = meView();
  const [text, setText] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLInputElement>(null);
  const label = post.text ? "Reply" : "Comment";
  const mine = post.by === "me";
  const send = () => {
    const t = text.trim();
    if (!t) return;
    buzz(8);
    social.comment("post", post.id, t);
    setText("");
  };
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [post.comments.length]);
  const menuC = post.comments.find((c) => c.id === menuFor);
  const editC = post.comments.find((c) => c.id === editing);

  return (
    <>
      <Sheet title={post.text ? "Replies" : "Comments"} onClose={onClose}>
        <div ref={listRef} className="max-h-[52dvh] overflow-y-auto -mx-1 px-1" data-noswipe>
          {post.comments.length === 0 ? (
            <p className="meta text-center py-8">
              No {word(post)}s yet. Say something. Only your 25 can read it.
            </p>
          ) : (
            <ul>
              {post.comments.map((c) => {
                const p = personOf(c.by);
                // Your own: edit or delete. On your scene: you can delete anyone's.
                const canMenu = c.by === "me" || mine;
                return (
                  <li
                    key={c.id}
                    className="flex gap-3 py-3"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <PersonLink
                      id={c.by}
                      username={p.username}
                      label={p.name}
                      className="inline-flex shrink-0 self-start"
                    >
                      <Avatar src={p.avatar} initials={p.initials} color={p.color} size={34} />
                    </PersonLink>
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: 14 }}>
                        <span className="font-bold text-cream">{p.name}</span>{" "}
                        <span className="meta">
                          · {timeAgo(c.at)}
                          {c.edited ? " · edited" : ""}
                        </span>
                      </p>
                      <p
                        className="text-cream"
                        style={{
                          fontSize: 15,
                          lineHeight: 1.42,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {isRich(c.text) ? <RichBubble value={c.text} /> : <Tagged text={c.text} />}
                      </p>
                    </div>
                    {canMenu && (
                      <button
                        onClick={() => setMenuFor(c.id)}
                        aria-label={`Options for this ${word(post)}`}
                        className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-cool hover:bg-[var(--fill)] shrink-0 self-start"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="mt-3">
          <TagPicker
            text={text}
            onPick={(h) => {
              setText((t) => withTag(t, h));
              boxRef.current?.focus();
            }}
          />
        </div>
        {/* Composer: your photo, a rounded box, and a clear pill button. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2.5 pt-3"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <Avatar src={me.avatar} initials={me.initials} size={34} />
          <button
            type="button"
            onClick={() => setGifOpen(true)}
            aria-label="Send a GIF"
            className="w-9 h-9 -mx-1 shrink-0 rounded-full flex items-center justify-center hover:bg-[var(--fill)]"
            style={{ color: "var(--lime)" }}
          >
            <span
              className="rounded-md px-1 font-extrabold"
              style={{ fontSize: 10.5, border: "1.5px solid currentColor", lineHeight: "15px" }}
            >
              GIF
            </span>
          </button>
          <label htmlFor="thread-input" className="sr-only">
            {label}
          </label>
          <input
            id="thread-input"
            ref={boxRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder={post.text ? "Post your reply" : "Add a comment"}
            className="flex-1 min-w-0 rounded-full px-4 outline-none"
            style={{
              minHeight: 42,
              fontSize: 15,
              background: "var(--fill)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            }}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="shrink-0 rounded-full px-4 font-bold transition-opacity disabled:opacity-40"
            style={{
              minHeight: 38,
              fontSize: 14,
              background: "var(--lime)",
              color: "var(--on-accent)",
            }}
          >
            {label}
          </button>
        </form>
      </Sheet>
      {menuC && (
        <Sheet title={`Your ${word(post)}`} onClose={() => setMenuFor(null)}>
          <div className="grid gap-2 pb-1">
            {menuC.by === "me" && !isRich(menuC.text) && (
              <button
                onClick={() => {
                  setMenuFor(null);
                  setEditing(menuC.id);
                }}
                className="btn-secondary w-full"
              >
                <Pencil size={18} /> Edit {word(post)}
              </button>
            )}
            <button
              onClick={() => {
                setMenuFor(null);
                social.deleteComment(post.id, menuC.id);
              }}
              className="btn-danger w-full"
            >
              <Trash2 size={18} /> Delete {word(post)}
            </button>
          </div>
        </Sheet>
      )}
      {editC && (
        <EditSheet
          title={`Edit ${word(post)}`}
          initial={editC.text}
          allowEmpty={false}
          onSave={(t) => social.editComment(post.id, editC.id, t)}
          onClose={() => setEditing(null)}
        />
      )}
      {gifOpen && (
        <GifPicker
          gifsOnly
          onClose={() => setGifOpen(false)}
          onPick={(ref) => {
            setGifOpen(false);
            buzz(8);
            social.comment("post", post.id, ref);
          }}
        />
      )}
    </>
  );
}

// ---------- Page ----------
function Scenes() {
  const s = useSocial();
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(() => {
    try {
      if (sessionStorage.getItem("tf.scene.posted")) {
        sessionStorage.removeItem("tf.scene.posted");
        return "Posted. Your 25 can see it now.";
      }
    } catch {
      // ignore
    }
    return null;
  });
  const open = s.posts.find((p) => p.id === openId);
  // Is the title bar (with its + button) scrolled out of view?
  const bandRef = useRef<HTMLDivElement>(null);
  const [bandGone, setBandGone] = useState(false);
  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBandGone(!e.isIntersecting), {
      rootMargin: "-40px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // From a notification (?post=<id>): show that scene and open its thread.
  const { post: wanted } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!wanted || !s.posts.some((p) => p.id === wanted)) return;
    document
      .querySelector(`[data-scene="${wanted}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
    setOpenId(wanted);
    void navigate({ to: "/app/feed", search: {}, replace: true });
  }, [wanted, s.posts, navigate]);

  return (
    <>
      <Tour
        id="feed"
        steps={[
          {
            at: 'button[aria-label="New scene"]',
            title: "Scenes: for your 25 only",
            body: "Post a thought, a photo or a video. Tag people with @, or everyone with @all. Only the people at your Table see it.",
          },
          {
            at: 'nav[aria-label="Main"]',
            title: "Swipe or tap",
            body: "Swipe left and right to move between Table, Scenes, the Drop, Chats and Games.",
          },
        ]}
      />
      <div ref={bandRef}>
        <PageBand
          ring
          title="Scenes"
          sub="What your 25 are up to. Nobody else sees it."
          actions={
            <button
              onClick={() => navigate({ to: "/app/scenes/new" })}
              className="lg w-12 h-12 rounded-full flex items-center justify-center"
              style={{ color: "#fff" }}
              aria-label="New scene"
            >
              <Plus size={24} strokeWidth={2.4} />
            </button>
          }
        />
      </div>
      {/* Scrolled past the title bar: just a small glass + floats at the top. */}
      <button
        onClick={() => navigate({ to: "/app/scenes/new" })}
        aria-label="New scene"
        tabIndex={bandGone ? 0 : -1}
        aria-hidden={!bandGone}
        className="lg fixed z-30 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          top: "max(12px, calc(env(safe-area-inset-top) + 8px))",
          right: "max(16px, calc(50vw - 224px + 16px))",
          color: "#fff",
          background: "rgba(10,10,14,0.35)",
          opacity: bandGone ? 1 : 0,
          transform: bandGone ? "scale(1)" : "scale(0.8)",
          pointerEvents: bandGone ? "auto" : "none",
        }}
      >
        <Plus size={24} strokeWidth={2.4} />
      </button>

      {s.loading ? (
        <div aria-busy="true" aria-label="Loading scenes">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-3 px-4 py-3.5">
              <span className="skeleton w-[42px] h-[42px] shrink-0" style={{ borderRadius: 999 }} />
              <div className="flex-1 grid gap-2">
                <span className="skeleton h-3.5 w-1/3" />
                <span className="skeleton h-3 w-4/5" />
                <span className="skeleton w-full aspect-[4/5] rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : s.posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No scenes yet"
          body="Share what's happening: a thought, a photo or a video. Only your 25 see it."
          action={
            <button
              onClick={() => navigate({ to: "/app/scenes/new" })}
              className="btn-primary px-5"
            >
              <Plus size={18} /> Share the first scene
            </button>
          }
        />
      ) : (
        <>
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {s.posts.map((p) => (
              <SceneRow
                key={p.id}
                post={p}
                onOpen={() => setOpenId(p.id)}
                onDeleted={() => setToast("Scene deleted.")}
              />
            ))}
          </div>
          <p className="text-center meta mt-8 mb-2 px-8">You're all caught up.</p>
        </>
      )}

      {open && <Thread post={open} onClose={() => setOpenId(null)} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
