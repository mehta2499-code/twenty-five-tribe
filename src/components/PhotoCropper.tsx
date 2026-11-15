/**
 * Crop a profile photo: drag to move, pinch (or the slider) to zoom, inside a
 * round frame. Gives back a square JPEG data URL (600×600).
 */
import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

const OUT = 600;

export function PhotoCropper({
  src,
  onDone,
  onCancel,
}: {
  src: string;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState(280);
  // Zoom 1 = the photo just covers the circle. x/y = offset of the photo centre (px).
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  useEffect(() => {
    const size = () => setFrame(Math.min(320, window.innerWidth - 48));
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, []);

  // How big the photo is drawn: its short side fills the frame at zoom 1.
  const base = img ? frame / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : frame;
  const h = img ? img.naturalHeight * base * zoom : frame;
  // Keep the circle covered: the photo can't be dragged past its edges.
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    const cw = img ? img.naturalWidth * base * z : frame;
    const ch = img ? img.naturalHeight * base * z : frame;
    const mx = Math.max(0, (cw - frame) / 2);
    const my = Math.max(0, (ch - frame) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };
  const setZoomTo = (z: number) => {
    const nz = Math.max(1, Math.min(4, z));
    setZoom(nz);
    setPos((p) => clamp(p, nz));
  };

  const down = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomTo((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist);
      return;
    }
    setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const done = () => {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = OUT;
    c.height = OUT;
    const ctx = c.getContext("2d")!;
    // The frame (in screen px) maps to the output square.
    const scale = OUT / frame;
    const left = frame / 2 + pos.x - w / 2;
    const top = frame / 2 + pos.y - h / 2;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, left * scale, top * scale, w * scale, h * scale);
    onDone(c.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-6"
      style={{ background: "rgba(5,5,8,0.96)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Crop your photo"
    >
      <p className="text-white font-bold text-lg mb-1">Move and zoom</p>
      <p className="text-white/70 text-sm mb-5">Drag the photo. Pinch or use the slider to zoom.</p>
      <div
        ref={frameRef}
        className="relative overflow-hidden touch-none select-none"
        style={{ width: frame, height: frame, borderRadius: 24, background: "#111" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => setZoomTo(zoom * (e.deltaY < 0 ? 1.08 : 0.93))}
      >
        {img && (
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute max-w-none pointer-events-none"
            style={{
              width: w,
              height: h,
              left: frame / 2 + pos.x - w / 2,
              top: frame / 2 + pos.y - h / 2,
            }}
          />
        )}
        {/* The round frame: everything outside it is dimmed. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: 24,
            background: "radial-gradient(circle at center, transparent 49.5%, rgba(0,0,0,0.6) 50%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 m-auto rounded-full pointer-events-none"
          style={{ border: "2px solid rgba(255,255,255,0.85)" }}
        />
      </div>
      <div className="flex items-center gap-3 mt-5 w-full" style={{ maxWidth: frame }}>
        <ZoomOut size={18} className="text-white/70 shrink-0" aria-hidden="true" />
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoomTo(Number(e.target.value))}
          aria-label="Zoom"
          className="flex-1 accent-[#C1EF62]"
        />
        <ZoomIn size={18} className="text-white/70 shrink-0" aria-hidden="true" />
      </div>
      <div className="flex gap-3 mt-6 w-full" style={{ maxWidth: frame }}>
        <button onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button onClick={done} disabled={!img} className="btn-primary flex-1">
          Use photo
        </button>
      </div>
    </div>
  );
}
