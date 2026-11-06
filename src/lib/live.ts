/**
 * Live layer: the same actions the screens already call, backed by Supabase.
 * Signed out, the app keeps running on demo data (see social.ts).
 */
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { uuid } from "@/lib/uuid";
import { supabase } from "@/integrations/supabase/client";
import {
  _get,
  _restoreDemo,
  _set,
  dayKey,
  registerLive,
  social as live,
  weekKey,
  type ChatMessage,
  type Comment,
  type FriendRequest,
  type GameId,
  type Me,
  type MsgStatus,
  type Person,
  type Post,
  type Reel,
  type ScoreBoard,
  type Snap,
  type SocialState,
  type Streak,
  showBanner,
  friendById,
} from "@/lib/social";

// ---------- Row shapes ----------
type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
};
type SeatRow = {
  owner: string;
  guest: string;
  created_at: string;
};
type MessageRow = {
  id: string;
  sender: string;
  recipient: string;
  body: string | null;
  snap_id: string | null;
  shared_ref: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};
type SnapRow = {
  id: string;
  sender: string;
  image_path: string | null;
  bg: string | null;
  caption: string | null;
  seconds: number;
  created_at: string;
};
type SnapRecipientRow = { snap_id: string; recipient: string; opened_at: string | null };
type StreakRow = {
  user_a: string;
  user_b: string;
  count: number;
  a_last: string | null;
  b_last: string | null;
  counted_day: string | null;
};
type PostRow = {
  id: string;
  author: string;
  kind: "post" | "reel";
  media_path: string;
  media_type: "image" | "video";
  caption: string;
  created_at: string;
};
type LikeRow = { post_id: string; user_id: string };
type CommentRow = { id: string; post_id: string; author: string; body: string; created_at: string };
type ScoreRow = { user_id: string; game: GameId; week: string; best: number };

const COLOURS = [
  "#2B8AC4",
  "#1A5276",
  "#D9534A",
  "#17926F",
  "#E0A21B",
  "#1E6FA0",
  "#7A5CC2",
  "#C2571B",
];
const colourFor = (id: string) =>
  COLOURS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLOURS.length];
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
const ts = (iso: string) => new Date(iso).getTime();
const newId = () => uuid();

let myId: string | null = null;
let channels: RealtimeChannel[] = [];
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function fail(message: string) {
  _set((s) => ({ ...s, error: message }));
}
function friendly(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/seats taken/i.test(msg)) return msg;
  if (/duplicate key.*username|profiles_username_key|username.*unique/i.test(msg))
    return "That username is taken. Try another.";
  if (/invalid.*password|password.*(weak|short|length)/i.test(msg))
    return "Use a stronger password with at least 8 characters.";
  if (/duplicate key.*seats/i.test(msg)) return "They're already in your 25.";
  if (/row-level security/i.test(msg)) return "You can only do that with people in your 25.";
  if (/Failed to fetch|NetworkError/i.test(msg))
    return "Can't reach the server. Check your connection and try again.";
  return msg;
}
/** Runs a list query; an empty result comes back as []. */
async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? []) as T;
}

