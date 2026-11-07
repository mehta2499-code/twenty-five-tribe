/** Group chats with people from your mutual 25. */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { _get, friendById, mutualFriends, showBanner, useSocial } from "@/lib/social";
import { uploadMediaAt } from "@/lib/live";
import { uuid } from "@/lib/uuid";

export type GMsg = { id: string; from: string; text?: string; ref?: string; at: number };
export type Group = {
  id: string;
  name: string;
  emoji: string;
  createdBy: string;
  members: string[];
};
export type Member = {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  color?: string;
  username?: string;
};

type State = {
  groups: Group[];
  msgs: Record<string, GMsg[]>;
  people: Record<string, Member>;
  loaded: boolean;
};
let store: State = { groups: [], msgs: {}, people: {}, loaded: false };
const listeners = new Set<() => void>();
function set(fn: (s: State) => State) {
  store = fn(store);
  listeners.forEach((l) => l());
  if (_get().mode !== "live") {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ groups: store.groups, msgs: store.msgs }));
    } catch {
      // ignore
    }
  }
}

const DEMO_KEY = "tf.groups.v1";
const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function demoState(): State {
  const f = mutualFriends().slice(0, 4);
  const now = Date.now();
  const g: Group = {
    id: "demo-goa",
    name: "Goa gang",
    emoji: "🏖️",
    createdBy: "me",
    members: ["me", ...f.map((x) => x.id)],
  };
  const lines = [
    "December plan is ON?",
    "only if someone else books 😭",
    "I'll make the itinerary",
    "famous last words",
  ];
  const msgs = {
    [g.id]: f.map((x, i) => ({
      id: `dg${i}`,
      from: x.id,
      text: lines[i],
      at: now - (4 - i) * 900_000,
    })),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "null") as Pick<
      State,
      "groups" | "msgs"
    > | null;
    if (saved?.groups?.length)
      return { groups: saved.groups, msgs: saved.msgs, people: {}, loaded: true };
  } catch {
    // ignore
  }
  return { groups: [g], msgs, people: {}, loaded: true };
}

let liveFor: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function load(me: string) {
  const { data: gs } = await supabase.from("groups").select("id,name,emoji,created_by");
  const groups = (gs ?? []) as { id: string; name: string; emoji: string; created_by: string }[];
  const ids = groups.map((g) => g.id);
  const [mem, msg] = ids.length
    ? await Promise.all([
        supabase
          .from("group_members")
          .select("group_id,user_id,last_read_at")
          .in("group_id", ids),
        supabase
          .from("group_messages")
          .select("id,group_id,sender,body,shared_ref,created_at")
          .in("group_id", ids)
          .order("created_at", { ascending: false })
          .limit(1500),
      ])
    : [{ data: [] }, { data: [] }];
  const who = (id: string) => (id === me ? "me" : id);
  const members: Record<string, string[]> = {};
  for (const r of (mem.data ?? []) as {
    group_id: string;
    user_id: string;
    last_read_at?: string | null;
  }[]) {
    (members[r.group_id] ??= []).push(who(r.user_id));
    if (r.user_id === me && r.last_read_at)
      serverSeen[r.group_id] = Math.max(serverSeen[r.group_id] ?? 0, Date.parse(r.last_read_at));
  }
  const msgs: Record<string, GMsg[]> = {};
  for (const r of (
    (msg.data ?? []) as {
      id: string;
      group_id: string;
      sender: string;
      body: string | null;
      shared_ref: string | null;
      created_at: string;
    }[]
  ).reverse())
    (msgs[r.group_id] ??= []).push({
      id: r.id,
      from: who(r.sender),
      text: r.body ?? undefined,
      ref: r.shared_ref ?? undefined,
      at: Date.parse(r.created_at),
    });
  // Names for members who aren't in your 25.
  const unknown = [...new Set(Object.values(members).flat())].filter(
    (id) => id !== "me" && !friendById(id),
  );
  const people: Record<string, Member> = {};
  if (unknown.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .in("id", unknown);
    for (const p of (data ?? []) as { id: string; display_name: string; username?: string }[])
      people[p.id] = {
        id: p.id,
        name: p.display_name,
        initials: initials(p.display_name),
        username: p.username ?? undefined,
      };
  }
  if (liveFor !== me) return;
  store = {
    loaded: true,
    people,
    msgs,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      createdBy: who(g.created_by),
      members: members[g.id] ?? [],
    })),
  };
  listeners.forEach((l) => l());
}

