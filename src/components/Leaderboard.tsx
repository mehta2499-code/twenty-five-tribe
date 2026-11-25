/**
 * The one leaderboard look used across the app: a podium for the top 3
 * (2nd · 1st · 3rd, each in a tall coloured card with a laurel), then the rest
 * in a list with laurel badges. Also the end-of-game screen for multiplayer
 * games (2 players: just the winner).
 */
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/PersonLink";
import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";
import { Flame, Shuffle } from "lucide-react";
import { Confetti, Sheet } from "@/components/SocialUI";
import { friendById, meView, social } from "@/lib/social";
import { makeRoastCard } from "@/lib/roastCard";

export type LeaderRow = {
  id: string;
  rank: number;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
  /** The score shown with the gem (e.g. 84 or "3/6"). */
  value?: number | string;
  /** Link to their profile (not for bots / guests). */
  link?: boolean;
  me?: boolean;
  /** false: never actually played (e.g. never opened it and the timer moved
   * for them). They can't be roasted. */
  played?: boolean;
};

const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
};

const TONES = {
  1: { leaf: "#F7C948", dark: "#B7791F", text: "#FFFFFF" },
  2: { leaf: "#C9D1DE", dark: "#7C879A", text: "#FFFFFF" },
  3: { leaf: "#F2B45A", dark: "#A8612A", text: "#FFFFFF" },
  rest: { leaf: "#E6B33E", dark: "#9C6F14", text: "#FFFFFF" },
} as const;

