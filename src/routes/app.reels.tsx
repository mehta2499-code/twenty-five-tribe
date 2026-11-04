import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Clapperboard, Film, Heart, MessageCircle, Music2, Plus, Send } from "lucide-react";
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
import { CommentsSheet, FeedTabs, personOf } from "@/components/FeedUI";
import { fileToImage, friendById, social, timeAgo, useSocial, type Reel } from "@/lib/social";

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
      buzz();
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  };
  const action = "flex flex-col items-center gap-1 text-white";

  return (
    <section
      className="relative snap-start overflow-hidden"
      style={{ height: "calc(100dvh - 250px)", background: "#000" }}
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
            fill="#fff"
            className="absolute left-1/2 top-1/2 heart-burst"
            style={{ color: "#fff" }}
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
            style={{ color: liked ? "var(--accent-oxblood)" : "#fff" }}
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

      <div className="absolute left-4 right-20 bottom-6 text-white">
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
  const s = useSocial();
  return (
    <Sheet title="New reel" onClose={onClose}>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-2xl overflow-hidden flex items-center justify-center mx-auto"
        style={{
          aspectRatio: "9 / 16",
          maxHeight: "42vh",
          border: media ? "none" : "1.5px dashed var(--line-2)",
          background: "var(--fill)",
        }}
        aria-label={media ? "Change video" : "Choose a video or photo"}
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
          <span className="flex flex-col items-center gap-2 text-cool px-6 text-center">
            <Film size={28} aria-hidden="true" />
            <span className="font-semibold" style={{ fontSize: 15 }}>
              Choose a video or photo
            </span>
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
      <label htmlFor="reel-caption" className="sr-only">
        Caption
      </label>
      <input
        id="reel-caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 150))}
        placeholder="Write a caption"
        className="input mt-4"
      />
      {s.mode !== "live" && (
        <p className="mt-2 meta">In demo mode, videos only play until you reload the page.</p>
      )}
      <button
        disabled={!media}
        onClick={() => {
          social.addReel({ ...media, caption: caption.trim() });
          onDone();
        }}
        className="btn-primary w-full mt-4"
      >
        Share with your 25
      </button>
      <div className="mt-3">
        <AudienceNote>Only people in your 25 will see this.</AudienceNote>
      </div>
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
      <PageBand
        title="Reels"
        sub="Short videos from your 25."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="btn-primary px-4"
            aria-label="New reel"
          >
            <Plus size={18} /> Reel
          </button>
        }
      >
        <div className="mt-4">
          <FeedTabs active="reels" />
        </div>
      </PageBand>

      {s.reels.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No reels yet"
          body="Share a short video and your 25 will see it here."
          action={
            <button onClick={() => setCreating(true)} className="btn-primary px-5">
              <Plus size={18} /> Share a reel
            </button>
          }
        />
      ) : (
        <div
          className="overflow-y-auto snap-y snap-mandatory rounded-2xl mx-3 no-scrollbar"
          style={{ height: "calc(100dvh - 250px)" }}
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
            style={{ height: "calc(100dvh - 250px)" }}
          >
            <p className="heading">You've seen every reel.</p>
            <p className="mt-2 text-cool" style={{ fontSize: 15 }}>
              No algorithm, no strangers. Just your 25.
            </p>
          </section>
        </div>
      )}

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
          title="Send to"
          cta="Send"
          note="They'll get it in your chat."
          onClose={() => setShareFor(null)}
          onPick={(ids) => {
            social.share(shareFor, ids, "reel");
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
        <NewReelSheet
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
