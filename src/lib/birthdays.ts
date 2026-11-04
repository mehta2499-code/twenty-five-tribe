/** Birthdays of you and your mutual 25 (day and month only), and birthday cards. */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { _get, seatedFriends, useSocial } from "@/lib/social";
import { today } from "@/lib/daily";

export type Bday = { id: string; month: number; day: number };
export type CardNote = { author: string; body: string; at: number };

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const bdayLabel = (b: Bday) => `${b.day} ${MONTHS[b.month - 1]}`;

/** 0 = today, 1 = tomorrow … */
export function daysUntil(b: Bday, from = today()): number {
  const year = Number(from.slice(0, 4));
  const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const key = (y: number) =>
    `${y}-${pad(b.month)}-${pad(b.month === 2 && b.day === 29 && !leap(y) ? 28 : b.day)}`;
  let next = key(year);
  if (next < from) next = key(year + 1);
  return Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** Demo: one friend's birthday today, one in 3 days, the rest spread out. */
function demoBirthdays(): Bday[] {
  const t = today();
  const at = (offset: number) => {
    const d = new Date(Date.parse(`${t}T00:00:00Z`) + offset * DAY);
    return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  };
  return seatedFriends().map((f, i) => ({
    id: f.id,
    ...(i === 1 ? at(0) : i === 4 ? at(3) : i === 7 ? at(12) : at(20 + (hash(f.id) % 330))),
  }));
}

let cache: { key: string; list: Bday[] } | null = null;

export function useBirthdays(): Bday[] {
  const s = useSocial();
  const key = s.mode === "live" ? `live:${s.me?.id}:${s.people.length}` : "demo";
  const [list, setList] = useState<Bday[]>(() => (cache?.key === key ? cache.list : []));
  useEffect(() => {
    if (cache?.key === key) return setList(cache.list);
    if (s.mode !== "live" || !s.me) {
      const l = demoBirthdays();
      cache = { key, list: l };
      return setList(l);
    }
    const me = s.me.id;
    void supabase.rpc("birthdays").then(({ data }) => {
      const l = ((data ?? []) as { user_id: string; month: number; day: number }[]).map((r) => ({
        id: r.user_id === me ? "me" : r.user_id,
        month: r.month,
        day: r.day,
      }));
      cache = { key, list: l };
      setList(l);
    });
  }, [key, s.mode, s.me]);
  return list;
}

/** Birthdays in the next `within` days, soonest first (yours excluded). */
export function upcoming(list: Bday[], within = 30) {
  return list
    .filter((b) => b.id !== "me")
    .map((b) => ({ ...b, inDays: daysUntil(b) }))
    .filter((b) => b.inDays <= within)
    .sort((a, b) => a.inDays - b.inDays);
}

// ---------- Cards ----------
const cardYear = () => Number(today().slice(0, 4));
const DEMO_KEY = "tf.cards.v1";

export async function loadCard(target: string): Promise<CardNote[]> {
  const s = _get();
  if (s.mode !== "live") {
    try {
      const all = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}") as Record<string, CardNote[]>;
      const mine = all[target] ?? [];
      const others = seatedFriends()
        .filter((f) => f.id !== target)
        .slice(0, 3)
        .map((f, i) => ({
          author: f.id,
          body: ["HAPPIEST BIRTHDAY 🎉 love you idiot", "Another year of you being iconic 💅", "Party at yours? 🎂"][i],
          at: Date.now() - (i + 1) * 3_600_000,
        }));
      return [...mine, ...others];
    } catch {
      return [];
    }
  }
  const { data } = await supabase
    .from("birthday_cards")
    .select("author,body,created_at")
    .eq("target", target)
    .eq("year", cardYear())
    .order("created_at");
  const me = s.me?.id;
  return ((data ?? []) as { author: string; body: string; created_at: string }[]).map((r) => ({
    author: r.author === me ? "me" : r.author,
    body: r.body,
    at: Date.parse(r.created_at),
  }));
}

export async function signCard(target: string, body: string) {
  const s = _get();
  if (s.mode !== "live") {
    const all = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}") as Record<string, CardNote[]>;
    all[target] = [...(all[target] ?? []), { author: "me", body, at: Date.now() }];
    localStorage.setItem(DEMO_KEY, JSON.stringify(all));
    return;
  }
  const { error } = await supabase
    .from("birthday_cards")
    .insert({ target, year: cardYear(), author: s.me!.id, body });
  if (error) throw new Error(/duplicate/i.test(error.message) ? "You've already signed." : error.message);
}
