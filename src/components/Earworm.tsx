/**
 * Earworm: hear a tiny clip, name the song. Each skip or wrong guess plays a
 * longer clip; naming it sooner scores more. 5 songs a game, solo or against
 * your 25 (same songs for everyone).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Pause, Play, Search, SkipForward, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, Sheet, buzz } from "@/components/SocialUI";
import { GameOverBoard, withRanks, type LeaderRow } from "@/components/Leaderboard";
import { sfx } from "@/lib/sfx";
import { friendById, mutualFriends, type Person } from "@/lib/social";
import {
  CATS,
  POINTS,
  STAGES,
  SONGS_PER_GAME,
  cleanTitle,
  isRight,
  loadPool,
  loadPreview,
  pickSongs,
  type EarCat,
  type EarLevel,
  type EarResult,
  type EarSong,
  type EarState,
  type Preview,
} from "@/lib/earworm";

const LIME = "#B8F25C";

// ---------- Setup ----------
export function EarwormSetup({
  onClose,
  onSolo,
  onChallenge,
}: {
  onClose: () => void;
  onSolo: (cat: EarCat, level: EarLevel) => void;
  onChallenge: (friends: Person[], cat: EarCat, level: EarLevel) => void;
}) {
  const [cat, setCat] = useState<EarCat>("bollywood");
  const [level, setLevel] = useState<EarLevel>("medium");
  const [picking, setPicking] = useState(false);
  const friends = mutualFriends();
  if (picking)
    return (
      <FriendPicker
        title="Who's in?"
        cta="Send the challenge"
        note="Everyone gets the same 5 songs. Highest score wins."
        onClose={() => setPicking(false)}
        onPick={(ids) =>
          onChallenge(
            friends.filter((f) => ids.includes(f.id)),
            cat,
            level,
          )
        }
      />
    );
  return (
    <Sheet title="Earworm" onClose={onClose}>
      <p className="meta -mt-1 mb-4">Hear a tiny clip. Name the song. Popular hits only.</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Songs">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            aria-pressed={cat === c.id}
            className="rounded-2xl py-3 flex flex-col items-center gap-1 font-extrabold transition-transform"
            style={{
              background: cat === c.id ? c.tone : "var(--fill)",
              color: cat === c.id ? "#fff" : "var(--ink)",
              border: `1px solid ${cat === c.id ? c.tone : "var(--line)"}`,
              transform: cat === c.id ? "scale(1.03)" : undefined,
            }}
          >
            <span style={{ fontSize: 26 }} aria-hidden="true">
              {c.emoji}
            </span>
            {c.name}
          </button>
        ))}
      </div>
      <p className="label-caps mt-5 mb-1.5">Difficulty</p>
      <div
        className="flex rounded-xl p-1"
        style={{ background: "var(--fill)" }}
        role="group"
        aria-label="Difficulty"
      >
        {(["easy", "medium", "hard"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            aria-pressed={level === l}
            className="flex-1 rounded-lg py-2 font-bold capitalize"
            style={{
              background: level === l ? LIME : "transparent",
              color: level === l ? "#14200A" : "var(--ink-2)",
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="meta mt-1.5" style={{ fontSize: 12 }}>
        First clip: {STAGES[level][0]}s, up to {STAGES[level][STAGES[level].length - 1]}s.
      </p>
      <div className="mt-5 grid gap-2.5">
        <button
          onClick={() => setPicking(true)}
          disabled={!friends.length}
          className="btn-primary disabled:opacity-50"
          style={{ minHeight: 54 }}
        >
          Challenge your 25
        </button>
        <button onClick={() => onSolo(cat, level)} className="btn-secondary">
          Play solo
        </button>
      </div>
    </Sheet>
  );
}

// ---------- The clip bar ----------
function ClipBar({
  stages,
  stage,
  playing,
  startedAt,
}: {
  stages: number[];
  stage: number;
  playing: boolean;
  startedAt: number;
}) {
  const total = stages[stages.length - 1];
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return setT(0);
    let raf = 0;
    const tick = () => {
      setT(Math.min(stages[stage], (performance.now() - startedAt) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, startedAt, stage, stages]);
  const pct = (s: number) => `${(s / total) * 100}%`;
  return (
    <div>
      <div
        className="relative h-4 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        {/* Unlocked so far */}
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: pct(stages[stage]), background: "rgba(184,242,92,0.28)" }}
        />
        {/* Playing now */}
        <span className="absolute inset-y-0 left-0" style={{ width: pct(t), background: LIME }} />
        {stages.slice(0, -1).map((s) => (
          <span
            key={s}
            aria-hidden="true"
            className="absolute inset-y-0 w-px"
            style={{ left: pct(s), background: "rgba(0,0,0,0.5)" }}
          />
        ))}
      </div>
      <div className="relative h-4 mt-1">
        <span
          className="absolute -translate-x-1/2 font-mono font-bold"
          style={{ left: pct(stages[stage]), fontSize: 11, color: LIME }}
        >
          {stages[stage]}s
        </span>
      </div>
    </div>
  );
}