/** A laurel wreath with the place in the middle: 1st gold, 2nd silver, 3rd bronze. */
export function Laurel({ rank, size = 44 }: { rank: number; size?: number }) {
  const t = rank <= 3 ? TONES[rank as 1 | 2 | 3] : TONES.rest;
  const solid = rank <= 3;
  // Leaves along two arcs that meet at the bottom.
  const leaves = Array.from({ length: 7 }, (_, i) => i);
  // Left branch from bottom-left up to the top; the right branch mirrors it.
  const leaf = (side: 1 | -1, i: number) => {
    const deg = 112 + i * 19;
    const a = (deg * Math.PI) / 180;
    const lx = 50 + Math.cos(a) * 37;
    const y = 52 + Math.sin(a) * 37;
    const x = side === 1 ? lx : 100 - lx;
    const rot = side === 1 ? deg + 22 : -(deg + 22);
    return (
      <ellipse
        key={`${side}${i}`}
        cx={x}
        cy={y}
        rx={solid ? 6 : 4.6}
        ry={solid ? 11 : 9}
        transform={`rotate(${rot} ${x} ${y})`}
        fill={solid ? t.leaf : "none"}
        stroke={solid ? t.dark : t.leaf}
        strokeWidth={solid ? 1.4 : 2.6}
      />
    );
  };
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${rank}${ordinal(rank)} place`}
      role="img"
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        {leaves.map((i) => leaf(1, i))}
        {leaves.map((i) => leaf(-1, i))}
        {solid && (
          <path
            d="M38 88 Q50 80 62 88 L58 94 Q50 89 42 94 Z"
            fill={t.leaf}
            stroke={t.dark}
            strokeWidth={1.2}
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center font-black tabular-nums"
        style={{
          color: t.text,
          fontSize: size * (rank > 9 ? 0.3 : 0.36),
          textShadow: "0 1px 2px rgba(0,0,0,0.55)",
          paddingBottom: size * 0.04,
        }}
      >
        {rank}
        <sup style={{ fontSize: "0.5em", fontWeight: 800, marginLeft: 1, top: "-0.6em" }}>
          {ordinal(rank)}
        </sup>
      </span>
    </span>
  );
}

/** The little green gem next to a score. */
function Gem({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <path d="M10 1 L18 10 L10 19 L2 10 Z" fill="#2FBF71" />
      <path d="M10 1 L18 10 L10 10 Z" fill="#7BE3A6" />
      <path d="M2 10 L10 19 L10 10 Z" fill="#1E8F52" />
    </svg>
  );
}

const CARD_BG: Record<1 | 2 | 3, string> = {
  1: "linear-gradient(180deg, rgba(247,201,72,0.08) 0%, #E9A825 55%, #F7C948 100%)",
  2: "linear-gradient(180deg, rgba(72,110,230,0.08) 0%, #3557D6 60%, #5B7CF0 100%)",
  3: "linear-gradient(180deg, rgba(232,120,70,0.08) 0%, #C4552C 60%, #E9804A 100%)",
};

function Face({ r, size }: { r: LeaderRow; size: number }) {
  const face = <Avatar src={r.avatar} initials={r.initials} color={r.color} size={size} />;
  return r.link ? (
    <PersonLink id={r.id} label={r.name} className="rounded-full">
      {face}
    </PersonLink>
  ) : (
    face
  );
}

function PodiumCard({ r, place, tall }: { r: LeaderRow; place: 1 | 2 | 3; tall: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-0 flex-1">
      <div
        className="w-full flex flex-col items-center justify-between rounded-t-[18px] rounded-b-[10px] px-1 pt-2 pb-3"
        style={{
          height: tall ? 196 : 164,
          background: CARD_BG[place],
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: r.me ? "0 0 0 2px var(--lime)" : undefined,
        }}
      >
        <Laurel rank={r.rank} size={tall ? 70 : 58} />
        <span
          className="rounded-full"
          style={{
            boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
            border: "2px solid rgba(255,255,255,0.7)",
          }}
        >
          <Face r={r} size={tall ? 78 : 64} />
        </span>
      </div>
      <p
        className="mt-2 font-semibold text-cream truncate max-w-full px-1"
        style={{ fontSize: 14 }}
      >
        {r.me ? "You" : r.name}
      </p>
      {r.value !== undefined && (
        <p className="flex items-center gap-1 font-extrabold tabular-nums" style={{ fontSize: 18 }}>
          <Gem /> {r.value}
        </p>
      )}
    </div>
  );
}

/** Top 3 as podium cards: 2nd · 1st · 3rd. With one row, just the winner in the middle. */
export function Podium({ rows }: { rows: LeaderRow[] }) {
  const [a, b, c] = rows;
  if (!a) return null;
  if (!b)
    return (
      <div className="flex justify-center">
        <div className="w-[46%]">
          <PodiumCard r={a} place={1} tall />
        </div>
      </div>
    );
  return (
    <div className="flex items-end gap-2.5">
      <PodiumCard r={b} place={2} tall={false} />
      <PodiumCard r={a} place={1} tall />
      {c ? <PodiumCard r={c} place={3} tall={false} /> : <div className="flex-1" />}
    </div>
  );
}

/** Everyone after the podium: face, name, gem score, laurel badge. */
export function RankList({ rows }: { rows: LeaderRow[] }) {
  if (!rows.length) return null;
  return (
    <div
      className="relative rounded-[22px] px-3 pt-3 pb-1"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      {/* The little lime notch on top, like a tab. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 -top-[3px] -translate-x-1/2 h-[5px] w-28 rounded-full"
        style={{ background: "var(--lime)", boxShadow: "0 0 12px rgba(193,239,98,0.6)" }}
      />
      <ol>
        {rows.map((r, i) => (
          <li
            key={r.id}
            className="flex items-center gap-3 py-2.5"
            style={{ borderTop: i ? "1px solid var(--line)" : undefined }}
          >
            <span
              className="rounded-full shrink-0"
              style={{ boxShadow: r.me ? "0 0 0 2px var(--lime)" : undefined }}
            >
              <Face r={r} size={48} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-cream truncate" style={{ fontSize: 16 }}>
                {r.me ? "You" : r.name}
              </span>
              {r.value !== undefined && (
                <span
                  className="flex items-center gap-1.5 font-extrabold tabular-nums"
                  style={{ fontSize: 17, color: "#3DDC84" }}
                >
                  <Gem /> {r.value}
                </span>
              )}
            </span>
            <Laurel rank={r.rank} size={46} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Podium + list. */
export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="grid gap-5">
      <Podium rows={rows.slice(0, 3)} />
      <RankList rows={rows.slice(3)} />
    </div>
  );
}

/** Give rows ranks from an already-sorted list (ties share a place). */
export function withRanks<T>(list: T[], key: (r: T) => number | string) {
  return list.map((r, i) => {
    let k = i;
    while (k > 0 && key(list[k - 1]) === key(r)) k--;
    return { r, rank: k + 1 };
  });
}

/**
 * End of a multiplayer game. Pass everyone best-first with their rank. Two
 * players: only the winner stands on the podium (a tie shows both).
 */
/** Who can be roasted: you, plus everyone who actually played. */
function roastable(rows: LeaderRow[], played?: string[]) {
  return rows.filter(
    (r) => r.me || (r.played !== false && (!played || played.includes(r.id) || /^bot/.test(r.id))),
  );
}

export function GameOverBoard({
  game,
  rows,
  headline,
  note,
  onClose,
  onPlayAgain,
  children,
  roast,
  played,
}: {
  /** Online games: who actually made a move. Anyone else (not a bot) can't be
   * roasted: they never played (their turns timed out, or they were skipped). */
  played?: string[];
  game: string;
  rows: LeaderRow[];
  /** Winners can roast the people they beat, as a post in Scenes. */
  roast?: { game: string; detail?: string };
  headline?: string;
  note?: string;
  onClose: () => void;
  onPlayAgain?: () => void;
  children?: React.ReactNode;
}) {
  const winners = rows.filter((r) => r.rank === 1);
  const shown = rows.length === 2 ? winners : rows;
  const iWon = winners.some((r) => r.me);
  useEffect(() => {
    if (iWon) sfx.win();
  }, [iWon]);
  const title =
    headline ??
    (winners.length > 1
      ? "Dead heat"
      : iWon
        ? "You win!"
        : `${winners[0]?.name.split(" ")[0] ?? "Someone"} wins`);
  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto"
      style={{ background: "var(--page)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${game}: game over`}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="label-caps text-center">{game} · game over</p>
        <h2 className="title text-center mt-2" style={{ fontSize: 30 }}>
          {title}
        </h2>
        {note && <p className="meta text-center mt-1">{note}</p>}
        <div className="mt-6">
          {shown.length === 2 ? (
            // A tie between two: both in the middle.
            <div className="flex justify-center gap-2.5">
              {shown.map((r) => (
                <div key={r.id} className="w-[42%]">
                  <PodiumCard r={r} place={1} tall />
                </div>
              ))}
            </div>
          ) : (
            <Leaderboard rows={shown} />
          )}
        </div>
        {children}
        {/* Only the winner gets to roast (in every game). */}
        {/* Only people who actually played can be roasted. */}
        {roast && iWon && winners.length === 1 && roastable(rows, played).length > 1 && (
          <RoastButton rows={roastable(rows, played)} roast={roast} mode="roast" />
        )}
        <div className="mt-8 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Done
          </button>
          {onPlayAgain && (
            <button onClick={onPlayAgain} className="btn-primary flex-1">
              Play again
            </button>
          )}
        </div>
      </div>
      <Confetti fire={iWon ? 1 : 0} />
    </div>
  );
}

