import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Heart, MessageCircle, Music2, Plus, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, Toast, clientOnly } from "@/components/SocialUI";
import { CommentsSheet, FeedTabs, personOf } from "@/components/FeedUI";
import { fileToImage, social, timeAgo, useSocial, type Reel } from "@/lib/social";

export const Route = createFileRoute("/app/reels")({
  component: clientOnly(Reels),
});

function ReelCard({
  reel,
  onComments,
  onShare,
}: {
  reel: Reel;
  onComments: () => void;
  onShare: () => void;
}) {
  const by = personOf(reel.by);
  const liked = reel.likes.includes("me");
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      social.like("reel", reel.id);
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  };
  const action = "flex flex-col items-center gap-1 text-cream";

  return (
    <section
      className="relative snap-start overflow-hidden"
      style={{ height: "calc(100dvh - 150px)", background: "#000" }}
    >
      <div className="absolute inset-0" onClick={onTap}>
        {reel.video ? (
          <video
            src={reel.video}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={reel.image}
            alt=""
            draggable={false}
            className="w-full h-full object-cover reel-pan"
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent 45%)" }}
        />
        {burst > 0 && (
          <Heart
            key={burst}
            size={110}
            fill="#EFE6D2"
            className="absolute left-1/2 top-1/2 heart-burst"
            style={{ color: "#EFE6D2" }}
          />
        )}
      </div>

      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <button
          onClick={() => social.toggleLike("reel", reel.id)}
          className={action}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart
            size={30}
            fill={liked ? "var(--accent-oxblood)" : "none"}
            style={{ color: liked ? "var(--accent-oxblood)" : "#EFE6D2" }}
          />
          <span className="tabular-nums" style={{ fontSize: 12 }}>
            {reel.likes.length}
          </span>
        </button>
        <button onClick={onComments} className={action} aria-label="Comments">
          <MessageCircle size={28} />
          <span className="tabular-nums" style={{ fontSize: 12 }}>
            {reel.comments.length}
          </span>
        </button>
        <button onClick={onShare} className={action} aria-label="Share to a friend">
          <Send size={26} />
        </button>
      </div>

      <div className="absolute left-4 right-20 bottom-6 text-cream">
        <div className="flex items-center gap-2.5">
          <Avatar src={by.avatar} initials={by.initials} color={by.color} size={32} />
          <span className="font-display" style={{ fontSize: 15 }}>
            {by.name}
          </span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>· {timeAgo(reel.at)}</span>
        </div>
        <p className="mt-2.5" style={{ fontSize: 14, lineHeight: 1.45 }}>
          {reel.caption}
        </p>
        <p className="mt-2 flex items-center gap-1.5" style={{ fontSize: 12, opacity: 0.8 }}>
          <Music2 size={13} /> {reel.sound}
        </p>
      </div>
    </section>
  );
}

function NewReelSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<{ video?: string; image?: string } | null>(null);
  const [caption, setCaption] = useState("");
  return (
    <Sheet title="new reel" onClose={onClose}>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-2xl overflow-hidden flex items-center justify-center mx-auto"
        style={{
          aspectRatio: "9 / 16",
          maxHeight: "42vh",
          border: media ? "none" : "1px dashed rgba(196,149,96,0.4)",
          background: "var(--bg-surface)",
        }}
      >
        {media?.video ? (
          <video
            src={media.video}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : media?.image ? (
          <img src={media.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display italic text-cool px-6 text-center" style={{ fontSize: 14 }}>
            Choose a video (or a photo)
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.type.startsWith("video/")) setMedia({ video: URL.createObjectURL(f) });
          else setMedia({ image: await fileToImage(f) });
        }}
      />
      <input
        id="reel-caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 150))}
        placeholder="Caption"
        className="mt-4 w-full rounded-full px-4 py-3 outline-none text-cream"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-cool)",
          fontSize: 15,
        }}
      />
      <p className="mt-2 font-display italic" style={{ color: "var(--text-muted)", fontSize: 12 }}>
        Videos play for this session only until there's a server to upload to.
      </p>
      <button
        disabled={!media}
        onClick={() => {
          social.addReel({ ...media, caption: caption.trim() });
          onDone();
        }}
        className="mt-4 w-full rounded-full py-3.5 font-display italic disabled:opacity-40"
        style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)", fontSize: 15 }}
      >
        Share reel
      </button>
    </Sheet>
  );
}

function Reels() {
  const s = useSocial();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const open = s.reels.find((r) => r.id === commentsFor);

  return (
    <>
      <header className="px-6 pt-6 pb-3 flex items-center justify-between">
        <span className="w-8" />
        <FeedTabs active="reels" />
        <button
          onClick={() => setCreating(true)}
          aria-label="New reel"
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent-bronze)", color: "var(--bg-primary)" }}
        >
          <Plus size={18} />
        </button>
      </header>

      <div
        className="overflow-y-auto snap-y snap-mandatory rounded-2xl mx-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: "calc(100dvh - 150px)" }}
      >
        {s.reels.map((r) => (
          <ReelCard
            key={r.id}
            reel={r}
            onComments={() => setCommentsFor(r.id)}
            onShare={() => setShareFor(r.id)}
          />
        ))}
        <section
          className="snap-start flex flex-col items-center justify-center text-center px-10"
          style={{ height: "calc(100dvh - 150px)" }}
        >
          <p className="font-display italic text-cream" style={{ fontSize: 22 }}>
            That's every reel from your 25.
          </p>
          <p
            className="font-display italic mt-3"
            style={{ color: "var(--text-muted)", fontSize: 14 }}
          >
            No algorithm. No strangers. Go outside, maybe.
          </p>
        </section>
      </div>

      {open && (
        <CommentsSheet
          kind="reel"
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
            social.share(shareFor, ids, "reel");
            setShareFor(null);
            setToast(`Shared with ${ids.length}`);
          }}
        />
      )}
      {creating && (
        <NewReelSheet
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            setToast("Reel shared with your 25.");
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
