/** Small coloured line icon that sits inline with text (instead of an emoji). */
import type { LucideIcon } from "lucide-react";

export function Ico({
  i: Icon,
  c,
  size = 16,
  className = "",
}: {
  i: LucideIcon;
  /** Colour; defaults to the text colour. */
  c?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Icon
      size={size}
      strokeWidth={2.25}
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{ color: c, verticalAlign: "-0.15em" }}
    />
  );
}

/** Colours for the recurring meanings, so a flame is always the same flame. */
export const TONE = {
  streak: "var(--amber)",
  oneWay: "var(--sky)",
  mutual: "var(--lime)",
  win: "var(--sun)",
  birthday: "var(--pink)",
  done: "var(--mint)",
} as const;
