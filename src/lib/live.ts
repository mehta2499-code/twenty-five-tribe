/**
 * Live layer: the same actions the screens already call, backed by Supabase.
 * Signed out, the app keeps running on demo data (see social.ts).
 */
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { track } from "@/lib/track";
import { isNetworkError } from "@/lib/vibes";
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
  type Poll,
  tapPoll,
  type FriendRequest,
  type GameId,
  type Me,
  type MsgStatus,
  type NowPlaying,
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
  np_track_id?: string | null;
  np_title?: string | null;
  np_artist?: string | null;
  np_image?: string | null;
  np_at?: string | null;
};

/** "Listening now" from a profile row, if it was shared in the last 24 hours. */
function npOf(p: ProfileRow): NowPlaying | undefined {
  if (!p.np_track_id || !p.np_at) return undefined;
  const at = Date.parse(p.np_at);
  if (!(Date.now() - at < 24 * 3600_000)) return undefined;
  return {
    id: p.np_track_id,
    title: p.np_title ?? "A song",
    artist: p.np_artist ?? "",
    image: p.np_image ?? null,
    at,
  };
}
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
  reply_to?: string | null;
  deleted?: boolean | null;
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
  media_path: string | null;
  media_type: "image" | "video" | "text";
  caption: string;
  created_at: string;
  edited_at?: string | null;
  poll_options?: string[] | null;
  poll_multi?: boolean;
};
type VoteRow = { post_id: string; user_id: string; option: number };
type LikeRow = { post_id: string; user_id: string };
type CommentRow = {
  id: string;
  post_id: string;
  author: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
};
type ScoreRow = { user_id: string; game: GameId; week: string; best: number };

const COLOURS = ["#C1EF62", "#F15B91", "#77B9E8", "#F4C96B"];
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
/** Supabase's password rules, in plain words (so people know what to fix). */
export function passwordProblem(msg: string) {
  const needs: string[] = [];
  const m = /at least one character of each:([^.]*)/i.exec(msg);
  if (m) {
    const sets = m[1];
    if (/abcdefghijklmnopqrstuvwxyz/.test(sets)) needs.push("a lowercase letter");
    if (/ABCDEFGHIJKLMNOPQRSTUVWXYZ/.test(sets)) needs.push("an uppercase letter");
    if (/0123456789/.test(sets)) needs.push("a number");
    if (/[!@#$%^&*]/.test(sets)) needs.push("a symbol (like ! @ # $)");
  }
  const len = /at least (\d+) characters/i.exec(msg)?.[1];
  if (len) needs.unshift(`at least ${len} characters`);
  if (needs.length)
    return `Your password needs ${needs.join(", ").replace(/, ([^,]*)$/, " and $1")}.`;
  if (/weak|easy to guess|pwned|leaked|known/i.test(msg))
    return "That password is too common and easy to guess. Try a different one.";
  if (/same.*(old|previous)|different from the old/i.test(msg))
    return "Your new password has to be different from your old one.";
  return msg;
}

function friendly(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (isNetworkError(e))
    return "Connection dropped for a second. Check your internet and try again.";
  if (/seats taken/i.test(msg)) return msg;
  if (/duplicate key.*username|profiles_username_key|username.*unique/i.test(msg))
    return "That username is taken. Try another.";
  if (/password/i.test(msg) && !/invalid login/i.test(msg)) return passwordProblem(msg);
  if (/error sending .*email|smtp/i.test(msg))
    return "We couldn't send your code right now. Try again in a minute.";
  if (/rate limit|too many|only request this after/i.test(msg))
    return "Too many codes sent. Wait a minute and try again.";
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
    .upload(path, blob, { contentType: blob.type || undefined, cacheControl: "31536000" });
  if (error) throw error;
  return path;
}
// Signed links last 6h. Reuse them for 5h: a new link for the same photo
// makes the phone download it again (and the image flickers), so caching
// them is the single biggest smoothness win.
const SIGN_TTL = 60 * 60 * 6;
const REUSE_MS = 5 * 60 * 60 * 1000;
const signedCache = new Map<string, { url: string; at: number }>();

/** Avatars also get a small copy next to the original, e.g. "me/x.jpg" → "me/x.thumb.jpg". */
const thumbOf = (path: string) => path.replace(/\.(\w+)$/, ".thumb.$1");
const THUMB_PX = 256;
/** Thumbnails we know aren't there yet (don't ask again for a while). */
const noThumb = new Map<string, number>();

async function makeThumb(source: string | Blob): Promise<Blob> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error("Couldn't read the photo."));
      img.src = url;
    });
    const scale = Math.min(1, THUMB_PX / Math.min(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, bad) =>
      c.toBlob(
        (b) => (b ? ok(b) : bad(new Error("Couldn't shrink the photo."))),
        "image/jpeg",
        0.82,
      ),
    );
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