// ---------- Files ----------
async function upload(bucket: "media" | "snaps" | "avatars", source: string | Blob, ext: string) {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const path = `${myId}/${newId()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: blob.type || undefined });
  if (error) throw error;
  return path;
}
async function signed(bucket: "media" | "snaps" | "avatars", paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 60 * 60 * 6);
  const out: Record<string, string> = {};
  data?.forEach((d) => d.signedUrl && d.path && (out[d.path] = d.signedUrl));
  return out;
}

/** Delete a snap's photo from storage, then forget its path. */
async function deleteSnapFile(snapId: string, path: string) {
  const { error } = await supabase.storage.from("snaps").remove([path]);
  if (!error) await supabase.rpc("forget_snap_file", { p_snap: snapId });
}

export type Suggestion = Person & {
  mutuals: number;
  reason: "mutuals" | "new";
};

// ---------- Loading ----------
async function loadAll() {
  if (!myId) return;
  const me = myId;
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", me)
      .maybeSingle<ProfileRow>();
    if (profileError) throw profileError;
    if (!profile) {
      _set((s) => ({ ...s, needsProfile: true, loading: false }));
      return;
    }

    const seatRows = await run(
      supabase.from("seats").select("*").or(`owner.eq.${me},guest.eq.${me}`).returns<SeatRow[]>(),
    );
    // mine: who I put in my 25. seatedMe: who put me in theirs.
    const mine = new Map(seatRows.filter((r) => r.owner === me).map((r) => [r.guest, r]));
    const seatedMe = new Map(seatRows.filter((r) => r.guest === me).map((r) => [r.owner, r]));
    const otherIds = [...new Set([...mine.keys(), ...seatedMe.keys()])];
    const profiles = otherIds.length
      ? await run(supabase.from("profiles").select("*").in("id", otherIds).returns<ProfileRow[]>())
      : [];
    const avatarUrls = await signed("avatars", [
      profile.avatar_path ?? "",
      ...profiles.map((p) => p.avatar_path ?? ""),
    ]);
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const toPerson = (p: ProfileRow, since?: string | null): Person => ({
      id: p.id,
      name: p.display_name,
      username: p.username,
      initials: initialsOf(p.display_name),
      color: colourFor(p.id),
      avatar: p.avatar_path ? (avatarUrls[p.avatar_path] ?? "") : "",
      postedToday: false,
      joinedDaysAgo: Math.floor((Date.now() - ts(since ?? p.created_at)) / 86_400_000),
      daysQuiet: 0,
    });

    const [{ data: myVibeRow }, { data: attempts }] = await Promise.all([
      supabase.from("vibe_answers").select("user_id").eq("user_id", me).maybeSingle(),
      supabase
        .from("quiz_attempts")
        .select("guesser,target,score,total,passed")
        .eq("passed", true)
        .or(`guesser.eq.${me},target.eq.${me}`),
    ]);
    const passedRows = (attempts ?? []) as {
      guesser: string;
      target: string;
      score: number;
      total: number;
    }[];
    const knewMe = new Map(
      passedRows
        .filter((a) => a.target === me)
        .map((a) => [a.guesser, { score: a.score, total: a.total }]),
    );
    const iPassed = new Set(passedRows.filter((a) => a.guesser === me).map((a) => a.target));

    const people: Person[] = [];
    const requests: FriendRequest[] = [];
    for (const [id, row] of mine) {
      const other = byId.get(id);
      if (other) people.push({ ...toPerson(other, row.created_at), mutual: seatedMe.has(id) });
    }
    for (const [id, row] of seatedMe) {
      const other = byId.get(id);
      if (!other || mine.has(id)) continue;
      requests.push({
        id,
        person: { ...toPerson(other, row.created_at), mutual: false },
        direction: "incoming",
        knew: knewMe.get(id),
        iPassed: iPassed.has(id),
      });
    }
    people.sort((a, b) => a.name.localeCompare(b.name));

    const [messages, inbox, sent, streakRows, postRows, scoreRows] = await Promise.all([
      run(
        supabase
          .from("messages")
          .select("*")
          .or(`sender.eq.${me},recipient.eq.${me}`)
          .order("created_at", { ascending: false })
          .limit(1500)
          .returns<MessageRow[]>(),
      ),
      run(
        supabase
          .from("snap_recipients")
          .select("*")
          .eq("recipient", me)
          .is("opened_at", null)
          .returns<SnapRecipientRow[]>(),
      ),
      run(
        supabase
          .from("snaps")
          .select("*")
          .eq("sender", me)
          .order("created_at", { ascending: false })
          .limit(60)
          .returns<SnapRow[]>(),
      ),
      run(
        supabase
          .from("streaks")
          .select("*")
          .or(`user_a.eq.${me},user_b.eq.${me}`)
          .returns<StreakRow[]>(),
      ),
      run(
        supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(150)
          .returns<PostRow[]>(),
      ),
      run(supabase.from("game_scores").select("*").eq("week", weekKey()).returns<ScoreRow[]>()),
    ]);

    // Chats
    const chats: Record<string, ChatMessage[]> = {};
    const unread: Record<string, number> = {};
    for (const m of [...messages].reverse()) {
      const other = m.sender === me ? m.recipient : m.sender;
      (chats[other] ??= []).push(toChat(m));
      if (m.recipient === me && !m.read_at) unread[other] = (unread[other] ?? 0) + 1;
    }
    // Tell senders their messages reached this phone.
    if (messages.some((m) => m.recipient === me && !m.delivered_at)) {
      void supabase
        .from("messages")
        .update({ delivered_at: new Date().toISOString() })
        .eq("recipient", me)
        .is("delivered_at", null)
        .then(() => {});
    }

    // Snaps: unopened ones sent to me, plus the ones I sent (to show "opened")
    const inboxSnaps = inbox.length
      ? await run(
          supabase
            .from("snaps")
            .select("*")
            .in(
              "id",
              inbox.map((r) => r.snap_id),
            )
            .returns<SnapRow[]>(),
        )
      : [];
    const sentRecipients = sent.length
      ? await run(
          supabase
            .from("snap_recipients")
            .select("*")
            .in(
              "snap_id",
              sent.map((x) => x.id),
            )
            .returns<SnapRecipientRow[]>(),
        )
      : [];
    // Clean up: my sent snaps everyone has opened lose their file for good.
    for (const x of sent) {
      if (!x.image_path) continue;
      const rs = sentRecipients.filter((r) => r.snap_id === x.id);
      if (rs.length && rs.every((r) => r.opened_at)) {
        void deleteSnapFile(x.id, x.image_path);
        x.image_path = null;
      }
    }
    const snapUrls = await signed(
      "snaps",
      [...inboxSnaps, ...sent].map((x) => x.image_path ?? ""),
    );
    const snaps: Snap[] = [
      ...inboxSnaps.map((x) => toSnap(x, ["me"], [], snapUrls)),
      ...sent.map((x) => {
        const rs = sentRecipients.filter((r) => r.snap_id === x.id);
        return toSnap(
          x,
          rs.map((r) => r.recipient),
          rs.filter((r) => r.opened_at).map((r) => r.recipient),
          snapUrls,
        );
      }),
    ].sort((a, b) => b.at - a.at);

    // Streaks: a streak is alive if it counted today or yesterday.
    const today = dayKey();
    const yesterday = dayKey(Date.now() - 86_400_000);
    const streaks: Record<string, Streak> = {};
    for (const r of streakRows) {
      const other = r.user_a === me ? r.user_b : r.user_a;
      const alive = r.counted_day === today || r.counted_day === yesterday;
      streaks[other] = {
        count: alive ? r.count : 0,
        lastSentDay: r.counted_day, // "at risk" = today hasn't counted yet
        lastGotDay: r.user_a === me ? r.b_last : r.a_last,
      };
    }

    // Posts and reels
    const postIds = postRows.map((p) => p.id);
    const [likes, comments] = postIds.length
      ? await Promise.all([
          run(
            supabase
              .from("post_likes")
              .select("post_id,user_id")
              .in("post_id", postIds)
              .returns<LikeRow[]>(),
          ),
          run(
            supabase
              .from("post_comments")
              .select("*")
              .in("post_id", postIds)
              .order("created_at")
              .returns<CommentRow[]>(),
          ),
        ])
      : [[], []];
    const mediaUrls = await signed(
      "media",
      postRows.map((p) => p.media_path),
    );
    const who = (id: string) => (id === me ? "me" : id);
    // People who liked/commented/posted but aren't loaded yet: fetch their names.
    const strangerIds = [
      ...new Set([
        ...likes.map((l) => l.user_id),
        ...comments.map((c) => c.author),
        ...postRows.map((p) => p.author),
      ]),
    ].filter((id) => id !== me && !byId.has(id));
    const strangerRows = strangerIds.length
      ? await run(
          supabase.from("profiles").select("*").in("id", strangerIds).returns<ProfileRow[]>(),
        )
      : [];
    const strangerUrls = await signed(
      "avatars",
      strangerRows.map((p) => p.avatar_path ?? ""),
    );
    const others: SocialState["others"] = {};
    for (const p of strangerRows)
      others[p.id] = {
        name: p.display_name,
        initials: initialsOf(p.display_name),
        avatar: p.avatar_path ? strangerUrls[p.avatar_path] : undefined,
        color: colourFor(p.id),
      };
    const likesFor = (id: string) =>
      likes.filter((l) => l.post_id === id).map((l) => who(l.user_id));
    const commentsFor = (id: string): Comment[] =>
      comments
        .filter((c) => c.post_id === id)
        .map((c) => ({ id: c.id, by: who(c.author), text: c.body, at: ts(c.created_at) }));
    const posts: Post[] = [];
    const reels: Reel[] = [];
    // The database only returns posts you're allowed to see (yours, and from
    // anyone who put you in their 25), so show them all.
    for (const p of postRows) {
      const url = mediaUrls[p.media_path] ?? "";
      const base = {
        id: p.id,
        by: who(p.author),
        caption: p.caption,
        at: ts(p.created_at),
        likes: likesFor(p.id),
        comments: commentsFor(p.id),
      };
      // Reels are gone: videos are just posts now.
      posts.push(
        p.media_type === "video"
          ? { ...base, image: "", video: url, mediaPath: p.media_path }
          : { ...base, image: url, mediaPath: p.media_path },
      );
    }
    const postedToday = new Set(
      postRows.filter((p) => dayKey(ts(p.created_at)) === today).map((p) => p.author),
    );
    people.forEach((p) => (p.postedToday = postedToday.has(p.id)));

    // Scores
    const scores: ScoreBoard = {
      "tap-rush": {},
      "quick-math": {},
      trivia: {},
      "colour-clash": {},
      "pair-up": {},
    };
    for (const r of scoreRows) scores[r.game][who(r.user_id)] = r.best;

    const meObj: Me = {
      id: me,
      name: profile.display_name,
      username: profile.username,
      initials: initialsOf(profile.display_name),
      avatar: profile.avatar_path ? avatarUrls[profile.avatar_path] : undefined,
      vibeDone: !!myVibeRow,
    };

    _set((s) => ({
      ...s,
      mode: "live",
      me: meObj,
      needsProfile: false,
      loading: false,
      people,
      requests,
      seatedByCount: seatedMe.size,
      others,
      chats,
      unread,
      snaps,
      streaks,
      posts,
      reels,
      scores,
      week: weekKey(),
    }));
  } catch (e) {
    _set((s) => ({ ...s, loading: false }));
    fail(friendly(e));
  }
}

function toChat(m: MessageRow): ChatMessage {
  const mine = m.sender === myId;
  const status: MsgStatus = m.read_at ? "read" : m.delivered_at ? "delivered" : "sent";
  return {
    id: m.id,
    from: mine ? "me" : m.sender,
    text: m.body ?? undefined,
    snapId: m.snap_id ?? undefined,
    sharedPostId: m.shared_ref ?? undefined,
    at: ts(m.created_at),
    status: mine ? status : undefined,
  };
}
function toSnap(x: SnapRow, to: string[], openedBy: string[], urls: Record<string, string>): Snap {
  return {
    id: x.id,
    from: x.sender === myId ? "me" : x.sender,
    to,
    image: x.image_path ? urls[x.image_path] : undefined,
    bg: x.bg ?? undefined,
    caption: x.caption ?? undefined,
    seconds: x.seconds,
    at: ts(x.created_at),
    openedBy,
  };
}

/** Coalesce bursts of realtime events into one refresh. */
export function scheduleReload(ms = 500) {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => void loadAll(), ms);
}

// ---------- Realtime ----------
function subscribe() {
  if (!myId) return;
  const me = myId;
  const db = supabase
    .channel(`db:${me}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      ({ new: row }) => {
        const m = row as MessageRow;
        if (m.sender !== me && m.recipient !== me) return;
        const other = m.sender === me ? m.recipient : m.sender;
        _set((s) => {
          const list = s.chats[other] ?? [];
          if (list.some((x) => x.id === m.id)) return s;
          const incoming = m.recipient === me;
          return {
            ...s,
            chats: { ...s.chats, [other]: [...list, toChat(m)] },
            unread: incoming ? { ...s.unread, [other]: (s.unread[other] ?? 0) + 1 } : s.unread,
            typing: { ...s.typing, [other]: false },
          };
        });
        if (m.recipient === me) {
          const f = friendById(m.sender);
          const ref = m.shared_ref ?? "";
          showBanner({
            id: m.id,
            title: f?.name ?? "New message",
            body: ref.startsWith("voice:")
              ? "🎤 Voice note"
              : ref.startsWith("img:")
                ? "📷 Photo"
                : ref.startsWith("vid:")
                  ? "🎥 Video"
                  : (m.body ?? "New message"),
            to: `/app/chat/${m.sender}`,
            avatar: f?.avatar || undefined,
            initials: f?.initials ?? "?",
            color: f?.color,
          });
          void supabase
            .from("messages")
            .update({ delivered_at: new Date().toISOString() })
            .eq("id", m.id)
            .is("delivered_at", null)
            .then(() => {});
          if (m.snap_id) scheduleReload();
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      ({ new: row }) => {
        const m = row as MessageRow;
        if (m.sender !== me) return;
        _set((s) => ({
          ...s,
          chats: {
            ...s.chats,
            [m.recipient]: (s.chats[m.recipient] ?? []).map((x) => (x.id === m.id ? toChat(m) : x)),
          },
        }));
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "seats" },
      ({ eventType, new: row }) => {
        const r = row as Partial<SeatRow>;
        if (eventType === "INSERT" && r.guest === me && r.owner) {
          const owner = r.owner;
          void supabase
            .from("profiles")
            .select("display_name")
            .eq("id", owner)
            .maybeSingle<{ display_name: string }>()
            .then(({ data }) => {
              const name = data?.display_name.split(" ")[0] ?? "Someone";
              const back = _get().people.some((p) => p.id === owner);
              _set((s) => ({
                ...s,
                notice: back
                  ? `🤝 ${name} seated you back. Chats and snaps unlocked.`
                  : `👀 ${name} put you in their 25.`,
              }));
            });
        }
        scheduleReload();
      },
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quiz_attempts" }, () =>
      scheduleReload(800),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "snap_recipients" },
      ({ eventType, new: row }) => {
        const r = row as Partial<SnapRecipientRow>;
        if (eventType === "INSERT" && r.recipient === me && r.snap_id) {
          void supabase
            .from("snaps")
            .select("sender")
            .eq("id", r.snap_id)
            .maybeSingle<{ sender: string }>()
            .then(({ data }) => {
              const f = data ? friendById(data.sender) : undefined;
              showBanner({
                id: `snap-${r.snap_id}`,
                title: f?.name ?? "New snap",
                body: "📸 Sent you a snap. Open before it vanishes.",
                to: "/app/snap",
                avatar: f?.avatar || undefined,
                initials: f?.initials ?? "?",
                color: f?.color,
              });
            });
        }
        scheduleReload();
      },
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "streaks" }, () =>
      scheduleReload(),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () =>
      scheduleReload(),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () =>
      scheduleReload(800),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments" }, () =>
      scheduleReload(),
    )
    .subscribe();

  // "typing…" goes over a lightweight broadcast channel, one inbox per person.
  const inbox = supabase
    .channel(`inbox:${me}`)
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      const from = (payload as { from?: string })?.from;
      if (!from) return;
      _set((s) => ({ ...s, typing: { ...s.typing, [from]: true } }));
      clearTimeout(typingTimers[from]);
      typingTimers[from] = setTimeout(
        () => _set((s) => ({ ...s, typing: { ...s.typing, [from]: false } })),
        3500,
      );
    })
    .subscribe();

  channels = [db, inbox];
}

