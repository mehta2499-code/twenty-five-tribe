/**
 * Name That Tune: hear a tiny clip, name the song. Each skip or wrong guess plays a
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
    <Sheet title="Name That Tune" onClose={onClose}>
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
  tone,
}: {
  stages: number[];
  stage: number;
  playing: boolean;
  startedAt: number;
  tone: string;
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
    <div aria-hidden="true">
      <div
        className="relative h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: pct(stages[stage]), background: `${tone}55` }}
        />
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: pct(t), background: LIME }}
        />
        {stages.slice(0, -1).map((s) => (
          <span
            key={s}
            className="absolute inset-y-0 w-[2px]"
            style={{ left: pct(s), background: "#09080D" }}
          />
        ))}
      </div>
      <div
        className="mt-1.5 flex justify-between tabular-nums"
        style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}
      >
        <span>0s</span>
        <span>{total}s</span>
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
      style={{
        background: `radial-gradient(120% 70% at 50% -10%, ${meta.tone}40 0%, transparent 60%), linear-gradient(180deg, #121019 0%, #09080D 100%)`,
      }}
    >
      {preview && <audio ref={audio} src={preview.url} preload="auto" />}
      <div className="mx-auto w-full max-w-md px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col min-h-full">
        {/* Top: close · title · score */}
        <header className="flex items-center justify-between">
          <button
            onClick={onClose}
            aria-label="Leave"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <X size={22} />
          </button>
          <span className="text-center leading-tight">
            <span
              className="block font-extrabold tracking-tight"
              style={{ fontSize: 16, color: "#fff" }}
            >
              Name That Tune
            </span>
            <span
              className="block font-semibold capitalize"
              style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}
            >
              {title ?? meta.name} · {level}
            </span>
          </span>
          <span
            className="min-w-[44px] text-center rounded-full px-2.5 py-1 font-black tabular-nums"
            style={{ fontSize: 14, background: "rgba(255,255,255,0.08)", color: LIME }}
            aria-label={`Score ${score}`}
          >
            {score}
          </span>
        </header>

        {/* Songs in this game */}
        <div
          className="mt-4 flex items-center justify-center gap-2"
          aria-label={`Song ${k + 1} of ${songs.length}`}
        >
          {songs.map((_, i) => {
            const d = done[i];
            const now = i === k && !reveal;
            return (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: now ? 22 : 8,
                  height: 8,
                  background: d
                    ? d.got >= 0
                      ? LIME
                      : d.got === -2
                        ? "rgba(255,255,255,0.25)"
                        : "#FF5A6E"
                    : now
                      ? "#fff"
                      : "rgba(255,255,255,0.18)",
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
            {/* The record: tap to hear the clip */}
            <div className="mt-8 flex flex-col items-center">
              <button
                onClick={() => play(stages[stage])}
                disabled={!preview}
                aria-label={playing ? "Stop" : `Play ${stages[stage]} seconds`}
                className="relative rounded-full disabled:opacity-60 active:scale-[0.97] transition-transform"
                style={{ width: 236, height: 236 }}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-full ${playing ? "vinyl-spin" : ""}`}
                  style={{
                    background:
                      "repeating-radial-gradient(circle at 50% 50%, #151318 0 2px, #1D1B21 2px 4px), #18161B",
                    boxShadow: playing
                      ? `0 0 0 6px ${meta.tone}33, 0 20px 60px rgba(0,0,0,0.7), 0 0 60px ${meta.tone}44`
                      : "0 20px 60px rgba(0,0,0,0.7)",
                  }}
                >
                  {/* label */}
                  <span
                    className="absolute rounded-full"
                    style={{
                      inset: "33%",
                      background: `radial-gradient(circle at 35% 30%, #fff8 0%, transparent 45%), ${meta.tone}`,
                    }}
                  />
                  <span
                    className="absolute rounded-full"
                    style={{ inset: "47.5%", background: "#09080D" }}
                  />
                  {/* shine */}
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 30deg, transparent 0 15%, rgba(255,255,255,0.07) 20%, transparent 30% 65%, rgba(255,255,255,0.05) 70%, transparent 80%)",
                    }}
                  />
                </span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(9,8,13,0.55)",
                      backdropFilter: "blur(6px)",
                      WebkitBackdropFilter: "blur(6px)",
                      color: "#fff",
                    }}
                  >
                    {preview === undefined ? (
                      <span
                        className="w-6 h-6 rounded-full border-[3px] border-white/25 border-t-white animate-spin"
                        aria-label="Loading"
                      />
                    ) : playing ? (
                      <Pause size={28} fill="currentColor" />
                    ) : (
                      <Play size={30} fill="currentColor" style={{ marginLeft: 4 }} />
                    )}
                  </span>
                </span>
              </button>
              <p
                className="mt-5 font-semibold"
                style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}
              >
                {preview === null
                  ? "Couldn't load this one. Next song…"
                  : playing
                    ? "Listen…"
                    : `Tap the record · ${stages[stage]}s clip`}
              </p>
            </div>

            <div className="mt-6">
              <ClipBar
                stages={stages}
                stage={stage}
                playing={playing}
                startedAt={startedAt}
                tone={meta.tone}
              />
            </div>

            {/* Wrong guesses so far */}
            {guesses.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                {guesses.map((g, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full pl-2 pr-2.5 py-1 max-w-full"
                    style={{
                      background: "rgba(255,90,110,0.12)",
                      color: "#FF8A98",
                      fontSize: 12.5,
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                    <span className="truncate">{g}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Guess */}
            <div className="mt-auto pt-6">
              {suggestions.length > 0 && (
                <ul
                  className="mb-2 rounded-2xl overflow-hidden"
                  style={{
                    background: "rgba(28,26,34,0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 -10px 30px rgba(0,0,0,0.4)",
                  }}
                  role="listbox"
                  aria-label="Songs"
                >
                  {suggestions.map((s, i) => (
                    <li key={s.id}>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => guess(s.title)}
                        className="w-full text-left px-4 py-2.5 flex flex-col active:bg-white/5"
                        style={{ borderTop: i ? "1px solid rgba(255,255,255,0.05)" : undefined }}
                      >
                        <span
                          className="font-semibold truncate"
                          style={{ fontSize: 14.5, color: "#fff" }}
                        >
                          {cleanTitle(s.title)}
                        </span>
                        <span
                          className="truncate"
                          style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}
                        >
                          {s.artist}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div
                key={shake}
                className={`flex items-center gap-2 rounded-[20px] p-1.5 ${shake ? "ear-shake" : ""}`}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <label className="flex-1 min-w-0 flex items-center gap-2 pl-2.5">
                  <Search
                    size={18}
                    aria-hidden="true"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  />
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guess(suggestions[0]?.title ?? text)}
                    placeholder="Name that song"
                    aria-label="Name that song"
                    className="flex-1 min-w-0 bg-transparent outline-none py-2.5"
                    style={{ fontSize: 16, color: "#fff" }}
                    autoComplete="off"
                  />
                </label>
                <button
                  onClick={() =>
                    wrong(
                      stage + 1 >= stages.length
                        ? "Skipped"
                        : `Skipped (+${+(stages[stage + 1] - stages[stage]).toFixed(1)}s)`,
                    )
                  }
                  className="shrink-0 rounded-2xl px-3.5 h-11 flex items-center gap-1.5 font-bold"
                  style={{ background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 14 }}
                >
                  <SkipForward size={16} aria-hidden="true" />{" "}
                  {stage + 1 >= stages.length ? "Give up" : "Skip"}
                </button>
              </div>
              <div className="mt-2.5 flex justify-between items-center px-1">
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                  Worth <b style={{ color: LIME }}>{POINTS[stage]}</b> now
                </span>
                <button
                  onClick={() => finishSong(-1)}
                  className="font-semibold"
                  style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}
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
  const ok = d.got >= 0;
  return (
    <div className="mt-6 flex-1 flex flex-col items-center text-center ear-pop">
      <div className="relative w-full flex justify-center pt-4 pb-2">
        {/* the cover, softly glowing behind itself */}
        {p?.cover && (
          <img
            src={p.cover}
            alt=""
            aria-hidden="true"
            className="absolute top-6 w-52 h-52 rounded-full object-cover"
            style={{ filter: "blur(40px) saturate(1.4)", opacity: 0.55 }}
          />
        )}
        <span className="relative">
          {p?.cover ? (
            <img
              src={p.cover}
              alt=""
              className="w-60 h-60 rounded-[28px] object-cover"
              style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.65)" }}
            />
          ) : (
            <span
              className="w-60 h-60 rounded-[28px] flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", fontSize: 64 }}
            >
              🎵
            </span>
          )}
          {p && (
            <button
              onClick={onPlayFull}
              aria-label={playing ? "Stop" : "Play the clip"}
              className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: "#fff",
                color: "#09080D",
                boxShadow: "0 10px 24px rgba(0,0,0,0.5)",
              }}
            >
              {playing ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" style={{ marginLeft: 3 }} />
              )}
            </button>
          )}
        </span>
      </div>
      <p
        className="mt-9 font-extrabold tracking-tight"
        style={{ fontSize: 25, color: "#fff", lineHeight: 1.15 }}
      >
        {cleanTitle(p?.title ?? d.song.title)}
      </p>
      <p className="mt-1" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.6)" }}>
        {p?.artist ?? d.song.artist}
      </p>
      <span
        className="mt-4 rounded-full px-3.5 py-1.5 font-bold"
        style={{
          background: ok ? "rgba(184,242,92,0.14)" : "rgba(255,90,110,0.12)",
          color: ok ? LIME : "#FF8A98",
          fontSize: 13,
        }}
      >
        {ok
          ? `Got it in ${STAGES_LABEL(d)} · +${POINTS[d.got]}`
          : d.got === -2
            ? "Skipped · didn't load"
            : "Missed this one"}
      </span>
      {p?.link && (
        <a
          href={p.link}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1"
          style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}
        >
          Full song on Deezer <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
      <button
        onClick={onNext}
        className="mt-auto w-full rounded-2xl font-extrabold"
        style={{ background: "#fff", color: "#09080D", minHeight: 54, fontSize: 16 }}
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
      style={{
        background:
          "radial-gradient(120% 60% at 50% -10%, rgba(184,242,92,0.16) 0%, transparent 60%), linear-gradient(180deg, #121019 0%, #09080D 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
        <p className="label-caps text-center">name that tune</p>
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
        game={`Name That Tune · ${cat.name}`}
        rows={rows}
        roast={{ game: "Name That Tune", detail: cat.name }}
        onClose={onClose}
      />
    );
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        background:
          "radial-gradient(120% 60% at 50% -10%, rgba(184,242,92,0.16) 0%, transparent 60%), linear-gradient(180deg, #121019 0%, #09080D 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
        <header className="flex items-center justify-between">
          <span className="label-caps">name that tune · {cat.name}</span>
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
        style={{ background: "#09080D" }}
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
