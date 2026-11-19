/**
 * Word Up: guess the 5-letter word in 6 tries.
 * Daily: one word for everyone, one go a day. Challenge: a friend sets the word.
 */
import { useDoing } from "@/lib/status";
import { useEffect, useMemo, useState } from "react";
import { Delete, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, FriendPicker, Toast, buzz } from "@/components/SocialUI";
import { friendById, meView, social } from "@/lib/social";
import { addDays, saveWord, today, useDaily } from "@/lib/daily";
import { track } from "@/lib/track";

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;

// Daily answers: common words, in a fixed shuffled order.
const ANSWERS = [
  "funny",
  "laugh",
  "short",
  "spare",
  "agree",
  "panel",
  "mercy",
  "blind",
  "swing",
  "waste",
  "blend",
  "maybe",
  "flash",
  "thank",
  "equal",
  "plant",
  "blame",
  "sharp",
  "uncle",
  "alert",
  "civic",
  "often",
  "opera",
  "fever",
  "grand",
  "clown",
  "argue",
  "about",
  "spray",
  "grief",
  "angry",
  "entry",
  "today",
  "space",
  "maple",
  "given",
  "mayor",
  "grant",
  "bring",
  "logic",
  "cream",
  "empty",
  "cycle",
  "stick",
  "scare",
  "climb",
  "trend",
  "flame",
  "first",
  "shock",
  "crazy",
  "toxic",
  "drive",
  "whole",
  "scale",
  "awful",
  "slice",
  "begin",
  "green",
  "quote",
  "stake",
  "floor",
  "tribe",
  "grain",
  "super",
  "clear",
  "mount",
  "rider",
  "issue",
  "field",
  "chalk",
  "arena",
  "false",
  "steel",
  "dance",
  "viral",
  "skirt",
  "cloud",
  "price",
  "relax",
  "tough",
  "quiet",
  "fancy",
  "grass",
  "sunny",
  "judge",
  "flour",
  "print",
  "irony",
  "fifty",
  "chair",
  "water",
  "shelf",
  "curve",
  "grade",
  "below",
  "blast",
  "rapid",
  "fence",
  "charm",
  "input",
  "motor",
  "adult",
  "slide",
  "local",
  "ocean",
  "label",
  "press",
  "match",
  "stair",
  "north",
  "track",
  "break",
  "harsh",
  "urban",
  "upper",
  "cheap",
  "stamp",
  "orbit",
  "plate",
  "smart",
  "sweet",
  "plane",
  "visit",
  "fifth",
  "tiger",
  "share",
  "shift",
  "vocal",
  "shine",
  "offer",
  "night",
  "fiber",
  "pizza",
  "depth",
  "youth",
  "medal",
  "hello",
  "owner",
  "dough",
  "stuff",
  "group",
  "humor",
  "model",
  "ideal",
  "essay",
  "squad",
  "quick",
  "sport",
  "sheep",
  "claim",
  "raise",
  "honey",
  "start",
  "clean",
  "after",
  "shout",
  "glass",
  "every",
  "death",
  "pride",
  "eight",
  "salad",
  "trail",
  "small",
  "giant",
  "lover",
  "jelly",
  "snack",
  "wagon",
  "spice",
  "index",
  "state",
  "other",
  "vivid",
  "toast",
  "sight",
  "enjoy",
  "flock",
  "would",
  "naive",
  "peace",
  "prize",
  "alive",
  "anger",
  "brain",
  "cheek",
  "angel",
  "frame",
  "world",
  "actor",
  "woman",
  "burst",
  "eager",
  "album",
  "table",
  "crowd",
  "dairy",
  "court",
  "party",
  "while",
  "quite",
  "usual",
  "knife",
  "upset",
  "twice",
  "thing",
  "jewel",
  "rough",
  "noble",
  "exact",
  "glove",
  "grace",
  "paint",
  "watch",
  "dream",
  "truly",
  "thick",
  "final",
  "again",
  "diary",
  "alien",
  "force",
  "peach",
  "extra",
  "treat",
  "board",
  "happy",
  "scent",
  "timer",
  "crash",
  "habit",
  "heavy",
  "phase",
  "great",
  "stand",
  "count",
  "style",
  "rural",
  "boost",
  "shade",
  "moral",
  "theme",
  "proud",
  "daily",
  "trick",
  "vital",
  "teach",
  "couch",
  "money",
  "blaze",
  "human",
  "under",
  "brief",
  "photo",
  "camel",
  "scene",
  "reach",
  "march",
  "shake",
  "guest",
  "tired",
  "weird",
  "click",
  "light",
  "bunch",
  "chunk",
  "fully",
  "truth",
  "nerve",
  "suite",
  "bloom",
  "fruit",
  "minor",
  "sleep",
  "trust",
  "close",
  "merit",
  "steam",
  "place",
  "stone",
  "blade",
  "basic",
  "tutor",
  "range",
  "ghost",
  "cheat",
  "draft",
  "glory",
  "choir",
  "juice",
  "beast",
  "clock",
  "write",
  "rumor",
  "point",
  "level",
  "bride",
  "shoot",
  "mouth",
  "bread",
  "booth",
  "stove",
  "ridge",
  "arise",
  "unity",
  "ready",
  "piece",
  "shell",
  "value",
  "route",
  "agent",
  "major",
  "white",
  "nurse",
  "taste",
  "block",
  "aware",
  "curry",
  "prime",
  "spark",
  "plain",
  "shame",
  "proof",
  "exist",
  "spoon",
  "enter",
  "award",
  "river",
  "fluid",
  "hotel",
  "knock",
  "crush",
  "wrong",
  "third",
  "fight",
  "carry",
  "outer",
  "worth",
  "earth",
  "above",
  "event",
  "lunch",
  "until",
  "trial",
  "drink",
  "chase",
  "bacon",
  "serve",
  "delay",
  "early",
  "forge",
  "elbow",
  "strip",
  "image",
  "south",
  "elite",
  "broke",
  "ratio",
  "score",
  "royal",
  "doubt",
  "touch",
  "spend",
  "storm",
  "shore",
  "feast",
  "video",
  "pasta",
  "berry",
  "bench",
  "chest",
  "pitch",
  "voice",
  "month",
  "cover",
  "movie",
  "react",
  "sense",
  "onion",
  "sword",
  "dress",
  "brush",
  "forth",
  "midst",
  "chart",
  "trade",
  "reply",
  "order",
  "queen",
  "title",
  "blush",
  "black",
  "fairy",
  "train",
  "child",
  "drama",
  "silly",
  "robot",
  "check",
  "magic",
  "beach",
  "along",
  "since",
  "olive",
  "dizzy",
  "scout",
  "spell",
  "valid",
  "dirty",
  "pearl",
  "seven",
  "chill",
  "ahead",
  "still",
  "crisp",
  "yield",
  "snake",
  "music",
  "rival",
  "allow",
  "smile",
  "faint",
  "greet",
  "dodge",
  "sugar",
  "brave",
  "limit",
  "flood",
  "tight",
  "horse",
  "guard",
  "radio",
  "inner",
  "thumb",
  "lemon",
  "total",
  "wheat",
  "error",
  "found",
  "house",
  "mango",
  "metal",
  "skill",
  "thief",
  "never",
  "wheel",
  "cheer",
  "coast",
  "fresh",
  "shark",
  "cause",
  "think",
  "cabin",
  "zebra",
  "vague",
  "study",
  "class",
  "rally",
  "crown",
  "bless",
  "brown",
  "build",
  "spicy",
  "beard",
  "fleet",
  "noise",
  "patch",
  "young",
  "crack",
  "joint",
  "alarm",
  "hurry",
  "phone",
  "front",
  "solid",
  "speed",
  "grape",
  "aside",
  "chess",
  "eagle",
  "learn",
  "solve",
  "sound",
  "badge",
  "hobby",
  "juicy",
  "power",
  "lobby",
  "worry",
  "layer",
  "smell",
  "heart",
  "honor",
  "mouse",
  "steal",
  "guess",
  "shirt",
  "craft",
  "novel",
  "sorry",
  "birth",
  "chief",
  "meter",
  "apple",
  "truck",
  "story",
  "sauce",
  "buddy",
  "pilot",
  "lucky",
  "candy",
  "smoke",
  "cargo",
  "catch",
  "throw",
  "faith",
  "frost",
  "right",
  "speak",
  "roast",
  "cliff",
  "coach",
  "topic",
  "round",
  "focus",
  "piano",
  "whale",
  "globe",
  "dealt",
  "clerk",
  "stage",
  "paper",
  "being",
  "loose",
  "blank",
  "tower",
  "panic",
  "guide",
  "alone",
  "shape",
];
const EPOCH = "2026-01-01";

