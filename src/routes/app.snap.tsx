import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, Type, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  cameraDenied,
  canvasToUrl,
  isIOS,
  fileToPhoto,
  openCamera,
  parkStream,
  setCameraDenied,
} from "@/lib/camera";
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
  friendById,
  mutualFriends,
  social,
  streakStatus,
  useSocial,
  timeAgo,
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

/** Draws the caption onto the photo at the height you dragged it to. */
async function bakeCaption(image: string, text: string, yPct: number): Promise<string> {
  const img = new Image();
  img.src = image;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const size = Math.round(c.width * 0.05);
  const barH = Math.round(size * 2);
  const y = Math.min(c.height - barH, Math.max(0, (yPct / 100) * c.height - barH / 2));
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, y, c.width, barH);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, y + barH / 2, c.width * 0.92);
  return canvasToUrl(c, 0.85);
}

function SnapScreen() {
  const { to } = Route.useSearch();
  const s = useSocial();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // The phone's own camera app: works even where the live camera isn't allowed (http).
  const shootRef = useRef<HTMLInputElement>(null);
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
  const [captionY, setCaptionY] = useState(50);
  // iPhone home-screen apps forget camera permission every launch, so there we
  // use the phone's own camera (no permission prompt) unless asked for live.
  // Live viewfinder everywhere (like any camera app). If the phone says no,
  // fall back to the phone's own camera app.
  // iPhone home-screen apps ask for camera permission again and again, so
  // there we use the phone's own camera app (no prompts). Elsewhere: live.
  const [liveCam, setLiveCam] = useState(() => !isIOS() && !cameraDenied());
  const [flash, setFlash] = useState(0);
  const [ready, setReady] = useState(false);
  const drag = useRef<{ startY: number; startPct: number; moved: boolean } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const target = to ? friendById(to) : undefined;
  const hasShot = !!image || !!bg;

  // Live camera while nothing is captured yet.
  useEffect(() => {
    if (hasShot) return;
    if (!liveCam) {
      setCamError("Tap to take a blink");
      return;
    }
    let cancelled = false;
    let live: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Tap to open your camera");
      return;
    }
    setReady(false);
    openCamera(facing)
      .then((ms) => {
        if (cancelled) return parkStream(ms, facing);
        live = ms;
        setStream(ms);
        setCamError(null);
        if (videoRef.current) videoRef.current.srcObject = ms;
      })
      .catch((e: Error) => {
        // Said no: stop asking, use the phone's camera app from now on.
        if (e?.name === "NotAllowedError") setCameraDenied(true);
        setLiveCam(false);
        setCamError("Tap to open your camera");
      });
    return () => {
      cancelled = true;
      if (live) parkStream(live, facing);
      setStream(null);
    };
  }, [facing, hasShot, liveCam]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    // Keep exactly what the 3:4 viewfinder showed (no surprise crop later).
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const ratio = 3 / 4;
    let sw = vw;
    let sh = vh;
    if (vw / vh > ratio) sw = vh * ratio;
    else sh = vw / ratio;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const scale = Math.min(1, 1920 / sh);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    const ctx = c.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    // Instant feedback: freeze the frame and flash, then encode in the background.
    v.pause();
    setFlash((n) => n + 1);
    buzz(12);
    void canvasToUrl(c, 0.9).then(setImage, (e) => setToast((e as Error).message));
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setImage(await fileToPhoto(file));
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const reset = () => {
    setImage(null);
    setBg(null);
    setCaption("");
  };

  const send = async (ids: string[]) => {
    const text = caption.trim();
    const finalImage =
      image && text ? await bakeCaption(image, text, captionY).catch(() => image) : image;
    social.sendSnap({
      to: ids,
      image: finalImage ?? undefined,
      bg: image ? undefined : (bg ?? BACKDROPS[0]),
      // Photo captions are drawn onto the photo where you placed them.
      caption: image ? undefined : text || undefined,
      seconds,
    });
    setCaptionY(50);
    // Snapping from a chat: go back to that chat.
    if (target && ids.length === 1 && ids[0] === target.id)
      setTimeout(() => navigate({ to: "/app/chat/$id", params: { id: target.id } }), 900);
    const saved = ids.filter((id) => streakStatus(s.streaks[id]).atRisk).length;
    const names = ids.map((id) => friendById(id)?.name).filter(Boolean);
    setPicking(false);
    reset();
    setBurst((b) => b + 1);
    buzz(30);
    setToast(
      `Sent to ${names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(" & ")}${saved ? `. ${saved} streak${saved > 1 ? "s" : ""} kept alive.` : ""}`,
    );
  };

  const inbox = s.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me"));
  // Download unopened blinks now, so they open instantly when tapped.
  const inboxKey = inbox.map((x) => x.id).join(",");
  useEffect(() => {
    for (const x of inbox) if (x.image) new Image().src = x.image;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxKey]);
  const atRisk = mutualFriends().filter((f) => streakStatus(s.streaks[f.id]).atRisk);

  return (
    <div className="pb-6">
      <PageBand
        title={target ? `Blink ${target.name.split(" ")[0]}` : "Blink"}
        sub="Photos and notes that disappear after one look."
        actions={target ? <StreakBadge friendId={target.id} size={14} /> : undefined}
      />
      <div className="px-5">
        {/* Viewfinder */}
        <div
          ref={frameRef}
          className="relative rounded-3xl overflow-hidden mx-auto"
          style={{
            aspectRatio: "3 / 4",
            maxHeight: "56vh",
            background: bg ?? "#0B0A10",
          }}
        >
          {!hasShot && !camError && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onPlaying={() => setReady(true)}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                transform: facing === "user" ? "scaleX(-1)" : "none",
                opacity: ready ? 1 : 0,
                transition: "opacity 160ms ease-out",
              }}
            />
          )}
          {/* Shutter flash */}
          {flash > 0 && (
            <div
              key={flash}
              className="absolute inset-0 pointer-events-none shutter-flash"
              style={{ background: "#fff" }}
              aria-hidden="true"
            />
          )}
          {!hasShot && camError && (
            <button
              onClick={() => shootRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-3"
            >
              <span
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--lime)",
                  color: "var(--on-accent)",
                  border: "var(--bd)",
                }}
              >
                <Camera size={34} aria-hidden="true" />
              </span>
              <p className="text-white font-bold" style={{ fontSize: 17 }}>
                {camError}
              </p>
            </button>
          )}
          {!hasShot && !liveCam && (
            <button
              onClick={() => {
                setCamError(null);
                setCameraDenied(false);
                setLiveCam(true);
              }}
              className="absolute bottom-3 inset-x-0 mx-auto w-max text-[13px] font-semibold underline underline-offset-4"
              style={{ color: "rgba(255,255,255,0.8)" }}
            >
              Use live camera instead
            </button>
          )}
          {image && (
            <img
              src={image}
              alt="Your blink"
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}
          {hasShot && (
            <div
              className="absolute left-0 right-0"
              style={{
                top: image ? `${captionY}%` : "50%",
                transform: "translateY(-50%)",
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                if (!image) return;
                drag.current = { startY: e.clientY, startPct: captionY, moved: false };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                const h = frameRef.current?.clientHeight ?? 1;
                if (!d) return;
                const dy = e.clientY - d.startY;
                if (Math.abs(dy) > 4) d.moved = true;
                if (d.moved) setCaptionY(Math.min(90, Math.max(10, d.startPct + (dy / h) * 100)));
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <input
                id="snap-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 80))}
                placeholder={image ? "Add a caption · drag to move" : "Say it big"}
                aria-label="Caption"
                className="block mx-4 w-[calc(100%-2rem)] text-center font-semibold outline-none rounded-2xl px-3 py-2.5 placeholder:text-white/70"
                style={{
                  fontSize: image ? 19 : 28,
                  color: "#fff",
                  background: image ? "rgba(0,0,0,0.45)" : "transparent",
                }}
              />
            </div>
          )}
          {hasShot && (
            <button
              onClick={reset}
              aria-label="Discard and start over"
              className="absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
            >
              <X size={18} />
            </button>
          )}
          {!hasShot && stream && (
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              aria-label="Flip camera"
              className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center"
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
                  aria-pressed={b === bg}
                  className="w-8 h-8 rounded-full"
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
          <div className="mt-5 grid grid-cols-3 items-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="justify-self-start flex flex-col items-center gap-1 text-cool w-16 py-1 rounded-xl"
            >
              <ImagePlus size={22} aria-hidden="true" />
              <span style={{ fontSize: 13 }}>Upload</span>
            </button>
            <button
              onClick={() => (stream ? capture() : shootRef.current?.click())}
              aria-label="Take photo"
              className="justify-self-center w-[72px] h-[72px] rounded-full disabled:opacity-40"
              style={{
                border: "5px solid var(--blue-deep)",
                background: "#fff",
                boxShadow: "0 0 0 4px var(--fill)",
              }}
            />
            <button
              onClick={() => setBg(BACKDROPS[0])}
              className="justify-self-end flex flex-col items-center gap-1 text-cool w-16 py-1 rounded-xl"
            >
              <Type size={22} aria-hidden="true" />
              <span style={{ fontSize: 13 }}>Text</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <input
              ref={shootRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-cool">Visible for</span>
              <div className="segmented" role="group" aria-label="How long the blink is visible">
                {TIMERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSeconds(t)}
                    aria-pressed={seconds === t}
                    className="tabular-nums"
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => (target ? send([target.id]) : setPicking(true))}
              className="btn-primary w-full mt-4"
            >
              {target ? `Send to ${target.name.split(" ")[0]}` : "Choose who gets it"}
            </button>
          </div>
        )}

        {/* Inbox */}
        {inbox.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[15px] font-semibold text-cream mb-2">Waiting for you</h2>
            <ul className="card divide-y" style={{ borderColor: "var(--line)" }}>
              {inbox.map((snap) => {
                const f = friendById(snap.from);
                if (!f) return null;
                return (
                  <li key={snap.id}>
                    <button
                      onClick={() => setViewing(snap)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      aria-label={`Open blink from ${f.name}`}
                    >
                      <Avatar
                        src={f.avatar || undefined}
                        initials={f.initials}
                        color={f.color}
                        size={40}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-cream truncate">{f.name}</span>
                        <span className="block meta">
                          {snap.image ? "Photo" : "Note"} · {timeAgo(snap.at)}
                        </span>
                      </span>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--coral-deep)" }}
                      >
                        Open
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Streaks at risk */}
        {atRisk.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[15px] font-semibold text-cream">Streaks ending today</h2>
            <p className="meta mb-3">Send them a blink before midnight to keep the streak.</p>
            <ul className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {atRisk.map((f) => (
                <li key={f.id}>
                  <Link
                    to="/app/snap"
                    search={{ to: f.id }}
                    className="flex flex-col items-center w-16"
                    aria-label={`Blink ${f.name}`}
                  >
                    <Avatar
                      src={f.avatar || undefined}
                      initials={f.initials}
                      color={f.color}
                      size={52}
                      ring="drift"
                    />
                    <span className="mt-1.5 text-[13px] text-cream truncate w-full text-center">
                      {f.name.split(" ")[0]}
                    </span>
                    <StreakBadge friendId={f.id} size={12} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {picking && (
          <FriendPicker
            title="Send blink to"
            cta="Send"
            showStreaks
            note="Each person can open it once."
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
