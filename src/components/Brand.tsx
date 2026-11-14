/**
 * 25's own visual language: the Seat Ring (25 seats around a table) and the
 * tab glyphs drawn for 25, instead of stock icons.
 */
import type { CSSProperties } from "react";

/** 25 seats in a ring; `filled` of them taken (lime), the rest open. */
export function SeatRing({
  filled = 25,
  size = 28,
  stroke = 1.6,
  style,
  label,
}: {
  filled?: number;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  label?: string;
}) {
  const seats = Array.from({ length: 25 }, (_, i) => {
    const a = (i / 25) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a), on: i < filled };
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle
        cx="50"
        cy="50"
        r="27"
        fill="var(--fill)"
        stroke="var(--line)"
        strokeWidth={stroke * 1.5}
      />
      {seats.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={6}
          fill={s.on ? "var(--lime)" : "transparent"}
          stroke={s.on ? "#0B0A10" : "var(--ink-2)"}
          strokeWidth={s.on ? stroke * 1.4 : stroke * 2}
          opacity={s.on ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}

// ---------- Tab glyphs (24px, currentColor) ----------
type G = { size?: number; active?: boolean };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** The Table: a round table with chairs around it. */
export function TableGlyph({ size = 22, active }: G) {
  const chairs = Array.from({ length: 6 }, (_, i) => (i / 6) * 360);
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="5.2" fill={active ? "currentColor" : "none"} />
      {chairs.map((deg) => (
        <rect
          key={deg}
          x="10.4"
          y="1.6"
          width="3.2"
          height="2.6"
          rx="1"
          fill="currentColor"
          stroke="none"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Feed: a short stack of cards (it ends when you're caught up). */
export function FeedGlyph({ size = 22, active }: G) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="3" width="14" height="10" rx="2.5" fill={active ? "currentColor" : "none"} />
      <path d="M5 17h14M7 21h10" />
    </svg>
  );
}

/** Blink: an eye that closes (one look, then gone). */
export function BlinkGlyph({ size = 26 }: G) {
  return (
    <svg {...base(size)} strokeWidth={2.3}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

/** Drop: a camera with a spark (one real photo, same time for everyone). */
export function DropGlyph({ size = 26 }: G) {
  return (
    <svg {...base(size)} strokeWidth={2.3}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M12.8 9.2 10.6 13h2.6l-1.9 3.6" />
    </svg>
  );
}

/** Chats: two bubbles, talking. */
export function ChatsGlyph({ size = 22, active }: G) {
  return (
    <svg {...base(size)}>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h8A2.5 2.5 0 0 1 17 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5z"
        fill={active ? "currentColor" : "none"}
      />
      <path d="M19.5 9.5A2.5 2.5 0 0 1 21 12v4.5a2.5 2.5 0 0 1-2 2.45V21l-3-2h-3.5a2.5 2.5 0 0 1-2.3-1.5" />
    </svg>
  );
}

/** Games: a die mid-roll. */
export function GamesGlyph({ size = 22, active }: G) {
  return (
    <svg {...base(size)}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        transform="rotate(-8 12 12)"
        fill={active ? "currentColor" : "none"}
      />
      <g fill={active ? "var(--surface)" : "currentColor"} stroke="none">
        <circle cx="8.6" cy="9" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="15.4" cy="15" r="1.5" />
      </g>
    </svg>
  );
}