// ---------- One game ----------
type Done = { song: EarSong; preview: Preview | null; got: number; guesses: string[] };

export function EarwormPlay({
  cat,
  level,
  songs,
  title,
  onFinish,
  onClose,
}: {
  cat: EarCat;
  level: EarLevel;
  songs: EarSong[];
  title?: string;
  onFinish: (r: EarResult, done: Done[]) => void;
  onClose: () => void;
}) {
  const stages = STAGES[level];
  const [k, setK] = useState(0);
  const [stage, setStage] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [reveal, setReveal] = useState<Done | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [pool, setPool] = useState<EarSong[]>([]);
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [shake, setShake] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const stopAt = useRef(0);
  const song = songs[k];
  const meta = CATS.find((c) => c.id === cat)!;

  useEffect(() => {
    void loadPool(cat).then(setPool);
  }, [cat]);
  // Load this song's clip.
  useEffect(() => {
    let alive = true;
    setPreview(undefined);
    void loadPreview(song).then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [song]);
  // A clip that won't load: skip it (no points lost).
  useEffect(() => {
    if (preview === null) {
      const t = setTimeout(() => finishSong(-2), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const stop = () => {
    audio.current?.pause();
    setPlaying(false);
  };
  const play = (seconds: number) => {
    const a = audio.current;
    if (!a || !preview) return;
    if (playing) return stop();
    a.currentTime = 0;
    stopAt.current = seconds;
    void a.play().then(
      () => {
        setStartedAt(performance.now());
        setPlaying(true);
      },
      () => setPlaying(false),
    );
  };
  // Stop exactly at the end of the clip.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const check = () => {
      const a = audio.current;
      if (a && a.currentTime >= stopAt.current) return stop();
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const finishSong = (got: number) => {
    stop();
    const d: Done = { song, preview: preview ?? null, got, guesses };
    if (got >= 0) {
      sfx.good();
      buzz(30);
    } else if (got === -1) sfx.bad();
    setReveal(d);
    setDone((x) => [...x, d]);
  };
  const next = () => {
    stop();
    const all = done;
    if (k + 1 >= songs.length) {
      const got = all.map((d) => (d.got === -2 ? -1 : d.got));
      onFinish(
        {
          score: all.reduce((a, d) => a + (d.got >= 0 ? POINTS[d.got] : 0), 0),
          got,
          at: Date.now(),
        },
        all,
      );
      return;
    }
    setK(k + 1);
    setStage(0);
    setGuesses([]);
    setText("");
    setReveal(null);
  };
  const wrong = (label: string) => {
    buzz(40);
    setShake((n) => n + 1);
    setGuesses((g) => [...g, label]);
    setText("");
    if (stage + 1 >= stages.length) finishSong(-1);
    else setStage(stage + 1);
  };
  const guess = (g: string) => {
    if (!g.trim() || reveal) return;
    if (isRight(g, song)) finishSong(stage);
    else wrong(g);
  };

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (q.length < 2) return [];
    const words = q.split(/\s+/);
    return pool
      .filter((s) => {
        const hay = `${s.title} ${s.artist}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 6);
  }, [text, pool]);

  const score = done.reduce((a, d) => a + (d.got >= 0 ? POINTS[d.got] : 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #1B2A12 0%, #0B0E0A 60%)" }}
    >
      {preview && <audio ref={audio} src={preview.url} preload="auto" />}
      <div className="mx-auto w-full max-w-md px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 flex flex-col min-h-full">
        <header className="flex items-center justify-between">
          <button
            onClick={onClose}
            aria-label="Leave"
            className="w-10 h-10 -ml-2 flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <X size={22} />
          </button>
          <span className="text-center">
            <span
              className="block font-black tracking-tight"
              style={{ fontSize: 20, color: "#fff" }}
            >
              earworm
            </span>
            <span className="block font-bold" style={{ fontSize: 11.5, color: meta.tone }}>
              {meta.emoji} {title ?? meta.name} · {level}
            </span>
          </span>
          <span className="font-black tabular-nums" style={{ fontSize: 16, color: LIME }}>
            {score}
          </span>
        </header>

        {/* Song dots */}
        <div className="mt-4 flex gap-1.5" aria-label={`Song ${k + 1} of ${songs.length}`}>
          {songs.map((_, i) => {
            const d = done[i];
            return (
              <span
                key={i}
                className="flex-1 h-1.5 rounded-full"
                style={{
                  background: d
                    ? d.got >= 0
                      ? LIME
                      : d.got === -2
                        ? "#555"
                        : "#FF5A6E"
                    : i === k
                      ? "rgba(255,255,255,0.6)"
                      : "rgba(255,255,255,0.15)",
                }}
              />
            );
          })}
        </div>

        {reveal ? (
          <RevealCard
            d={reveal}
            last={k + 1 >= songs.length}
            onNext={next}
            audio={audio}
            onPlayFull={() => play(30)}
            playing={playing}
          />
        ) : (
          <>
            <div className="mt-8">
              <ClipBar stages={stages} stage={stage} playing={playing} startedAt={startedAt} />
            </div>

            <div className="mt-6 flex items-center justify-center gap-5">
              <button
                onClick={() => play(stages[stage])}
                disabled={!preview}
                aria-label={playing ? "Stop" : `Play ${stages[stage]} seconds`}
                className="w-32 h-32 rounded-full flex items-center justify-center disabled:opacity-40 transition-transform active:scale-95"
                style={{
                  background: LIME,
                  color: "#0B0E0A",
                  boxShadow: playing
                    ? "0 0 0 10px rgba(184,242,92,0.18), 0 0 40px rgba(184,242,92,0.5)"
                    : "0 12px 30px rgba(184,242,92,0.25)",
                }}
              >
                {preview === undefined ? (
                  <span
                    className="w-8 h-8 rounded-full border-4 border-black/30 border-t-black animate-spin"
                    aria-label="Loading"
                  />
                ) : playing ? (
                  <Pause size={52} fill="currentColor" />
                ) : (
                  <Play size={56} fill="currentColor" style={{ marginLeft: 6 }} />
                )}
              </button>
              <span className="font-mono font-black" style={{ fontSize: 26, color: LIME }}>
                {stages[stage]}s
              </span>
            </div>
            {preview === null && (
              <p className="text-center meta mt-3">Couldn't load this one. Next song…</p>
            )}

            {/* Wrong guesses so far */}
            {guesses.length > 0 && (
              <ul className="mt-6 grid gap-1.5">
                {guesses.map((g, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{
                      background: "rgba(255,90,110,0.1)",
                      border: "1px solid rgba(255,90,110,0.3)",
                    }}
                  >
                    <X size={15} style={{ color: "#FF5A6E" }} aria-hidden="true" />
                    <span className="truncate" style={{ fontSize: 14 }}>
                      {g}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Guess */}
            <div className="mt-auto pt-6">
              {suggestions.length > 0 && (
                <ul
                  className="mb-2 rounded-2xl overflow-hidden"
                  style={{ background: "#1A2016", border: "1px solid rgba(255,255,255,0.1)" }}
                  role="listbox"
                  aria-label="Songs"
                >
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => guess(s.title)}
                        className="w-full text-left px-3.5 py-2.5 flex flex-col"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <span
                          className="font-bold truncate"
                          style={{ fontSize: 14.5, color: "#fff" }}
                        >
                          {cleanTitle(s.title)}
                        </span>
                        <span
                          className="truncate"
                          style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}
                        >
                          {s.artist}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div key={shake} className={`flex gap-2 ${shake ? "ear-shake" : ""}`}>
                <label
                  className="flex-1 min-w-0 flex items-center gap-2 rounded-2xl px-3.5"
                  style={{
                    background: "#1A2016",
                    border: "1px solid rgba(255,255,255,0.12)",
                    minHeight: 52,
                  }}
                >
                  <Search size={18} aria-hidden="true" style={{ color: "rgba(255,255,255,0.5)" }} />
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guess(suggestions[0]?.title ?? text)}
                    placeholder="Name that song"
                    aria-label="Name that song"
                    className="flex-1 min-w-0 bg-transparent outline-none"
                    style={{ fontSize: 16, color: "#fff" }}
                    autoComplete="off"
                  />
                </label>
                <button
                  onClick={() =>
                    wrong(
                      stage + 1 >= stages.length
                        ? "Skipped"
                        : `Skipped (+${stages[stage + 1] - stages[stage]}s)`,
                    )
                  }
                  className="shrink-0 rounded-2xl px-4 flex items-center gap-1.5 font-extrabold"
                  style={{ border: `1.5px solid ${LIME}`, color: LIME, minHeight: 52 }}
                >
                  <SkipForward size={17} aria-hidden="true" />{" "}
                  {stage + 1 >= stages.length ? "Give up" : "Skip"}
                </button>
              </div>
              <div className="mt-3 flex justify-between items-center">
                <span className="meta" style={{ fontSize: 12 }}>
                  Song {k + 1} of {songs.length} · {POINTS[stage]} pts if you get it now
                </span>
                <button
                  onClick={() => finishSong(-1)}
                  className="meta font-bold"
                  style={{ fontSize: 12.5 }}
                >
                  Give up
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RevealCard({
  d,
  last,
  onNext,
  onPlayFull,
  playing,
}: {
  d: Done;
  last: boolean;
  onNext: () => void;
  onPlayFull: () => void;
  playing: boolean;
  audio: React.RefObject<HTMLAudioElement | null>;
}) {
  const p = d.preview;
  return (
    <div className="mt-8 flex-1 flex flex-col items-center text-center ear-pop">
      <span
        className="rounded-full px-3 py-1 font-black"
        style={{
          background: d.got >= 0 ? LIME : "rgba(255,90,110,0.18)",
          color: d.got >= 0 ? "#14200A" : "#FF8090",
          fontSize: 13,
        }}
      >
        {d.got >= 0
          ? `Got it in ${STAGES_LABEL(d)} · +${POINTS[d.got]}`
          : d.got === -2
            ? "Skipped (didn't load)"
            : "Missed it"}
      </span>
      <span className="mt-5 relative">
        {p?.cover ? (
          <img
            src={p.cover}
            alt=""
            className="w-56 h-56 rounded-3xl object-cover"
            style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}
          />
        ) : (
          <span
            className="w-56 h-56 rounded-3xl flex items-center justify-center"
            style={{ background: "#1A2016", fontSize: 64 }}
          >
            🎵
          </span>
        )}
        {p && (
          <button
            onClick={onPlayFull}
            aria-label={playing ? "Stop" : "Play the clip"}
            className="absolute -bottom-4 -right-4 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: LIME, color: "#0B0E0A", boxShadow: "0 8px 20px rgba(0,0,0,0.5)" }}
          >
            {playing ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" style={{ marginLeft: 3 }} />
            )}
          </button>
        )}
      </span>
      <p className="mt-7 font-black" style={{ fontSize: 26, color: "#fff", lineHeight: 1.1 }}>
        {cleanTitle(p?.title ?? d.song.title)}
      </p>
      <p className="mt-1 font-semibold" style={{ fontSize: 16, color: "rgba(255,255,255,0.65)" }}>
        {p?.artist ?? d.song.artist}
      </p>
      {p?.link && (
        <a
          href={p.link}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 meta"
          style={{ fontSize: 12.5 }}
        >
          Listen to the full song <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
      <button
        onClick={onNext}
        className="mt-auto w-full rounded-2xl font-black"
        style={{ background: LIME, color: "#14200A", minHeight: 56, fontSize: 17 }}
      >
        {last ? "See your score" : "Next song"}
      </button>
    </div>
  );
}
const STAGES_LABEL = (d: Done) => `${d.guesses.length + 1} ${d.guesses.length ? "tries" : "try"}`;

// ---------- Results ----------
/** Solo: your 5 songs and total. */
export function EarwormSummary({
  done,
  result,
  onAgain,
  onClose,
}: {
  done: Done[];
  result: EarResult;
  onAgain: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #1B2A12 0%, #0B0E0A 60%)" }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
        <p className="label-caps text-center">earworm</p>
        <p
          className="text-center font-black mt-2"
          style={{ fontSize: 64, color: LIME, lineHeight: 1 }}
        >
          {result.score}
        </p>
        <p className="text-center meta">out of {SONGS_PER_GAME * POINTS[0]}</p>
        <ul className="mt-6 grid gap-2">
          {done.map((d, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-2xl p-2.5"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              {d.preview?.cover ? (
                <img src={d.preview.cover} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "#1A2016" }}
                >
                  🎵
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate" style={{ color: "#fff" }}>
                  {cleanTitle(d.preview?.title ?? d.song.title)}
                </span>
                <span className="block meta truncate" style={{ fontSize: 12.5 }}>
                  {d.preview?.artist ?? d.song.artist}
                </span>
              </span>
              <span
                className="font-black tabular-nums"
                style={{ color: d.got >= 0 ? LIME : "#FF5A6E" }}
              >
                {d.got >= 0 ? (
                  `+${POINTS[d.got]}`
                ) : d.got === -2 ? (
                  "–"
                ) : (
                  <X size={18} aria-label="Missed" />
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-2.5">
          <button
            onClick={onAgain}
            className="rounded-2xl font-black"
            style={{ background: LIME, color: "#14200A", minHeight: 54 }}
          >
            Play again
          </button>
          <button onClick={onClose} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Online: where everyone stands (waiting for the rest, or the final board). */
export function EarwormStandings({
  st,
  players,
  meId,
  onClose,
}: {
  st: EarState;
  players: string[];
  meId: string;
  onClose: () => void;
}) {
  const doneIds = players.filter((p) => st.results[p]);
  const waiting = players.filter((p) => !st.results[p]);
  const person = (id: string) => {
    const f = friendById(id);
    return {
      name: id === meId ? "You" : (f?.name ?? "Someone"),
      avatar: f?.avatar || undefined,
      initials: f?.initials ?? "?",
      color: f?.color,
    };
  };
  const sorted = [...doneIds].sort((a, b) => st.results[b].score - st.results[a].score);
  const rows: LeaderRow[] = withRanks(sorted, (id) => st.results[id].score).map(
    ({ r: id, rank }) => ({
      id,
      rank,
      value: st.results[id].score,
      link: id !== meId,
      me: id === meId,
      ...person(id),
    }),
  );
  const cat = CATS.find((c) => c.id === st.cat)!;
  if (!waiting.length)
    return (
      <GameOverBoard
        game={`Earworm · ${cat.name}`}
        rows={rows}
        roast={{ game: "Earworm", detail: cat.name }}
        onClose={onClose}
      />
    );
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #1B2A12 0%, #0B0E0A 60%)" }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
        <header className="flex items-center justify-between">
          <span className="label-caps">earworm · {cat.name}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center text-cool"
          >
            <X size={22} />
          </button>
        </header>
        <p className="font-black mt-3" style={{ fontSize: 26, color: "#fff" }}>
          You scored {st.results[meId]?.score ?? 0}
        </p>
        <p className="meta mt-1">
          Waiting for {waiting.length} more. The board fills in as they finish.
        </p>
        <ul className="mt-5 grid gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
              style={{ background: r.me ? "rgba(184,242,92,0.1)" : "rgba(255,255,255,0.05)" }}
            >
              <span className="w-6 font-black tabular-nums" style={{ color: LIME }}>
                {r.rank}
              </span>
              <Avatar src={r.avatar} initials={r.initials} color={r.color} size={36} />
              <span className="flex-1 font-bold truncate" style={{ color: "#fff" }}>
                {r.name}
              </span>
              <span className="font-black tabular-nums" style={{ color: LIME }}>
                {r.value}
              </span>
            </li>
          ))}
          {waiting.map((id) => {
            const p = person(id);
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 opacity-60"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <span className="w-6" />
                <Avatar src={p.avatar} initials={p.initials} color={p.color} size={36} />
                <span className="flex-1 font-bold truncate" style={{ color: "#fff" }}>
                  {p.name}
                </span>
                <span className="meta" style={{ fontSize: 12.5 }}>
                  still playing…
                </span>
              </li>
            );
          })}
        </ul>
        <p
          className="meta text-center mt-6 flex items-center justify-center gap-1.5"
          style={{ fontSize: 12 }}
        >
          <Check size={14} aria-hidden="true" /> Open it from Your games to check back.
        </p>
      </div>
    </div>
  );
}

/** Solo game from start to the summary. */
export function SoloEarworm({
  cat,
  level,
  onClose,
}: {
  cat: EarCat;
  level: EarLevel;
  onClose: () => void;
}) {
  const [songs, setSongs] = useState<EarSong[] | null>(null);
  const [end, setEnd] = useState<{ r: EarResult; done: Done[] } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    setSongs(null);
    setEnd(null);
    void loadPool(cat).then((pool) => alive && setSongs(pickSongs(pool)));
    return () => {
      alive = false;
    };
  }, [cat, round]);
  if (end)
    return (
      <EarwormSummary
        done={end.done}
        result={end.r}
        onAgain={() => setRound((n) => n + 1)}
        onClose={onClose}
      />
    );
  if (!songs)
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "#0B0E0A" }}
      >
        <p className="meta">Picking songs…</p>
      </div>
    );
  return (
    <EarwormPlay
      key={round}
      cat={cat}
      level={level}
      songs={songs}
      onClose={onClose}
      onFinish={(r, done) => setEnd({ r, done })}
    />
  );
}
