/**
 * Weekly trivia: 5 new topics every week, switching every Saturday at
 * midnight India time. Week 1 started Saturday 14 Nov 2026. After week 8 it
 * loops back to week 1.
 */
import week1 from "@/lib/trivia/week1";
import week2 from "@/lib/trivia/week2";
import week3 from "@/lib/trivia/week3";
import week4 from "@/lib/trivia/week4";
import week5 from "@/lib/trivia/week5";
import week6 from "@/lib/trivia/week6";
import week7 from "@/lib/trivia/week7";
import week8 from "@/lib/trivia/week8";
import type { WeekPack } from "@/lib/trivia/types";

export const WEEKS: WeekPack[][] = [week1, week2, week3, week4, week5, week6, week7, week8];

/** Saturday 14 Nov 2026, 00:00 in India (UTC+5:30). */
const ANCHOR = Date.UTC(2026, 10, 13, 18, 30);
const WEEK_MS = 7 * 24 * 3600_000;

/** Which week of the rotation it is (0-7). */
export function weekIndex(now = Date.now()) {
  const n = Math.floor((now - ANCHOR) / WEEK_MS);
  return ((n % WEEKS.length) + WEEKS.length) % WEEKS.length;
}

/** This week's pack ids. */
export const thisWeekIds = (now = Date.now()) => WEEKS[weekIndex(now)].map((p) => p.id);

/** When the topics change next. */
export function nextSwitch(now = Date.now()) {
  const n = Math.floor((now - ANCHOR) / WEEK_MS);
  return ANCHOR + (n + 1) * WEEK_MS;
}

/** "in 3 days", "tomorrow", "in 5 hours". */
export function switchesIn(now = Date.now()) {
  const ms = nextSwitch(now) - now;
  const days = Math.floor(ms / (24 * 3600_000));
  if (days >= 2) return `in ${days} days`;
  if (days === 1) return "tomorrow";
  const hours = Math.max(1, Math.ceil(ms / 3600_000));
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}
