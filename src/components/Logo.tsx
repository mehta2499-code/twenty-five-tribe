/**
 * The 25 mark: one gold line where the 2's base runs on into the 5's top bar.
 * Drawn from the founder's sketch. Line weight grows at small sizes so it stays crisp.
 */
export const LOGO_PATH =
  "M19 31 C 21 16, 33 8, 46 8 C 60 8, 69 17, 69 30 C 69 42, 61 49, 50 57 L 17 80 L 91 80 M 55 80 L 53 101 C 61 94, 72 92, 81 96 C 92 101, 96 113, 93 123 C 89 134, 78 139, 66 139 C 57 139, 50 136, 45 132";

export function Logo({
  height = 48,
  color = "var(--lime)",
  title = "25",
  className = "",
}: {
  height?: number;
  color?: string;
  title?: string;
  className?: string;
}) {
  const stroke = height < 40 ? 10 : height < 90 ? 8 : height < 180 ? 6.5 : 5.5;
  return (
    <svg
      className={className}
      height={height}
      width={(height * 104) / 146}
      viewBox="-2 0 104 146"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      <path d={LOGO_PATH} />
    </svg>
  );
}
