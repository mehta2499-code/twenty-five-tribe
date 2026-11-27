/**
 * The Drop camera, Snapchat style: tap the shutter for a photo, press and hold
 * it to record a video (up to 10 seconds, a ring fills as it goes). Flip
 * between the back and front camera. The camera is always switched off when
 * this closes.
 *
 * If the phone won't let us open the camera (no permission, old browser),
 * it offers the phone's own camera instead.
 */
import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { buzz } from "@/components/SocialUI";
import { MAX_VIDEO_SECONDS, firstFrame, readDropFile, type DropShot } from "@/lib/drop";

const HOLD_MS = 280; // press longer than this and it's a video

/** A recorder format this browser can make (iPhone: mp4; Chrome/Android: webm or mp4). */
function recorderType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ])
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
}

export function DropCamera({
  onShot,
  onClose,
}: {
  onShot: (shot: DropShot) => void;
  onClose: () => void;
}) {
  // Our camera couldn't open: offer the phone's own instead.
  const [blocked, setBlocked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onFallback = () => setBlocked(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const poster = useRef<string>("");
  const started = useRef(0);
  const raf = useRef(0);

  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  // Open the camera (again when flipping); always close it on the way out.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    stopStream();
    const open = async () => {
      const video = {
        facingMode: { ideal: facing },
        // The sensor's own 4:3 shape: asking for a tall 9:16 picture makes the
        // phone crop the middle of the sensor, which looks zoomed in.
        width: { ideal: 1920 },
        height: { ideal: 1440 },
      };
      try {
        let s: MediaStream;
        try {
          s = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        } catch {
          // No microphone allowed: photos and silent videos still work.
          s = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        }
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        if (!cancelled) onFallback();
      }
    };
    if (!navigator.mediaDevices?.getUserMedia) onFallback();
    else void open();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing]);

  // Belt and braces: the camera goes off when this screen goes away.
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      cancelAnimationFrame(raf.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stopStream();
    },
    [],
  );

  /**
   * The current frame as a JPEG, cut to the 3:4 frame you saw (selfies saved
   * the right way round).
   */
  const grab = () => {
    const v = videoRef.current!;
    const w = v.videoWidth || 1440;
    const h = v.videoHeight || 1920;
    // The middle 3:4 of the frame, exactly what the viewfinder showed.
    let sw = w;
    let sh = h;
    if (w / h > 3 / 4) sw = Math.round((h * 3) / 4);
    else sh = Math.round((w * 4) / 3);
    const scale = Math.min(1, 1440 / sh);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    c.getContext("2d")!.drawImage(v, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  };

  const takePhoto = () => {
    if (!ready || busy) return;
    buzz(25);
    const image = grab();
    stopStream();
    onShot({ image });
  };

  const startVideo = () => {
    const s = stream.current;
    const type = recorderType();
    if (!s || type === null) {
      takePhoto(); // can't record here: a photo instead
      return;
    }
    poster.current = grab();
    chunks.current = [];
    const r = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
    recorder.current = r;
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = async () => {
      cancelAnimationFrame(raf.current);
      setRecording(false);
      const mime = r.mimeType || type || "video/mp4";
      const blob = new Blob(chunks.current, { type: mime.split(";")[0] });
      stopStream();
      if (performance.now() - started.current < 600 || !blob.size) {
        // Too short to be a video: keep the photo from the start.
        onShot({ image: poster.current });
        return;
      }
      setBusy(true);
      const ext = mime.includes("webm") ? "webm" : "mp4";
      const file = new File([blob], `drop.${ext}`, { type: mime.split(";")[0] });
      const image = poster.current || (await firstFrame(file).then((f) => f.image));
      onShot({ image, video: file });
    };
    r.start(250);
    started.current = performance.now();
    setRecording(true);
    buzz(40);
    const tick = () => {
      const p = (performance.now() - started.current) / (MAX_VIDEO_SECONDS * 1000);
      setProgress(Math.min(1, p));
      if (p >= 1) {
        if (r.state === "recording") r.stop();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const down = (e: React.PointerEvent) => {
    if (!ready || busy || recording) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      startVideo();
    }, HOLD_MS);
  };
  const up = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      takePhoto();
      return;
    }
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const secs = (progress * MAX_VIDEO_SECONDS).toFixed(1);
  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col select-none"
      style={{ background: "#000", touchAction: "none" }}
      role="dialog"
      aria-modal="true"
      aria-label="Drop camera"
    >
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={() => {
            stopStream();
            onClose();
          }}
          aria-label="Close camera"
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)", color: "#fff" }}
        >
          <X size={22} />
        </button>
        {recording ? (
          <span
            className="rounded-full px-3 py-1 font-extrabold tabular-nums text-[14px]"
            style={{ background: "rgba(255,84,112,0.9)", color: "#fff" }}
            aria-live="polite"
          >
            ● {secs}s
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={() => !recording && setFacing((f) => (f === "user" ? "environment" : "user"))}
          aria-label="Flip camera"
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)", color: "#fff", opacity: recording ? 0.4 : 1 }}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-3 py-3">
        {/* The viewfinder: a 3:4 frame, the same shape a Drop is shown in. */}
        <div
          className="relative overflow-hidden rounded-[28px]"
          style={{
            aspectRatio: "3 / 4",
            width: "100%",
            maxHeight: "100%",
            maxWidth: "calc((100dvh - 15rem) * 0.75)",
            background: "#111",
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
            // Selfie preview mirrored, like a mirror (the saved photo isn't).
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
          {blocked && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
              style={{ color: "#fff" }}
            >
              <p className="font-extrabold" style={{ fontSize: 20 }}>
                Camera's not available here
              </p>
              <p className="mt-2 text-[14.5px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                Allow camera access for 25 in your phone's settings, or use your phone's camera.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn-primary mt-5 px-6"
                style={{ minHeight: 50 }}
              >
                Open phone camera
              </button>
              {err && (
                <p className="mt-3 text-[13.5px]" style={{ color: "#FF8FA3" }} role="alert">
                  {err}
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  readDropFile(f).then(onShot, (x: Error) => setErr(x.message));
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Shutter */}
      <div
        hidden={blocked}
        className="relative z-10 flex flex-col items-center gap-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]"
      >
        <p
          className="text-[13.5px] font-bold"
          style={{ color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
        >
          {busy
            ? "Getting your video ready…"
            : recording
              ? "Let go to stop"
              : `Tap for a photo · hold for a video (${MAX_VIDEO_SECONDS}s)`}
        </p>
        <button
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
          disabled={!ready || busy}
          aria-label="Shutter. Tap for a photo, hold for a video"
          className="relative rounded-full flex items-center justify-center disabled:opacity-50"
          style={{
            width: 88,
            height: 88,
            background: `conic-gradient(#FF5470 ${progress * 360}deg, rgba(255,255,255,0.9) 0deg)`,
            transform: recording ? "scale(1.12)" : undefined,
            transition: "transform 150ms",
            WebkitTouchCallout: "none",
          }}
        >
          <span
            className="block rounded-full"
            style={{
              width: recording ? 58 : 70,
              height: recording ? 58 : 70,
              background: recording ? "#FF5470" : "rgba(255,255,255,0.25)",
              border: "3px solid #000",
              transition: "all 150ms",
            }}
          />
        </button>
      </div>
    </div>
  );
}
