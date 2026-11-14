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

/** The 2 (with its base running into the 5's top bar), then the 5's body. */
const LOGO_PARTS = LOGO_PATH.split(" M 55 80").map((p, i) => (i === 0 ? p : `M 55 80${p}`));

/**
 * The 25 mark drawing itself, stroke by stroke. Used on the opening screen.
 * Its frame is centred on the drawn shape so it sits dead centre on screen.
 */
export function AnimatedLogo({
  height = 180,
  color = "var(--lime)",
}: {
  height?: number;
  color?: string;
}) {
  return (
    <svg
      className="logo-draw"
      height={height}
      width={(height * 104) / 146}
      viewBox="4.5 0 104 146"
      fill="none"
      stroke={color}
      strokeWidth={6.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="25"
    >
      {LOGO_PARTS.map((d, i) => (
        <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 0.75}s` }} />
      ))}
    </svg>
  );
}

/** 25 points spaced evenly along the 25 mark: one dot per seat. */
const SEAT_DOTS: [number, number][] = [
  [19, 31],
  [25.4, 16.7],
  [39, 8.8],
  [54.8, 9.4],
  [66.6, 19.4],
  [68.5, 35],
  [60.4, 48.5],
  [48, 58.4],
  [34.9, 67.5],
  [21.8, 76.7],
  [27.1, 80],
  [43.1, 80],
  [59.1, 80],
  [75, 80],
  [91, 80],
  [54.3, 86.9],
  [53, 100.8],
  [65.1, 94.7],
  [78.9, 95.2],
  [89.9, 103.3],
  [94, 116.4],
  [89.5, 129.3],
  [78.1, 137.1],
  [64.4, 139],
  [50.9, 135.7],
];

/**
 * The 25 mark drawn as 25 dots, one per seat. `filled` dots light up lime
 * (your seats so far). `animate` lights them one by one, on a loop (loader).
 */
export function SeatLogo({
  filled = 25,
  height = 40,
  animate = false,
  label,
}: {
  filled?: number;
  height?: number;
  animate?: boolean;
  label?: string;
}) {
  const r = height < 50 ? 6.2 : 4.8;
  return (
    <svg
      height={height}
      width={(height * 104) / 146}
      viewBox="4.5 0 104 146"
      className={animate ? "seatlogo-anim" : undefined}
      role="img"
      aria-label={label ?? `${Math.min(filled, 25)} of 25 seats filled`}
    >
      {SEAT_DOTS.map(([x, y], i) => {
        const on = animate || i < filled;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill={on && !animate ? "var(--lime)" : "var(--fill-2)"}
            style={
              animate
                ? { animationDelay: `${i * 0.07}s` }
                : on
                  ? { filter: "drop-shadow(0 0 3px rgba(193,239,98,0.55))" }
                  : undefined
            }
          />
        );
      })}
    </svg>
  );
}
