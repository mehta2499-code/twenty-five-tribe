/**
 * Scenes (the old Feed): what your 25 are up to. X-style rows: text, photo or
 * video (caption optional), no likes. Text posts get replies, photo and video
 * posts get comments. Tag people with @username, or everyone with @all.
 */
import { Tour } from "@/components/Tour";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  AtSign,
  ImagePlus,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
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
import { personOf } from "@/components/FeedUI";
import { LazyVideo } from "@/components/LazyVideo";
import { mentionQuery } from "@/lib/groups";
import {
  fileToImage,
  meView,
  social,
  timeAgo,
  useSocial,
  type Person,
  type Post,
} from "@/lib/social";

const MAX_VIDEO_MB = 50;
const MAX_CHARS = 280;

export const Route = createFileRoute("/app/feed")({
  component: clientOnly(Scenes),
});

/** "Reply" on text posts, "Comment" on photo and video posts. */
const word = (p: Post) => (p.text ? "reply" : "comment");

// ---------- Text with @tags ----------
function useHandles() {
  const s = useSocial();
  const map = new Map<string, Person>();
  for (const p of s.people) if (p.username) map.set(p.username.toLowerCase(), p);
  return { map, myHandle: s.me?.username?.toLowerCase() };
}

/** Post text with @tags in lime (tap a tag to open their profile). */
function Tagged({ text }: { text: string }) {
  const { map, myHandle } = useHandles();
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/@([\w.]+)/g)) {
    const handle = m[1].replace(/\.+$/, "").toLowerCase();
    const all = handle === "all" || handle === "everyone";
    const who = map.get(handle);
    if (!all && !who && handle !== myHandle) continue;
    const start = m.index!;
    const end = start + 1 + m[1].replace(/\.+$/, "").length;
    if (start > last) parts.push(text.slice(last, start));
    const tag = text.slice(start, end);
    parts.push(
      who ? (
        <PersonLink key={start} id={who.id} username={who.username} label={who.name}>
          <span className="font-semibold" style={{ color: "var(--lime)" }}>
            {tag}
          </span>
        </PersonLink>
      ) : (
        <span key={start} className="font-semibold" style={{ color: "var(--lime)" }}>
          {tag}
        </span>
      ),
    );
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const n = post.comments.length;

  return (
    <article
      className="flex gap-3 px-4 py-3.5"
      style={{ borderBottom: "1px solid var(--line)" }}
      aria-label={`Scene by ${by.name}`}
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
          <span className="meta shrink-0">· {timeAgo(post.at)}</span>
          {post.by === "me" && (
            <button
              onClick={() => setConfirmDelete(true)}
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
      {confirmDelete && (
        <Sheet title="Delete this scene?" onClose={() => setConfirmDelete(false)}>
          <p className="text-cool text-sm">
            It disappears for everyone, along with its {word(post)}s. This can't be undone.
          </p>
          <button
            onClick={() => {
              setConfirmDelete(false);
              onDeleted();
              social.deletePost(post.id);
            }}
            className="btn-danger w-full mt-4"
          >
            <Trash2 size={18} /> Delete scene
          </button>
          <button onClick={() => setConfirmDelete(false)} className="btn-quiet w-full mt-2">
            Keep it
          </button>
        </Sheet>
      )}
    </article>
  );
}

// ---------- Thread: the scene plus its replies / comments ----------
function Thread({ post, onClose }: { post: Post; onClose: () => void }) {
  const by = personOf(post.by);
  const me = meView();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const label = post.text ? "Reply" : "Comment";
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

  return (
    <Sheet title={post.text ? "Replies" : "Comments"} onClose={onClose}>
      <div ref={listRef} className="max-h-[52dvh] overflow-y-auto -mx-1 px-1" data-noswipe>
        {/* The scene, small, at the top. */}
        <div className="flex gap-3 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <Avatar src={by.avatar} initials={by.initials} color={by.color} size={36} />
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 14.5 }}>
              <span className="font-bold text-cream">{by.name}</span>{" "}
              <span className="meta">· {timeAgo(post.at)}</span>
            </p>
            {post.caption && (
              <p
                className="text-cream"
                style={{
                  fontSize: 15,
                  lineHeight: 1.4,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                <Tagged text={post.caption} />
              </p>
            )}
            {post.image && (
              <img src={post.image} alt="" className="mt-2 w-24 h-24 rounded-xl object-cover" />
            )}
          </div>
        </div>
        {post.comments.length === 0 ? (
          <p className="meta text-center py-8">
            No {word(post)}s yet. Say something. Only your 25 can read it.
          </p>
        ) : (
          <ul>
            {post.comments.map((c) => {
              const p = personOf(c.by);
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
                  <div className="min-w-0">
                    <p style={{ fontSize: 14 }}>
                      <span className="font-bold text-cream">{p.name}</span>{" "}
                      <span className="meta">· {timeAgo(c.at)}</span>
                    </p>
                    <p
                      className="text-cream"
                      style={{ fontSize: 15, lineHeight: 1.42, overflowWrap: "anywhere" }}
                    >
                      {c.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* Composer: your photo, a rounded box, and a clear pill button. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2.5 mt-3 pt-3"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <Avatar src={me.avatar} initials={me.initials} size={34} />
        <label htmlFor="thread-input" className="sr-only">
          {label}
        </label>
        <input
          id="thread-input"
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
  );
}

// ---------- New scene ----------
function Composer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const s = useSocial();
  const me = meView();
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  // @tags: people at your Table (they're the ones who can see it), or @all.
  const q = mentionQuery(text);
  const picks =
    q === null
      ? []
      : s.people
          .filter((p) => p.username)
          .filter(
            (p) =>
              p.username!.toLowerCase().startsWith(q) ||
              p.name
                .toLowerCase()
                .split(" ")
                .some((w) => w.startsWith(q)),
          )
          .slice(0, 5);
  const showAll = q !== null && ("all".startsWith(q) || "everyone".startsWith(q));
  const put = (handle: string) => {
    setText((t) => t.replace(/@([\w.]*)$/, `@${handle} `));
    boxRef.current?.focus();
  };
  const addAt = () => {
    setText((t) => (t && !/\s$/.test(t) ? `${t} @` : `${t}@`));
    boxRef.current?.focus();
  };

  const left = MAX_CHARS - text.length;
  const canPost = (text.trim().length > 0 || !!image || !!video) && left >= 0;

  return (
    <Sheet title="New scene" onClose={onClose}>
      <div className="flex gap-3">
        <Avatar src={me.avatar} initials={me.initials} size={40} />
        <div className="flex-1 min-w-0">
          <label htmlFor="scene-text" className="sr-only">
            What's happening
          </label>
          <textarea
            id="scene-text"
            ref={boxRef}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS + 20))}
            placeholder={image || video ? "Add a caption (optional)" : "What's happening?"}
            rows={2}
            className="w-full resize-none bg-transparent outline-none text-cream pt-2"
            style={{ fontSize: 18, lineHeight: 1.4 }}
          />
          {(picks.length > 0 || showAll) && (
            <ul
              className="rounded-2xl overflow-hidden py-1 mb-2"
              style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
              role="listbox"
              aria-label="Tag someone"
            >
              {showAll && (
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => put("all")}
                    className="menu-row w-full flex items-center gap-3 px-3 py-2 text-left"
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: "var(--pink)", color: "var(--on-accent)" }}
                    >
                      <Megaphone size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-cream">@all</span>
                      <span className="block meta truncate">Tag everyone who can see it</span>
                    </span>
                  </button>
                </li>
              )}
              {picks.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => put(p.username!)}
                    className="menu-row w-full flex items-center gap-3 px-3 py-2 text-left"
                  >
                    <Avatar src={p.avatar} initials={p.initials} color={p.color} size={32} />
                    <span className="min-w-0">
                      <span className="block font-bold text-cream truncate">{p.name}</span>
                      <span className="block meta truncate">@{p.username}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(image || video) && (
            <div
              className="relative mt-1 rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--line)" }}
            >
              {video ? (
                <video
                  src={video.url}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full max-h-[320px] object-cover"
                />
              ) : (
                <img src={image!} alt="Your photo" className="w-full max-h-[320px] object-cover" />
              )}
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setVideo(null);
                }}
                aria-label="Remove photo or video"
                className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--coral-deep)" }} role="alert">
          {error}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
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
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 mt-3 pt-3"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Add a photo or video"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--fill)]"
          style={{ color: "var(--lime)" }}
        >
          <ImagePlus size={21} />
        </button>
        <button
          type="button"
          onClick={addAt}
          aria-label="Tag someone"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--fill)]"
          style={{ color: "var(--lime)" }}
        >
          <AtSign size={21} />
        </button>
        <span
          className="ml-auto mr-2 tabular-nums meta"
          style={{
            fontSize: 12.5,
            color: left < 0 ? "var(--coral-deep)" : left <= 20 ? "var(--sun)" : undefined,
          }}
          aria-live="polite"
        >
          {left <= 40 ? left : ""}
        </span>
        <button
          disabled={!canPost}
          onClick={() => {
            social.addPost(image ?? "", text, video?.file);
            onDone();
          }}
          className="rounded-full px-5 font-bold transition-opacity disabled:opacity-40"
          style={{
            minHeight: 38,
            fontSize: 15,
            background: "var(--lime)",
            color: "var(--on-accent)",
          }}
        >
          Post
        </button>
      </div>
      <div className="mt-3">
        <AudienceNote>Only people at your Table will see this.</AudienceNote>
      </div>
    </Sheet>
  );
}

// ---------- Page ----------
function Scenes() {
  const s = useSocial();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const open = s.posts.find((p) => p.id === openId);

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
      <PageBand
        ring
        title="Scenes"
        sub="What your 25 are up to. Nobody else sees it."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="lg w-12 h-12 rounded-full flex items-center justify-center"
            style={{ color: "#fff" }}
            aria-label="New scene"
          >
            <Plus size={24} strokeWidth={2.4} />
          </button>
        }
      />

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
            <button onClick={() => setCreating(true)} className="btn-primary px-5">
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
      {creating && (
        <Composer
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
