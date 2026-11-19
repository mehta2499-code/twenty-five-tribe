/**
 * Anonymous compliment polls, weekly: a new set of 10 questions every Thursday
 * at 9 PM (India time). For each, pick one of 4 people from your mutual 25. The person
 * picked is told "someone picked you", never who.
 */
import { supabase } from "@/integrations/supabase/client";
import { _get, dayKey, mutualFriends, type Person } from "@/lib/social";
import { addDays } from "@/lib/daily";

/*
 * Poll weeks turn over every Thursday at 9 PM India time. The set launched on
 * Thu 19 Nov 2026 runs until Thu 26 Nov, 9 PM (it keeps its old key,
 * "2026-11-15", so votes already cast still count). After that, each week's
 * key is the Thursday it started. Keep in sync with public.poll_week().
 */
const FIRST_KEY = "2026-11-15";
const FIRST_SWITCH = "2026-11-26"; // a Thursday; new polls at 9 PM
const SHIFT = 3 * 3_600_000; // 9 PM + 3 h = the next day
const dayMs = 86_400_000;
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);

/** This poll week's key, as "YYYY-MM-DD". */
export function pollWeek(now = Date.now()) {
  const shifted = dayKey(now + SHIFT); // from Thu 9 PM it's "Friday"
  const since = daysBetween(addDays(FIRST_SWITCH, 1), shifted);
  if (since < 0) return FIRST_KEY;
  return addDays(FIRST_SWITCH, 7 * Math.floor(since / 7));
}

/** When the next set of polls comes out (ms). */
export function nextPollsAt(now = Date.now()) {
  const key = pollWeek(now);
  const start = key === FIRST_KEY ? FIRST_SWITCH : addDays(key, 7);
  return Date.parse(`${start}T21:00:00+05:30`);
}

/** "tonight at 9 PM", "tomorrow at 9 PM", "Thursday at 9 PM". */
export function newPollsWhen(now = Date.now()) {
  const at = nextPollsAt(now);
  const d = daysBetween(dayKey(now), dayKey(at));
  if (d <= 0) return "tonight at 9 PM";
  if (d === 1) return "tomorrow at 9 PM";
  return "Thursday at 9 PM";
}

/**
 * Spicy (but never mean) questions. Each week takes the next 10 in a shuffled
 * order, so nothing repeats until the whole list has gone round (~16 weeks).
 */
