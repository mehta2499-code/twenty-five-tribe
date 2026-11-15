/** Shared pieces of Scenes: @tags in text, the tag picker, and the edit sheet. */
import { Fragment, useState } from "react";
import { Check, Megaphone } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/PersonLink";
import { Sheet, buzz } from "@/components/SocialUI";
import { mentionQuery } from "@/lib/groups";
import { social, useSocial, type Person, type Poll } from "@/lib/social";

export const MAX_CHARS = 280;

// ---------- Text with @tags ----------
export function useHandles() {
  const s = useSocial();
  const map = new Map<string, Person>();
  for (const p of s.people) if (p.username) map.set(p.username.toLowerCase(), p);
  return { map, myHandle: s.me?.username?.toLowerCase() };
}

/** Post text with @tags in lime (tap a tag to open their profile). */
export function Tagged({ text }: { text: string }) {
  const { map, myHandle } = useHandles();
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/@([\w.]+)/g)) {
    const handle = m[1].replace(/\.+$/, "").toLowerCase();
    const all = handle === "all" || handle === "everyone";
    const who = map.get(handle);
    if (!all && !who && handle !== myHandle) continue;
    const start = m.index!;
    const end = start + 1 + m[1].replace(/\.+$/, "").length;
    if (start > last) parts.push(text.slice(last, start));
    const tag = text.slice(start, end);
    parts.push(
      who ? (
        <PersonLink key={start} id={who.id} username={who.username} label={who.name}>
          <span className="font-semibold" style={{ color: "var(--lime)" }}>
            {tag}
          </span>
        </PersonLink>
      ) : (
        <span key={start} className="font-semibold" style={{ color: "var(--lime)" }}>
          {tag}
        </span>
      ),
    );
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}

// ---------- @tag suggestions (people at your Table, or @all) ----------
export function TagPicker({ text, onPick }: { text: string; onPick: (handle: string) => void }) {
  const s = useSocial();
  const q = mentionQuery(text);
  if (q === null) return null;
  const picks = s.people
    .filter((p) => p.username)
    .filter(
      (p) =>
        p.username!.toLowerCase().startsWith(q) ||
        p.name
          .toLowerCase()
          .split(" ")
          .some((w) => w.startsWith(q)),
    )
    .slice(0, 5);
  const showAll = "all".startsWith(q) || "everyone".startsWith(q);
  if (!picks.length && !showAll) return null;
  return (
    <ul
      className="rounded-2xl overflow-hidden py-1 mb-2"
      style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
      role="listbox"
      aria-label="Tag someone"
    >
      {showAll && (
        <li>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick("all")}
            className="menu-row w-full flex items-center gap-3 px-3 py-2 text-left"
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "var(--pink)", color: "var(--on-accent)" }}
            >
              <Megaphone size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-cream">@all</span>
              <span className="block meta truncate">Tag everyone who can see it</span>
            </span>
          </button>
        </li>
      )}
      {picks.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(p.username!)}
            className="menu-row w-full flex items-center gap-3 px-3 py-2 text-left"
          >
            <Avatar src={p.avatar} initials={p.initials} color={p.color} size={32} />
            <span className="min-w-0">
              <span className="block font-bold text-cream truncate">{p.name}</span>
              <span className="block meta truncate">@{p.username}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
export const withTag = (t: string, handle: string) => t.replace(/@([\w.]*)$/, `@${handle} `);