// ---------- Roast: brag about a win in Scenes ----------

const ROASTS = [
  "Just beat {who} in {game}{detail}{by}. Anyone else want to lose? 😤",
  "{game}{detail}: me 1, {who} 0{by}. Next victim? 🔥",
  "Sorry {who}, {game} just isn't your thing. Took the W{by}. Who's next?",
  "Another day, another {game} win over {who}{by}. Form an orderly queue. 🏆",
  "{who} really thought. {game}{detail} is mine{by}. Line up. 😮‍💨",
  "Dear {who}, practice more. Love, the {game} champ. 💅",
  "Took {who} to school in {game}{detail}{by}. Class dismissed. 🎓",
];

// Didn't win: post the result anyway (and call for a rematch).
const RESULTS = [
  "{winner} took {game}{detail} this time. Rematch? 😤",
  "Came #{rank} in {game}{detail}. {winner}, enjoy it while it lasts. 👀",
  "{winner} got lucky in {game}{detail}. Run it back? 🔁",
  "Lost {game}{detail} to {winner}. I'll be back. 😮‍💨",
  "GG {winner}. {game}{detail} rematch tonight? 🔥",
];

function resultText(k: number, rows: LeaderRow[], roast: { game: string; detail?: string }) {
  const me = rows.find((r) => r.me);
  const w = rows.find((r) => r.rank === 1 && !r.me);
  const u = w?.link ? friendById(w.id)?.username : undefined;
  const winner = u ? `@${u}` : (w?.name.split(" ")[0] ?? "Someone");
  return RESULTS[k % RESULTS.length]
    .replace("{winner}", winner)
    .replace("{rank}", String(me?.rank ?? 2))
    .replace("{game}", roast.game)
    .replace("{detail}", roast.detail ? ` (${roast.detail})` : "");
}

function roastText(k: number, rows: LeaderRow[], roast: { game: string; detail?: string }) {
  const me = rows.find((r) => r.me);
  const losers = rows.filter((r) => !r.me && r.rank > (me?.rank ?? 1));
  const tag = (r: LeaderRow) => {
    const u = r.link ? friendById(r.id)?.username : undefined;
    return u ? `@${u}` : r.name.split(" ")[0];
  };
  const names = losers.map(tag);
  const who =
    names.length <= 1
      ? (names[0] ?? "everyone")
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const next = losers[0];
  const margin =
    typeof me?.value === "number" && typeof next?.value === "number" ? me.value - next.value : 0;
  const by =
    margin > 0 && losers.length === 1 ? ` by ${margin} point${margin === 1 ? "" : "s"}` : "";
  return ROASTS[k % ROASTS.length]
    .replace("{who}", who)
    .replace("{game}", roast.game)
    .replace("{detail}", roast.detail ? ` (${roast.detail})` : "")
    .replace("{by}", by);
}

