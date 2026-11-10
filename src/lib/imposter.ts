/**
 * Imposter — a party game for 4 to 20 people. Pure rules, no UI.
 *
 * Everyone gets the same secret word except the imposter(s). Take turns giving
 * one clue each, then vote. Catch the imposter and the crew wins, unless the
 * imposter then types the word. Vote out a crew member and the imposters win.
 * A tie gets one revote between the tied players; a second tie goes to the imposters.
 *
 * Points: crew win = 1 each; imposter win = 2 each (it's harder); an imposter
 * who gets caught but guesses the word = 3.
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
  /** Old games only: words the imposter could pick from. Guesses are typed now. */
  options?: string[];
  guess?: string;
  /** When the current clue turn started (ms), for the 45-second turn clock. */
  turnAt?: number;
  /** A tie: revote between just these players. */
  runoff?: string[];
  /** The votes from the vote that decided the game, kept for the reveal. */
  finalVotes?: Record<string, string>;
  winner?: "crew" | "imposters";
  /** Games played with this group and wins per player. */
  tally: Record<string, number>;
  games: number;
  /** The category this game actually used (when "random"). */
  playedCategory?: string;
};

export const CATEGORIES: Record<string, string[]> = {
  Food: [
    "pizza",
    "biryani",
    "sushi",
    "momos",
    "pani puri",
    "burger",
    "pasta",
    "dosa",
    "tacos",
    "ice cream",
    "chai",
    "samosa",
    "noodles",
    "pancakes",
    "butter chicken",
    "falafel",
    "popcorn",
    "maggi",
    "croissant",
    "ramen",
  ],
  Places: [
    "airport",
    "beach",
    "gym",
    "hospital",
    "library",
    "mall",
    "metro",
    "temple",
    "cinema",
    "school",
    "hotel",
    "zoo",
    "stadium",
    "market",
    "office",
    "wedding",
    "club",
    "museum",
    "hill station",
    "petrol pump",
  ],
  Movies: [
    "Titanic",
    "Avatar",
    "Sholay",
    "Barbie",
    "Inception",
    "3 Idiots",
    "Frozen",
    "Joker",
    "DDLJ",
    "Interstellar",
    "Lagaan",
    "Spider-Man",
    "RRR",
    "Shrek",
    "Dangal",
    "Batman",
    "Jurassic Park",
    "Zindagi Na Milegi Dobara",
    "Harry Potter",
    "Toy Story",
  ],
  Sports: [
    "cricket",
    "football",
    "badminton",
    "chess",
    "tennis",
    "kabaddi",
    "swimming",
    "boxing",
    "basketball",
    "golf",
    "F1",
    "volleyball",
    "table tennis",
    "skating",
    "wrestling",
    "archery",
    "surfing",
    "carrom",
    "hockey",
    "cycling",
  ],
  Things: [
    "umbrella",
    "toothbrush",
    "headphones",
    "mirror",
    "backpack",
    "pillow",
    "candle",
    "wallet",
    "sunglasses",
    "laptop",
    "keys",
    "charger",
    "remote",
    "perfume",
    "camera",
    "watch",
    "fan",
    "bottle",
    "helmet",
    "passport",
  ],
  Animals: [
    "elephant",
    "penguin",
    "cat",
    "tiger",
    "dolphin",
    "monkey",
    "giraffe",
    "dog",
    "owl",
    "kangaroo",
    "peacock",
    "shark",
    "panda",
    "camel",
    "parrot",
    "lion",
    "snake",
    "cow",
    "rabbit",
    "octopus",
  ],
  Jobs: [
    "doctor",
    "pilot",
    "chef",
    "teacher",
    "DJ",
    "influencer",
    "astronaut",
    "lawyer",
    "barber",
    "police",
    "farmer",
    "engineer",
    "dentist",
    "photographer",
    "magician",
    "firefighter",
    "YouTuber",
    "cricketer",
    "designer",
    "waiter",
  ],
  Vibes: [
    "first date",
    "exam night",
    "road trip",
    "power cut",
    "Monday morning",
    "birthday party",
    "group project",
    "breakup",
    "job interview",
    "Diwali",
    "sleepover",
    "late-night drive",
    "monsoon",
    "wedding dance",
    "airport goodbye",
    "game night",
    "festival",
    "hangover",
    "family dinner",
    "New Year",
  ],
};
export const CATEGORY_NAMES = Object.keys(CATEGORIES);

export const MIN_PLAYERS = 4;
export const TURN_SECONDS = 45;
export const POINTS = { crew: 1, imposter: 2, steal: 3 };
export const MAX_PLAYERS = 20;
export const impostersFor = (n: number) => (n >= 8 ? 2 : 1);

export const hideWord = (w: string) =>
  btoa(unescape(encodeURIComponent([...w].reverse().join(""))));
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
  // The imposter never goes first: they get to hear at least one clue.
  let order = shuffle(ids, rand);
  const firstCrew = order.findIndex((id) => !imposters.includes(id));
  if (firstCrew > 0) order = [...order.slice(firstCrew), ...order.slice(0, firstCrew)];
  return {
    ...s,
    phase: "clues",
    hidden: hideWord(word),
    imposters,
    order,
    options: undefined,
    round: 1,
    turn: 0,
    turnAt: Date.now(),
    clues: [],
    votes: {},
    runoff: undefined,
    finalVotes: undefined,
    out: undefined,
    guess: undefined,
    winner: undefined,
    playedCategory: cat,
  };
}