export function dailyWord(day: string) {
  let n = 0;
  for (let d = EPOCH; d < day && n < 5000; d = addDays(d, 1)) n++;
  return ANSWERS[n % ANSWERS.length];
}
export function wordNumber(day: string) {
  let n = 1;
  for (let d = EPOCH; d < day && n < 5000; d = addDays(d, 1)) n++;
  return n;
}

let dict: Set<string> | null = null;
let dictLoad: Promise<Set<string>> | null = null;
export function loadWords() {
  dictLoad ??= fetch("/words5.txt")
    .then((r) => r.text())
    .then((t) => (dict = new Set(t.split(/\s+/).filter((w) => w.length === WORD_LEN))))
    .catch(() => (dict = new Set(ANSWERS)));
  return dictLoad;
}
export const isWord = (w: string) => !dict || dict.has(w) || ANSWERS.includes(w);

export type Mark = "hit" | "near" | "miss";
export function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(WORD_LEN).fill("miss");
  const left: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === answer[i]) marks[i] = "hit";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] !== "hit" && left[guess[i]]) {
      marks[i] = "near";
      left[guess[i]]--;
    }
  }
  return marks;
}
export const gridOf = (guesses: string[], answer: string) =>
  guesses
    .map((g) =>
      score(g, answer)
        .map((m) => (m === "hit" ? "🟩" : m === "near" ? "🟨" : "⬛"))
        .join(""),
    )
    .join("\n");