/** Edit the words of a scene or a reply. */
export function EditSheet({
  title,
  initial,
  allowEmpty,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  allowEmpty: boolean;
  onSave: (t: string) => void;
  onClose: () => void;
}) {
  const [t, setT] = useState(initial);
  const ok =
    (allowEmpty || t.trim().length > 0) && t.length <= MAX_CHARS && t.trim() !== initial.trim();
  return (
    <Sheet title={title} onClose={onClose}>
      <label htmlFor="edit-text" className="sr-only">
        {title}
      </label>
      <textarea
        id="edit-text"
        autoFocus
        value={t}
        onChange={(e) => setT(e.target.value.slice(0, MAX_CHARS + 20))}
        rows={4}
        className="input resize-none mt-1"
        style={{ fontSize: 16, lineHeight: 1.4 }}
      />
      <TagPicker text={t} onPick={(h) => setT((x) => withTag(x, h))} />
      <div className="flex items-center gap-2 mt-3">
        <span className="meta tabular-nums" style={{ fontSize: 12.5 }}>
          {MAX_CHARS - t.length}
        </span>
        <button onClick={onClose} className="btn-quiet ml-auto px-4">
          Cancel
        </button>
        <button
          disabled={!ok}
          onClick={() => {
            onSave(t);
            onClose();
          }}
          className="rounded-full px-5 font-bold disabled:opacity-40"
          style={{ minHeight: 38, background: "var(--lime)", color: "var(--on-accent)" }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Polls ----------
/**
 * A scene's poll. Before you vote: the options (tap one; on multiple choice,
 * tick several and press Vote). After: bars with percentages and your picks.
 */
export function PollView({
  postId,
  poll,
  onVote,
  onShowVotes,
}: {
  postId: string;
  poll: Poll;
  /** Where a tap goes (default: a Scenes poll). */
  onVote?: (option: number) => void;
  /** Group polls: open the list of who voted for what. */
  onShowVotes?: () => void;
}) {
  // A tap counts straight away. Tap your pick again to take it back; in
  // multiple choice, tap more options to add them.
  const voted = poll.mine.length > 0;
  const total = poll.counts.reduce((a, b) => a + b, 0);
  const tap = (i: number) => {
    buzz(12);
    if (onVote) onVote(i);
    else social.votePoll(postId, i);
  };
  return (
    <div className="mt-2.5 grid gap-2" role="group" aria-label="Poll">
      {poll.options.map((o, i) => {
        const n = poll.counts[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const mine = poll.mine.includes(i);
        if (voted)
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              aria-pressed={mine}
              className="relative overflow-hidden rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-left"
              style={{
                background: "var(--fill)",
                border: `1px solid ${mine ? "rgba(193,239,98,0.55)" : "var(--line)"}`,
              }}
              aria-label={`${o}: ${pct}%${mine ? ", your vote" : ""}`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: mine ? "rgba(193,239,98,0.28)" : "rgba(255,255,255,0.08)",
                }}
              />
              <span
                className="relative flex-1 min-w-0 truncate font-semibold text-cream"
                style={{ fontSize: 14.5 }}
              >
                {o}
              </span>
              {mine && (
                <Check
                  size={15}
                  className="relative shrink-0"
                  style={{ color: "var(--lime)" }}
                  aria-hidden="true"
                />
              )}
              <span className="relative tabular-nums font-bold shrink-0" style={{ fontSize: 13.5 }}>
                {pct}%
              </span>
            </button>
          );
        return (
          <button
            key={i}
            type="button"
            onClick={() => tap(i)}
            className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-left font-semibold"
            style={{
              fontSize: 14.5,
              color: "var(--lime)",
              border: "1.5px solid rgba(193,239,98,0.45)",
            }}
          >
            <span
              aria-hidden="true"
              className={`shrink-0 w-[18px] h-[18px] ${poll.multi ? "rounded-md" : "rounded-full"}`}
              style={{ border: "1.5px solid currentColor" }}
            />
            <span className="flex-1 min-w-0 truncate">{o}</span>
          </button>
        );
      })}
      <div className="flex items-center gap-2 meta" style={{ fontSize: 12.5 }}>
        <span>
          {poll.voters} vote{poll.voters === 1 ? "" : "s"}
          {poll.multi ? " · Pick one or more" : ""}
        </span>
        {onShowVotes && poll.voters > 0 && (
          <button
            type="button"
            onClick={onShowVotes}
            className="ml-auto font-bold"
            style={{ color: "var(--lime)", fontSize: 12.5 }}
          >
            View votes
          </button>
        )}
      </div>
    </div>
  );
}