export function useGroups() {
  const s = useSocial();
  const st = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => store,
  );
  useEffect(() => {
    if (s.mode === "live" && s.me) {
      if (liveFor === s.me.id) return;
      const me = s.me.id;
      liveFor = me;
      void load(me);
      if (channel) void supabase.removeChannel(channel);
      const reload = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void load(me), 300);
      };
      channel = supabase
        .channel(`groups:${me}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "group_messages" },
          ({ new: row }) => {
            const m = row as { id: string; group_id: string; sender: string; body: string | null };
            if (m.sender !== me) {
              const g = store.groups.find((x) => x.id === m.group_id);
              const who = member(m.sender, store);
              if (g)
                showBanner({
                  id: m.id,
                  title: `${g.emoji} ${g.name}`,
                  body: `${who.name.split(" ")[0]}: ${m.body ?? "New message"}`,
                  to: `/app/group/${g.id}`,
                  avatar: who.avatar,
                  initials: who.initials,
                  color: who.color,
                });
            }
            reload();
          },
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, reload)
        .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, reload)
        .subscribe();
    } else if (s.mode === "demo" && liveFor !== "demo") {
      liveFor = "demo";
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      store = demoState();
      listeners.forEach((l) => l());
    }
  }, [s.mode, s.me]);
  return st;
}

/** Display info for anyone in a group. */
export function member(id: string, st: State): Member {
  if (id === "me") {
    const me = _get().me;
    return {
      id,
      name: "You",
      initials: me?.initials ?? "YO",
      avatar: me?.avatar,
      username: me?.username,
    };
  }
  const f = friendById(id);
  if (f)
    return {
      id,
      name: f.name,
      initials: f.initials,
      avatar: f.avatar || undefined,
      color: f.color,
      username: (f as { username?: string }).username,
    };
  return st.people[id] ?? { id, name: "Someone", initials: "?" };
}

// ---------- Unread ----------
// Saved on the server per member (follows you across devices), with a local
// copy so opening a group clears its badge instantly.
const serverSeen: Record<string, number> = {};
const SEEN_KEY = "tf.groups.seen";
function seenMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function markSeen(groupId: string) {
  const m = seenMap();
  m[groupId] = Date.now();
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
  // Tell the server, so other devices and future logins know too.
  if (mine()) {
    serverSeen[groupId] = Date.now();
    void supabase.rpc("mark_group_read" as never, { p_group: groupId } as never);
  }
}
export function unreadIn(st: State, groupId: string) {
  const since = Math.max(seenMap()[groupId] ?? 0, serverSeen[groupId] ?? 0);
  return (st.msgs[groupId] ?? []).filter((m) => m.from !== "me" && m.at > since).length;
}

// ---------- Actions ----------
const mine = () => _get().mode === "live" && _get().me;

export async function createGroup(name: string, emoji: string, memberIds: string[]) {
  const id = uuid();
  if (!mine()) {
    set((s) => ({
      ...s,
      groups: [{ id, name, emoji, createdBy: "me", members: ["me", ...memberIds] }, ...s.groups],
    }));
    return id;
  }
  const me = _get().me!.id;
  const g = await supabase.from("groups").insert({ id, name, emoji, created_by: me });
  if (g.error) throw new Error(g.error.message);
  const self = await supabase.from("group_members").insert({ group_id: id, user_id: me });
  if (self.error) throw new Error(self.error.message);
  if (memberIds.length) {
    const r = await supabase
      .from("group_members")
      .insert(memberIds.map((u) => ({ group_id: id, user_id: u })));
    if (r.error) throw new Error(r.error.message);
  }
  await load(me);
  return id;
}

function pushLocal(groupId: string, m: GMsg) {
  set((s) => ({ ...s, msgs: { ...s.msgs, [groupId]: [...(s.msgs[groupId] ?? []), m] } }));
}

export async function sendToGroup(groupId: string, text: string) {
  const t = text.trim();
  if (!t) return;
  const id = uuid();
  pushLocal(groupId, { id, from: "me", text: t, at: Date.now() });
  if (!mine()) return;
  const { error } = await supabase
    .from("group_messages")
    .insert({ id, group_id: groupId, sender: _get().me!.id, body: t });
  if (error) throw new Error(error.message);
}

export async function sendGroupVoice(groupId: string, blob: Blob, secs: number) {
  const id = uuid();
  const ref = (src: string) => `voice:${src}|${Math.round(secs)}`;
  pushLocal(groupId, {
    id,
    from: "me",
    text: "Voice note",
    ref: ref(URL.createObjectURL(blob)),
    at: Date.now(),
  });
  if (!mine()) return;
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const path = await uploadMediaAt(`g/${groupId}`, blob, ext);
  const { error } = await supabase.from("group_messages").insert({
    id,
    group_id: groupId,
    sender: _get().me!.id,
    body: "Voice note",
    shared_ref: ref(path),
  });
  if (error) throw new Error(error.message);
}

export async function addMembers(groupId: string, ids: string[]) {
  if (!mine()) {
    set((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, members: [...new Set([...g.members, ...ids])] } : g,
      ),
    }));
    return;
  }
  const { error } = await supabase
    .from("group_members")
    .insert(ids.map((u) => ({ group_id: groupId, user_id: u })));
  if (error)
    throw new Error(
      /25/.test(error.message)
        ? error.message
        : "Couldn't add them. Only people in your mutual 25.",
    );
  await load(_get().me!.id);
}

export async function leaveGroup(groupId: string) {
  set((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== groupId) }));
  if (!mine()) return;
  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", _get().me!.id);
}

/** Send a photo or video to a group. */
export async function sendGroupMedia(groupId: string, file: File) {
  const { prepareMedia } = await import("@/components/ChatExtras");
  const { blob, kind, ext } = await prepareMedia(file);
  const id = uuid();
  const label = kind === "vid" ? "Video" : "Photo";
  pushLocal(groupId, {
    id,
    from: "me",
    text: label,
    ref: `${kind}:${URL.createObjectURL(blob)}`,
    at: Date.now(),
  });
  if (!mine()) return;
  const path = await uploadMediaAt(`g/${groupId}`, blob, ext);
  const { error } = await supabase.from("group_messages").insert({
    id,
    group_id: groupId,
    sender: _get().me!.id,
    body: label,
    shared_ref: `${kind}:${path}`,
  });
  if (error) throw new Error(error.message);
}

/** "@aman hey" → the @-word being typed at the end of the text, or null. */
export function mentionQuery(text: string) {
  const m = /(^|\s)@([\w.]*)$/.exec(text);
  return m ? m[2].toLowerCase() : null;
}

/** Split message text into plain parts and @mentions of group members. */
export function splitMentions(text: string, members: Member[]) {
  const byName = new Map(
    members.filter((m) => m.username).map((m) => [m.username!.toLowerCase(), m]),
  );
  const parts: { text: string; who?: Member }[] = [];
  let last = 0;
  for (const m of text.matchAll(/@([\w.]+)/g)) {
    const handle = m[1].replace(/\.+$/, "").toLowerCase();
    const who = byName.get(handle);
    if (!who) continue;
    const start = m.index!;
    const end = start + 1 + handle.length;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: text.slice(start, end), who });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
