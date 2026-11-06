/** Little coloured illustrations for the game tiles (sticker style: dark outline). */
const EDGE = "#0B0A10";

export type ArtKind =
  | "kachuful"
  | "trivia"
  | "ludo"
  | "word"
  | "mystery"
  | "tap-rush"
  | "quick-math"
  | "colour-clash"
  | "pair-up"
  | "odd-one-out"
  | "pattern"
  | "reflex";

export function GameArt({ kind, size = 64 }: { kind: ArtKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ filter: `drop-shadow(2px 2px 0 ${EDGE})`, overflow: "visible" }}
    >
      {kind === "kachuful" && <Cards />}
      {kind === "trivia" && <Bolt />}
      {kind === "ludo" && <Die />}
      {kind === "word" && <Tiles />}
      {kind === "mystery" && <Mystery />}
      {kind === "tap-rush" && <Target />}
      {kind === "quick-math" && <MathTiles />}
      {kind === "colour-clash" && <PaletteArt />}
      {kind === "pair-up" && <Pairs />}
      {kind === "odd-one-out" && <OddOne />}
      {kind === "pattern" && <Simon />}
      {kind === "reflex" && <Stopwatch />}
    </svg>
  );
}

function Cards() {
  return (
    <g strokeLinejoin="round">
      <g transform="rotate(-16 32 40)">
        <rect x="12" y="10" width="28" height="40" rx="5" fill="#FFF8EC" stroke={EDGE} strokeWidth="2.5" />
        <path d="M26 22c-4 5-8 7-8 11a4 4 0 0 0 7 2.5l-1.5 5h5l-1.5-5a4 4 0 0 0 7-2.5c0-4-4-6-8-11z" fill={EDGE} />
      </g>
      <g transform="rotate(14 32 40)">
        <rect x="24" y="10" width="28" height="40" rx="5" fill="#FFF8EC" stroke={EDGE} strokeWidth="2.5" />
        <path d="M38 40c-6-4.5-9-8-9-11.5a4.5 4.5 0 0 1 9-1.5 4.5 4.5 0 0 1 9 1.5c0 3.5-3 7-9 11.5z" fill="#F15B91" stroke={EDGE} strokeWidth="1.5" />
        <text x="29" y="19" fontSize="8" fontWeight="800" fill="#F15B91" fontFamily="system-ui">A</text>
      </g>
    </g>
  );
}

function Bolt() {
  return (
    <g strokeLinejoin="round">
      <circle cx="32" cy="32" r="26" fill="#F15B91" stroke={EDGE} strokeWidth="2.5" />
      <path d="M36 8 16 36h13l-4 20 22-30H33z" fill="#F4C96B" stroke={EDGE} strokeWidth="2.5" />
      <circle cx="47" cy="16" r="3" fill="#fff" />
    </g>
  );
}

function Die() {
  const pip = (x: number, y: number, c: string) => (
    <circle cx={x} cy={y} r="5" fill={c} stroke={EDGE} strokeWidth="1.5" />
  );
  return (
    <g strokeLinejoin="round" transform="rotate(-10 32 32)">
      <rect x="9" y="9" width="46" height="46" rx="11" fill="#FFF8EC" stroke={EDGE} strokeWidth="2.5" />
      {pip(21, 21, "#F15B91")}
      {pip(43, 21, "#C1EF62")}
      {pip(32, 32, EDGE)}
      {pip(21, 43, "#77B9E8")}
      {pip(43, 43, "#F4C96B")}
    </g>
  );
}

function Tiles() {
  const tile = (x: number, y: number, c: string, ch: string, r: number) => (
    <g transform={`rotate(${r} ${x + 11} ${y + 11})`}>
      <rect x={x} y={y} width="22" height="22" rx="5" fill={c} stroke={EDGE} strokeWidth="2.5" />
      <text
        x={x + 11}
        y={y + 16.5}
        textAnchor="middle"
        fontSize="15"
        fontWeight="800"
        fill={EDGE}
        fontFamily="system-ui"
      >
        {ch}
      </text>
    </g>
  );
  return (
    <g strokeLinejoin="round">
      {tile(4, 22, "#C1EF62", "W", -8)}
      {tile(21, 14, "#F4C96B", "O", 4)}
      {tile(38, 22, "#C1EF62", "W", 10)}
    </g>
  );
}

function Mystery() {
  return (
    <g strokeLinejoin="round">
      <rect x="8" y="8" width="48" height="48" rx="12" fill="#F15B91" stroke={EDGE} strokeWidth="2.5" transform="rotate(-8 32 32)" />
      <text
        x="32"
        y="45"
        textAnchor="middle"
        fontSize="38"
        fontWeight="900"
        fill="#F4C96B"
        stroke={EDGE}
        strokeWidth="2"
        fontFamily="system-ui"
      >
        ?
      </text>
      <path d="M52 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#F4C96B" stroke={EDGE} strokeWidth="1.5" />
    </g>
  );
}

