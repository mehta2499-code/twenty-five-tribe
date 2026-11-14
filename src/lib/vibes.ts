/**
 * Vibe check: the this-or-that questions everyone answers, and the
 * "How well do you know them?" quiz that gates a seat in your 25.
 * Answers are checked on the server (see supabase/migrations/*_vibe_check.sql).
 */
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/track";

export type Choice = "a" | "b";
export type VibeQuestion = {
  id: string;
  ask: string; // how it reads when it's about someone else
  a: { label: string; emoji: string };
  b: { label: string; emoji: string };
};

export const VIBE_QUESTIONS: VibeQuestion[] = [
  {
    id: "food",
    ask: "Pizza or pasta?",
    a: { label: "Pizza", emoji: "🍕" },
    b: { label: "Pasta", emoji: "🍝" },
  },
  {
    id: "pet",
    ask: "Cats or dogs?",
    a: { label: "Cats", emoji: "🐱" },
    b: { label: "Dogs", emoji: "🐶" },
  },
  {
    id: "drink",
    ask: "Chai or coffee?",
    a: { label: "Chai", emoji: "🫖" },
    b: { label: "Coffee", emoji: "☕" },
  },
  {
    id: "plan",
    ask: "Dinner out or movie night?",
    a: { label: "Dinner out", emoji: "🍽️" },
    b: { label: "Movie night", emoji: "🍿" },
  },
  {
    id: "colour",
    ask: "Black or white?",
    a: { label: "Black", emoji: "🖤" },
    b: { label: "White", emoji: "🤍" },
  },
  {
    id: "time",
    ask: "Night owl or early bird?",
    a: { label: "Night owl", emoji: "🦉" },
    b: { label: "Early bird", emoji: "🐤" },
  },
  {
    id: "trip",
    ask: "Beach or mountains?",
    a: { label: "Beach", emoji: "🏖️" },
    b: { label: "Mountains", emoji: "🏔️" },
  },
  {
    id: "talk",
    ask: "Texts or calls?",
    a: { label: "Texts", emoji: "💬" },
    b: { label: "Calls", emoji: "📞" },
  },
  {
    id: "taste",
    ask: "Sweet or spicy?",
    a: { label: "Sweet", emoji: "🍩" },
    b: { label: "Spicy", emoji: "🌶️" },
  },
  {
    id: "booze",
    ask: "Vodka or whiskey?",
    a: { label: "Vodka", emoji: "🍸" },
    b: { label: "Whiskey", emoji: "🥃" },
  },
];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const questionById = (id: string) => VIBE_QUESTIONS.find((q) => q.id === id);

/** How many right answers you need, out of how many. */
export const PASS_MARK = 4;
/** Questions in a "prove it" quiz: the birthday every time + 6 random this-or-thats. */
export const QUIZ_SIZE = 7;
export const QUIZ_LENGTH = 6;

/** A dropped connection: Safari says "TypeError: Load failed", Chrome "Failed to fetch". */
export function isNetworkError(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e);
  return /load failed|failed to fetch|networkerror|network request failed|network connection was lost|internet connection appears to be offline/i.test(
    m,
  );
}

const NETWORK_MSG = "Connection dropped for a second. Check your internet and tap Try again.";

function message(e: unknown) {
  if (isNetworkError(e)) return NETWORK_MSG;
  const m = (e as { message?: string })?.message ?? String(e);
  return m.replace(/^.*?ERROR:\s*/, "");
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run a Supabase call, retrying a couple of times if the connection drops. */
async function withRetry<T>(fn: () => PromiseLike<{ data: T; error: unknown }>) {
  let last: { data: T; error: unknown } | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      last = await fn();
      if (!last.error || !isNetworkError(last.error)) return { ...last, retried: i > 0 };
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      last = { data: null as T, error: e };
    }
    await wait(600 * (i + 1));
  }
  return { ...last!, retried: true };
}

export async function myVibe(
  userId: string,
): Promise<{ answers: Record<string, Choice>; birthday: string } | null> {
  const { data } = await supabase
    .from("vibe_answers")
    .select("answers,birthday")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { answers: Record<string, Choice>; birthday: string } | null) ?? null;
}

export async function saveVibe(userId: string, answers: Record<string, Choice>, birthday: string) {
  const { error } = await supabase
    .from("vibe_answers")
    .upsert({ user_id: userId, answers, birthday, updated_at: new Date().toISOString() });
  if (error) throw new Error(message(error));
}

export type QuizStart = { passed: true } | { passed: false; attempt: string; questions: string[] };

export async function startQuiz(targetId: string): Promise<QuizStart> {
  const { data, error } = await withRetry(() =>
    supabase.rpc("start_vibe_quiz", { p_target: targetId }),
  );
  if (error) throw new Error(message(error));
  if (!(data as QuizStart).passed) track("quiz_started");
  return data as QuizStart;
}

export async function submitQuiz(attempt: string, guesses: Record<string, string>) {
  const res = await withRetry(() =>
    supabase.rpc("submit_vibe_quiz", { p_attempt: attempt, p_guesses: guesses }),
  );
  let r = res.data as { score: number; total: number; passed: boolean } | null;
  if (res.error || !r) {
    // The first try may have reached the server before the connection dropped:
    // then the quiz is already scored, so read the saved result.
    const { data: saved } = await supabase
      .from("quiz_attempts")
      .select("score,total,passed")
      .eq("id", attempt)
      .maybeSingle();
    const row = saved as { score: number | null; total: number; passed: boolean } | null;
    if (row && row.score !== null) r = { score: row.score, total: row.total, passed: row.passed };
    else throw new Error(message(res.error ?? "Couldn't check your answers. Try again."));
  }
  // Only the score, never the answers.
  track("quiz_completed", {
    score: `${r.score}/${r.total}`,
    correct: r.score,
    total: r.total,
    passed: r.passed,
  });
  return r;
}

export type PublicCard = {
  id: string;
  display_name: string;
  username: string;
  seats: number;
  vibe_done: boolean;
  avatar_path?: string | null;
};

export async function publicCard(username: string): Promise<PublicCard | null> {
  const { data, error } = await supabase.rpc("public_card", { p_username: username });
  if (error) throw new Error(message(error));
  return ((data as PublicCard[]) ?? [])[0] ?? null;
}

/** The link people share: "Are you in my 25?" */
export const shareUrl = (username: string) =>
  `${typeof window !== "undefined" ? window.location.origin : "https://twenty-five-tribe.lovable.app"}/in/${username}`;

export async function shareCard(username: string, name: string) {
  const url = shareUrl(username);
  const text = `Are you in my 25? 👀 Prove it.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${name}'s 25`, text, url });
      return "shared";
    }
  } catch {
    // Cancelled or unsupported; fall back to copying.
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

// ---------- Demo mode: sample answers so the quiz can be tried without an account ----------
export const DEMO_ANSWERS: Record<string, { answers: Record<string, Choice>; month: number }> = {
  "2": {
    answers: {
      food: "b",
      pet: "b",
      drink: "a",
      plan: "a",
      colour: "a",
      time: "a",
      trip: "a",
      talk: "b",
      taste: "b",
      booze: "b",
    },
    month: 8,
  },
};
