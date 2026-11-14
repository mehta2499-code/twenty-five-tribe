/**
 * 3D art instead of emojis.
 *  • <Glyph3D name="cheers" animate />  our own Blender renders (public/assets/3d),
 *    several frames each so they move.
 *  • <Glyph3D emoji="🍕" />              Microsoft Fluent Emoji 3D (MIT) for everything else.
 *  • <EmojiText text="Pizza 🍕 night" />  swaps any emoji inside a string for its 3D image.
 * If an image is missing, the plain emoji shows instead, so nothing goes blank.
 */
import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { EMOJI3D } from "@/lib/emoji3d";

/** Our renders and how many animation frames each has. */
export const SPRITES = {
  ball: 1,
  ballot: 1,
  beer: 1,
  cake: 2,
  camera: 1,
  chai: 4,
  cheers: 4,
  dice: 6,
  flame: 4,
  headphones: 2,
  highfive: 4,
  laugh: 2,
  notes: 3,
  paddle: 3,
  partyhat: 2,
  pizza: 1,
  plane: 3,
  popper: 2,
  sparkle: 3,
  wave: 4,
  whisper: 3,
  wine: 1,
  winefallen: 1,
} as const;
export type SpriteName = keyof typeof SPRITES;

const spriteSrc = (name: SpriteName, i: number) => `/assets/3d/${name}/${i}.webp`;
const strip = (e: string) => e.replace(/️|︎/g, "");
const EMOJI_KEYS = new Map(Object.entries(EMOJI3D).map(([e, k]) => [strip(e), k]));
export const emojiSrc = (e: string) => {
  const k = EMOJI_KEYS.get(strip(e));
  return k ? `/assets/emoji3d/${k}.webp` : null;
};

const reduced = () =>
  typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Warm the browser cache so a sprite never pops in blank mid-animation. */
export function preloadSprites(names: SpriteName[]) {
  if (typeof window === "undefined") return;
  for (const n of names)
    for (let i = 0; i < SPRITES[n]; i++) {
      const img = new Image();
      img.src = spriteSrc(n, i);
    }
}

export function Glyph3D({
  name,
  emoji,
  size = 24,
  animate = false,
  fps = 8,
  loop = true,
  className = "",
  style,
  label,
}: {
  name?: SpriteName;
  emoji?: string;
  size?: number;
  animate?: boolean;
  fps?: number;
  loop?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; decorative (hidden) when left out. */
  label?: string;
}) {
  const frames = name ? SPRITES[name] : 1;
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!name || !animate || frames < 2 || reduced()) return;
    let k = 0;
    const t = setInterval(() => {
      k += 1;
      if (!loop && k >= frames) return clearInterval(t);
      setI(k % frames);
    }, 1000 / fps);
    return () => clearInterval(t);
  }, [name, animate, frames, fps, loop]);

  const src = name ? spriteSrc(name, i) : emoji ? emojiSrc(emoji) : null;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  if (!src || broken)
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.9, lineHeight: 1, display: "inline-block", ...style }}
        {...a11y}
      >
        {emoji ?? ""}
      </span>
    );
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      loading={name ? "eager" : "lazy"}
      draggable={false}
      onError={() => setBroken(true)}
      className={`inline-block select-none ${className}`}
      style={{
        width: size,
        height: size,
        maxWidth: "none",
        objectFit: "contain",
        verticalAlign: "-0.2em",
        ...style,
      }}
      {...a11y}
    />
  );
}

// Longest first so multi-part emojis (👩‍🍳) win over their pieces.
const EMOJI_RE = (() => {
  const keys = [...new Set(Object.keys(EMOJI3D).flatMap((e) => [e, strip(e)]))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(${keys.join("|")})️?`, "gu");
})();

/** Text with every known emoji swapped for its 3D image (sized to the text). */
export function EmojiText({ text, size = "1.15em" }: { text: string; size?: number | string }) {
  if (!text) return null;
  const parts: (string | { e: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ e: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, k) =>
        typeof p === "string" ? (
          <Fragment key={k}>{p}</Fragment>
        ) : (
          <img
            key={k}
            src={emojiSrc(p.e) ?? ""}
            alt={p.e}
            decoding="async"
            loading="lazy"
            draggable={false}
            className="inline-block select-none"
            style={{ width: size, height: size, verticalAlign: "-0.22em", objectFit: "contain" }}
          />
        ),
      )}
    </>
  );
}
