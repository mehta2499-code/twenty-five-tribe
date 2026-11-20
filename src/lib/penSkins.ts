/**
 * Pen fight pens and medals. Pens are looks only (every pen plays the same);
 * you unlock them by winning. Our own designs in classic pen styles.
 *
 * Only wins against your 25 count (the server counts them), not bot games.
 */
import { supabase } from "@/integrations/supabase/client";
import { _get } from "@/lib/social";

export type Skin = {
  id: string;
  name: string;
  /** Wins needed to unlock. */
  wins: number;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  /** Barrel gradient (light → dark). */
  body: [string, string];
  cap: string;
  clip: string;
  tip: "ball" | "fountain" | "click";
  /** Extra look on the barrel. */
  pattern?: "stars" | "rainbow" | "stripes" | "shine";
};

export const SKINS: Skin[] = [
  {
    id: "classic",
    name: "Classic Blue",
    wins: 0,
    rarity: "Common",
    body: ["#5B8CFF", "#2448C9"],
    cap: "#13256B",
    clip: "#D9DEE7",
    tip: "ball",
  },
  {
    id: "exam",
    name: "Exam Black",
    wins: 1,
    rarity: "Common",
    body: ["#4A4A55", "#16161C"],
    cap: "#0B0B0F",
    clip: "#C9CED8",
    tip: "ball",
  },
  {
    id: "gel",
    name: "Gel Glide",
    wins: 2,
    rarity: "Common",
    body: ["#E8F1FF", "#9DB7E8"],
    cap: "#2448C9",
    clip: "#2448C9",
    tip: "ball",
    pattern: "shine",
  },
  {
    id: "neon",
    name: "Neon Click",
    wins: 3,
    rarity: "Rare",
    body: ["#C6FF6B", "#5FB51E"],
    cap: "#1E2A0B",
    clip: "#1E2A0B",
    tip: "click",
  },
  {
    id: "fountain",
    name: "Ink Fountain",
    wins: 5,
    rarity: "Rare",
    body: ["#2E2E38", "#08080C"],
    cap: "#08080C",
    clip: "#F2C14E",
    tip: "fountain",
  },
  {
    id: "candy",
    name: "Candy Stripe",
    wins: 7,
    rarity: "Rare",
    body: ["#FF9EC7", "#E0457B"],
    cap: "#FFFFFF",
    clip: "#E0457B",
    tip: "ball",
    pattern: "stripes",
  },
  {
    id: "chrome",
    name: "Chrome Steel",
    wins: 10,
    rarity: "Epic",
    body: ["#F2F4F8", "#7D8594"],
    cap: "#4A5160",
    clip: "#FFFFFF",
    tip: "click",
    pattern: "shine",
  },
  {
    id: "rainbow",
    name: "Rainbow Gel",
    wins: 15,
    rarity: "Epic",
    body: ["#FF6B7F", "#6B5BFF"],
    cap: "#1A1726",
    clip: "#FFD34D",
    tip: "ball",
    pattern: "rainbow",
  },
  {
    id: "gold",
    name: "Gold Executive",
    wins: 25,
    rarity: "Legendary",
    body: ["#FFE48A", "#B8860B"],
    cap: "#1A1408",
    clip: "#FFF4C2",
    tip: "fountain",
    pattern: "shine",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    wins: 40,
    rarity: "Legendary",
    body: ["#6B4BD6", "#160B3A"],
    cap: "#0B0620",
    clip: "#C9B8FF",
    tip: "fountain",
    pattern: "stars",
  },
  {
    id: "diamond",
    name: "Diamond",
    wins: 50,
    rarity: "Legendary",
    body: ["#E6FBFF", "#7FD3E8"],
    cap: "#FFFFFF",
    clip: "#B8F2FF",
    tip: "click",
    pattern: "shine",
  },
];
export const skinById = (id?: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** A red twin of a pen, for when both players pick the same one. */
export const RIVAL: Skin = {
  ...SKINS[0],
  id: "rival",
  name: "Rival Red",
  body: ["#FF6B7F", "#C81E3A"],
  cap: "#6E0E1F",
};

export const MEDALS = [
  { name: "Bronze", wins: 3, color: "#CD7F32", emoji: "🥉" },
  { name: "Silver", wins: 10, color: "#C0C7D1", emoji: "🥈" },
  { name: "Gold", wins: 25, color: "#F7C948", emoji: "🥇" },
  { name: "Diamond", wins: 50, color: "#7FD3E8", emoji: "💎" },
] as const;
export function medalFor(wins: number) {
  const have = [...MEDALS].reverse().find((m) => wins >= m.wins) ?? null;
  const next = MEDALS.find((m) => wins < m.wins) ?? null;
  return { have, next };
}
export const unlocked = (s: Skin, wins: number) => wins >= s.wins;

// ---- Wins ----
const SKIN_KEY = "tf.pen.skin";
/** Your pen fight wins against your 25 (the server counts them; bots don't count). */
export async function loadPenWins(): Promise<number> {
  if (_get().mode !== "live") return 0;
  const { data } = await supabase.rpc("my_pen_wins" as never);
  return Number(data ?? 0) || 0;
}

/** The pen you play with (only one you've unlocked). */
export function chosenSkin(wins: number): Skin {
  let id = "classic";
  try {
    id = localStorage.getItem(SKIN_KEY) ?? "classic";
  } catch {
    // ignore
  }
  const s = skinById(id);
  return unlocked(s, wins) ? s : SKINS[0];
}
export function chooseSkin(id: string) {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // ignore
  }
}
/** The pen to bring to an online game: your pick, if you've unlocked it. */
export async function myPenId(): Promise<string> {
  return chosenSkin(await loadPenWins()).id;
}

/** What a win just earned: a new pen and/or a medal (or nothing). */
export function unlockNote(before: number, after: number): string | undefined {
  const pens = SKINS.filter((s) => s.wins > before && s.wins <= after).map((s) => s.name);
  const medal = MEDALS.find((m) => m.wins > before && m.wins <= after);
  const bits = [
    ...(medal ? [`${medal.emoji} ${medal.name} medal`] : []),
    ...pens.map((n) => `🖊️ ${n} pen`),
  ];
  return bits.length ? `Unlocked: ${bits.join(" · ")}` : undefined;
}
