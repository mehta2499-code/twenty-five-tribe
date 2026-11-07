/**
 * Activity: what happened to you. Seated, seated back, likes, comments,
 * word results, anonymous poll picks. Stored in Supabase `notifications`.
 */
import { useEffect, useSyncExternalStore } from "react";
import {
  Cake,
  Camera,
  Crown,
  Eye,
  Handshake,
  Heart,
  MessageCircle,
  Sparkles,
  Type,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { _get, seatedFriends, useSocial } from "@/lib/social";

export type Activity = {
  id: string;
  kind: "seated" | "seated_back" | "like" | "comment" | "word_done" | "poll" | "drop" | string;
  actor: string | null;
  /** Name of the person, filled in when we load it. */
  actorName?: string;
  ref: string | null;
  body: string;
  at: number;
  read: boolean;
};

type State = { items: Activity[]; loaded: boolean };
let store: State = { items: [], loaded: false };
const listeners = new Set<() => void>();
const set = (s: State) => {
  store = s;
  listeners.forEach((l) => l());
};

let liveFor: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;

async function load(me: string) {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  const rows = (data ?? []) as {
    id: string;
    kind: string;
    actor: string | null;
    ref: string | null;
    body: string;
    created_at: string;
    read_at: string | null;
  }[];
  const ids = [...new Set(rows.map((r) => r.actor).filter(Boolean))] as string[];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: ps } = await supabase.from("profiles").select("id,display_name").in("id", ids);
    for (const p of (ps ?? []) as { id: string; display_name: string }[]) names[p.id] = p.display_name;
  }
  if (liveFor !== me) return;
  set({
    loaded: true,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      actor: r.actor,
      actorName: r.actor ? names[r.actor] : undefined,
      ref: r.ref,
      body: r.body,
      at: new Date(r.created_at).getTime(),
      read: !!r.read_at,
    })),
  });
}

function demoItems(): Activity[] {
  const f = seatedFriends();
  const now = Date.now();
  const m = 60_000;
  const pick = (i: number) => f[i % Math.max(1, f.length)];
  return [
    { kind: "poll", actor: null, body: "Most likely to become famous", at: now - 9 * m },
    { kind: "seated_back", actor: pick(1)?.id, at: now - 40 * m },
    { kind: "like", actor: pick(2)?.id, ref: "post:p1", at: now - 2 * 60 * m },
    { kind: "comment", actor: pick(3)?.id, body: "this is SO you 😭", at: now - 5 * 60 * m },
    { kind: "seated", actor: pick(4)?.id, at: now - 26 * 60 * m },
    { kind: "word_done", actor: pick(0)?.id, body: "cracked your word in 4/6", at: now - 30 * 60 * m },
  ].map((x, i) => ({
    id: `demo-${i}`,
    ref: null,
    body: "",
    read: i > 1,
    ...x,
    actor: x.actor ?? null,
    actorName: f.find((p) => p.id === x.actor)?.name,
  }));
}

function ensure() {
  const s = _get();
  if (s.mode === "live" && s.me) {
    if (liveFor === s.me.id) return;
    const me = s.me.id;
    liveFor = me;
    void load(me);
    if (channel) void supabase.removeChannel(channel);
    channel = supabase
      .channel(`activity:${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me}` },
        () => void load(me),
      )
      .subscribe();
  } else if (s.mode === "demo" && liveFor !== "demo") {
    liveFor = "demo";
    if (channel) void supabase.removeChannel(channel);
    channel = null;
    set({ loaded: true, items: demoItems() });
  }
}

export function useActivity() {
  const s = useSocial();
  const st = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => store,
  );
  useEffect(ensure, [s.mode, s.me?.id]);
  return st;
}

export const unreadCount = (s: State) => s.items.filter((i) => !i.read).length;

export async function markAllRead() {
  if (!store.items.some((i) => !i.read)) return;
  set({ ...store, items: store.items.map((i) => ({ ...i, read: true })) });
  if (_get().mode === "live") {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
  }
}

/** One line of text for an activity item. */
export function describe(a: Activity): { Icon: LucideIcon; tone: string; text: string } {
  const who = a.actorName?.split(" ")[0] ?? "Someone";
  switch (a.kind) {
    case "seated":
      return { Icon: Eye, tone: "var(--sky)", text: `${who} put you in their 25. Seat them back?` };
    case "seated_back":
      return { Icon: Handshake, tone: "var(--lime)", text: `${who} seated you back. Chats and blinks unlocked.` };
    case "like":
      return { Icon: Heart, tone: "var(--hot)", text: `${who} liked your ${a.ref?.startsWith("reel") ? "reel" : "post"}` };
    case "comment":
      return { Icon: MessageCircle, tone: "var(--sky)", text: `${who} commented: ${a.body}` };
    case "word_done":
      return { Icon: Type, tone: "var(--sun)", text: `${who} ${a.body}` };
    case "poll":
      return { Icon: Vote, tone: "var(--pink)", text: `Someone in your 25 picked you for “${a.body}”` };
    case "card":
      return { Icon: Cake, tone: "var(--pink)", text: `${who} signed your birthday card` };
    case "drop_like":
      return { Icon: Heart, tone: "var(--hot)", text: `${who} liked your Drop` };
    case "drop_comment":
      return { Icon: MessageCircle, tone: "var(--sky)", text: `${who} commented on your Drop: ${a.body}` };
    case "quiz_ace":
      return {
        Icon: Crown,
        tone: "var(--sun)",
        text: `${who} got ${a.body} on your quiz. ${a.body?.split("/")[0] === a.body?.split("/")[1] ? "Ride or Die." : "A Real One."}`,
      };
    case "drop":
      return { Icon: Camera, tone: "var(--lime)", text: `${who} posted their Drop` };
    default:
      return { Icon: Sparkles, tone: "var(--sun)", text: a.body || "Something happened" };
  }
}
