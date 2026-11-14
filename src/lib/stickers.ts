/**
 * The 25 sticker pack: big, tilted, sticker-style words and emoji.
 * Drawn with CSS, so there's nothing to download or host.
 */
export type Sticker = { id: string; text: string; bg: string; fg?: string; tilt: number };

export const STICKERS: Sticker[] = [
  { id: "nocap", text: "no cap 🧢", bg: "var(--lime)", tilt: -6 },
  { id: "slay", text: "slay 💅", bg: "var(--pink)", tilt: 5 },
  { id: "dead", text: "dead 💀", bg: "#F5F1FA", tilt: -4 },
  { id: "sayless", text: "say less", bg: "var(--sky)", tilt: 4 },
  { id: "only25", text: "25 only 🔒", bg: "var(--lime)", tilt: -3 },
  { id: "chai", text: "chai? ☕", bg: "var(--sun)", tilt: 6 },
  { id: "lit", text: "🔥🔥🔥", bg: "var(--hot, #FF6B5B)", tilt: -5 },
  { id: "omw", text: "omw 🏃", bg: "var(--sky)", tilt: 3 },
  { id: "bestie", text: "bestie 🫶", bg: "var(--pink)", tilt: -4 },
  { id: "spill", text: "spill the tea 🍵", bg: "var(--sun)", tilt: 5 },
  { id: "mood", text: "mood.", bg: "#F5F1FA", tilt: -6 },
  { id: "iykyk", text: "iykyk 👀", bg: "var(--lime)", tilt: 4 },
  { id: "lowkey", text: "lowkey 🤫", bg: "var(--sky)", tilt: -3 },
  { id: "goat", text: "GOAT 🐐", bg: "var(--sun)", tilt: 6 },
  { id: "bruh", text: "bruh.", bg: "#F5F1FA", tilt: -5 },
  { id: "proud", text: "so proud 🥹", bg: "var(--pink)", tilt: 3 },
  { id: "plans", text: "plans tonight?", bg: "var(--lime)", tilt: -4 },
  { id: "miss", text: "miss u 💌", bg: "var(--pink)", tilt: 5 },
  { id: "hbd", text: "HBD!! 🎂", bg: "var(--sun)", tilt: -6 },
  { id: "w", text: "W", bg: "var(--lime)", tilt: 4 },
  { id: "l", text: "L", bg: "var(--hot, #FF6B5B)", tilt: -4 },
  { id: "sus", text: "sus 🤨", bg: "var(--sky)", tilt: 5 },
  { id: "gm", text: "gm ☀️", bg: "var(--sun)", tilt: -3 },
  { id: "gn", text: "gn 🌙", bg: "#C9B8FF", tilt: 4 },
];

export const stickerById = (id: string) => STICKERS.find((s) => s.id === id);

/** gif:<url> or sticker:<id> → what to draw, or null. Only GIPHY links are trusted. */
export function parseRich(ref?: string | null) {
  if (!ref) return null;
  if (ref.startsWith("gif:")) {
    const url = ref.slice(4);
    return /^https:\/\/media\d*\.giphy\.com\//.test(url) ? { kind: "gif" as const, url } : null;
  }
  if (ref.startsWith("sticker:")) {
    const s = stickerById(ref.slice(8));
    return s ? { kind: "sticker" as const, sticker: s } : null;
  }
  return null;
}
