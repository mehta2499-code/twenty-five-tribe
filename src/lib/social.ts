/**
 * Social layer for 25: chats, snaps + streaks, feed posts, reels and game scores.
 * Client-side only for now. State lives in memory and is saved to localStorage,
 * so a real backend can later replace `load`/`save` without touching screens.
 */
import { useEffect, useSyncExternalStore } from "react";
import { FRIENDS, ME, getSeatMeta, type Friend } from "@/lib/data";

// ---------- Types ----------
export type MsgStatus = "sent" | "delivered" | "read";
export type ChatMessage = {
  id: string;
  from: "me" | string; // "me" or friendId
  text?: string;
  snapId?: string; // a snap sent inside the chat
  sharedPostId?: string;
  at: number;
  status?: MsgStatus;
};

export type Snap = {
  id: string;
  from: "me" | string;
  to: string[];
  image?: string; // data URL or remote URL
  bg?: string; // for text-only snaps
  caption?: string;
  seconds: number;
  at: number;
  openedBy: string[]; // friendIds (or "me") who opened it
};

export type Streak = {
  count: number;
  lastSentDay: string | null; // yyyy-mm-dd
  lastGotDay: string | null;
};

export type Comment = { id: string; by: "me" | string; text: string; at: number };
export type Post = {
  id: string;
  by: "me" | string;
  image: string;
  /** Video posts: the video URL (image is then empty or a poster). */
  video?: string;
  /** Where the photo/video is stored (live posts), so deleting removes the file too. */
  mediaPath?: string;
  caption: string;
  at: number;
  likes: string[]; // friendIds + "me"
  comments: Comment[];
};

export type Reel = {
  id: string;
  by: "me" | string;
  image?: string;
  video?: string; // blob URL, not persisted
  caption: string;
  sound: string;
  at: number;
  likes: string[];
  comments: Comment[];
};

export type GameId = "tap-rush" | "quick-math" | "trivia" | "colour-clash" | "pair-up";
export type ScoreBoard = Record<GameId, Record<string, number>>; // game -> personId -> best this week

/** Someone in your 25, as the screens see them. */
export type Person = Friend & {
  username?: string;
  /** They put you in their 25 too. Chats, snaps, streaks and games need this. */
  mutual?: boolean;
};
export type FriendRequest = {
  id: string;
  person: Person;
  /** "incoming": they put you in their 25 and you haven't seated them back. */
  direction: "incoming" | "outgoing";
  /** For incoming requests: how they scored on "How well do you know them?" about you. */
  knew?: { score: number; total: number };
  /** Whether you've already proved you know them. */
  iPassed?: boolean;
};
export type Me = {
  id: string;
  name: string;
  username: string;
  initials: string;
  avatar?: string;
  /** Has answered the vibe check (needed before quizzing or being quizzed). */
  vibeDone: boolean;
};

export type SocialState = {
  /** "demo": sample people on this phone. "live": signed in, real people via Supabase. */
  mode: "demo" | "live";
  me: Me | null;
  /** Signed in but hasn't picked a name and username yet. */
  needsProfile: boolean;
  people: Person[];
  requests: FriendRequest[];
  loading: boolean;
  error: string | null;
  chats: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
  typing: Record<string, boolean>;
  snaps: Snap[];
  streaks: Record<string, Streak>;
  posts: Post[];
  reels: Reel[];
  scores: ScoreBoard;
  week: string;
  /** How many people have you in their 25 (only you see this). */
  seatedByCount: number;
  /** Names/photos of people who aren't in your 25 but show up (likes, comments). */
  others: Record<string, { name: string; initials: string; avatar?: string; color?: string }>;
  /** A friendly heads-up, e.g. "Devansh put you in their 25". */
  notice: string | null;
  /** In-app banner for a new message/snap: tap opens `to`. */
  banner: Banner | null;
};

// ---------- Helpers ----------
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Days and weeks follow India time, the same as the server's streak rules.
const IST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayKey = (t = Date.now()) => IST.format(new Date(t));
export const weekKey = (t = Date.now()) => {
  const [y, m, d] = dayKey(t).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};
const uid = () => Math.random().toString(36).slice(2, 10);