const outboxes: Record<string, RealtimeChannel> = {};
let lastTypingSent = 0;
export function sendTyping(friendId: string) {
  if (!myId || Date.now() - lastTypingSent < 2000) return;
  lastTypingSent = Date.now();
  const ch = (outboxes[friendId] ??= supabase.channel(`inbox:${friendId}`));
  void ch.send({ type: "broadcast", event: "typing", payload: { from: myId } });
}

// ---------- Session ----------
async function start(session: Session) {
  if (myId === session.user.id) return;
  stopChannels();
  myId = session.user.id;
  _set((s) => ({
    ...s,
    mode: "live",
    loading: true,
    error: null,
    me: null,
    people: [],
    requests: [],
    seatedByCount: 0,
    notice: null,
    chats: {},
    unread: {},
    snaps: [],
    streaks: {},
    posts: [],
    reels: [],
  }));
  await loadAll();
  subscribe();
}
function stopChannels() {
  channels.forEach((c) => void supabase.removeChannel(c));
  Object.values(outboxes).forEach((c) => void supabase.removeChannel(c));
  channels = [];
  for (const k of Object.keys(outboxes)) delete outboxes[k];
}
function stop() {
  stopChannels();
  myId = null;
  _restoreDemo();
}

let started = false;
/** Call once in the browser: picks up an existing session and listens for sign-in/out. */
export function initLive() {
  if (started || typeof window === "undefined") return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => data.session && void start(data.session));
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) void start(session);
    if (event === "SIGNED_OUT") stop();
  });
  // Refresh signed media links and catch anything missed while the tab was asleep.
  document.addEventListener(
    "visibilitychange",
    () => document.visibilityState === "visible" && myId && scheduleReload(100),
  );
}

