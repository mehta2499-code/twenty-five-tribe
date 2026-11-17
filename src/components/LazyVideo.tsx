/**
 * Instagram-style video: nothing downloads until the video is about to come on
 * screen (then just its first frame; the rest streams once it's on screen). In the Feed it then plays by itself (muted, looping) while it
 * streams, pauses when you scroll past, and only one plays at a time. Tap for
 * sound. With data saver on (or `autoplay={false}`, as in chats) it waits for a
 * tap instead.
 */
import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

// Only one video plays at a time across the app.
let playing: HTMLVideoElement | null = null;
// Sound choice carries over between videos (like Instagram).
let soundOn = false;

const saveData = () =>
  typeof navigator !== "undefined" &&
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export function LazyVideo({
  src,
  className,
  style,
  autoplay = true,
  label = "Video",
  fitShape = false,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  autoplay?: boolean;
  label?: string;
  /**
   * Take the video's own shape (portrait stays tall, landscape wide) once it
   * loads, instead of a fixed box. Holds a 4:5 box until then.
   */
  fitShape?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  // near: within a screen of the viewport → attach the source (starts streaming).
  const [near, setNear] = useState(false);
  // inView: mostly on screen → play.
  const [inView, setInView] = useState(false);
  const [started, setStarted] = useState(false); // a tap started it (no autoplay)
  const [paused, setPaused] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(!soundOn);
  const auto = autoplay && !saveData();
  // The video's own width ÷ height (fitShape), kept between tall 9:16 and wide 16:9.
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const nearIo = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), {
      rootMargin: "50% 0px",
    });
    const viewIo = new IntersectionObserver(([e]) => setInView(e.intersectionRatio >= 0.6), {
      threshold: [0, 0.6, 1],
    });
    nearIo.observe(el);
    viewIo.observe(el);
    return () => {
      nearIo.disconnect();
      viewIo.disconnect();
    };
  }, []);

  // Play when on screen (autoplay or after a tap); pause when scrolled away.
  useEffect(() => {
    const v = vid.current;
    if (!v || !near) return;
    if (inView && (auto || started)) {
      if (playing && playing !== v) playing.pause();
      playing = v;
      v.muted = !soundOn;
      setMuted(!soundOn);
      void v.play().catch(() => {
        // Some browsers block autoplay with sound: retry muted.
        v.muted = true;
        setMuted(true);
        void v.play().catch(() => undefined);
      });
    } else if (!v.paused) v.pause();
  }, [inView, near, auto, started]);

  useEffect(
    () => () => {
      if (playing === vid.current) playing = null;
    },
    [],
  );

  const tap = () => {
    const v = vid.current;
    if (!v) return;
    if (v.paused) {
      setStarted(true);
      if (!near) setNear(true);
      if (playing && playing !== v) playing.pause();
      playing = v;
      void v.play().catch(() => undefined);
      return;
    }
    // Playing: tap toggles sound, like Instagram.
    soundOn = v.muted;
    v.muted = !soundOn;
    setMuted(!soundOn);
  };

  return (
    <div
      ref={box}
      className={`relative ${className ?? ""}`}
      style={{
        background: "#000",
        ...(fitShape ? { aspectRatio: String(ratio ?? 4 / 5) } : {}),
        ...style,
      }}
    >
      <video
        ref={vid}
        src={near ? (src.includes("#") ? src : `${src}#t=0.1`) : undefined}
        preload={!near ? "none" : inView || started ? "auto" : "metadata"}
        playsInline
        loop
        muted={muted}
        aria-label={label}
        onClick={tap}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (fitShape && v.videoWidth && v.videoHeight)
            setRatio(Math.min(16 / 9, Math.max(9 / 16, v.videoWidth / v.videoHeight)));
        }}
        className="w-full h-full object-cover"
      />
      {/* Buffering */}
      {near && waiting && !paused && (
        <span
          aria-hidden="true"
          className="absolute inset-0 m-auto w-9 h-9 rounded-full border-[3px] border-white/30 border-t-white animate-spin pointer-events-none"
        />
      )}
      {/* Tap to play (no autoplay, or not started yet) */}
      {paused && !(auto && inView) && (
        <button
          type="button"
          onClick={tap}
          aria-label={`Play ${label.toLowerCase()}`}
          className="absolute inset-0 m-auto w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)", color: "#fff", backdropFilter: "blur(6px)" }}
        >
          <Play size={26} fill="currentColor" aria-hidden="true" />
        </button>
      )}
      {/* Sound on/off */}
      {!paused && (
        <button
          type="button"
          onClick={tap}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          className="absolute right-3 bottom-3 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
        >
          {muted ? (
            <VolumeX size={16} aria-hidden="true" />
          ) : (
            <Volume2 size={16} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
