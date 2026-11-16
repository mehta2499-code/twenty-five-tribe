/**
 * Our own Staunton-style chess pieces (vector, drawn for 25): big, shaded and
 * outlined so they read clearly on any square. White is cream, black charcoal.
 */
type Kind = "k" | "q" | "r" | "b" | "n" | "p";

const STYLE = {
  w: { top: "#FFFFFF", bottom: "#D9D6CF", line: "#3B3934", detail: "#3B3934" },
  b: { top: "#6E6B66", bottom: "#2B2A27", line: "#151412", detail: "#A9A59C" },
};

function Shapes({ kind, detail }: { kind: Kind; detail: string }) {
  // Shared base: a wide foot and a step, like a turned wooden piece.
  const base = (
    <>
      <rect x="20" y="84" width="60" height="9" rx="3.5" />
      <rect x="26" y="77" width="48" height="8.5" rx="3" />
    </>
  );
  switch (kind) {
    case "p":
      return (
        <>
          {base}
          <path d="M39 77 C40 66 43 59 44 53 L56 53 C57 59 60 66 61 77 Z" />
          <ellipse cx="50" cy="52" rx="13" ry="4" />
          <circle cx="50" cy="35" r="14" />
        </>
      );
    case "r":
      return (
        <>
          {base}
          <path d="M33 77 C35 64 36 52 35 42 L65 42 C64 52 65 64 67 77 Z" />
          <rect x="29" y="35" width="42" height="8" rx="2.5" />
          <path d="M29 36 V17 H38 V24 H45.5 V17 H54.5 V24 H62 V17 H71 V36 Z" />
        </>
      );
    case "b":
      return (
        <>
          {base}
          <path d="M37 77 C40 68 44 62 44 56 L56 56 C56 62 60 68 63 77 Z" />
          <ellipse cx="50" cy="55" rx="15" ry="4.2" />
          <path d="M50 17 C65 28 68 42 59 52 L41 52 C32 42 35 28 50 17 Z" />
          <circle cx="50" cy="13" r="5" />
          <path
            d="M56 28 L47 40"
            fill="none"
            stroke={detail}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      );
    case "q":
      return (
        <>
          {base}
          <path d="M34 77 C38 64 40 52 37 42 L63 42 C60 52 62 64 66 77 Z" />
          <ellipse cx="50" cy="42" rx="17" ry="4.5" />
          <path d="M31 41 L23 19 L36 31 L37 13 L45.5 29 L50 10 L54.5 29 L63 13 L64 31 L77 19 L69 41 Z" />
          <circle cx="23" cy="17" r="4" />
          <circle cx="37" cy="11" r="4" />
          <circle cx="50" cy="8" r="4.2" />
          <circle cx="63" cy="11" r="4" />
          <circle cx="77" cy="17" r="4" />
        </>
      );
    case "k":
      return (
        <>
          {base}
          <path d="M34 77 C38 64 40 52 37 42 L63 42 C60 52 62 64 66 77 Z" />
          <ellipse cx="50" cy="42" rx="17" ry="4.5" />
          <path d="M33 41 C28 30 33 22 42 25 C45 21 55 21 58 25 C67 22 72 30 67 41 Z" />
          <rect x="46.5" y="4" width="7" height="19" rx="1.5" />
          <rect x="41" y="9" width="18" height="6.5" rx="1.5" />
        </>
      );
    case "n":
      return (
        <>
          {base}
          <path d="M33 77 C29 63 36 54 45 47 C38 47 31 51 25 53 C18 51 17 44 22 39 C30 30 36 22 45 18 L47 9 L53 16 C69 19 78 36 75 55 C74 65 70 72 68 77 Z" />
          <circle cx="42" cy="29" r="2.8" fill={detail} stroke="none" />
          <path
            d="M57 21 C68 31 71 50 66 70"
            fill="none"
            stroke={detail}
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M27 46 L31 45"
            fill="none"
            stroke={detail}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      );
  }
}

/** One piece. `p` is the board letter: upper case white, lower case black. */
export function ChessPiece({ p, size }: { p: string; size: number }) {
  const color = p === p.toUpperCase() ? "w" : "b";
  const s = STYLE[color];
  const id = `cp-${color}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{
        display: "block",
        filter: "drop-shadow(0 2px 1.5px rgba(0,0,0,0.35))",
        overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={s.top} />
          <stop offset="1" stopColor={s.bottom} />
        </linearGradient>
      </defs>
      {/* Drawn a little narrow, then widened so they sit chunky on the square. */}
      <g
        fill={`url(#${id})`}
        stroke={s.line}
        strokeWidth="2.8"
        strokeLinejoin="round"
        transform="translate(50 0) scale(1.16 1) translate(-50 0)"
      >
        <Shapes kind={p.toLowerCase() as Kind} detail={s.detail} />
      </g>
    </svg>
  );
}
