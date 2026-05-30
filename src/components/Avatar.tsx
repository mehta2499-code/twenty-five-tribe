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
  color = "#7B6FD4",
  size = 56,
  ring = "none",
  className = "",
}: Props) {
  const inner = (
    <div
      className="relative rounded-full overflow-hidden flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: src
          ? "#1A2D3E"
          : `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, #000))`,
        fontSize: size * 0.36,
      }}
    >
      {src ? (
        <img src={src} alt={initials} loading="lazy" draggable={false} className="h-full w-full object-cover" />
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
    ring === "active" ? "ring-active"
    : ring === "purple" ? "ring-purple"
    : ring === "drift" ? "ring-drift"
    : "ring-quiet";

  return (
    <div className={`${ringCls} ${className}`} style={{ display: "inline-block" }}>
      <div className="rounded-full p-[2px]" style={{ background: "#0D1820" }}>{inner}</div>
    </div>
  );
}