function Target() {
  return (
    <g strokeLinejoin="round">
      <circle cx="30" cy="34" r="24" fill="#F15B91" stroke={EDGE} strokeWidth="2.5" />
      <circle cx="30" cy="34" r="16" fill="#FFF8EC" stroke={EDGE} strokeWidth="2" />
      <circle cx="30" cy="34" r="8" fill="#F15B91" stroke={EDGE} strokeWidth="2" />
      <path d="M30 34 52 12" stroke={EDGE} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M50 6l2 6 6 2-5 4-5-1-1-5z" fill="#F4C96B" stroke={EDGE} strokeWidth="1.8" />
    </g>
  );
}

function MathTiles() {
  const t = (x: number, y: number, c: string, sym: string, r: number) => (
    <g transform={`rotate(${r} ${x + 12} ${y + 12})`}>
      <rect x={x} y={y} width="24" height="24" rx="6" fill={c} stroke={EDGE} strokeWidth="2.5" />
      <text x={x + 12} y={y + 18.5} textAnchor="middle" fontSize="18" fontWeight="900" fill={EDGE} fontFamily="system-ui">
        {sym}
      </text>
    </g>
  );
  return (
    <g strokeLinejoin="round">
      {t(6, 6, "#F4C96B", "+", -6)}
      {t(34, 6, "#77B9E8", "−", 5)}
      {t(6, 34, "#C1EF62", "×", 4)}
      {t(34, 34, "#F15B91", "÷", -5)}
    </g>
  );
}

function PaletteArt() {
  return (
    <g strokeLinejoin="round">
      <path
        d="M32 6C16 6 5 17 5 31c0 13 10 23 22 23 5 0 6-3 5-6s0-6 5-6h7c9 0 15-6 15-14C59 15 47 6 32 6z"
        fill="#FFF8EC"
        stroke={EDGE}
        strokeWidth="2.5"
      />
      <circle cx="19" cy="24" r="5" fill="#F15B91" stroke={EDGE} strokeWidth="1.5" />
      <circle cx="31" cy="16" r="5" fill="#F4C96B" stroke={EDGE} strokeWidth="1.5" />
      <circle cx="44" cy="20" r="5" fill="#77B9E8" stroke={EDGE} strokeWidth="1.5" />
      <circle cx="17" cy="38" r="5" fill="#C1EF62" stroke={EDGE} strokeWidth="1.5" />
      <circle cx="48" cy="33" r="4" fill="#77B9E8" stroke={EDGE} strokeWidth="1.5" />
    </g>
  );
}

function Pairs() {
  const star = "M0,-1 L0.29,-0.4 L0.95,-0.31 L0.48,0.15 L0.59,0.81 L0,0.5 L-0.59,0.81 L-0.48,0.15 L-0.95,-0.31 L-0.29,-0.4 Z";
  return (
    <g strokeLinejoin="round">
      <g transform="rotate(-12 20 34)">
        <rect x="6" y="14" width="28" height="38" rx="6" fill="#77B9E8" stroke={EDGE} strokeWidth="2.5" />
        <path d={star} transform="translate(20 33) scale(9)" fill="#F4C96B" stroke={EDGE} strokeWidth="0.2" />
      </g>
      <g transform="rotate(12 44 34)">
        <rect x="30" y="14" width="28" height="38" rx="6" fill="#77B9E8" stroke={EDGE} strokeWidth="2.5" />
        <path d={star} transform="translate(44 33) scale(9)" fill="#F4C96B" stroke={EDGE} strokeWidth="0.2" />
      </g>
    </g>
  );
}

function OddOne() {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const odd = r === 1 && c === 2;
      cells.push(
        <circle
          key={`${r}${c}`}
          cx={14 + c * 18}
          cy={14 + r * 18}
          r={odd ? 8 : 7}
          fill={odd ? "#F15B91" : "#F4C96B"}
          stroke={EDGE}
          strokeWidth="2"
        />,
      );
    }
  return (
    <g strokeLinejoin="round">
      <rect x="2" y="2" width="60" height="60" rx="12" fill="#77B9E8" stroke={EDGE} strokeWidth="2.5" />
      {cells}
    </g>
  );
}

function Simon() {
  return (
    <g strokeLinejoin="round" stroke={EDGE} strokeWidth="2.5">
      <path d="M32 32V6A26 26 0 0 0 6 32z" fill="#C1EF62" />
      <path d="M32 32V6a26 26 0 0 1 26 26z" fill="#F15B91" />
      <path d="M32 32h26a26 26 0 0 1-26 26z" fill="#77B9E8" />
      <path d="M32 32v26A26 26 0 0 1 6 32z" fill="#F4C96B" />
      <circle cx="32" cy="32" r="8" fill="#1E1A28" />
    </g>
  );
}

function Stopwatch() {
  return (
    <g strokeLinejoin="round">
      <rect x="27" y="3" width="10" height="7" rx="2" fill="#F15B91" stroke={EDGE} strokeWidth="2" />
      <circle cx="32" cy="36" r="24" fill="#F4C96B" stroke={EDGE} strokeWidth="2.5" />
      <circle cx="32" cy="36" r="17" fill="#FFF8EC" stroke={EDGE} strokeWidth="2" />
      <path d="M32 36V24" stroke={EDGE} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 36l8 5" stroke="#F15B91" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="36" r="2.5" fill={EDGE} />
    </g>
  );
}
