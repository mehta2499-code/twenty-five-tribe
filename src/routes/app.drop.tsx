import { Ico, TONE } from "@/components/Ico";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Clock, Heart, Lock, MessageCircle, Send, X, Zap } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, PageBand, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { fileToImage, friendById, mutualFriends, meView, useSocial } from "@/lib/social";
import {
  WINDOW_MIN,
  commentOnDrop,
  dropTime,
  loadDrops,
  phaseOf,
  postDrop,
  toggleDropLike,
  type DropPost,
} from "@/lib/drop";
import { personOf } from "@/components/FeedUI";

export const Route = createFileRoute("/app/drop")({
  head: () => ({ meta: [{ title: "The 25 Drop · 25" }] }),
  component: clientOnly(DropScreen),
});

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function DropScreen() {
  useEffect(() => {
    try {
      localStorage.setItem("tf.seen.drop", "1");
    } catch {
      // ignore
    }
  }, []);
  useSocial();
  const now = useNow();
  const [at, setAt] = useState<number | null>(null);
  const [data, setData] = useState<{ mine: DropPost | null; others: DropPost[] } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const shootRef = useRef<HTMLInputElement>(null);

  const reload = () => void loadDrops().then(setData);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    void dropTime().then(setAt);
    reload();
  }, []);

  if (at === null || !data) return <p className="meta text-center pt-24">Loading…</p>;
  const phase = phaseOf(at, now);
  const left = Math.max(0, at + WINDOW_MIN * 60_000 - now);
  const mm = Math.floor(left / 60_000);
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0");
  const waiting = mutualFriends().length - data.others.length;

  return (
    <div className="pb-8">
      <PageBand
        title="The 25 Drop"
        sub="Once a day, at a surprise time. 10 minutes. One real photo. Post yours to see theirs."
      />

      {phase === "before" && !data.mine && (
        <section className="px-5">
          <div className="card p-6 text-center">
            <p className="text-5xl float">⏳</p>
            <p className="heading mt-3">Today's Drop hasn't happened yet</p>
            <p className="meta mt-1">
              It lands at a surprise time between 10 AM and 10 PM. Keep 25 close.
            </p>
          </div>
        </section>
      )}

      {phase !== "before" && !data.mine && (
        <section className="px-5">
          <div
            className="rounded-[24px] p-4 text-center"
            style={{
              background: phase === "now" ? "var(--lime)" : "var(--sun)",
              color: "var(--on-accent)",
              border: "var(--bd)",
              boxShadow: "var(--pop)",
            }}
          >
            {phase === "now" ? (
              <>
                <p className="display" style={{ fontSize: 30 }}>
                  DROP TIME
                </p>
                <p className="display tabular-nums mt-1" style={{ fontSize: 40 }}>
                  {mm}:{ss}
                </p>
                <p className="font-bold text-[13px]">left to post on time</p>
              </>
            ) : (
              <>
                <p className="display" style={{ fontSize: 24 }}>
                  The Drop was at {clock(at)}
                </p>
                <p className="font-bold text-[13px] mt-1">
                  You can still post. Everyone will see it's late ⏰
                </p>
              </>
            )}
          </div>

          <div className="mt-4">
            {image ? (
              <div
                className="relative rounded-3xl overflow-hidden"
                style={{ aspectRatio: "3 / 4", border: "var(--bd)" }}
              >
                <img
                  src={image}
                  alt="Your drop"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-3 left-3 btn-quiet min-h-[36px] px-3 text-sm"
                  style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                >
                  Retake
                </button>
              </div>
            ) : (
              <button
                onClick={() => shootRef.current?.click()}
                className="w-full rounded-3xl flex flex-col items-center justify-center gap-3"
                style={{
                  aspectRatio: "3 / 4",
                  background: "var(--fill)",
                  border: "2px dashed var(--line-2, rgba(255,255,255,0.3))",
                }}
              >
                <span
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--lime)",
                    color: "var(--on-accent)",
                    border: "var(--bd)",
                  }}
                >
                  <Camera size={34} />
                </span>
                <span className="font-bold text-cream">Take your Drop</span>
                <span className="meta">No filters. No retakes… okay, one retake.</span>
              </button>
            )}
            <input
              ref={shootRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImage(await fileToImage(f, 1080));
                e.target.value = "";
              }}
            />
          </div>
          {image && (
            <>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 120))}
                placeholder="What's happening? (optional)"
                className="input mt-3 w-full"
              />
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await postDrop(image, caption, at);
                    setParty((n) => n + 1);
                    buzz(40);
                    reload();
                  } catch (e) {
                    setToast((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn-primary w-full mt-3"
                style={{ minHeight: 54, fontSize: 17 }}
              >
                {busy ? (
                  "Dropping…"
                ) : (
                  <>
                    <Camera size={18} aria-hidden="true" /> Drop it
                  </>
                )}
              </button>
            </>
          )}
        </section>
      )}

      {data.mine && (
        <section className="px-5">
          <div className="grid grid-cols-2 gap-3">
            <DropCard post={data.mine} onOpen={() => setOpen(data.mine!.id)} />
            {data.others.map((p) => (
              <DropCard key={p.id} post={p} onOpen={() => setOpen(p.id)} />
            ))}
          </div>
          {waiting > 0 && (
            <p className="meta text-center mt-5">
              {waiting} of your 25 {waiting === 1 ? "hasn't" : "haven't"} dropped yet. Nudge them.
            </p>
          )}
        </section>
      )}

      {!data.mine && (
        <section className="px-5 mt-6">
          <div className="card p-4 flex items-center gap-3">
            <Lock size={20} className="text-faint shrink-0" />
            <p className="text-cool text-[14px] leading-snug">
              Your 25's drops stay hidden until you post yours. That's the deal.
            </p>
          </div>
        </section>
      )}
      {open && data && (
        <DropViewer
          post={[data.mine, ...data.others].find((x) => x?.id === open)!}
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={party} />
    </div>
  );
}

