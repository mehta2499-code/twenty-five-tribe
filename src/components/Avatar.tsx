type Props = {
  initials?: string;
  src?: string;
  color?: string;
  size?: number;
  ring?: "active" | "quiet" | "purple" | "none";
  className?: string;
};

export function Avatar({
  initials = "",
  src,
  color = "#7F77DD",
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
          ? "#22222A"
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

  const ringCls =
    ring === "active" ? "ring-active" : ring === "purple" ? "ring-purple" : "ring-quiet";

  return (
    <div className={`${ringCls} ${className}`} style={{ display: "inline-block" }}>
      <div className="rounded-full bg-background p-[2px]">{inner}</div>
    </div>
  );
}
