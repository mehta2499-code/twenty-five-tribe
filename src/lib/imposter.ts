/**
 * Imposter — a party game for 4 to 20 people. Pure rules, no UI.
 *
 * Everyone gets the same secret word except the imposter(s). Take turns giving
 * one clue each, then vote. Catch the imposter and the crew wins, unless the
 * imposter then guesses the word. Vote out a crew member and the imposters win.
 */

export type ImpPlayer = { id: string; name: string; initials: string };
export type ImpPhase = "lobby" | "clues" | "vote" | "guess" | "over";

export type ImpState = {
  phase: ImpPhase;
  host: string;
  players: ImpPlayer[];
  /** Category picked in the lobby ("random" picks one each game). */
  category: string;
  /** The word, lightly scrambled so it isn't readable at a glance. */
  hidden?: string;
  imposters?: string[];
  /** Clue order for this game (player ids). */
  order?: string[];
  round: number;
  turn: number;
  clues: { id: string; text: string; round: number }[];
  votes: Record<string, string>;
  /** Who got voted out (null = tie, nobody). */
  out?: string | null;
  /** Words the imposter can pick from when guessing. */
  options?: string[];
  guess?: string;
  winner?: "crew" | "imposters";
  /** Games played with this group and wins per player. */
  tally: Record<string, number>;
  games: number;
  /** The category this game actually used (when "random"). */
  playedCategory?: string;
};

export const CATEGORIES: Record<string, string[]> = {
  Food: ["pizza", "biryani", "sushi", "momos", "pani puri", "burger", "pasta", "dosa", "tacos", "ice cream", "chai", "samosa", "noodles", "pancakes", "butter chicken", "falafel", "popcorn", "maggi", "croissant", "ramen"],
  Places: ["airport", "beach", "gym", "hospital", "library", "mall", "metro", "temple", "cinema", "school", "hotel", "zoo", "stadium", "market", "office", "wedding", "club", "museum", "hill station", "petrol pump"],
  Movies: ["Titanic", "Avatar", "Sholay", "Barbie", "Inception", "3 Idiots", "Frozen", "Joker", "DDLJ", "Interstellar", "Lagaan", "Spider-Man", "RRR", "Shrek", "Dangal", "Batman", "Jurassic Park", "Zindagi Na Milegi Dobara", "Harry Potter", "Toy Story"],
  Sports: ["cricket", "football", "badminton", "chess", "tennis", "kabaddi", "swimming", "boxing", "basketball", "golf", "F1", "volleyball", "table tennis", "skating", "wrestling", "archery", "surfing", "carrom", "hockey", "cycling"],
  Things: ["umbrella", "toothbrush", "headphones", "mirror", "backpack", "pillow", "candle", "wallet", "sunglasses", "laptop", "keys", "charger", "remote", "perfume", "camera", "watch", "fan", "bottle", "helmet", "passport"],
  Animals: ["elephant", "penguin", "cat", "tiger", "dolphin", "monkey", "giraffe", "dog", "owl", "kangaroo", "peacock", "shark", "panda", "camel", "parrot", "lion", "snake", "cow", "rabbit", "octopus"],
  Jobs: ["doctor", "pilot", "chef", "teacher", "DJ", "influencer", "astronaut", "lawyer", "barber", "police", "farmer", "engineer", "dentist", "photographer", "magician", "firefighter", "YouTuber", "cricketer", "designer", "waiter"],
  Vibes: ["first date", "exam night", "road trip", "power cut", "Monday morning", "birthday party", "group project", "breakup", "job interview", "Diwali", "sleepover", "late-night drive", "monsoon", "wedding dance", "airport goodbye", "game night", "festival", "hangover", "family dinner", "New Year"],
};
export const CATEGORY_NAMES = Object.keys(CATEGORIES);

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;
export const impostersFor = (n: number) => (n >= 8 ? 2 : 1);

export const hideWord = (w: string) => btoa(unescape(encodeURIComponent([...w].reverse().join(""))));
export const revealWord = (h?: string) =>
  h ? [...decodeURIComponent(escape(atob(h)))].reverse().join("") : "";

function shuffle<T>(xs: T[], rand: () => number = Math.random) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newParty(host: ImpPlayer): ImpState {
  return {
    phase: "lobby",
    host: host.id,
    players: [host],
    category: "random",
    round: 1,
    turn: 0,
    clues: [],
    votes: {},
    tally: {},
    games: 0,
  };
}