function DropCard({ post, onOpen }: { post: DropPost; onOpen: () => void }) {
  const me = post.id === "me";
  const f = me ? null : friendById(post.id);
  const who = me ? meView() : f;
  return (
    <figure className="card overflow-hidden p-0 cursor-pointer" onClick={onOpen}>
      <div className="relative" style={{ aspectRatio: "3 / 4" }}>
        {post.image ? (
          <img src={post.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--fill)" }} />
        )}
        <span
          className={`sticker ${post.late ? "pink" : ""} absolute top-2 left-2 !text-[11px]`}
          style={{ transform: "rotate(-4deg)" }}
        >
          {post.late ? (
            <>
              <Ico i={Clock} size={11} /> {post.late}m late
            </>
          ) : (
            <>
              <Ico i={Zap} size={11} /> on time
            </>
          )}
        </span>
      </div>
      <figcaption className="p-2.5 flex items-center gap-2">
        <Avatar
          src={who?.avatar || undefined}
          initials={who?.initials ?? "?"}
          color={f?.color}
          size={26}
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-cream truncate">
            {me ? "You" : who?.name.split(" ")[0]}
          </span>
          {post.caption && (
            <span className="block meta truncate" style={{ fontSize: 12 }}>
              {post.caption}
            </span>
          )}
        </span>
        <span className="ml-auto flex items-center gap-2 meta shrink-0" style={{ fontSize: 12 }}>
          <span className="flex items-center gap-0.5">
            <Heart size={13} fill={post.likes?.includes("me") ? "var(--pink)" : "none"} />{" "}
            {post.likes?.length ?? 0}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageCircle size={13} /> {post.comments?.length ?? 0}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function DropViewer({
  post,
  onClose,
  onChanged,
}: {
  post: DropPost;
  onClose: () => void;
  onChanged: () => void;
}) {
  const by = personOf(post.id);
  const [likes, setLikes] = useState(post.likes ?? []);
  const [comments, setComments] = useState(post.comments ?? []);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const liked = likes.includes("me");
  const owner = post.owner;
  const like = () => {
    if (!owner) return;
    buzz(10);
    setLikes((l) => (liked ? l.filter((x) => x !== "me") : [...l, "me"]));
    void toggleDropLike(owner, liked).then(onChanged);
  };
  const send = async () => {
    const t = text.trim();
    if (!t || !owner) return;
    setText("");
    setComments((c) => [...c, { id: `tmp-${Date.now()}`, by: "me", body: t, at: Date.now() }]);
    try {
      await commentOnDrop(owner, t);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "#000" }}>
      <div className="mx-auto w-full max-w-md flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-white">
          <Avatar src={by.avatar} initials={by.initials} color={by.color} size={34} />
          <span className="flex-1 min-w-0">
            <span className="block font-bold truncate">{by.name}</span>
            <span className="block text-xs text-white/70">
              {post.late ? (
                <>
                  <Ico i={Clock} size={11} /> {post.late}m late
                </>
              ) : (
                <>
                  <Ico i={Zap} size={11} /> on time
                </>
              )}
            </span>
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center"
          >
            <X size={22} />
          </button>
        </header>
        <div className="relative flex-1 min-h-0" onDoubleClick={() => !liked && like()}>
          {post.image && (
            <img
              src={post.image}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}
        </div>
        <div className="px-4 pt-3 text-white">
          {post.caption && <p className="text-[15px]">{post.caption}</p>}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={like}
              aria-label={liked ? "Unlike" : "Like"}
              className="flex items-center gap-1.5 font-bold"
            >
              <Heart
                size={24}
                fill={liked ? "var(--pink)" : "none"}
                style={{ color: liked ? "var(--pink)" : "#fff" }}
              />
              {likes.length}
            </button>
            <span className="flex items-center gap-1.5 font-bold">
              <MessageCircle size={22} /> {comments.length}
            </span>
          </div>
          {likes.length > 0 && (
            <p className="text-xs text-white/70 mt-1">
              Liked by {likes.map((id) => personOf(id).name.split(" ")[0]).join(", ")}
            </p>
          )}
          <ul className="mt-3 grid gap-2 max-h-40 overflow-y-auto">
            {comments.map((c) => {
              const p = personOf(c.by);
              return (
                <li key={c.id} className="text-[14px]">
                  <b className="mr-1.5">{p.name.split(" ")[0]}</b>
                  {c.body}
                </li>
              );
            })}
          </ul>
          {err && (
            <p className="text-xs mt-1" style={{ color: "var(--pink)" }}>
              {err}
            </p>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder="Add a comment…"
            className="input flex-1"
            style={{ borderRadius: 22 }}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send comment"
            className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            <Send size={19} />
          </button>
        </form>
      </div>
    </div>
  );
}