const demoFriends = () => FRIENDS.filter((f) => getSeatMeta(f.id).state === "ACCEPTED");
export const seatedFriends = (): Person[] => (state.mode === "live" ? state.people : demoFriends());
export const friendById = (id: string): Person | undefined =>
  state.mode === "live"
    ? (state.people.find((f) => f.id === id) ??
      state.requests.find((r) => r.person.id === id)?.person)
    : FRIENDS.find((f) => f.id === id);
/** Demo friends are all mutual; live ones only when they seated you back. */
export const isMutual = (p?: Person) => !!p && p.mutual !== false;
/** People you can chat, snap and play with: you're in each other's 25. */
export const mutualFriends = (): Person[] => seatedFriends().filter(isMutual);

export function timeAgo(at: number) {
  const s = Math.max(0, Date.now() - at);
  if (s < MIN) return "now";
  if (s < HOUR) return `${Math.floor(s / MIN)}m`;
  if (s < DAY) return `${Math.floor(s / HOUR)}h`;
  return `${Math.floor(s / DAY)}d`;
}
export function clock(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Stable pseudo-random number per string, for seeded scores. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

// ---------- Seed ----------
const DEMO_SESSION = {
  mode: "demo" as const,
  me: null,
  needsProfile: false,
  people: [],
  requests: [],
  loading: false,
  error: null,
  seatedByCount: 0,
  notice: null,
  banner: null,
  others: {},
};

const PHOTOS = [
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=900",
  "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=900",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900",
  "https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=900",
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=900",
  "https://images.unsplash.com/photo-1530023367847-a683933f4172?w=900",
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900",
];

function seed(): SocialState {
  const now = Date.now();
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY);
  const seated = demoFriends();

  const streakCounts = [212, 87, 45, 3, 0, 120, 14, 9, 33, 2, 61, 7, 0, 18, 5, 0, 26, 1, 0, 11];
  const streaks: Record<string, Streak> = {};
  seated.forEach((f, i) => {
    const count = streakCounts[i % streakCounts.length];
    streaks[f.id] = {
      count,
      // A few already snapped today; the rest are "at risk" until you snap them.
      lastSentDay: count === 0 ? null : i % 3 === 0 ? today : yesterday,
      lastGotDay: count === 0 ? null : today,
    };
  });

  const m = (from: string, text: string, minsAgo: number, status?: MsgStatus): ChatMessage => ({
    id: uid(),
    from,
    text,
    at: now - minsAgo * MIN,
    status: from === "me" ? (status ?? "read") : undefined,
  });

  const chats: Record<string, ChatMessage[]> = {
    "1": [
      m("1", "bro did you see the promotion post 😭", 190),
      m("me", "YES. Senior PM. Party kab hai?", 185),
      m("1", "saturday. you're bringing the speaker", 180),
      m("1", "also call me tonight? need to vent about the new team", 14),
    ],
    "2": [
      m("me", "Goa pics are unreal", 300),
      m("2", "you should've come 🥲", 290),
      m("2", "next trip you're not allowed to cancel", 40),
    ],
    "4": [
      m("4", "IIM A!!! I actually got in", 400),
      m("me", "I KNEW IT. so proud of you", 395),
      m("me", "dinner on me this week", 394, "delivered"),
    ],
    "9": [m("9", "Truth Jar rematch?", 60 * 26), m("me", "you're going down", 60 * 25)],
    "3": [m("3", "random sunday dread, you up?", 170)],
  };

  const snaps: Snap[] = [
    {
      id: uid(),
      from: "2",
      to: ["me"],
      image: PHOTOS[0],
      caption: "guess where 👀",
      seconds: 5,
      at: now - 25 * MIN,
      openedBy: [],
    },
    {
      id: uid(),
      from: "1",
      to: ["me"],
      bg: "linear-gradient(160deg,#F7A8A0,#D9534A)",
      caption: "call me when free",
      seconds: 3,
      at: now - 70 * MIN,
      openedBy: [],
    },
    {
      id: uid(),
      from: "6",
      to: ["me"],
      image: PHOTOS[5],
      caption: "first chai of the day",
      seconds: 5,
      at: now - 3 * HOUR,
      openedBy: [],
    },
  ];

  const c = (by: string, text: string, minsAgo: number): Comment => ({
    id: uid(),
    by,
    text,
    at: now - minsAgo * MIN,
  });
  const posts: Post[] = [
    {
      id: "p1",
      by: "2",
      image: PHOTOS[0],
      caption: "Goa with the college gang. First trip where nobody cancelled.",
      at: now - 1 * HOUR,
      likes: ["1", "3", "4", "9"],
      comments: [c("1", "where was my invite", 50), c("9", "the sunset one!!", 32)],
    },
    {
      id: "p2",
      by: "15",
      image: PHOTOS[2],
      caption: "Coldplay tonight. Twelve year old me would not believe this.",
      at: now - 5 * HOUR,
      likes: ["2", "6", "11", "13", "18"],
      comments: [c("13", "jealous beyond words", 200)],
    },
    {
      id: "p3",
      by: "13",
      image: PHOTOS[3],
      caption: "moving back to bangalore next month. round 2.",
      at: now - 11 * HOUR,
      likes: ["4", "5"],
      comments: [c("4", "finally!! filter coffee dates are back", 400)],
    },
    {
      id: "p4",
      by: "6",
      image: PHOTOS[4],
      caption: "Sunday hike. Legs gone. Heart full.",
      at: now - 20 * HOUR,
      likes: ["1", "2", "3", "9", "12"],
      comments: [],
    },
  ];

  const reels: Reel[] = [
    {
      id: "r1",
      by: "5",
      image: PHOTOS[6],
      caption: "POV: you finally take the trip you've talked about for 4 years",
      sound: "Kesariya · lofi",
      at: now - 2 * HOUR,
      likes: ["1", "2"],
      comments: [c("2", "TAKE ME", 60)],
    },
    {
      id: "r2",
      by: "1",
      image: PHOTOS[1],
      caption: "2 AM autos > everything",
      sound: "original audio · Rahul",
      at: now - 6 * HOUR,
      likes: ["2", "4", "9"],
      comments: [],
    },
    {
      id: "r3",
      by: "9",
      image: PHOTOS[7],
      caption: "mountains fixed me (temporarily)",
      sound: "Ilahi · slowed",
      at: now - 9 * HOUR,
      likes: ["3"],
      comments: [],
    },
    {
      id: "r4",
      by: "18",
      image: PHOTOS[5],
      caption: "rating every chai stall on my street. day 3.",
      sound: "original audio · Karan",
      at: now - 22 * HOUR,
      likes: ["6", "13", "15"],
      comments: [c("6", "the one near the station is a 10", 300)],
    },
  ];

  const scores = seedScores();

  return {
    ...DEMO_SESSION,
    seatedByCount: 31,
    chats,
    unread: { "1": 1, "2": 1, "3": 1 },
    typing: {},
    snaps,
    streaks,
    posts,
    reels,
    scores,
    week: weekKey(now),
  };
}

