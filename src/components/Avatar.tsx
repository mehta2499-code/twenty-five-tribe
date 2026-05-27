type Props = {
  initials?: string;
  src?: string;
  color?: string;
  size?: number;
  ring?: "active" | "quiet" | "none";
  className?: string;
};

export function Avatar({ initials = "", src, color = "#7F77DD", size = 56, ring = "none", className = "" }: Props) {
  const ringClass =
    ring === "active" ? "ring-glow" : ring === "quiet" ? "ring-quiet" : "";
  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center font-semibold text-foreground shrink-0 ${ringClass} ${className}`}
      style={{
        width: size,
        height: size,
        background: src
          ? "var(--surface-2)"
          : `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 60%, #000))`,
        fontSize: size * 0.36,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={initials}
          loading="lazy"
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        initials
      )}
    </div>
  );
}
