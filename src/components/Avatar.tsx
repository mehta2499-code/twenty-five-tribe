import { useEffect, useRef, useState } from "react";

type Props = {
  initials?: string;
  src?: string;
  color?: string;
  size?: number;
  ring?: "active" | "quiet" | "purple" | "drift" | "gold" | "none";
  className?: string;
};

export function Avatar({
  initials = "",
  src,
  color = "var(--blue)",
  size = 56,
  ring = "none",
  className = "",
}: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // A photo can fail before the page becomes interactive (server-rendered pages),
  // so also check once on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0 && src) setFailed(src);
  }, [src]);
  const showImg = !!src && failed !== src;
  const inner = (
    <div
      className="relative rounded-full overflow-hidden flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        background: showImg
          ? "var(--bg-surface)"
          : `linear-gradient(145deg, color-mix(in oklab, ${color} 88%, #fff), color-mix(in oklab, ${color} 78%, #000))`,
        color: showImg ? undefined : "var(--on-dark-fill)",
        fontSize: size * 0.36,
        transition: "opacity 200ms var(--ease)",
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={initials}
          loading="lazy"
          draggable={false}
          className="h-full w-full object-cover avatar-img"
          ref={imgRef}
          onError={() => setFailed(src ?? null)}
        />
      ) : (
        initials
      )}
    </div>
  );

  if (ring === "none") return <div className={className}>{inner}</div>;

  if (ring === "gold") {
    return (
      <div className={`ring-gold-glow ${className}`} style={{ display: "inline-block" }}>
        {inner}
      </div>
    );
  }

  const ringCls =
    ring === "active"
      ? "ring-active"
      : ring === "purple"
        ? "ring-purple"
        : ring === "drift"
          ? "ring-drift"
          : "ring-quiet";

  return (
    <div className={`${ringCls} ${className}`} style={{ display: "inline-block" }}>
      <div className="rounded-full p-[2px]" style={{ background: "var(--bg-surface)" }}>
        {inner}
      </div>
    </div>
  );
}
