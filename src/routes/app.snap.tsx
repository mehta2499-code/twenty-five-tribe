import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, Type, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  Confetti,
  FriendPicker,
  SnapViewer,
  StreakBadge,
  Toast,
  buzz,
  clientOnly,
  PageBand,
} from "@/components/SocialUI";
import {
  fileToImage,
  friendById,
  seatedFriends,
  social,
  streakStatus,
  useSocial,
  type Snap,
} from "@/lib/social";

export const Route = createFileRoute("/app/snap")({
  validateSearch: (s: Record<string, unknown>) => ({
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  component: clientOnly(SnapScreen),
});

const BACKDROPS = [
  "linear-gradient(160deg,#2B8AC4,#1A5276)",
  "linear-gradient(160deg,#F7A8A0,#D9534A)",
  "linear-gradient(160deg,#FFC542,#F0803C)",
  "linear-gradient(160deg,#17926F,#2B8AC4)",
  "linear-gradient(160deg,#1A5276,#0E2A45)",
];
const TIMERS = [3, 5, 10];

function SnapScreen() {
  const { to } = Route.useSearch();
  const s = useSocial();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [camError, setCamError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [bg, setBg] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Snap | null>(null);
  const [burst, setBurst] = useState(0);
  const target = to ? friendById(to) : undefined;
  const hasShot = !!image || !!bg;

  // Live camera while nothing is captured yet.
  useEffect(() => {
    if (hasShot) return;
    let cancelled = false;
    let live: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("This browser can't open the camera. Upload a photo or make a text snap.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((ms) => {
        if (cancelled) return ms.getTracks().forEach((t) => t.stop());
        live = ms;
        setStream(ms);
        setCamError(null);
        if (videoRef.current) videoRef.current.srcObject = ms;
      })
      .catch(() =>
        setCamError("Camera is off. Allow camera access, or upload a photo or make a text snap."),
      );
    return () => {
      cancelled = true;
      live?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [facing, hasShot]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight));
    c.width = v.videoWidth * scale;
    c.height = v.videoHeight * scale;
    const ctx = c.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setImage(c.toDataURL("image/jpeg", 0.82));
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setImage(await fileToImage(file));
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const reset = () => {
    setImage(null);
    setBg(null);
    setCaption("");
  };

  const send = (ids: string[]) => {
    social.sendSnap({
      to: ids,
      image: image ?? undefined,
      bg: image ? undefined : (bg ?? BACKDROPS[0]),
      caption: caption.trim() || undefined,
      seconds,
    });
    const saved = ids.filter((id) => streakStatus(s.streaks[id]).atRisk).length;
    const names = ids.map((id) => friendById(id)?.name).filter(Boolean);
    setPicking(false);
    reset();
    setBurst((b) => b + 1);
    buzz(30);
    setToast(
      `Sent to ${names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(" & ")}${saved ? ` · ${saved} streak${saved > 1 ? "s" : ""} saved 🔥` : ""}`,
    );
  };

  const inbox = s.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me"));
  const atRisk = seatedFriends().filter((f) => streakStatus(s.streaks[f.id]).atRisk);

  return (
    <div className="pb-6">
      <PageBand
        eyebrow={target ? "snap" : "snap · disappears after viewing"}
        title={target ? `Snap ${target.name}.` : "Gone in 5 seconds."}
      >
        {target && (
          <div className="mt-3 inline-flex rounded-full px-3 py-1" style={{ background: "#fff" }}>
            <StreakBadge friendId={target.id} size={13} />
          </div>
        )}
      </PageBand>
      <div className="px-5">
        {/* Viewfinder */}
        <div
          className="relative mt-5 rounded-3xl overflow-hidden mx-auto"
          style={{
            aspectRatio: "3 / 4",
            maxHeight: "58vh",
            background: bg ?? "var(--navy)",
            border: "1px solid var(--border-cool)",
          }}
        >
          {!hasShot && !camError && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
            />
          )}
          {!hasShot && camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-3">
              <Camera size={28} className="text-faint" />
              <p
                className="font-display italic text-cool"
                style={{ fontSize: 14, lineHeight: 1.5 }}
              >
                {camError}
              </p>
            </div>
          )}
          {image && (
            <img
              src={image}
              alt="Your snap"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {hasShot && (
            <input
              id="snap-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 80))}
              placeholder={image ? "Add a caption" : "Say it big"}
              className="absolute left-4 right-4 top-1/2 -translate-y-1/2 text-center font-display italic outline-none rounded-2xl px-3 py-2.5"
              style={{
                fontSize: image ? 19 : 28,
                color: "#fff",
                background: image ? "rgba(0,0,0,0.45)" : "transparent",
              }}
            />
          )}
          {hasShot && (
            <button
              onClick={reset}
              aria-label="Discard"
              className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
            >
              <X size={18} />
            </button>
          )}
          {!hasShot && stream && (
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              aria-label="Flip camera"
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
            >
              <RefreshCw size={16} />
            </button>
          )}
          {!image && bg && (
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
              {BACKDROPS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBg(b)}
                  aria-label="Background colour"
                  className="w-7 h-7 rounded-full"
                  style={{
                    background: b,
                    outline: b === bg ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        {!hasShot ? (
          <div className="mt-5 flex items-center justify-between px-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-1 text-cool"
              aria-label="Upload a photo"
            >
              <ImagePlus size={22} />
              <span style={{ fontSize: 11 }}>Photo</span>
            </button>
            <button
              onClick={capture}
              disabled={!stream}
              aria-label="Take snap"
              className="w-[72px] h-[72px] rounded-full active:scale-95 transition disabled:opacity-40 animate-ember-pulse"
              style={{
                border: "5px solid var(--blue)",
                background: "#fff",
                boxShadow: "0 0 0 4px var(--sky-100)",
              }}
            />
            <button
              onClick={() => setBg(BACKDROPS[0])}
              className="flex flex-col items-center gap-1 text-cool"
              aria-label="Text snap"
            >
              <Type size={22} />
              <span style={{ fontSize: 11 }}>Text</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-center justify-center gap-2">
              <span className="label-caps mr-1">disappears in</span>
              {TIMERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setSeconds(t)}
                  className="px-3 py-1.5 rounded-full tabular-nums"
                  style={{
                    fontSize: 13,
                    background: seconds === t ? "var(--accent-bronze)" : "var(--bg-surface)",
                    color: seconds === t ? "var(--bg-primary)" : "var(--text-secondary)",
                  }}
                >
                  {t}s
                </button>
              ))}
            </div>
            <button
              onClick={() => (target ? send([target.id]) : setPicking(true))}
              className="mt-5 w-full rounded-full py-3.5 font-display italic active:scale-[0.99] transition"
              style={{
                background: "var(--accent-bronze)",
                color: "var(--bg-primary)",
                fontSize: 15,
              }}
            >
              {target ? `Send to ${target.name}` : "Send to…"}
            </button>
          </div>
        )}

        {/* Inbox */}
        {inbox.length > 0 && (
          <section className="mt-10">
            <p className="label-caps mb-3">waiting for you</p>
            <div className="space-y-2">
              {inbox.map((snap) => {
                const f = friendById(snap.from)!;
                return (
                  <button
                    key={snap.id}
                    onClick={() => setViewing(snap)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left active:scale-[0.99] transition"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-cool)",
                    }}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-[4px]"
                      style={{
                        background: snap.image ? "var(--accent-oxblood)" : "var(--accent-ember)",
                      }}
                    />
                    <Avatar src={f.avatar} initials={f.initials} color={f.color} size={36} />
                    <span className="font-display text-cream flex-1" style={{ fontSize: 15 }}>
                      {f.name}
                    </span>
                    <span className="label-caps" style={{ color: "var(--accent-ember)" }}>
                      tap to view
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Streaks at risk */}
        {atRisk.length > 0 && (
          <section className="mt-10">
            <p className="label-caps mb-1">streaks ending tonight</p>
            <p
              className="font-display italic mb-4"
              style={{ color: "var(--text-muted)", fontSize: 13 }}
            >
              Snap them before midnight or the 🔥 resets.
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {atRisk.map((f) => (
                <Link
                  key={f.id}
                  to="/app/snap"
                  search={{ to: f.id }}
                  className="flex flex-col items-center shrink-0"
                  style={{ width: 60 }}
                >
                  <Avatar
                    src={f.avatar}
                    initials={f.initials}
                    color={f.color}
                    size={50}
                    ring="drift"
                  />
                  <span
                    className="font-display italic mt-1.5 text-cool truncate w-full text-center"
                    style={{ fontSize: 11 }}
                  >
                    {f.name}
                  </span>
                  <StreakBadge friendId={f.id} size={10} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {picking && (
          <FriendPicker
            title="send to your people"
            cta="Send snap"
            showStreaks
            onClose={() => setPicking(false)}
            onPick={send}
          />
        )}
        {viewing && <SnapViewer snap={viewing} onClose={() => setViewing(null)} />}
        {toast && <Toast text={toast} onDone={() => setToast(null)} />}
        <Confetti fire={burst} />
      </div>
    </div>
  );
}