export const QUESTIONS = [
  "Most likely to text their ex at 2 AM 📱",
  "Secretly the biggest flirt in the 25 😏",
  "Most likely to ghost the group chat 👻",
  "Would sell the whole 25 out for ₹500 💸",
  "Has a secret second Insta account 🕵️",
  "Most likely to get caught lying 🤥",
  "Has the most dramatic breakup story 💔",
  "Most likely to fall for someone in a week 💘",
  "Takes 47 selfies to post one 🤳",
  "Most likely to cancel plans last minute 🙅",
  "Would survive one day without their phone 📵",
  "Most likely to start a fight at a wedding 💍",
  "Biggest overthinker in the 25 🌀",
  "Most likely to be on a dating app right now 📲",
  "Still stalks their ex's profile 👀",
  "Most likely to say 'I'm 5 min away' from home 🏠",
  "Gives the worst advice with full confidence 🫠",
  "Most likely to cry at their own birthday 🎂",
  "Would get kicked out of a club first 🚪",
  "Most likely to marry their school crush 💌",
  "Has the most screenshots of other people's chats 📸",
  "Most likely to reply 'k' and mean war ⚔️",
  "Would be the first to break in a prank 😂",
  "Most likely to become a reel influencer 🎥",
  "Spends the most on online shopping 🛍️",
  "Most likely to get lost with Google Maps open 🗺️",
  "Would win a roast battle 🔥",
  "Most likely to fake being sick to skip work 🤒",
  "Has the weirdest search history 🔍",
  "Most likely to fall asleep at a party 😴",
  "Would date someone just for their dog 🐕",
  "Most likely to go viral for the wrong reason 😬",
  "Says 'last drink' and orders three more 🍹",
  "Most likely to have a crush on someone in the 25 🙈",
  "Would survive Bigg Boss the longest 🏆",
  "Most likely to send a voice note longer than 5 min 🎙️",
  "Has the most chaotic camera roll 🌪️",
  "Most likely to be late to their own wedding ⏰",
  "Would steal your fries without asking 🍟",
  "Most likely to drunk-text the group 🍻",
  "Most likely to have a secret talent no one knows 🎭",
  "Would ditch the 25 for a new partner 💑",
  "Most likely to go on a trip and not tell anyone ✈️",
  "Has the best poker face 🃏",
  "Most likely to laugh at the wrong moment 🤭",
  "Would win an argument they're totally wrong in 🗣️",
  "Most likely to get a tattoo they regret 🖋️",
  "Has the most unread messages 📨",
  "Most likely to fall for a scam call ☎️",
  "Would make the worst first date 🙃",
  "Most likely to post a cryptic story after a fight 📖",
  "Most likely to remember every embarrassing thing you did 🧠",
  "Would be the first to leave the party without saying bye 🏃",
  "Most likely to binge a whole season in one night 📺",
  "Has the strongest 'main character' delusion 🎬",
  "Most likely to send a risky text and delete it 🗑️",
  "Would spend their last ₹100 on chai ☕",
  "Most likely to get roasted by their mom on the family group 👩",
  "Most likely to fall in love on a vacation 🌴",
  "Has the most 'situationships' 🤷",
  "Most likely to accidentally like a 3-year-old post ❤️",
  "Would win a dance-off at a sangeet 💃",
  "Most likely to cry over a reel 🥹",
  "Most likely to be the reason the group gets kicked out 🚨",
  "Has the funniest 'drunk' personality 🥴",
  "Most likely to go silent and then post 20 stories 📱",
  "Would be the worst roommate 🛏️",
  "Most likely to say 'I'm fine' when they're not 🙂",
  "Most likely to fight a delivery guy over 2 minutes 🛵",
  "Has a 'type' and everyone knows it 😌",
  "Most likely to go to the gym once and post about it 💪",
  "Would forget their own anniversary 📅",
  "Most likely to steal the aux and never give it back 🎧",
  "Most likely to have a fake accent after one trip abroad 🗽",
  "Would survive a horror movie till the end 🔪",
  "Most likely to text 'wyd' at 1 AM 🌙",
  "Has the most ex-besties 👯",
  "Most likely to cry when their team loses 🏏",
  "Most likely to become a CEO and forget us 👔",
  "Would win 'who knows the most gossip' 🍵",
  "Most likely to get a parking ticket on their birthday 🚗",
  "Most likely to stalk a crush's whole family 👀",
  "Would be the funniest person at 3 AM 🌚",
  "Most likely to fake laugh at their boss's joke 😅",
  "Most likely to start a business that fails in a week 📉",
  "Has the worst taste in partners 🚩",
  "Most likely to send a meme instead of saying sorry 🐸",
  "Would forget your name after one drink 🍸",
  "Most likely to eat the last slice and deny it 🍕",
  "Most likely to plan a trip that never happens 🧳",
  "Has the most red flags (and is proud) 🚩",
  "Most likely to cry-laugh at their own joke 😂",
  "Would make the best villain in a movie 😈",
  "Most likely to be single forever by choice 💅",
  "Most likely to get married first 💒",
  "Has the most savage comebacks 🗡️",
  "Most likely to become famous for a meme 🖼️",
  "Would spill the 25's secrets for free pizza 🍕",
  "Most likely to apologise to a door they bumped into 🚪",
  "Most likely to go missing during a group photo 📷",
  "Has the best 'I didn't see your text' excuses 🙈",
  "Most likely to text their crush 'hey' 50 times in their head 💭",
  "Would ask for a refund on a free sample 🧾",
  "Most likely to become a motivational speaker 🎤",
  "Most likely to sleep through an alarm on an exam day ⏰",
  "Has a playlist for every mood 🎶",
  "Most likely to cry at a wedding they barely know 💐",
  "Would be the first to say 'let's do shots' 🥃",
  "Most likely to send a screenshot to the wrong chat 😱",
  "Most likely to have a 5-year plan and ignore it 📋",
  "Has the most 'it's complicated' stories 💬",
  "Most likely to become a stand-up comic 🎙️",
  "Would win 'Who Wants to Be a Crorepati' 💰",
  "Most likely to fall in love with a fictional character 📚",
  "Most likely to fight with the ref at a gully cricket match 🏏",
  "Has the funniest family drama stories 👨‍👩‍👧",
  "Most likely to get recognised by a stranger from Insta 🌟",
  "Would give a speech at your wedding and roast you 🎤",
  "Most likely to eat Maggi at 4 AM 🍜",
  "Most likely to text back after 3 business days 📆",
  "Has the best 'come to my place' energy 🏡",
  "Most likely to be someone's secret crush 😳",
  "Would survive a week in the jungle 🌿",
  "Most likely to start crying at a sad song in a cab 🚕",
  "Most likely to go to a party just for the food 🍗",
  "Has the strongest gaali game 🤬",
  "Most likely to post 'new year, new me' every month 🗓️",
  "Would win a staring contest 👁️",
  "Most likely to get married in Vegas by accident 🎰",
  "Most likely to say 'I knew it' after it happens 🧐",
  "Has the most unexpected celebrity crush ⭐",
  "Most likely to take a nap during a fight 😪",
  "Would be the worst at keeping a surprise 🎁",
  "Most likely to cry at the airport goodbye ✈️",
  "Most likely to fall for a 'limited time offer' 🏷️",
  "Has the loudest laugh in a quiet room 🤣",
  "Most likely to accidentally call their teacher 'mom' 👩‍🏫",
  "Would start a podcast no one asked for 🎧",
  "Most likely to be in the group chat but never reply 🫥",
  "Most likely to win an argument with an auto driver 🛺",
  "Has the most 'friends' they secretly can't stand 😬",
  "Most likely to plan a surprise and spoil it 🤦",
  "Would order for the whole table without asking 🍽️",
  "Most likely to be famous after 40 🎉",
  "Most likely to say 'one more episode' at 3 AM 📺",
  "Has the best glow-up story ✨",
  "Most likely to write a tell-all book about the 25 📕",
  "Would be the first one arrested in a heist movie 🚓",
  "Most likely to keep a grudge for 10 years 🧊",
  "Most likely to cry when the food is late 🍔",
  "Has the most toxic trait they find cute 💀",
  "Most likely to text 'we need to talk' and then disappear 🫣",
  "Would win a karaoke battle on the first song 🎤",
  "Most likely to have a celebrity encounter story ⭐",
  "Most likely to be the group's therapist (unpaid) 🛋️",
  "Has the funniest dating app bio 📝",
];
/** Questions per week. */
export const PER_WEEK = 10;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** A fixed shuffle of the list, so weeks walk through it without repeats. */
const ORDER = [...QUESTIONS].sort((a, b) => hash("25:" + a) - hash("25:" + b));