/** Save the small copy of an avatar (quietly; the full photo still works without it). */
async function uploadThumb(path: string, source: string | Blob) {
  try {
    const blob = await makeThumb(source);
    await supabase.storage
      .from("avatars")
      .upload(thumbOf(path), blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    noThumb.delete(path);
  } catch {
    // ignore
  }
}

async function signed(bucket: "media" | "snaps" | "avatars", paths: string[]) {
  if (bucket !== "avatars") return signedRaw(bucket, paths);
  // Avatars are shown small: use the thumbnail, fall back to the full photo.
  const unique = [...new Set(paths.filter(Boolean))];
  const now = Date.now();
  const tryThumb = unique.filter((p) => !(now - (noThumb.get(p) ?? 0) < 10 * 60_000));
  const thumbs = await signedRaw("avatars", tryThumb.map(thumbOf));
  const out: Record<string, string> = {};
  const needFull: string[] = [];
  for (const p of unique) {
    const t = thumbs[thumbOf(p)];
    if (t) out[p] = t;
    else {
      if (tryThumb.includes(p)) noThumb.set(p, now);
      needFull.push(p);
    }
  }
  if (needFull.length) Object.assign(out, await signedRaw("avatars", needFull));
  return out;
}

async function signedRaw(bucket: "media" | "snaps" | "avatars", paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  const out: Record<string, string> = {};
  const now = Date.now();
  const missing: string[] = [];
  for (const p of unique) {
    const hit = signedCache.get(`${bucket}/${p}`);
    if (hit && now - hit.at < REUSE_MS) out[p] = hit.url;
    else missing.push(p);
  }
  if (!missing.length) return out;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(missing, SIGN_TTL);
  data?.forEach((d) => {
    if (!d.signedUrl || !d.path) return;
    out[d.path] = d.signedUrl;
    signedCache.set(`${bucket}/${d.path}`, { url: d.signedUrl, at: now });
  });
  return out;
}

/** Delete a snap's photo from storage, then forget its path. */
async function deleteSnapFile(snapId: string, path: string) {
  const { error } = await supabase.storage.from("snaps").remove([path]);
  if (!error) await supabase.rpc("forget_snap_file", { p_snap: snapId });
}

export type Suggestion = Person & {
  mutuals: number;
  reason: "seated_you" | "mutuals" | "quiz" | "friends" | "new";
  /** Up to 2 people in your 25 who seated them (first names + photo URLs). */
  via: { name: string; avatar: string }[];
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
    // Older accounts have no small copy yet: make mine from the full photo.
    const myAvatar = profile.avatar_path;
    if (myAvatar && noThumb.has(myAvatar) && avatarUrls[myAvatar])
      void uploadThumb(myAvatar, avatarUrls[myAvatar]);
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
      np: npOf(p),
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

    const [messages, postRows, scoreRows] = await Promise.all([
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

    // Blinks and streaks are gone (dropped features).
    const snaps: Snap[] = [];
    const streaks: Record<string, Streak> = {};
    const today = dayKey();

    // Posts and reels
    const postIds = postRows.map((p) => p.id);
    const [likes, comments, votes] = postIds.length
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
          run(
            supabase
              .from("post_poll_votes" as never)
              .select("post_id,user_id,option")
              .in("post_id", postIds)
              .returns<VoteRow[]>(),
          ).catch(() => [] as VoteRow[]),
        ])
      : [[], [], []];
    // Poll totals come from the server (everyone's votes); the votes we can
    // see one by one are ours, our mutual 25's, or everyone's on our own polls.
    const pollIds = postRows.filter((p) => p.poll_options?.length).map((p) => p.id);
    const totals = pollIds.length
      ? (((await supabase.rpc("poll_counts" as never, { p_ids: pollIds } as never)).data ?? []) as {
          post_id: string;
          option: number;
          n: number;
          voters: number;
        }[])
      : [];
    const pollFor = (p: PostRow): Poll | undefined => {
      if (!p.poll_options?.length) return undefined;
      const vs = (votes as VoteRow[]).filter((v) => v.post_id === p.id);
      const t = totals.filter((x) => x.post_id === p.id);
      const seen = (i: number) => vs.filter((v) => v.option === i).length;
      return {
        options: p.poll_options,
        multi: !!p.poll_multi,
        counts: p.poll_options.map((_, i) =>
          Math.max(seen(i), t.find((x) => x.option === i)?.n ?? 0),
        ),
        mine: vs.filter((v) => v.user_id === me).map((v) => v.option),
        voters: Math.max(new Set(vs.map((v) => v.user_id)).size, t[0]?.voters ?? 0),
        by: p.poll_options.map((_, i) =>
          vs.filter((v) => v.option === i).map((v) => (v.user_id === me ? "me" : v.user_id)),
        ),
      };
    };
    const mediaUrls = await signed(
      "media",
      postRows.map((p) => p.media_path ?? ""),
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
        .map((c) => ({
          id: c.id,
          by: who(c.author),
          text: c.body,
          at: ts(c.created_at),
          edited: !!c.edited_at,
        }));
    const posts: Post[] = [];
    const reels: Reel[] = [];
    // The database only returns posts you're allowed to see (yours, and from
    // anyone who put you in their 25), so show them all.
    for (const p of postRows) {
      const url = p.media_path ? (mediaUrls[p.media_path] ?? "") : "";
      const base = {
        id: p.id,
        by: who(p.author),
        caption: p.caption,
        at: ts(p.created_at),
        edited: !!p.edited_at,
        likes: likesFor(p.id),
        comments: commentsFor(p.id),
      };
      // Reels are gone: videos are just posts now.
      posts.push(
        p.media_type === "text"
          ? { ...base, image: "", text: true, poll: pollFor(p) }
          : p.media_type === "video"
            ? { ...base, image: "", video: url, mediaPath: p.media_path ?? undefined }
            : { ...base, image: url, mediaPath: p.media_path ?? undefined },
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
      np: npOf(profile),
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
    replyTo: m.reply_to ?? undefined,
    deleted: !!m.deleted || undefined,
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
/** Poll vote changes waiting to go out, per poll. */
const pollQueue: Record<string, Promise<void>> = {};

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
              ? "Voice note"
              : ref.startsWith("gif:")
                ? "Sent a GIF"
                : ref.startsWith("sticker:")
                  ? "Sent a sticker"
                  : ref.startsWith("img:")
                    ? "Photo"
                    : ref.startsWith("vid:")
                      ? "Video"
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
        if (m.sender !== me && m.recipient !== me) return;
        // Read ticks on yours; "deleted" on either side.
        const other = m.sender === me ? m.recipient : m.sender;
        _set((s) => ({
          ...s,
          chats: {
            ...s.chats,
            [other]: (s.chats[other] ?? []).map((x) => (x.id === m.id ? toChat(m) : x)),
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
                  ? `${name} seated you back. Chats unlocked.`
                  : `${name} put you in their 25.`,
              }));
            });
        }
        scheduleReload();
      },
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quiz_attempts" }, () =>
      scheduleReload(800),
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
    .on("postgres_changes", { event: "*", schema: "public", table: "post_poll_votes" }, () =>
      scheduleReload(800),
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
let hiddenAt = Date.now();
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
  document.addEventListener("visibilitychange", () => {
    // Back after a while: catch up. Quick app switches don't need a full reload.
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (myId && Date.now() - hiddenAt > 30_000) scheduleReload(100);
  });
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
  /**
   * Sign up with email + password. Supabase emails a 6-digit code to confirm the
   * email (needsCode); if email confirmation is switched off, you're in right away.
   */
  async signUp(email: string, password: string): Promise<{ needsCode: boolean }> {
    if (password.length < 8 || password.length > 128)
      throw new Error("Use a password between 8 and 128 characters.");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw new Error(friendly(error));
    if (data.user && (data.user.identities ?? []).length === 0)
      throw new Error("That email already has a seat. Sign in instead.");
    return { needsCode: !data.session };
  },
  /** Send the sign-up code again. */
  async resendSignupCode(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw new Error(friendly(error));
  },
  async verifyCode(email: string, token: string) {
    const args = { email: email.trim(), token: token.trim() };
    // Sign-up codes are "signup"; codes from the sign-in email are "email".
    let { error } = await supabase.auth.verifyOtp({ ...args, type: "signup" });
    if (error) ({ error } = await supabase.auth.verifyOtp({ ...args, type: "email" }));
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
    /** Leave out when the password was already set at sign-up. */
    password?: string;
    confirmPassword?: string;
  }) {
    if (!myId) throw new Error("Sign in first.");
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(username))
      throw new Error("Usernames are 3–20 letters, numbers, dots or underscores.");
    const displayName = input.name.trim();
    if (displayName.length < 1 || displayName.length > 40)
      throw new Error("Your name should be between 1 and 40 characters.");
    if (input.password !== undefined) {
      if (input.password.length < 8 || input.password.length > 128)
        throw new Error("Use a password between 8 and 128 characters.");
      if (input.password !== input.confirmPassword)
        throw new Error("Those passwords don’t match yet.");
    }
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
    await uploadThumb(avatar_path, input.avatar);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: myId, username, display_name: displayName, avatar_path }, { onConflict: "id" });
    if (error) throw new Error(friendly(error));
    track("signup_completed");

    const passwordError =
      input.password === undefined
        ? null
        : (await supabase.auth.updateUser({ password: input.password })).error;
    await loadAll();
    subscribe();
    if (passwordError)
      fail("You're in! Your password didn't save, so use Forgot password next time you sign in.");
  },
  async updateAvatar(image: string) {
    if (!myId) throw new Error("Sign in first.");
    const path = await upload("avatars", image, "jpg");
    await uploadThumb(path, image);
    const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", myId);
    if (error) throw new Error(friendly(error));
    await loadAll();
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  /** Take yourself out of someone's 25. They're told and can't re-add you unless you add them. */
  async leaveTheir25(personId: string) {
    const { error } = await supabase.rpc("leave_their_25" as never, { p_owner: personId } as never);
    if (error) throw new Error(friendly(error));
    await loadAll();
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
      reason: Suggestion["reason"];
      via_names: string[] | null;
      via_avatars: string[] | null;
    }[];
    const urls = await signed("avatars", [
      ...rows.map((r) => r.avatar_path ?? ""),
      ...rows.flatMap((r) => r.via_avatars ?? []),
    ]);
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
      via: (p.via_names ?? []).map((name, i) => ({
        name,
        avatar: urls[(p.via_avatars ?? [])[i] ?? ""] ?? "",
      })),
    }));
  },
  /** Put someone in your 25 (after passing the quiz about them). */
  async request(personId: string) {
    try {
      // Did they already seat me? Then this makes it mutual.
      const theySeatedMe = _get().requests.some((r) => r.person.id === personId);
      // Retry if the connection drops; "already seated" after a retry means the first one worked.
      for (let i = 0; ; i++) {
        const { error } = await supabase.from("seats").insert({ owner: myId, guest: personId });
        if (!error) break;
        const msg = (error as { message?: string }).message ?? "";
        if (/duplicate key|already exists/i.test(msg)) break;
        if (i < 2 && isNetworkError(error)) {
          await new Promise((r) => setTimeout(r, 700 * (i + 1)));
          continue;
        }
        throw error;
      }
      track("seat_added");
      if (theySeatedMe) track("mutual_seat");
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
  /** Send a message; `ref` attaches a card (e.g. "wordup:2026-11-07"). */
  sendMessage(friendId: string, text: string, ref?: string, replyTo?: string) {
    const t = text.trim();
    if (!t || !myId) return;
    const id = newId();
    patch((s) => ({
      ...s,
      chats: {
        ...s.chats,
        [friendId]: [
          ...(s.chats[friendId] ?? []),
          { id, from: "me", text: t, sharedPostId: ref, replyTo, at: Date.now(), status: "sent" },
        ],
      },
    }));
    void supabase
      .from("messages")
      .insert({
        id,
        sender: myId,
        recipient: friendId,
        body: t,
        shared_ref: ref ?? null,
        ...(replyTo ? { reply_to: replyTo } : {}),
      })
      .then(({ error }) => {
        if (error) fail(friendly(error));
      });
  },

  deleteMessage(friendId: string, msgId: string) {
    patch((s) => ({
      ...s,
      chats: {
        ...s.chats,
        [friendId]: (s.chats[friendId] ?? []).map((m) =>
          m.id === msgId
            ? { ...m, text: undefined, sharedPostId: undefined, replyTo: undefined, deleted: true }
            : m,
        ),
      },
    }));
    void supabase.rpc("delete_message" as never, { p_id: msgId } as never).then(({ error }) => {
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
    track("blink_sent", { recipients: input.to.length, photo: !!input.image });
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
        fail(`Blink didn't send. ${friendly(e)}`);
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

  editPost(postId: string, caption: string) {
    const post = _get().posts.find((p) => p.id === postId);
    const t = caption.trim();
    if (!post || post.by !== "me") return;
    if (post.text && !t) return fail("A text scene needs some words.");
    patch((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id === postId ? { ...p, caption: t, edited: true } : p)),
    }));
    void supabase
      .from("posts")
      .update({ caption: t })
      .eq("id", postId)
      .then(({ error }) => {
        if (!error) return;
        fail(`Couldn't save that edit. ${friendly(error)}`);
        patch((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? post : p)) }));
      });
  },

  editComment(postId: string, commentId: string, text: string) {
    const t = text.trim();
    if (!t) return;
    const before = _get().posts.find((p) => p.id === postId);
    const setComments = (fn: (c: Comment[]) => Comment[]) =>
      patch((s) => ({
        ...s,
        posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: fn(p.comments) } : p)),
      }));
    setComments((cs) => cs.map((c) => (c.id === commentId ? { ...c, text: t, edited: true } : c)));
    void supabase
      .from("post_comments")
      .update({ body: t })
      .eq("id", commentId)
      .then(({ error }) => {
        if (!error || !before) return;
        fail(`Couldn't save that edit. ${friendly(error)}`);
        setComments(() => before.comments);
      });
  },

  deleteComment(postId: string, commentId: string) {
    const before = _get().posts.find((p) => p.id === postId);
    if (!before) return;
    patch((s) => ({
      ...s,
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p,
      ),
    }));
    void supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId)
      .then(({ error }) => {
        if (!error) return;
        fail(`Couldn't delete that. ${friendly(error)}`);
        patch((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? before : p)) }));
      });
  },

  votePoll(postId: string, option: number) {
    const before = _get().posts.find((p) => p.id === postId);
    if (!myId || !before?.poll) return;
    const { next, added, removed } = tapPoll(before.poll, option);
    patch((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id === postId ? { ...p, poll: next } : p)),
    }));
    const me = myId;
    // One change at a time per poll, in the order they were tapped.
    pollQueue[postId] = (pollQueue[postId] ?? Promise.resolve()).then(async () => {
      const del = removed.length
        ? await supabase
            .from("post_poll_votes" as never)
            .delete()
            .eq("post_id" as never, postId as never)
            .eq("user_id" as never, me as never)
            .in("option" as never, removed as never)
        : { error: null };
      const ins =
        !del.error && added.length
          ? await supabase
              .from("post_poll_votes" as never)
              .insert(added.map((o) => ({ post_id: postId, user_id: me, option: o })) as never)
          : { error: null };
      const error = del.error ?? ins.error;
      if (!error) return;
      fail(`Your vote didn't go through. ${friendly(error)}`);
      scheduleReload(100);
    });
  },

  addPost(
    image: string,
    caption: string,
    video?: Blob,
    poll?: { options: string[]; multi: boolean },
  ) {
    if (!myId) return;
    const textOnly = !image && !video;
    track("post_created", { video: !!video, text: textOnly });
    const me = myId;
    const id = newId();
    const preview = video ? URL.createObjectURL(video) : undefined;
    patch((s) => ({
      ...s,
      posts: [
        {
          id,
          by: "me",
          text: textOnly,
          poll:
            textOnly && poll
              ? { ...poll, counts: poll.options.map(() => 0), mine: [], voters: 0 }
              : undefined,
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
        const media_path = textOnly
          ? null
          : video
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
              media_type: textOnly ? "text" : video ? "video" : "image",
              caption: caption.trim(),
              ...(textOnly && poll
                ? { poll_options: poll.options.map((o) => o.trim()), poll_multi: poll.multi }
                : {}),
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
    .upload(path, blob, { contentType: blob.type || undefined, cacheControl: "31536000" });
  if (error) throw error;
  return path;
}