function seedScores(): ScoreBoard {
  const wk = weekKey();
  const board: ScoreBoard = {
    "tap-rush": {},
    "quick-math": {},
    trivia: {},
    "colour-clash": {},
    "pair-up": {},
  };
  demoFriends().forEach((f) => {
    // Not everyone plays every week.
    if (hash(f.id + "tap" + wk) % 4 !== 0)
      board["tap-rush"][f.id] = 14 + (hash(f.id + "t" + wk) % 26);
    if (hash(f.id + "math" + wk) % 3 !== 0)
      board["quick-math"][f.id] = 6 + (hash(f.id + "m" + wk) % 18);
    if (hash(f.id + "triv" + wk) % 3 !== 0) board.trivia[f.id] = 1 + (hash(f.id + "q" + wk) % 5);
    if (hash(f.id + "clash" + wk) % 3 !== 0)
      board["colour-clash"][f.id] = 8 + (hash(f.id + "c" + wk) % 20);
    if (hash(f.id + "pair" + wk) % 3 !== 0)
      board["pair-up"][f.id] = 40 + (hash(f.id + "p" + wk) % 70);
  });
  return board;
}

// ---------- Store ----------
const KEY = "tf.social.v1";
let state: SocialState = seed();
const listeners = new Set<() => void>();
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}
function save() {
  if (state.mode === "live") return; // live data lives in Supabase, not on the phone
  try {
    const persist: SocialState = {
      ...state,
      typing: {},
      reels: state.reels.filter((r) => !r.video), // video blob URLs don't survive a reload
    };
    localStorage.setItem(KEY, JSON.stringify(persist));
  } catch {
    // Storage full (large photos) or blocked. The session still works in memory.
  }
}
function set(fn: (s: SocialState) => SocialState) {
  state = fn(state);
  emit();
  save();
}

