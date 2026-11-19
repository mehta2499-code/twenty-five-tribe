/**
 * Card suit symbols drawn as shapes (not emoji or font glyphs), so they look
 * the same, crisp and flat, on every phone.
 */
export type SuitKey = "S" | "H" | "D" | "C";

const PATHS: Record<SuitKey, string> = {
  // Heart
  H: "M50 88 C46 84 8 58 8 32 C8 18 19 8 32 8 C40 8 46 12 50 19 C54 12 60 8 68 8 C81 8 92 18 92 32 C92 58 54 84 50 88 Z",
  // Diamond
  D: "M50 4 L86 50 L50 96 L14 50 Z",
  // Spade (with stem)
  S: "M50 6 C56 18 92 40 92 62 C92 75 82 84 70 84 C62 84 56 80 53 74 C54 82 57 89 64 94 L36 94 C43 89 46 82 47 74 C44 80 38 84 30 84 C18 84 8 75 8 62 C8 40 44 18 50 6 Z",
  // Club (three leaves and a stem)
  C: "M50 6 C63 6 72 16 72 28 C72 34 70 39 66 43 C70 41 74 40 78 40 C90 40 98 50 98 62 C98 74 89 84 77 84 C67 84 59 78 55 70 C55 80 58 88 66 94 L34 94 C42 88 45 80 45 70 C41 78 33 84 23 84 C11 84 2 74 2 62 C2 50 10 40 22 40 C26 40 30 41 34 43 C30 39 28 34 28 28 C28 16 37 6 50 6 Z",
};

export const SUIT_RED: Record<SuitKey, boolean> = { H: true, D: true, S: false, C: false };

export function SuitIcon({
  suit,
  size = 16,
  color,
  style,
}: {
  suit: SuitKey;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <path d={PATHS[suit]} fill={color ?? (SUIT_RED[suit] ? "#D3243B" : "#14121C")} />
    </svg>
  );
}
