/**
 * Anonymous compliment polls. Each day: 5 questions, pick one of 4 people from
 * your mutual 25. The person picked is told "someone picked you", never who.
 */
import { supabase } from "@/integrations/supabase/client";
import { _get, mutualFriends, type Person } from "@/lib/social";
import { today } from "@/lib/daily";

export const QUESTIONS = [
  "Most likely to become famous 🌟",
  "Would survive a zombie apocalypse 🧟",
  "Best hugger in the 25 🤗",
  "Gives the best advice 🧠",
  "Main character energy 🎬",
  "Would win a dance battle 💃",
  "Funniest laugh 😂",
  "Always has snacks 🍟",
  "Best taste in music 🎧",
  "Would be a great parent 🍼",
  "Never gets mad 😇",
  "Most likely to text back in 2 seconds ⚡",
  "Best person to go on a road trip with 🚗",
  "Would make the best teacher 📚",
  "Cooks like a Michelin chef 👩‍🍳",
  "Most loyal friend 🫶",
  "Best dressed 👗",
  "Would win Bigg Boss 🏆",
  "Most likely to start a business 💼",
  "Gives the best compliments 💐",
  "Best storyteller 📖",
  "Would make a great PM of India 🇮🇳",
  "Most likely to cry at a movie 🥹",
  "Brightest smile 😁",
  "Best at keeping secrets 🤐",
  "Would survive on a deserted island 🏝️",
  "Best at planning trips 🗺️",
  "Most likely to adopt 10 dogs 🐶",
  "Always on time ⏰",
  "Best gym motivation 💪",
  "Most chaotic in the best way 🌀",
  "Makes any party better 🎉",
  "Smartest person in the room 🤓",
  "Most underrated 💎",
  "Would win a cooking show 🍳",
  "Best at board games 🎲",
  "Best singing voice in the shower 🎤",
  "Would be a great therapist 🛋️",
  "Glow-up of the year ✨",
  "Most likely to go viral 📱",
  "Best person to call at 3 AM 📞",
  "Has the best memes 🐸",
  "Would win a fight against a goose 🪿",
  "Most likely to move abroad ✈️",
  "Gives the warmest welcome 🏠",
  "Best laugh in the group 😆",
  "Would ace any exam without studying 📝",
  "Coolest under pressure 🧊",
  "Most likely to be a CEO by 30 👔",
  "Best hype person 📣",
  "Biggest heart in the 25 ❤️",
  "Best at gifts 🎁",
  "Most likely to become a YouTuber 🎥",
  "Can make anyone smile 🙂",
  "Would make the best co-founder 🚀",
  "Most adventurous 🧗",
  "Best handwriting ✍️",
  "Always says yes to plans 🙌",
  "Most likely to remember your birthday 🎂",
  "The friend everyone needs 🌈",
];
export const PER_DAY = 5;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export function questionsFor(day = today()): string[] {
  const order = [...QUESTIONS].sort((a, b) => hash(day + a) - hash(day + b));
  return order.slice(0, PER_DAY);
}

/** 4 people to pick from. `shuffle` changes the set. */
export function optionsFor(question: string, shuffle = 0, day = today()): Person[] {
  return [...mutualFriends()]
    .sort((a, b) => hash(day + question + shuffle + a.id) - hash(day + question + shuffle + b.id))
    .slice(0, 4);
}

// ---------- Votes ----------
const DEMO_KEY = "tf.polls.v1";
type DemoVotes = Record<string, Record<string, string>>; // day -> question -> person

function readDemo(): DemoVotes {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Questions you've already answered today -> who you picked. */
export async function myVotesToday(): Promise<Record<string, string>> {
  const s = _get();
  if (s.mode !== "live") return readDemo()[today()] ?? {};
  const { data } = await supabase
    .from("poll_votes")
    .select("question,target")
    .eq("day", today());
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { question: string; target: string }[]) out[r.question] = r.target;
  return out;
}

export async function vote(question: string, target: string) {
  const s = _get();
  if (s.mode !== "live") {
    const all = readDemo();
    all[today()] = { ...(all[today()] ?? {}), [question]: target };
    localStorage.setItem(DEMO_KEY, JSON.stringify(all));
    return;
  }
  const { error } = await supabase.from("poll_votes").insert({ voter: s.me!.id, target, question });
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
}

export type Pick = { question: string; picks: number; at: number };

/** What you've been picked for (never who picked you). */
export async function myPicks(): Promise<Pick[]> {
  const s = _get();
  if (s.mode !== "live") {
    return QUESTIONS.slice(3, 9).map((q, i) => ({
      question: q,
      picks: 1 + ((i * 7) % 4),
      at: Date.now() - i * 5_400_000,
    }));
  }
  const { data } = await supabase.rpc("my_poll_picks");
  return ((data ?? []) as { question: string; picks: number; last_at: string }[]).map((r) => ({
    question: r.question,
    picks: r.picks,
    at: Date.parse(r.last_at),
  }));
}