export const playedCategory = (s: ImpState) => s.playedCategory ?? s.category;
export const whoseTurn = (s: ImpState) => (s.order ?? [])[s.turn];
export const isImposter = (s: ImpState, id: string) => (s.imposters ?? []).includes(id);

// ---------- Word matching (typed guesses, "don't say the word") ----------

/** Lowercase, no accents, no spaces or punctuation, no leading "the", no plural s. */
export function normalize(w: string) {
  let x = w
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]/g, "");
  if (x.length >= 3 && x.endsWith("s") && !x.endsWith("ss")) x = x.slice(0, -1);
  return x;
}

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}

/** Is a typed guess the word? Forgives case, spaces, plurals and a small typo. */
export function sameWord(guess: string, word: string) {
  const g = normalize(guess);
  const w = normalize(word);
  if (!g) return false;
  if (g === w) return true;
  const allowed = w.length >= 7 ? 2 : w.length >= 4 ? 1 : 0;
  return editDistance(g, w) <= allowed;
}

/** Does a clue give the word away (contains it)? */
export function saysWord(clue: string, word: string) {
  const w = normalize(word);
  if (w.length < 3) return false;
  const c = normalize(clue);
  return c.includes(w) || clue.split(/\s+/).some((part) => sameWord(part, word));
}

/** Give your clue (or "said it out loud") on your turn. */
export function giveClue(s: ImpState, id: string, text: string): ImpState {
  if (s.phase !== "clues" || whoseTurn(s) !== id) return s;
  const clue = text.trim().slice(0, 40) || "said it out loud";
  return {
    ...s,
    clues: [...s.clues, { id, text: clue, round: s.round }],
    turn: s.turn + 1,
    turnAt: Date.now(),
  };
}

/** Host skips someone whose 45 seconds ran out. */
export function skipTurn(s: ImpState): ImpState {
  const id = whoseTurn(s);
  if (s.phase !== "clues" || !id) return s;
  return {
    ...s,
    clues: [...s.clues, { id, text: "⏱ ran out of time", round: s.round }],
    turn: s.turn + 1,
    turnAt: Date.now(),
  };
}

/** Clues a player has given this game. */
export const cluesOf = (s: ImpState, id: string) => s.clues.filter((c) => c.id === id);

/** Everyone has given a clue this round. */
export const roundDone = (s: ImpState) => s.phase === "clues" && s.turn >= (s.order ?? []).length;

export function anotherRound(s: ImpState): ImpState {
  if (!roundDone(s)) return s;
  return { ...s, round: s.round + 1, turn: 0, turnAt: Date.now() };
}

export function toVote(s: ImpState): ImpState {
  if (s.phase !== "clues") return s;
  return { ...s, phase: "vote", votes: {}, runoff: undefined };
}

/** Who can be voted for right now (everyone, or just the tied players in a revote). */
export const candidates = (s: ImpState) =>
  s.runoff ? s.players.filter((p) => s.runoff!.includes(p.id)) : s.players;

export function vote(s: ImpState, voter: string, target: string): ImpState {
  if (s.phase !== "vote" || voter === target) return s;
  if (!s.players.some((p) => p.id === voter) || !candidates(s).some((p) => p.id === target))
    return s;
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
  const tied = top ? sorted.filter(([, n]) => n === top[1]).map(([id]) => id) : [];
  if (tied.length > 1 && !s.runoff) {
    // First tie: one revote between just the tied players.
    return { ...s, votes: {}, runoff: tied, finalVotes: s.votes };
  }
  const out = tied.length === 1 ? tied[0] : null;
  const decided = { ...s, out, finalVotes: s.votes };
  if (out && isImposter(s, out)) return { ...decided, phase: "guess" };
  // Crew member out (or a second tie): the imposters win.
  return finish(decided, "imposters");
}

/** Caught imposter's last chance: type the word. */
export function guessWord(s: ImpState, id: string, typed: string): ImpState {
  if (s.phase !== "guess" || s.out !== id) return s;
  const guess = typed.trim().slice(0, 40);
  if (!guess) return s;
  const right = sameWord(guess, revealWord(s.hidden));
  return finish({ ...s, guess }, right ? "imposters" : "crew", right);
}

/** Did the caught imposter type the word? */
export const stoleIt = (s: ImpState) => !!s.guess && sameWord(s.guess, revealWord(s.hidden));

function finish(s: ImpState, winner: "crew" | "imposters", steal = false): ImpState {
  const tally = { ...s.tally };
  for (const p of s.players) {
    const imp = isImposter(s, p.id);
    let pts = 0;
    if (winner === "crew" && !imp) pts = POINTS.crew;
    if (winner === "imposters" && imp)
      pts = steal && p.id === s.out ? POINTS.steal : POINTS.imposter;
    if (pts) tally[p.id] = (tally[p.id] ?? 0) + pts;
  }
  return { ...s, phase: "over", winner, tally, games: s.games + 1 };
}

/** Same group, new word. */
export function playAgain(s: ImpState): ImpState {
  if (s.phase !== "over") return s;
  return {
    ...s,
    phase: "lobby",
    clues: [],
    votes: {},
    runoff: undefined,
    finalVotes: undefined,
    out: undefined,
    guess: undefined,
    winner: undefined,
  };
}