export function join(s: ImpState, p: ImpPlayer): ImpState {
  if (s.phase !== "lobby" || s.players.some((x) => x.id === p.id)) return s;
  if (s.players.length >= MAX_PLAYERS) return s;
  return { ...s, players: [...s.players, p] };
}

export function leave(s: ImpState, id: string): ImpState {
  if (s.phase !== "lobby") return s;
  return { ...s, players: s.players.filter((p) => p.id !== id) };
}

export function start(s: ImpState, rand: () => number = Math.random): ImpState {
  if (s.players.length < MIN_PLAYERS) return s;
  const cat =
    s.category === "random" || !CATEGORIES[s.category]
      ? CATEGORY_NAMES[Math.floor(rand() * CATEGORY_NAMES.length)]
      : s.category;
  const words = CATEGORIES[cat];
  const word = words[Math.floor(rand() * words.length)];
  const ids = s.players.map((p) => p.id);
  const imposters = shuffle(ids, rand).slice(0, impostersFor(ids.length));
  const options = shuffle([word, ...shuffle(words.filter((w) => w !== word), rand).slice(0, 5)], rand);
  return {
    ...s,
    phase: "clues",
    hidden: hideWord(word),
    imposters,
    order: shuffle(ids, rand),
    options,
    round: 1,
    turn: 0,
    clues: [],
    votes: {},
    out: undefined,
    guess: undefined,
    winner: undefined,
    playedCategory: cat,
  };
}

export const playedCategory = (s: ImpState) => s.playedCategory ?? s.category;
export const whoseTurn = (s: ImpState) => (s.order ?? [])[s.turn];
export const isImposter = (s: ImpState, id: string) => (s.imposters ?? []).includes(id);

/** Give your clue (or "said it out loud") on your turn. */
export function giveClue(s: ImpState, id: string, text: string): ImpState {
  if (s.phase !== "clues" || whoseTurn(s) !== id) return s;
  const clue = text.trim().slice(0, 40) || "said it out loud";
  return {
    ...s,
    clues: [...s.clues, { id, text: clue, round: s.round }],
    turn: s.turn + 1,
  };
}

/** Everyone has given a clue this round. */
export const roundDone = (s: ImpState) => s.phase === "clues" && s.turn >= (s.order ?? []).length;

export function anotherRound(s: ImpState): ImpState {
  if (!roundDone(s)) return s;
  return { ...s, round: s.round + 1, turn: 0 };
}

export function toVote(s: ImpState): ImpState {
  if (s.phase !== "clues") return s;
  return { ...s, phase: "vote", votes: {} };
}

export function vote(s: ImpState, voter: string, target: string): ImpState {
  if (s.phase !== "vote" || voter === target) return s;
  if (!s.players.some((p) => p.id === voter) || !s.players.some((p) => p.id === target)) return s;
  const votes = { ...s.votes, [voter]: target };
  const next = { ...s, votes };
  return Object.keys(votes).length >= s.players.length ? count(next) : next;
}

/** Count the votes (the host can also call it early). */
export function count(s: ImpState): ImpState {
  if (s.phase !== "vote") return s;
  const tally: Record<string, number> = {};
  for (const t of Object.values(s.votes)) tally[t] = (tally[t] ?? 0) + 1;
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const tie = !top || (sorted[1] && sorted[1][1] === top[1]);
  const out = tie ? null : top[0];
  if (out && isImposter(s, out)) return { ...s, phase: "guess", out };
  // Crew member out (or a tie): the imposters win.
  return finish({ ...s, out }, "imposters");
}

/** Caught imposter's last chance: name the word. */
export function guessWord(s: ImpState, id: string, word: string): ImpState {
  if (s.phase !== "guess" || s.out !== id) return s;
  const right = word === revealWord(s.hidden);
  return finish({ ...s, guess: word }, right ? "imposters" : "crew");
}

function finish(s: ImpState, winner: "crew" | "imposters"): ImpState {
  const tally = { ...s.tally };
  for (const p of s.players) {
    const imp = isImposter(s, p.id);
    if ((winner === "imposters" && imp) || (winner === "crew" && !imp)) tally[p.id] = (tally[p.id] ?? 0) + 1;
  }
  return { ...s, phase: "over", winner, tally, games: s.games + 1 };
}

/** Same group, new word. */
export function playAgain(s: ImpState): ImpState {
  if (s.phase !== "over") return s;
  return { ...s, phase: "lobby", clues: [], votes: {}, out: undefined, guess: undefined, winner: undefined };
}
