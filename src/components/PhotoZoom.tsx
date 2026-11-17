/**
 * Photos you can zoom, like Instagram:
 * - In the feed, pinch a photo and it grows over the screen as you pinch,
 *   then springs back when you let go. The photo stays its normal size.
 * - Tap it to open it full screen: pinch or double-tap to zoom, drag to look
 *   around, swipe down (or the X) to close.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Pt = { x: number; y: number };
const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const mid = (a: Touch, b: Touch): Pt => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A feed photo: pinch to zoom in place, tap to open full screen. */
export function ZoomablePhoto({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const img = useRef<HTMLImageElement>(null);
  const [open, setOpen] = useState(false);
  // While pinching: where the photo sat, and how far it's zoomed/moved.
  const [pinch, setPinch] = useState<{
    rect: DOMRect;
    scale: number;
    dx: number;
    dy: number;
    back: boolean;
  } | null>(null);
  const start = useRef<{ d: number; m: Pt } | null>(null);
  const tapAt = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const el = img.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        tapAt.current = null;
        start.current = { d: dist(e.touches[0], e.touches[1]), m: mid(e.touches[0], e.touches[1]) };
        setPinch({ rect: el.getBoundingClientRect(), scale: 1, dx: 0, dy: 0, back: false });
      } else if (e.touches.length === 1) {
        tapAt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
      }
    };
    const onMove = (e: TouchEvent) => {
      const t0 = tapAt.current;
      if (t0 && e.touches.length === 1) {
        const t = e.touches[0];
        if (Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 10) tapAt.current = null;
      }
      if (!start.current || e.touches.length < 2) return;
      e.preventDefault();
      const s = start.current;
      const m = mid(e.touches[0], e.touches[1]);
      setPinch(
        (p) =>
          p && {
            ...p,
            scale: clamp(dist(e.touches[0], e.touches[1]) / s.d, 1, 4),
            dx: m.x - s.m.x,
            dy: m.y - s.m.y,
          },
      );
    };
    const onEnd = (e: TouchEvent) => {
      if (start.current && e.touches.length < 2) {
        start.current = null;
        // Spring back into place, then hand the photo back to the feed.
        setPinch((p) => p && { ...p, scale: 1, dx: 0, dy: 0, back: true });
        setTimeout(() => setPinch(null), 230);
        return;
      }
      const t0 = tapAt.current;
      tapAt.current = null;
      if (t0 && e.touches.length === 0 && Date.now() - t0.t < 350) {
        e.preventDefault();
        setOpen(true);
      }
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <>
      <img
        ref={img}
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        // Mouse / keyboard: click to open. (Touch is handled above.)
        onClick={() => setOpen(true)}
        className={`cursor-zoom-in ${className ?? ""}`}
        style={{ ...style, visibility: pinch ? "hidden" : undefined, touchAction: "pan-y" }}
      />
      {pinch &&
        createPortal(
          <div className="fixed inset-0 z-[95] pointer-events-none" aria-hidden="true">
            <div
              className="absolute inset-0"
              style={{
                background: "#000",
                opacity: clamp((pinch.scale - 1) * 0.9, 0, 0.75),
                transition: pinch.back ? "opacity 0.22s ease" : undefined,
              }}
            />
            <img
              src={src}
              alt=""
              className={className}
              style={{
                ...style,
                position: "absolute",
                left: pinch.rect.left,
                top: pinch.rect.top,
                width: pinch.rect.width,
                height: pinch.rect.height,
                transform: `translate(${pinch.dx}px, ${pinch.dy}px) scale(${pinch.scale})`,
                transformOrigin: "center",
                transition: pinch.back ? "transform 0.22s cubic-bezier(.2,.8,.2,1)" : undefined,
              }}
            />
          </div>,
          document.body,
        )}
      {open && <PhotoViewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Full-screen photo: pinch / double-tap to zoom, drag to pan, swipe down to close. */
export function PhotoViewer({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ scale: 1, x: 0, y: 0, anim: false });
  const [drop, setDrop] = useState(0); // swipe-down distance (at 1x)
  const g = useRef<{
    d?: number;
    s0: number;
    x0: number;
    y0: number;
    p?: Pt;
    m?: Pt;
    lastTap?: number;
  }>({ s0: 1, x0: 0, y0: 0 });
  const vRef = useRef(v);
  vRef.current = v;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // Zoom to `scale` keeping the point under the finger (cx, cy) in place.
  const zoomAt = (scale: number, cx: number, cy: number, anim = true) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ox = cx - r.left - r.width / 2;
    const oy = cy - r.top - r.height / 2;
    const cur = vRef.current;
    const k = scale / cur.scale;
    const x = scale === 1 ? 0 : ox - (ox - cur.x) * k;
    const y = scale === 1 ? 0 : oy - (oy - cur.y) * k;
    setV({ scale, x, y, anim });
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      const c = vRef.current;
      if (e.touches.length === 2) {
        g.current = {
          ...g.current,
          d: dist(e.touches[0], e.touches[1]),
          s0: c.scale,
          x0: c.x,
          y0: c.y,
          m: mid(e.touches[0], e.touches[1]),
        };
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        const now = Date.now();
        // Double tap: zoom in there, or back out.
        if (g.current.lastTap && now - g.current.lastTap < 280) {
          g.current.lastTap = 0;
          zoomAt(c.scale > 1 ? 1 : 2.5, t.clientX, t.clientY);
          return;
        }
        g.current = {
          ...g.current,
          d: undefined,
          s0: c.scale,
          x0: c.x,
          y0: c.y,
          p: { x: t.clientX, y: t.clientY },
          lastTap: now,
        };
      }
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const s = g.current;
      if (e.touches.length === 2 && s.d && s.m) {
        const scale = clamp((dist(e.touches[0], e.touches[1]) / s.d) * s.s0, 1, 5);
        const m = mid(e.touches[0], e.touches[1]);
        setV({ scale, x: s.x0 + (m.x - s.m.x), y: s.y0 + (m.y - s.m.y), anim: false });
      } else if (e.touches.length === 1 && s.p) {
        const t = e.touches[0];
        const dx = t.clientX - s.p.x;
        const dy = t.clientY - s.p.y;
        if (Math.hypot(dx, dy) > 8) s.lastTap = 0;
        if (vRef.current.scale > 1)
          setV({ ...vRef.current, x: s.x0 + dx, y: s.y0 + dy, anim: false });
        else setDrop(Math.max(0, dy));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length) return;
      const c = vRef.current;
      if (c.scale <= 1.02) setV({ scale: 1, x: 0, y: 0, anim: true });
      setDrop((d) => {
        if (d > 110) onClose();
        return 0;
      });
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[96] flex flex-col"
      style={{ background: `rgba(0,0,0,${1 - Math.min(0.6, drop / 400)})` }}
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute z-[2] right-3 top-[max(0.75rem,env(safe-area-inset-top))] w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
      >
        <X size={22} />
      </button>
      <div
        ref={box}
        className="relative flex-1 overflow-hidden flex items-center justify-center"
        style={{ touchAction: "none" }}
        onDoubleClick={(e) => zoomAt(v.scale > 1 ? 1 : 2.5, e.clientX, e.clientY)}
        onWheel={(e) =>
          zoomAt(clamp(v.scale * (e.deltaY < 0 ? 1.15 : 0.87), 1, 5), e.clientX, e.clientY, false)
        }
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `translate(${v.x}px, ${v.y + drop}px) scale(${v.scale * (1 - Math.min(0.15, drop / 1500))})`,
            transition: v.anim ? "transform 0.22s cubic-bezier(.2,.8,.2,1)" : undefined,
            willChange: "transform",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