/** You, as the screens should show you: your real profile when signed in. */
export function meView(): { name: string; avatar?: string; initials: string } {
  return state.mode === "live" && state.me
    ? { name: state.me.name, avatar: state.me.avatar, initials: state.me.initials }
    : { name: ME.name, avatar: ME.avatar, initials: ME.initials };
}

export function clearError() {
  if (state.error) set((s) => ({ ...s, error: null }));
}
export type Banner = {
  id: string;
  title: string;
  body: string;
  to: string;
  avatar?: string;
  initials: string;
  color?: string;
  emoji?: string;
};
export function showBanner(b: Banner) {
  set((s) => ({ ...s, banner: b }));
}
export function clearBanner(id?: string) {
  if (state.banner && (!id || state.banner.id === id)) set((s) => ({ ...s, banner: null }));
}

export function clearNotice() {
  if (state.notice) set((s) => ({ ...s, notice: null }));
}

/** For the live (Supabase) layer: read and replace the store. */
export const _get = () => state;
export const _set = set;
/** Back to the demo data saved on this phone (used on sign-out). */
export function _restoreDemo() {
  let next = seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) next = { ...next, ...JSON.parse(raw), ...DEMO_SESSION, typing: {} };
  } catch {
    // Unreadable; use the seed.
  }
  state = rollover(next);
  emit();
}

/** Expire streaks you missed, and reset the leaderboard each Monday. */
function rollover(s: SocialState): SocialState {
  const yesterday = dayKey(Date.now() - DAY);
  const streaks = { ...s.streaks };
  for (const id of Object.keys(streaks)) {
    const st = streaks[id];
    if (st.count > 0 && (!st.lastSentDay || st.lastSentDay < yesterday)) {
      streaks[id] = { ...st, count: 0 };
    }
  }
  const wk = weekKey();
  // Older saved data may predate newer games; fill in their boards.
  const scores = s.week !== wk ? seedScores() : { ...seedScores(), ...s.scores };
  return { ...s, streaks, scores, week: wk };
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && state.mode === "demo")
      state = { ...seed(), ...JSON.parse(raw), ...DEMO_SESSION, typing: {} };
  } catch {
    // Saved data is unreadable; start from the seed.
  }
  if (state.mode === "demo") state = rollover(state);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

export function useSocial() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(hydrate, []);
  return s;
}

// ---------- Streak logic ----------
export function streakStatus(st?: Streak) {
  if (!st || st.count === 0) return { count: 0, atRisk: false };
  return { count: st.count, atRisk: st.lastSentDay !== dayKey() };
}

function bumpStreak(s: SocialState, friendId: string): Record<string, Streak> {
  const today = dayKey();
  const st = s.streaks[friendId] ?? { count: 0, lastSentDay: null, lastGotDay: null };
  if (st.lastSentDay === today) return s.streaks;
  return { ...s.streaks, [friendId]: { ...st, count: st.count + 1, lastSentDay: today } };
}

// ---------- Simulated friends (until there's a backend) ----------
const REPLIES = [
  "hahaha 😂",
  "wait what",
  "yaar same",
  "call me in 5?",
  "okay this made my day",
  "noted 🫡",
  "you're unreal",
  "LOL",
  "tell me everything",
  "brb, chai",
  "❤️",
  "omg yes",
];
const SNAP_BACKS = [
  "right back at you",
  "streak saved 🔥",
  "where is this??",
  "miss you",
  "lol your face",
];

function simulateReply(friendId: string, text?: string) {
  const delay = 1200 + Math.random() * 1500;
  // delivered → read → typing → reply
  setTimeout(() => markStatus(friendId, "delivered"), 500);
  setTimeout(() => {
    markStatus(friendId, "read");
    set((s) => ({ ...s, typing: { ...s.typing, [friendId]: true } }));
  }, delay);
  setTimeout(() => {
    const reply =
      text && /\?$/.test(text.trim())
        ? "hmm let me think… yes"
        : REPLIES[Math.floor(Math.random() * REPLIES.length)];
    set((s) => ({
      ...s,
      typing: { ...s.typing, [friendId]: false },
      chats: {
        ...s.chats,
        [friendId]: [
          ...(s.chats[friendId] ?? []),
          { id: uid(), from: friendId, text: reply, at: Date.now() },
        ],
      },
      unread: { ...s.unread, [friendId]: (s.unread[friendId] ?? 0) + 1 },
    }));
  }, delay + 1600);
}