const TONE: Record<Mark, string> = {
  hit: "var(--lime)",
  near: "var(--sun)",
  miss: "var(--fill-2)",
};

// ---------- Board + keyboard ----------

export function WordBoard({
  answer,
  guesses,
  onGuess,
  readOnly,
}: {
  answer: string;
  guesses: string[];
  onGuess?: (g: string) => void;
  readOnly?: boolean;
}) {
  const [typing, setTyping] = useState("");
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const solved = guesses.includes(answer);
  const done = readOnly || solved || guesses.length >= MAX_GUESSES;

  useEffect(() => void loadWords(), []);

  const keys = useMemo(() => {
    const best: Record<string, Mark> = {};
    const rank = { miss: 0, near: 1, hit: 2 };
    for (const g of guesses)
      score(g, answer).forEach((m, i) => {
        const k = g[i];
        if (!best[k] || rank[m] > rank[best[k]]) best[k] = m;
      });
    return best;
  }, [guesses, answer]);

  const press = (k: string) => {
    if (done) return;
    buzz(4);
    if (k === "enter") {
      if (typing.length < WORD_LEN) return nope("Not enough letters");
      if (!isWord(typing)) return nope("Not in the word list");
      onGuess?.(typing);
      setTyping("");
    } else if (k === "back") setTyping((t) => t.slice(0, -1));
    else if (typing.length < WORD_LEN) setTyping((t) => t + k);
  };
  const nope = (msg: string) => {
    buzz(50);
    setShake(true);
    setToast(msg);
    setTimeout(() => setShake(false), 350);
  };

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "Enter") press("enter");
      else if (e.key === "Backspace") press("back");
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) =>
    r < guesses.length ? guesses[r] : r === guesses.length && !done ? typing : "",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5 mx-auto" style={{ width: "min(100%, 300px)" }}>
        {rows.map((word, r) => {
          const marks = r < guesses.length ? score(word, answer) : null;
          return (
            <div
              key={r}
              className={`grid grid-cols-5 gap-1.5 ${r === guesses.length && shake ? "wiggle" : ""}`}
            >
              {Array.from({ length: WORD_LEN }).map((_, i) => (
                <span
                  key={i}
                  className={`aspect-square rounded-xl flex items-center justify-center display uppercase ${marks ? "pop" : ""}`}
                  style={{
                    fontSize: 26,
                    border: "var(--bd)",
                    background: marks ? TONE[marks[i]] : word[i] ? "var(--fill)" : "transparent",
                    color: marks && marks[i] !== "miss" ? "var(--on-accent)" : "var(--ink)",
                    animationDelay: marks ? `${i * 70}ms` : undefined,
                    boxShadow: word[i] && !marks ? "var(--pop-sm)" : "none",
                  }}
                >
                  {word[i] ?? ""}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      {!done && (
        <div className="grid gap-1.5 select-none">
          {["qwertyuiop", "asdfghjkl", "+zxcvbnm-"].map((row) => (
            <div key={row} className="flex justify-center gap-1">
              {row.split("").map((k) => {
                const key = k === "+" ? "enter" : k === "-" ? "back" : k;
                const m = keys[k];
                return (
                  <button
                    key={k}
                    onClick={() => press(key)}
                    aria-label={key === "back" ? "Delete" : key === "enter" ? "Enter" : k}
                    className="h-12 rounded-lg font-bold uppercase flex items-center justify-center active:scale-95"
                    style={{
                      flex: key.length > 1 ? 1.6 : 1,
                      maxWidth: key.length > 1 ? 60 : 36,
                      fontSize: key === "enter" ? 11 : 15,
                      border: "var(--bd)",
                      background: m ? TONE[m] : "var(--surface)",
                      color:
                        m && m !== "miss"
                          ? "var(--on-accent)"
                          : m === "miss"
                            ? "var(--ink-3)"
                            : "var(--ink)",
                    }}
                  >
                    {key === "back" ? <Delete size={18} /> : key === "enter" ? "enter" : k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

// ---------- Daily word ----------

const progressKey = (day: string) => `tf.word.${day}`;
function readProgress(day: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(progressKey(day)) ?? "[]");
  } catch {
    return [];
  }
}

export function WordDaily({ onClose }: { onClose: () => void }) {
  const day = today();
  const answer = dailyWord(day);
  useDoing({ doing: "game", detail: "Word Up", ref: "daily:word" });
  const d = useDaily();
  const [guesses, setGuesses] = useState<string[]>(() => readProgress(day));
  const [party, setParty] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const posted = d.words[day]?.me;
  const solved = guesses.includes(answer);
  const finished = solved || guesses.length >= MAX_GUESSES || !!posted;
  const result =
    posted ??
    (finished ? { guesses: solved ? guesses.length : 7, grid: gridOf(guesses, answer) } : null);
  const shareText = result
    ? `Word Up #${wordNumber(day)} ${result.guesses > 6 ? "X" : result.guesses}/6\n${result.grid}`
    : "";

  const guess = (g: string) => {
    if (guesses.length === 0) track("game_started", { game: "word_up", daily: true });
    const next = [...guesses, g];
    setGuesses(next);
    try {
      localStorage.setItem(progressKey(day), JSON.stringify(next));
    } catch {
      // ignore
    }
    const won = g === answer;
    if (won || next.length >= MAX_GUESSES) {
      if (won) {
        setParty((n) => n + 1);
        buzz(40);
      }
      saveWord(day, { guesses: won ? next.length : 7, grid: gridOf(next, answer) }).catch((e) =>
        setToast((e as Error).message),
      );
    }
  };

  const table = Object.entries(d.words[day] ?? {})
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => a.guesses - b.guesses);

  return (
    <div className="fixed inset-0 z-50 bg-background animate-soft-in overflow-y-auto">
      <div className="mx-auto w-full max-w-md min-h-full flex flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="heading">Word Up</p>
            <p className="meta">Daily word #{wordNumber(day)} · same for everyone</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-cool">
            <X size={22} />
          </button>
        </header>

        <div className="mt-5">
          {posted && guesses.length === 0 ? (
            <p className="text-center text-cool">You've played today's word.</p>
          ) : (
            <WordBoard
              answer={answer}
              guesses={guesses}
              onGuess={guess}
              readOnly={!!posted && !finished}
            />
          )}
        </div>

        {finished && result && (
          <div className="mt-6 text-center animate-soft-in">
            <p className="display" style={{ fontSize: 30 }}>
              {result.guesses <= 6
                ? ["", "Genius", "Unreal", "Big brain", "Solid", "Phew", "Clutch"][result.guesses]
                : `It was ${answer.toUpperCase()}`}
            </p>
            <pre className="mt-3 text-[20px] leading-tight">{result.grid}</pre>
            <button onClick={() => setSharing(true)} className="btn-primary mt-4 px-6">
              Send my result
            </button>

            <div className="mt-6 card p-4 text-left">
              <p className="font-bold text-cream">Today at your table</p>
              <ul className="mt-2 grid gap-2">
                {table.map((r) => {
                  const me = r.id === "me";
                  const f = me ? null : friendById(r.id);
                  const v = me ? meView() : f;
                  return (
                    <li key={r.id} className="flex items-center gap-3">
                      <Avatar
                        src={v?.avatar || undefined}
                        initials={v?.initials ?? "?"}
                        color={f?.color}
                        size={30}
                      />
                      <span className="flex-1 font-semibold text-cream truncate">
                        {me ? "You" : f?.name}
                      </span>
                      <span className="font-bold tabular-nums">
                        {r.guesses > 6 ? "X/6" : `${r.guesses}/6`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="meta mt-4">New word at midnight.</p>
          </div>
        )}
      </div>
      {sharing && (
        <FriendPicker
          title="flex on who?"
          cta="Send"
          onClose={() => setSharing(false)}
          onPick={(ids) => {
            ids.forEach((id) => social.sendMessage(id, shareText, `wordup:${day}`));
            setSharing(false);
            setToast("Sent");
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={party} />
    </div>
  );
}