export function questionsFor(day = pollWeek()): string[] {
  // The first set is 0; then one more each Thursday, never repeating a set
  // until the whole list has gone round.
  const weeks = day === FIRST_KEY ? 0 : 1 + Math.round(daysBetween(FIRST_SWITCH, day) / 7);
  const rounds = Math.floor(ORDER.length / PER_WEEK);
  const k = ((weeks % rounds) + rounds) % rounds;
  return ORDER.slice(k * PER_WEEK, k * PER_WEEK + PER_WEEK);
}

/** 4 people to pick from. `shuffle` changes the set. */
export function optionsFor(question: string, shuffle = 0, day = pollWeek()): Person[] {
  return [...mutualFriends()]
    .sort((a, b) => hash(day + question + shuffle + a.id) - hash(day + question + shuffle + b.id))
    .slice(0, 4);
}

// ---------- Votes ----------
const DEMO_KEY = "tf.polls.v1";
type DemoVotes = Record<string, Record<string, string>>; // week -> question -> person

function readDemo(): DemoVotes {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Questions you've already answered this week -> who you picked. */
export async function myVotesThisWeek(): Promise<Record<string, string>> {
  const s = _get();
  if (s.mode !== "live") {
    const now = new Set(questionsFor());
    return Object.fromEntries(
      Object.entries(readDemo()[pollWeek()] ?? {}).filter(([q]) => now.has(q)),
    );
  }
  const { data } = await supabase
    .from("poll_votes")
    .select("question,target")
    .eq("day", pollWeek());
  // Only this week's questions count (the list can change under a week's votes).
  const now = new Set(questionsFor());
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { question: string; target: string }[])
    if (now.has(r.question)) out[r.question] = r.target;
  return out;
}

export async function vote(question: string, target: string) {
  const s = _get();
  if (s.mode !== "live") {
    const all = readDemo();
    all[pollWeek()] = { ...(all[pollWeek()] ?? {}), [question]: target };
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
