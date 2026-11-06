/**
 * The 25 Drop: once a day, at a surprise time (same for everyone, 10:00–22:00
 * India time), everyone gets 10 minutes to post one unfiltered photo.
 * You only see your mutual 25's drops after posting yours.
 */
import { supabase } from "@/integrations/supabase/client";
import { _get, mutualFriends } from "@/lib/social";
import { today } from "@/lib/daily";
import { signedMedia, uploadMedia } from "@/lib/live";

export const WINDOW_MIN = 10;
export type DropComment = { id: string; by: string; body: string; at: number };
export type DropPost = {
  /** "me" or the owner's id. */
  id: string;
  /** Real user id (for likes/comments). */
  owner?: string;
  image: string;
  caption: string;
  late: number;
  at: number;
  likes?: string[];
  comments?: DropComment[];
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

let timeCache: { day: string; at: number } | null = null;

/** When today's Drop happens (ms since epoch). */
export async function dropTime(): Promise<number> {
  const day = today();
  if (timeCache?.day === day) return timeCache.at;
  let at: number;
  if (_get().mode === "live") {
    const { data } = await supabase.rpc("drop_time");
    at = Date.parse(data as string);
  } else {
    // Demo: a time earlier today, so there's always something to try.
    const midnightIst = Date.parse(`${day}T00:00:00+05:30`);
    const nowMin = Math.floor((Date.now() - midnightIst) / 60_000);
    const mins = Math.max(0, Math.min(nowMin - 3, 600 + (hash(day) % 720)));
    at = midnightIst + mins * 60_000;
  }
  timeCache = { day, at };
  return at;
}

export function phaseOf(at: number, now = Date.now()) {
  if (now < at) return "before" as const;
  if (now < at + WINDOW_MIN * 60_000) return "now" as const;
  return "after" as const;
}

const DEMO_KEY = "tf.drop.v1";
const PHOTOS = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=700",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=700",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=700",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=700",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=700",
];

/** Today's drops: yours, then your mutual 25's (empty until you post). */
export async function loadDrops(): Promise<{ mine: DropPost | null; others: DropPost[] }> {
  const s = _get();
  const day = today();
  if (s.mode !== "live") {
    let mine: DropPost | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "null") as (DropPost & { day: string }) | null;
      if (saved?.day === day) mine = saved;
    } catch {
      // ignore
    }
    const others = mine
      ? mutualFriends()
          .slice(0, 5)
          .map((f, i) => ({
            id: f.id,
            image: PHOTOS[i],
            caption: ["desk lunch again 🥲", "send help", "views tho", "", "no thoughts"][i],
            late: [0, 0, 34, 0, 112][i],
            at: Date.now() - i * 600_000,
          }))
      : [];
    return { mine, others };
  }
  const { data } = await supabase
    .from("drops")
    .select("user_id,image_path,caption,late_minutes,created_at")
    .eq("day", day);
  const rows = (data ?? []) as {
    user_id: string;
    image_path: string;
    caption: string;
    late_minutes: number;
    created_at: string;
  }[];
  const urls = await signedMedia(rows.map((r) => r.image_path));
  const me = s.me?.id;
  const who = (id: string) => (id === me ? "me" : id);
  const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
    supabase.from("drop_likes").select("owner,user_id").eq("day", day),
    supabase.from("drop_comments").select("id,owner,author,body,created_at").eq("day", day).order("created_at"),
  ]);
  const likes = (likeRows ?? []) as { owner: string; user_id: string }[];
  const comments = (commentRows ?? []) as {
    id: string;
    owner: string;
    author: string;
    body: string;
    created_at: string;
  }[];
  const posts = rows.map((r) => ({
    id: who(r.user_id),
    owner: r.user_id,
    likes: likes.filter((l) => l.owner === r.user_id).map((l) => who(l.user_id)),
    comments: comments
      .filter((c) => c.owner === r.user_id)
      .map((c) => ({ id: c.id, by: who(c.author), body: c.body, at: Date.parse(c.created_at) })),
    image: urls[r.image_path] ?? "",
    caption: r.caption,
    late: r.late_minutes,
    at: Date.parse(r.created_at),
  }));
  return {
    mine: posts.find((p) => p.id === "me") ?? null,
    others: posts.filter((p) => p.id !== "me").sort((a, b) => a.at - b.at),
  };
}

export async function postDrop(image: string, caption: string, at: number) {
  const s = _get();
  if (s.mode !== "live") {
    const late = Math.max(0, Math.floor((Date.now() - at) / 60_000) - WINDOW_MIN);
    localStorage.setItem(
      DEMO_KEY,
      JSON.stringify({ id: "me", image, caption, late, at: Date.now(), day: today() }),
    );
    return;
  }
  const path = await uploadMedia(image, "jpg");
  const { error } = await supabase
    .from("drops")
    .insert({ user_id: s.me!.id, image_path: path, caption: caption.slice(0, 120) });
  if (error) {
    throw new Error(
      /duplicate/i.test(error.message)
        ? "You've already dropped today."
        : /row-level/i.test(error.message)
          ? "Today's Drop hasn't happened yet. Hold tight."
          : error.message,
    );
  }
}

export async function toggleDropLike(owner: string, liked: boolean) {
  const me = _get().me;
  if (!me) return;
  const day = today();
  if (liked)
    await supabase.from("drop_likes").delete().eq("owner", owner).eq("day", day).eq("user_id", me.id);
  else await supabase.from("drop_likes").insert({ owner, day, user_id: me.id });
}

export async function commentOnDrop(owner: string, body: string) {
  const me = _get().me;
  if (!me) return;
  const { error } = await supabase
    .from("drop_comments")
    .insert({ owner, day: today(), author: me.id, body: body.trim().slice(0, 300) });
  if (error) throw new Error(error.message);
}