function markStatus(friendId: string, status: MsgStatus) {
  set((s) => ({
    ...s,
    chats: {
      ...s.chats,
      [friendId]: (s.chats[friendId] ?? []).map((m) =>
        m.from === "me" && m.status !== "read" ? { ...m, status } : m,
      ),
    },
  }));
}

// ---------- Actions ----------
const demo = {
  sendMessage(friendId: string, text: string, ref?: string) {
    const t = text.trim();
    if (!t) return;
    set((s) => ({
      ...s,
      chats: {
        ...s.chats,
        [friendId]: [
          ...(s.chats[friendId] ?? []),
          { id: uid(), from: "me", text: t, sharedPostId: ref, at: Date.now(), status: "sent" },
        ],
      },
    }));
    simulateReply(friendId, t);
  },

  markRead(friendId: string) {
    if (!state.unread[friendId]) return;
    set((s) => ({ ...s, unread: { ...s.unread, [friendId]: 0 } }));
  },

  /** Send one snap to many people. Each recipient's streak goes up once per day. */
  sendSnap(input: {
    to: string[];
    image?: string;
    bg?: string;
    caption?: string;
    seconds: number;
  }) {
    if (input.to.length === 0) return;
    const snap: Snap = { id: uid(), from: "me", openedBy: [], at: Date.now(), ...input };
    set((s) => {
      let streaks = s.streaks;
      const chats = { ...s.chats };
      for (const id of input.to) {
        streaks = bumpStreak({ ...s, streaks }, id);
        chats[id] = [
          ...(chats[id] ?? []),
          { id: uid(), from: "me", snapId: snap.id, at: Date.now(), status: "delivered" },
        ];
      }
      return { ...s, snaps: [snap, ...s.snaps], streaks, chats };
    });
    // One friend snaps back a few seconds later.
    const back = input.to[Math.floor(Math.random() * input.to.length)];
    setTimeout(() => {
      const reply: Snap = {
        id: uid(),
        from: back,
        to: ["me"],
        openedBy: [],
        at: Date.now(),
        seconds: 5,
        bg: "linear-gradient(160deg,#2B8AC4,#1A5276)",
        caption: SNAP_BACKS[Math.floor(Math.random() * SNAP_BACKS.length)],
      };
      set((s) => ({
        ...s,
        snaps: [
          reply,
          ...s.snaps.map((x) => (x.id === snap.id ? { ...x, openedBy: [...x.openedBy, back] } : x)),
        ],
        streaks: {
          ...s.streaks,
          [back]: {
            ...(s.streaks[back] ?? { count: 1, lastSentDay: dayKey() }),
            lastGotDay: dayKey(),
          },
        },
        chats: {
          ...s.chats,
          [back]: [
            ...(s.chats[back] ?? []).map((m) =>
              m.snapId === snap.id ? { ...m, status: "read" as const } : m,
            ),
            { id: uid(), from: back, snapId: reply.id, at: Date.now() },
          ],
        },
        unread: { ...s.unread, [back]: (s.unread[back] ?? 0) + 1 },
      }));
    }, 6000);
  },

  openSnap(snapId: string) {
    set((s) => ({
      ...s,
      snaps: s.snaps.map((x) => (x.id === snapId ? { ...x, openedBy: [...x.openedBy, "me"] } : x)),
    }));
  },

  /** Delete one of your own posts. */
  deletePost(postId: string) {
    set((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== postId) }));
  },

  addPost(image: string, caption: string, video?: Blob) {
    const post: Post = {
      id: uid(),
      by: "me",
      image: video ? "" : image,
      video: video ? URL.createObjectURL(video) : undefined,
      caption: caption.trim(),
      at: Date.now(),
      likes: [],
      comments: [],
    };
    set((s) => ({ ...s, posts: [post, ...s.posts] }));
    // Your people notice.
    const fans = seatedFriends().slice(0, 6);
    fans.forEach((f, i) =>
      setTimeout(
        () =>
          set((s) => ({
            ...s,
            posts: s.posts.map((p) => (p.id === post.id ? { ...p, likes: [...p.likes, f.id] } : p)),
          })),
        2000 + i * 1400,
      ),
    );
    setTimeout(
      () => social._friendComment("post", post.id, fans[1]?.id ?? "1", "okay this is a good one"),
      5000,
    );
  },

  toggleLike(kind: "post" | "reel", id: string) {
    const flip = (likes: string[]) =>
      likes.includes("me") ? likes.filter((x) => x !== "me") : [...likes, "me"];
    set((s) =>
      kind === "post"
        ? { ...s, posts: s.posts.map((p) => (p.id === id ? { ...p, likes: flip(p.likes) } : p)) }
        : { ...s, reels: s.reels.map((r) => (r.id === id ? { ...r, likes: flip(r.likes) } : r)) },
    );
  },

  like(kind: "post" | "reel", id: string) {
    const item =
      kind === "post" ? state.posts.find((p) => p.id === id) : state.reels.find((r) => r.id === id);
    if (item && !item.likes.includes("me")) social.toggleLike(kind, id);
  },

  comment(kind: "post" | "reel", id: string, text: string) {
    const t = text.trim();
    if (!t) return;
    const c: Comment = { id: uid(), by: "me", text: t, at: Date.now() };
    set((s) =>
      kind === "post"
        ? {
            ...s,
            posts: s.posts.map((p) => (p.id === id ? { ...p, comments: [...p.comments, c] } : p)),
          }
        : {
            ...s,
            reels: s.reels.map((r) => (r.id === id ? { ...r, comments: [...r.comments, c] } : r)),
          },
    );
  },

  _friendComment(kind: "post" | "reel", id: string, by: string, text: string) {
    const c: Comment = { id: uid(), by, text, at: Date.now() };
    set((s) =>
      kind === "post"
        ? {
            ...s,
            posts: s.posts.map((p) => (p.id === id ? { ...p, comments: [...p.comments, c] } : p)),
          }
        : {
            ...s,
            reels: s.reels.map((r) => (r.id === id ? { ...r, comments: [...r.comments, c] } : r)),
          },
    );
  },

  /** Share a post or reel into one or more chats. */
  share(postId: string, to: string[], kind: "post" | "reel") {
    set((s) => {
      const chats = { ...s.chats };
      for (const id of to) {
        chats[id] = [
          ...(chats[id] ?? []),
          {
            id: uid(),
            from: "me",
            sharedPostId: `${kind}:${postId}`,
            at: Date.now(),
            status: "sent",
          },
        ];
      }
      return { ...s, chats };
    });
    to.forEach((id) => simulateReply(id));
  },

  addReel(input: { video?: string; image?: string; caption: string }) {
    const reel: Reel = {
      id: uid(),
      by: "me",
      sound: "original audio · You",
      at: Date.now(),
      likes: [],
      comments: [],
      ...input,
    };
    set((s) => ({ ...s, reels: [reel, ...s.reels] }));
  },

  /** Records your best score this week. Returns true if it's a new best. */
  recordScore(game: GameId, score: number) {
    const prev = state.scores[game]?.me ?? -1;
    if (score <= prev) return false;
    set((s) => ({ ...s, scores: { ...s.scores, [game]: { ...s.scores[game], me: score } } }));
    return true;
  },

  challenge(friendId: string, gameName: string, score: number) {
    social.sendMessage(friendId, `I just scored ${score} in ${gameName}. Your move 😏`);
  },
};

export type SocialActions = typeof demo;
let liveImpl: Partial<SocialActions> | null = null;
/** The live layer plugs its versions of these actions in here. */
export function registerLive(impl: Partial<SocialActions>) {
  liveImpl = impl;
}
/** Every screen calls these. Signed in, they go to Supabase; otherwise to the demo. */
export const social: SocialActions = new Proxy(demo, {
  get(target, key: string) {
    if (state.mode === "live" && liveImpl && key in liveImpl)
      return liveImpl[key as keyof SocialActions];
    return target[key as keyof SocialActions];
  },
});

export function leaderboard(s: SocialState, game: GameId) {
  return Object.entries(s.scores[game] ?? {})
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/** Downscale an uploaded image so it fits in storage. */
export function fileToImage(file: File, max = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't an image we can read."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
