/**
 * Vibe check: the this-or-that questions everyone answers, and the
 * "How well do you know them?" quiz that gates a seat in your 25.
 * Answers are checked on the server (see supabase/migrations/*_vibe_check.sql).
 */
import { supabase } from "@/integrations/supabase/client";

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
    id: "weekend",
    ask: "Party or stay in?",
    a: { label: "Party", emoji: "🪩" },
    b: { label: "Stay in", emoji: "🛋️" },
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
/** Questions in a "prove it" quiz, picked from the 9 this-or-thats + birthday. */
export const QUIZ_SIZE = 7;
export const QUIZ_LENGTH = 6;

function message(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e);
  return m.replace(/^.*?ERROR:\s*/, "");
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
  const { data, error } = await supabase.rpc("start_vibe_quiz", { p_target: targetId });
  if (error) throw new Error(message(error));
  return data as QuizStart;
}

export async function submitQuiz(attempt: string, guesses: Record<string, string>) {
  const { data, error } = await supabase.rpc("submit_vibe_quiz", {
    p_attempt: attempt,
    p_guesses: guesses,
  });
  if (error) throw new Error(message(error));
  return data as { score: number; total: number; passed: boolean };
}

export type PublicCard = {
  id: string;
  display_name: string;
  username: string;
  seats: number;
  vibe_done: boolean;
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
      weekend: "b",
    },
    month: 8,
  },
};