function RoastButton({
  rows,
  roast,
  mode = "roast",
}: {
  rows: LeaderRow[];
  roast: { game: string; detail?: string };
  /** roast: you won, roast them. result: post how it went and ask for a rematch. */
  mode?: "roast" | "result";
}) {
  const lines = mode === "roast" ? ROASTS : RESULTS;
  const textFor = (n: number) =>
    mode === "roast" ? roastText(n, rows, roast) : resultText(n, rows, roast);
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(() => Math.floor(Math.random() * lines.length));
  const [text, setText] = useState("");
  const [posted, setPosted] = useState(false);
  // The roast card (a picture for the post), and whether to post it.
  const [card, setCard] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [withCard, setWithCard] = useState(true);
  const me = rows.find((r) => r.me);
  // The card always shows the winner on top: you, or whoever beat you.
  const top = mode === "roast" ? me : rows.find((r) => r.rank === 1 && !r.me);
  const losers = rows.filter((r) => r !== top && r.rank > (top?.rank ?? 1));
  const draw = (variant: number) => {
    if (!me || !top) return;
    const next = losers[0];
    setMaking(true);
    void makeRoastCard(
      {
        game: roast.game,
        detail: roast.detail,
        winner:
          top === me
            ? { name: meView().name, avatar: me.avatar ?? meView().avatar, initials: me.initials }
            : { name: top.name, avatar: top.avatar, initials: top.initials },
        losers: losers.map((r) => ({ name: r.name, avatar: r.avatar, initials: r.initials })),
        score:
          typeof top.value === "number" && typeof next?.value === "number"
            ? [top.value, next.value]
            : undefined,
      },
      variant,
    ).then((url) => {
      setCard((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setMaking(false);
    });
  };
  if (!me || !top) return null;
  const start = () => {
    setText(textFor(k));
    setOpen(true);
    if (!card) draw(k);
  };
  return (
    <>
      <button
        onClick={start}
        disabled={posted}
        className="mt-6 w-full rounded-full font-extrabold flex items-center justify-center gap-2 disabled:opacity-60"
        style={{
          minHeight: 52,
          background: "linear-gradient(90deg, #FF7A45, #F2506A)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(242,80,106,0.35)",
        }}
      >
        <Flame size={19} aria-hidden="true" />
        {posted
          ? "Posted to Scenes"
          : mode === "roast"
            ? "Roast them in Scenes"
            : "Post to Scenes · ask for a rematch"}
      </button>
      {open && (
        <Sheet
          title={mode === "roast" ? "Roast them" : "Post to Scenes"}
          onClose={() => setOpen(false)}
        >
          {/* The roast card: tap to leave it out. */}
          <div className="mb-3 flex items-start gap-3">
            <button
              onClick={() => card && setWithCard((v) => !v)}
              aria-pressed={withCard}
              aria-label={withCard ? "Roast card on (tap to leave it out)" : "Add the roast card"}
              className="relative shrink-0 rounded-2xl overflow-hidden"
              style={{
                width: 96,
                height: 120,
                background: "var(--fill)",
                outline: withCard && card ? "3px solid var(--lime)" : "1px solid var(--line)",
                opacity: withCard ? 1 : 0.45,
              }}
            >
              {card ? (
                <img src={card} alt="Your roast card" className="w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="w-6 h-6 rounded-full border-[3px] border-white/20 border-t-white animate-spin"
                    aria-label="Making your roast card"
                  />
                </span>
              )}
              {making && card && (
                <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="w-6 h-6 rounded-full border-[3px] border-white/20 border-t-white animate-spin" />
                </span>
              )}
            </button>
            <p className="meta pt-1" style={{ fontSize: 13 }}>
              {card
                ? withCard
                  ? "Your roast card goes with the post. Tap it to leave it out."
                  : "Posting just the text. Tap the card to add it back."
                : making
                  ? "Making your roast card…"
                  : "Couldn't make a card this time. The roast still posts."}
            </p>
          </div>
          <label className="sr-only" htmlFor="roast-text">
            Your roast
          </label>
          <textarea
            id="roast-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 280))}
            rows={4}
            className="input w-full resize-none"
            style={{ fontSize: 16, lineHeight: 1.4, paddingTop: 12 }}
          />
          <div className="mt-3 flex gap-2.5">
            <button
              onClick={() => {
                const n = k + 1;
                setK(n);
                setText(textFor(n));
                draw(n);
              }}
              className="btn-secondary px-4 flex items-center gap-1.5"
            >
              <Shuffle size={16} aria-hidden="true" /> Another
            </button>
            <button
              disabled={!text.trim()}
              onClick={() => {
                social.addPost(withCard && card ? card : "", text.trim());
                setPosted(true);
                setOpen(false);
              }}
              className="btn-primary flex-1"
            >
              Post to Scenes
            </button>
          </div>
          <p className="meta mt-3" style={{ fontSize: 12.5 }}>
            Goes to Scenes for your 25. Anyone you @tag gets a ping.
          </p>
        </Sheet>
      )}
    </>
  );
}