// ---------- Account ----------
export const account = {
  async sendCode(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw new Error(friendly(error));
  },
  async verifyCode(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "email",
    });
    if (error)
      throw new Error(
        /expired|invalid/i.test(error.message)
          ? "That code didn't work. Check it, or send a new one."
          : friendly(error),
      );
  },
  async createProfile(input: {
    name: string;
    username: string;
    avatar?: string;
    password: string;
    confirmPassword: string;
  }) {
    if (!myId) throw new Error("Sign in first.");
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(username))
      throw new Error("Usernames are 3–20 letters, numbers, dots or underscores.");
    const displayName = input.name.trim();
    if (displayName.length < 1 || displayName.length > 40)
      throw new Error("Your name should be between 1 and 40 characters.");
    if (input.password.length < 8 || input.password.length > 128)
      throw new Error("Use a password between 8 and 128 characters.");
    if (input.password !== input.confirmPassword)
      throw new Error("Those passwords don’t match yet.");
    if (!input.avatar) throw new Error("Add a profile photo before saving your seat.");

    // Make sure the sign-in from the email code is still here before saving anything.
    let { data: sess } = await supabase.auth.getSession();
    if (!sess.session) ({ data: sess } = await supabase.auth.refreshSession());
    if (!sess.session || sess.session.user.id !== myId)
      throw new Error(
        "Your sign-in timed out on this device. Go back, enter your email again, and use the new code.",
      );

    // Profile first, so a password hiccup can't block the account.
    const avatar_path = await upload("avatars", input.avatar, "jpg");
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: myId, username, display_name: displayName, avatar_path }, { onConflict: "id" });
    if (error) throw new Error(friendly(error));

    const { error: passwordError } = await supabase.auth.updateUser({ password: input.password });
    await loadAll();
    subscribe();
    if (passwordError)
      fail(
        "You're in! Your password didn't save, so sign in with an email code next time, or use Forgot password.",
      );
  },
  async updateAvatar(image: string) {
    if (!myId) throw new Error("Sign in first.");
    const path = await upload("avatars", image, "jpg");
    const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", myId);
    if (error) throw new Error(friendly(error));
    await loadAll();
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  /** Block: they leave your 25, you leave theirs, and they can't find or seat you. */
  async block(personId: string) {
    const { error } = await supabase.from("blocks").insert({ blocker: myId, blocked: personId });
    if (error && !/duplicate/i.test(error.message)) throw new Error(friendly(error));
    await loadAll();
  },
  async unblock(personId: string) {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker", myId)
      .eq("blocked", personId);
    if (error) throw new Error(friendly(error));
  },
  async blockedPeople(): Promise<{ id: string; name: string; username: string }[]> {
    const rows = await run(
      supabase
        .from("blocks")
        .select("blocked")
        .eq("blocker", myId)
        .returns<{ blocked: string }[]>(),
    );
    if (!rows.length) return [];
    const profiles = await run(
      supabase
        .from("profiles")
        .select("id,display_name,username")
        .in(
          "id",
          rows.map((r) => r.blocked),
        )
        .returns<{ id: string; display_name: string; username: string }[]>(),
    );
    return profiles.map((p) => ({ id: p.id, name: p.display_name, username: p.username }));
  },
  async report(personId: string | null, reason: string, details: string) {
    const { error } = await supabase
      .from("reports")
      .insert({ reporter: myId, reported: personId, reason, details: details.slice(0, 1000) });
    if (error) throw new Error(friendly(error));
  },
  /** Deletes your files, then your account and everything in it. Can't be undone. */
  async deleteAccount() {
    const me = myId;
    if (!me) throw new Error("Sign in first.");
    for (const bucket of ["media", "snaps", "avatars"] as const) {
      for (let i = 0; i < 50; i++) {
        const { data } = await supabase.storage.from(bucket).list(me, { limit: 100 });
        if (!data?.length) break;
        await supabase.storage.from(bucket).remove(data.map((f) => `${me}/${f.name}`));
        if (data.length < 100) break;
      }
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw new Error(friendly(error));
    await supabase.auth.signOut();
  },
  async search(q: string): Promise<Person[]> {
    const term = q.trim().toLowerCase().replace(/^@/, "");
    if (term.length < 2 || !myId) return [];
    const rows = await run(
      supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .neq("id", myId)
        .limit(15)
        .returns<ProfileRow[]>(),
    );
    const urls = await signed(
      "avatars",
      rows.map((r) => r.avatar_path ?? ""),
    );
    return rows.map((p) => ({
      id: p.id,
      name: p.display_name,
      username: p.username,
      initials: initialsOf(p.display_name),
      color: colourFor(p.id),
      avatar: p.avatar_path ? (urls[p.avatar_path] ?? "") : "",
      postedToday: false,
      joinedDaysAgo: 0,
      daysQuiet: 0,
    }));
  },
  /** People you may know: seated by your 25 (most mutuals first), then newcomers. */
  async suggestions(includeNew = false): Promise<Suggestion[]> {
    if (!myId) return [];
    const { data, error } = await supabase.rpc("suggestions", {
      p_limit: 30,
      p_include_new: includeNew,
    });
    if (error) throw error;
    const rows = (data ?? []) as {
      id: string;
      display_name: string;
      username: string;
      avatar_path: string | null;
      mutuals: number;
      reason: "mutuals" | "new";
    }[];
    const urls = await signed(
      "avatars",
      rows.map((r) => r.avatar_path ?? ""),
    );
    return rows.map((p) => ({
      id: p.id,
      name: p.display_name,
      username: p.username,
      initials: initialsOf(p.display_name),
      color: colourFor(p.id),
      avatar: p.avatar_path ? (urls[p.avatar_path] ?? "") : "",
      postedToday: false,
      joinedDaysAgo: 0,
      daysQuiet: 0,
      mutuals: p.mutuals,
      reason: p.reason,
    }));
  },
  /** Put someone in your 25 (after passing the quiz about them). */
  async request(personId: string) {
    try {
      await run(supabase.from("seats").insert({ owner: myId, guest: personId }).select());
      await loadAll();
    } catch (e) {
      throw new Error(friendly(e));
    }
  },
  /** Seat back someone who put you in their 25. The id is their person id. */
  async accept(personId: string) {
    return account.request(personId);
  },
  /** Take someone out of your 25. They can still keep you in theirs. */
  async remove(personId: string) {
    const { error } = await supabase.from("seats").delete().eq("owner", myId).eq("guest", personId);
    if (error) throw new Error(friendly(error));
    await loadAll();
  },
};

// ---------- The actions screens call (same names as the demo) ----------
function patch(fn: (s: SocialState) => SocialState) {
  _set(fn);
}

registerLive({
  sendMessage(friendId: string, text: string) {
    const t = text.trim();
    if (!t || !myId) return;
    const id = newId();
    patch((s) => ({
      ...s,
      chats: {
        ...s.chats,
        [friendId]: [
          ...(s.chats[friendId] ?? []),
          { id, from: "me", text: t, at: Date.now(), status: "sent" },
        ],
      },
    }));
    void supabase
      .from("messages")
      .insert({ id, sender: myId, recipient: friendId, body: t })
      .then(({ error }) => {
        if (error) fail(friendly(error));
      });
  },

  markRead(friendId: string) {
    if (!myId || !_get().unread[friendId]) return;
    patch((s) => ({ ...s, unread: { ...s.unread, [friendId]: 0 } }));
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender", friendId)
      .eq("recipient", myId)
      .is("read_at", null)
      .then(() => {});
  },

  sendSnap(input: {
    to: string[];
    image?: string;
    bg?: string;
    caption?: string;
    seconds: number;
  }) {
    if (!myId || !input.to.length) return;
    const me = myId;
    const id = newId();
    // Show it as sent straight away; the server confirms streaks a moment later.
    patch((s) => {
      const chats = { ...s.chats };
      for (const r of input.to)
        chats[r] = [
          ...(chats[r] ?? []),
          { id: newId(), from: "me", snapId: id, at: Date.now(), status: "sent" },
        ];
      return {
        ...s,
        chats,
        snaps: [
          {
            id,
            from: "me",
            to: input.to,
            image: input.image,
            bg: input.bg,
            caption: input.caption,
            seconds: input.seconds,
            at: Date.now(),
            openedBy: [],
          },
          ...s.snaps,
        ],
      };
    });
    void (async () => {
      try {
        const image_path = input.image ? await upload("snaps", input.image, "jpg") : null;
        await run(
          supabase
            .from("snaps")
            .insert({
              id,
              sender: me,
              image_path,
              bg: input.bg ?? null,
              caption: input.caption ?? null,
              seconds: input.seconds,
            })
            .select(),
        );
        await run(
          supabase
            .from("snap_recipients")
            .insert(input.to.map((r) => ({ snap_id: id, recipient: r })))
            .select(),
        );
        await run(
          supabase
            .from("messages")
            .insert(input.to.map((r) => ({ sender: me, recipient: r, snap_id: id })))
            .select(),
        );
        scheduleReload(300);
      } catch (e) {
        fail(`Snap didn't send. ${friendly(e)}`);
        scheduleReload(0);
      }
    })();
  },

  openSnap(snapId: string) {
    patch((s) => ({
      ...s,
      snaps: s.snaps.map((x) => (x.id === snapId ? { ...x, openedBy: [...x.openedBy, "me"] } : x)),
    }));
    void supabase.rpc("open_snap", { p_snap: snapId }).then(async ({ data, error }) => {
      if (error) return fail(friendly(error));
      // Last one to open it: delete the photo for good.
      if (typeof data === "string" && data) await deleteSnapFile(snapId, data);
    });
  },

  deletePost(postId: string) {
    const post = _get().posts.find((p) => p.id === postId);
    if (!post || post.by !== "me") return;
    patch((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== postId) }));
    void (async () => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) {
        fail(`Couldn't delete that post. ${friendly(error)}`);
        patch((s) => ({ ...s, posts: [post, ...s.posts].sort((a, b) => b.at - a.at) }));
        return;
      }
      // Likes and comments go with the post; also remove the photo or video file.
      if (post.mediaPath) await supabase.storage.from("media").remove([post.mediaPath]);
    })();
  },

  addPost(image: string, caption: string, video?: Blob) {
    if (!myId) return;
    const me = myId;
    const id = newId();
    const preview = video ? URL.createObjectURL(video) : undefined;
    patch((s) => ({
      ...s,
      posts: [
        {
          id,
          by: "me",
          image: video ? "" : image,
          video: preview,
          caption: caption.trim(),
          at: Date.now(),
          likes: [],
          comments: [],
        },
        ...s.posts,
      ],
    }));
    void (async () => {
      try {
        const media_path = video
          ? await upload("media", video, video.type.includes("quicktime") ? "mov" : "mp4")
          : await upload("media", image, "jpg");
        await run(
          supabase
            .from("posts")
            .insert({
              id,
              author: me,
              kind: "post",
              media_path,
              media_type: video ? "video" : "image",
              caption: caption.trim(),
            })
            .select(),
        );
      } catch (e) {
        fail(`Post didn't upload. ${friendly(e)}`);
        patch((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) }));
      }
    })();
  },

  addReel(input: { video?: string; image?: string; caption: string }) {
    if (!myId) return;
    const me = myId;
    const id = newId();
    patch((s) => ({
      ...s,
      reels: [
        {
          id,
          by: "me",
          sound: "original audio · You",
          at: Date.now(),
          likes: [],
          comments: [],
          ...input,
        },
        ...s.reels,
      ],
    }));
    void (async () => {
      try {
        const isVideo = !!input.video;
        const media_path = await upload(
          "media",
          (input.video ?? input.image)!,
          isVideo ? "mp4" : "jpg",
        );
        await run(
          supabase
            .from("posts")
            .insert({
              id,
              author: me,
              kind: "reel",
              media_path,
              media_type: isVideo ? "video" : "image",
              caption: input.caption,
            })
            .select(),
        );
      } catch (e) {
        fail(`Reel didn't upload. ${friendly(e)}`);
        patch((s) => ({ ...s, reels: s.reels.filter((r) => r.id !== id) }));
      }
    })();
  },

  toggleLike(kind: "post" | "reel", id: string) {
    if (!myId) return;
    const list = kind === "post" ? _get().posts : _get().reels;
    const liked = list.find((p) => p.id === id)?.likes.includes("me");
    const flip = (likes: string[]) => (liked ? likes.filter((x) => x !== "me") : [...likes, "me"]);
    patch((s) =>
      kind === "post"
        ? { ...s, posts: s.posts.map((p) => (p.id === id ? { ...p, likes: flip(p.likes) } : p)) }
        : { ...s, reels: s.reels.map((r) => (r.id === id ? { ...r, likes: flip(r.likes) } : r)) },
    );
    const q = liked
      ? supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", myId)
      : supabase.from("post_likes").insert({ post_id: id, user_id: myId });
    void q.then(({ error }) => error && fail(friendly(error)));
  },

  like(kind: "post" | "reel", id: string) {
    const list = kind === "post" ? _get().posts : _get().reels;
    if (list.find((p) => p.id === id)?.likes.includes("me")) return;
    (live.toggleLike as (k: "post" | "reel", i: string) => void)(kind, id);
  },

  comment(kind: "post" | "reel", id: string, text: string) {
    const t = text.trim();
    if (!t || !myId) return;
    const c: Comment = { id: newId(), by: "me", text: t, at: Date.now() };
    patch((s) =>
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
    void supabase
      .from("post_comments")
      .insert({ id: c.id, post_id: id, author: myId, body: t })
      .then(({ error }) => error && fail(friendly(error)));
  },

  share(postId: string, to: string[], kind: "post" | "reel") {
    if (!myId) return;
    const me = myId;
    const ref = `${kind}:${postId}`;
    const rows = to.map((r) => ({ id: newId(), sender: me, recipient: r, shared_ref: ref }));
    patch((s) => {
      const chats = { ...s.chats };
      for (const r of rows)
        chats[r.recipient] = [
          ...(chats[r.recipient] ?? []),
          { id: r.id, from: "me", sharedPostId: ref, at: Date.now(), status: "sent" },
        ];
      return { ...s, chats };
    });
    void supabase
      .from("messages")
      .insert(rows)
      .then(({ error }) => error && fail(friendly(error)));
  },

  recordScore(game: GameId, score: number) {
    const prev = _get().scores[game]?.me ?? -1;
    if (score > prev)
      patch((s) => ({ ...s, scores: { ...s.scores, [game]: { ...s.scores[game], me: score } } }));
    void supabase
      .rpc("record_score", { p_game: game, p_score: score })
      .then(({ error }) => error && fail(friendly(error)));
    return score > prev;
  },

  challenge(friendId: string, gameName: string, score: number) {
    (live.sendMessage as (f: string, t: string) => void)(
      friendId,
      `I just scored ${score} in ${gameName}. Your move 😏`,
    );
  },
});

/** For other features (the Drop): upload a photo to your media folder, and sign media links. */
export const uploadMedia = (source: string | Blob, ext = "jpg") => upload("media", source, ext);
export const signedMedia = (paths: string[]) => signed("media", paths);
/** Upload into your media folder, optionally under a subfolder (e.g. "g/<group id>"). */
export async function uploadMediaAt(sub: string, blob: Blob, ext: string) {
  const path = `${myId}/${sub ? `${sub}/` : ""}${newId()}.${ext}`;
  const { error } = await supabase.storage
    .from("media")
    .upload(path, blob, { contentType: blob.type || undefined });
  if (error) throw error;
  return path;
}
