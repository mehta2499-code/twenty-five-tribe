import { Tour } from "@/components/Tour";
import { DailyTune, EarwormSetup, SoloEarworm, SongsLoading } from "@/components/Earworm";
import { pickGameSongs, type EarCat, type EarLevel, type EarState } from "@/lib/earworm";
import { ChessLobby, LocalChess } from "@/components/Chess";
import { Connect4Lobby, LocalConnect4 } from "@/components/Connect4";
import { LocalPenFight, PenLobby } from "@/components/PenFight";
import type { PenState } from "@/lib/penfight";
import type { C4State } from "@/lib/connect4";
import { PokerSetup } from "@/components/Poker";
import type { ChessState } from "@/lib/chess";
import type { PokerState } from "@/lib/poker";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Sparkles, Users, X } from "lucide-react";
import { Glyph3D } from "@/components/Glyph3D";
import { SuitIcon } from "@/components/SuitIcon";
import { GameArt, type ArtKind } from "@/components/GameArt";
import { FriendPicker, PageBand, Sheet, Toast } from "@/components/SocialUI";
import { DailyRunner } from "@/components/ArcadeGames";
import { SeasonCard } from "@/components/Scoreboard";
import { TodaySection } from "@/components/DayResults";
import { WordDaily, checkWord, inWordList, loadWords, WORD_LEN } from "@/components/WordUp";
import { gameFor, today, useDaily } from "@/lib/daily";
import { KachufulLobby, LocalKachuful } from "@/components/Kachuful";
import { LocalLudo, LudoLobby } from "@/components/Ludo";
import type { LudoState } from "@/lib/ludo";
import type { Length } from "@/lib/kachuful";
import type { ImpState } from "@/lib/imposter";
import { TriviaGame } from "@/components/TriviaGame";
import { PackIcon } from "@/components/PackIcon";
import { TRIVIA_PACKS, thisWeeksPacks, type TriviaPack } from "@/lib/data";
import { switchesIn } from "@/lib/triviaWeeks";
import { bankSize } from "@/lib/trivia";
import {
  botSeats,
  listMyGames,
  seatFor,
  startKachuful,
  inviteToDuel,
  quitGame,
  startLudo,
  startChess,
  startConnect4,
  startPenFight,
  startEarworm,
  startPoker,
  startParty,
  startTriviaChallenge,
  startWordChallenge,
  type GameRow,
  type TriviaState,
  type WordState,
} from "@/lib/games";
import type { KState, Scoring, Seat } from "@/lib/kachuful";
import { friendById, meView, useSocial } from "@/lib/social";

function YourGames({ meId }: { meId: string }) {
  const [games, setGames] = useState<GameRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => listMyGames().then((g) => alive && setGames(g));
    void load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  // Hide games that are over, trivia you've already played (the result comes in
  // chat), games nobody has touched in a week, and party lobbies that never started.
  const now = Date.now();
  const open = (games ?? []).filter((g) => {
    if (g.status !== "playing" || gone.includes(g.id)) return false;
    if (g.kind === "trivia" && (g.state as TriviaState).results[meId]) return false;
    const idle = now - Date.parse(g.updated_at);
    if (idle > 7 * 86_400_000) return false;
    if (g.kind === "imposter" && (g.state as ImpState).phase === "lobby" && idle > 6 * 3_600_000)
      return false;
    return true;
  });
  const remove = async (g: GameRow) => {
    setConfirm(null);
    setGone((x) => [...x, g.id]);
    await quitGame(g, meId).catch(() => undefined);
  };
  if (!open.length) return null;
  const items = open
    .map((g) => {
      const others = g.players
        .filter((p) => p !== meId)
        .map((p) => friendById(p))
        .filter(Boolean);
      let title = "";
      let status = "";
      let yourTurn = false;
      if (g.kind === "kachuful") {
        const k = g.state as KState;
        const turn = k.seats[k.turn];
        yourTurn = turn?.id === meId || (k.phase === "roundEnd" && g.host === meId);
        title = `Judgement · round ${k.round + 1}/${k.plan.length}`;
        status = yourTurn ? "Your turn" : turn ? `${turn.name.split(" ")[0]}'s turn` : "In play";
      } else if (g.kind === "ludo") {
        const l = g.state as LudoState;
        const turn = l.players[l.turn];
        yourTurn = turn?.id === meId;
        title = `Ludo · ${l.players.length} players`;
        status =
          l.phase === "lobby"
            ? "Waiting room"
            : yourTurn
              ? "Your turn"
              : `${turn?.name.split(" ")[0] ?? "Their"}'s turn`;
      } else if (g.kind === "word") {
        const w = g.state as WordState;
        const guessing = w.guesser === meId;
        yourTurn = guessing;
        title = guessing ? "Word Up · your word" : "Word Up · you set it";
        status = guessing
          ? `Your turn · ${w.guesses.length}/6`
          : `${others[0]?.name.split(" ")[0] ?? "They"}'re on ${w.guesses.length}/6`;
      } else if (g.kind === "earworm") {
        const e = g.state as EarState;
        title = `Name That Tune · ${e.songs.length} songs`;
        if (e.mode === "live") {
          const out = e.left?.includes(meId);
          yourTurn = !out;
          status = out ? "You left" : e.startAt ? "Live now · jump back in" : "Waiting room · join";
        } else {
          yourTurn = !e.results[meId];
          const left = g.players.filter((p) => !e.results[p]).length;
          status = yourTurn ? "Your turn" : `Waiting for ${left}`;
        }
      } else if (g.kind === "penfight") {
        const p = g.state as PenState;
        const seat = p.players[0] === meId ? 0 : 1;
        const waiting = p.joined && p.joined.length < 2;
        yourTurn = waiting ? !p.joined!.includes(meId) : p.turn === seat && p.winner === undefined;
        title = `Pen fight vs ${others[0]?.name.split(" ")[0] ?? "a friend"}`;
        status = waiting
          ? yourTurn
            ? "Join the game"
            : "Waiting room"
          : yourTurn
            ? "Your flick"
            : "Their flick";
      } else if (g.kind === "connect4") {
        const c = g.state as C4State;
        const mine = c.red === meId ? "r" : "y";
        yourTurn = c.turn === mine && !c.result;
        title = `Connect 4 vs ${others[0]?.name.split(" ")[0] ?? "a friend"}`;
        const waiting = c.joined && c.joined.length < 2;
        if (waiting) yourTurn = !c.joined!.includes(meId);
        status = waiting
          ? yourTurn
            ? "Join the game"
            : "Waiting room"
          : yourTurn
            ? "Your move"
            : "Their move";
      } else if (g.kind === "chess") {
        const c = g.state as ChessState;
        const mine = c.white === meId ? "w" : "b";
        yourTurn = c.turn === mine && !c.result;
        title = `Chess vs ${others[0]?.name.split(" ")[0] ?? "a friend"}`;
        status = yourTurn ? "Your move" : "Their move";
      } else if (g.kind === "poker") {
        const pk = g.state as PokerState;
        yourTurn = pk.phase === "betting" && pk.seats[pk.toAct]?.id === meId;
        title = `Hold'em · ${pk.seats.length}/${pk.maxSeats} seats`;
        status =
          pk.phase === "lobby"
            ? pk.seats.some((p) => p.id === meId)
              ? "Waiting to deal"
              : "Take your seat"
            : yourTurn
              ? "Your turn"
              : `Hand ${pk.handNo}`;
      } else if (g.kind === "imposter") {
        const p = g.state as ImpState;
        yourTurn =
          p.phase === "clues"
            ? p.order?.[p.turn] === meId
            : p.phase === "vote"
              ? !p.votes[meId]
              : false;
        title = `Imposter · ${p.players.length} players`;
        status =
          p.phase === "lobby"
            ? "In the lobby"
            : p.phase === "over"
              ? "Round over"
              : yourTurn
                ? p.phase === "vote"
                  ? "Vote now"
                  : "Your clue"
                : "In progress";
      } else {
        const t = g.state as TriviaState;
        const pack = TRIVIA_PACKS.find((p) => p.id === t.pack);
        yourTurn = !t.results[meId];
        title = `${pack?.name ?? "Trivia"} challenge`;
        status = yourTurn ? "Your turn" : `Waiting for ${others[0]?.name.split(" ")[0] ?? "them"}`;
      }
      return { g, title, status, yourTurn, others };
    })
    // Games waiting on you first.
    .sort((x, y) => Number(y.yourTurn) - Number(x.yourTurn));
  const waiting = items.filter((x) => x.yourTurn).length;
  const TONE: Record<string, string> = {
    kachuful: "#2E2A3A",
    ludo: "#C84F5C",
    word: "#2FA76A",
    earworm: "#2A3416",
    chess: "#7E6CD6",
    connect4: "#2F5BE0",
    penfight: "#8E5A2E",
    poker: "#1F8150",
    imposter: "#3A2E4A",
    trivia: "#5BA6DD",
  };
  return (
    <section className="px-5 mt-5" aria-label="Your games">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="label-caps">{waiting ? "Your turn" : "Your games"}</h2>
        <span
          className="font-bold"
          style={{ fontSize: 12.5, color: waiting ? "var(--pink)" : "var(--ink-2)" }}
        >
          {waiting ? `${waiting} waiting` : `${items.length} in progress`}
        </span>
      </div>
      <ul className="card overflow-hidden p-0" style={{ borderRadius: 22 }}>
        {items.map(({ g, title, status, yourTurn }, i) => (
          <li key={g.id} style={{ borderTop: i ? "1px solid var(--line)" : undefined }}>
            {confirm === g.id ? (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-cream text-sm truncate">
                    Quit {title}?
                  </span>
                  <span className="block meta" style={{ fontSize: 12 }}>
                    {g.kind === "kachuful"
                      ? "A bot takes your seat."
                      : "You can't come back to it."}
                  </span>
                </span>
                <button
                  onClick={() => setConfirm(null)}
                  className="btn-secondary px-3"
                  style={{ minHeight: 36 }}
                >
                  Keep
                </button>
                <button
                  onClick={() => void remove(g)}
                  className="btn-danger px-3"
                  style={{ minHeight: 36 }}
                >
                  Quit
                </button>
              </div>
            ) : (
              <Link
                to="/app/play/$id"
                params={{ id: g.id }}
                className="flex items-center gap-3 px-3 py-2.5 active:bg-[var(--fill)]"
              >
                <span
                  className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0"
                  style={{ background: TONE[g.kind] ?? "var(--fill)" }}
                >
                  <GameArt kind={g.kind as ArtKind} size={30} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className="block font-extrabold text-cream truncate"
                    style={{ fontSize: 14.5 }}
                  >
                    {title}
                  </span>
                  <span className="block meta truncate" style={{ fontSize: 12.5 }}>
                    {status}
                  </span>
                </span>
                {yourTurn ? (
                  <span
                    className="shrink-0 rounded-full px-3 py-1.5 font-extrabold"
                    style={{
                      background: "var(--pink)",
                      color: "var(--on-accent)",
                      border: "2px solid var(--edge)",
                      fontSize: 13,
                    }}
                  >
                    {/join|seat|lobby|waiting room/i.test(status) ? "Join" : "Play"}
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirm(g.id);
                    }}
                    aria-label={`Quit ${title}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-cool shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Each game's card: its colours and its 3D art. */
const CARD: Record<string, { from: string; to: string; glow: string }> = {
  earworm: { from: "#4B2BB8", to: "#1A1450", glow: "#8B5CF6" },
  poker: { from: "#1E8A5A", to: "#0E3B33", glow: "#34D399" },
  chess: { from: "#F08A24", to: "#9A3A0E", glow: "#FDBA74" },
  kachuful: { from: "#B03BB0", to: "#4A1A6B", glow: "#E879F9" },
  trivia: { from: "#2F6BF0", to: "#152A7A", glow: "#60A5FA" },
  ludo: { from: "#2FA35A", to: "#13492F", glow: "#4ADE80" },
  word: { from: "#D13E9E", to: "#5A1E8C", glow: "#F472B6" },
  imposter: { from: "#3B3A9E", to: "#1A1650", glow: "#818CF8" },
  connect4: { from: "#1E9BD7", to: "#123A8A", glow: "#38BDF8" },
  penfight: { from: "#C98B52", to: "#5A3518", glow: "#F6B26B" },
};

/** A wooden letter tile (Word Up's art). */
function Tile({ ch, rot, y }: { ch: string; rot: number; y: number }) {
  return (
    <span
      className="inline-flex items-center justify-center font-black"
      style={{
        width: 30,
        height: 32,
        marginLeft: -3,
        borderRadius: 7,
        background: "linear-gradient(160deg, #F7D9A0, #D9A75E)",
        color: "#2A1A0A",
        fontSize: 19,
        transform: `rotate(${rot}deg) translateY(${y}px)`,
        boxShadow: "0 4px 0 #A87835, 0 8px 14px rgba(0,0,0,0.4)",
      }}
    >
      {ch}
    </span>
  );
}
/** A small white playing card (Hold'em's art). */
function MiniCard({ rank, suit, rot }: { rank: string; suit: "S" | "H"; rot: number }) {
  const red = suit === "H";
  return (
    <span
      className="relative inline-block"
      style={{
        width: 40,
        height: 54,
        marginLeft: -10,
        borderRadius: 7,
        background: "linear-gradient(160deg, #FFFFFF, #ECE8E2)",
        color: red ? "#D3243B" : "#14121C",
        transform: `rotate(${rot}deg)`,
        boxShadow: "0 8px 16px rgba(0,0,0,0.45)",
      }}
    >
      <span className="absolute left-1.5 top-0.5 font-black" style={{ fontSize: 15 }}>
        {rank}
      </span>
      <SuitIcon suit={suit} size={20} style={{ position: "absolute", right: 4, bottom: 4 }} />
    </span>
  );
}

function CardArt({ kind }: { kind: string }) {
  const g = (emoji: string, size = 64, style?: React.CSSProperties) => (
    <Glyph3D
      emoji={emoji}
      size={size}
      style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.45))", ...style }}
    />
  );
  switch (kind) {
    case "earworm":
      return g("🎧", 66);
    case "poker":
      return (
        <span className="inline-flex items-end pl-2">
          <MiniCard rank="A" suit="S" rot={-12} />
          <MiniCard rank="K" suit="H" rot={10} />
        </span>
      );
    case "chess":
      return g("♟️", 64);
    case "kachuful":
      return g("⚖️", 64);
    case "trivia":
      return g("⚡", 64);
    case "ludo":
      return (
        <Glyph3D
          name="dice"
          size={76}
          style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.45))" }}
        />
      );
    case "word":
      return (
        <span className="inline-flex items-end pl-1">
          <Tile ch="W" rot={-12} y={4} />
          <Tile ch="O" rot={0} y={-6} />
          <Tile ch="W" rot={12} y={4} />
        </span>
      );
    case "imposter":
      return g("🥷", 64);
    case "penfight":
      return g("🖊️", 66, { transform: "rotate(-20deg)" });
    case "connect4":
      return (
        <span className="relative inline-block" style={{ width: 74, height: 62 }}>
          {g("🟡", 46, { position: "absolute", right: 0, top: 0 })}
          {g("🔴", 50, { position: "absolute", left: 0, bottom: 0 })}
        </span>
      );
    default:
      return null;
  }
}

function GameTile({
  art,
  title,
  badge,
  onClick,
  tour,
  wide,
}: {
  tone?: string;
  art: ArtKind;
  title: string;
  badge?: string;
  onClick: () => void;
  tour?: string;
  wide?: boolean;
}) {
  const c = CARD[art] ?? { from: "#3A3550", to: "#1A1726", glow: "#A78BFA" };
  return (
    <button
      onClick={onClick}
      data-tour={tour}
      className={`relative overflow-hidden rounded-[24px] text-left active:scale-[0.97] transition-transform ${wide ? "col-span-2" : ""}`}
      style={{
        minHeight: 122,
        background: `radial-gradient(120% 90% at 70% 20%, ${c.glow}55, transparent 60%), linear-gradient(150deg, ${c.from}, ${c.to})`,
        border: "1px solid rgba(255,255,255,0.22)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -10px 24px rgba(0,0,0,0.25), 0 10px 24px -10px ${c.glow}99`,
        color: "#fff",
      }}
    >
      {/* Glass shine across the top */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.14), transparent)" }}
      />
      {badge && (
        <span
          className="absolute left-3 top-3 z-[1] text-[11px] font-black px-2.5 py-1 rounded-full"
          style={{
            background: "linear-gradient(180deg, #FFD86B, #F5B83A)",
            color: "#3A2400",
            letterSpacing: "0.04em",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        >
          {badge}
        </span>
      )}
      <span
        className="absolute"
        style={{ right: wide ? "30%" : 12, top: 10, lineHeight: 0 }}
        aria-hidden="true"
      >
        <CardArt kind={art} />
      </span>
      <span
        className="absolute left-3.5 bottom-3 right-14 font-extrabold leading-tight"
        style={{ fontSize: 16.5, textShadow: "0 2px 6px rgba(0,0,0,0.35)" }}
      >
        {title}
      </span>
      <span
        aria-hidden="true"
        className="absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(10,8,24,0.45)",
          border: "1px solid rgba(255,255,255,0.25)",
          backdropFilter: "blur(6px)",
        }}
      >
        <ChevronRight size={19} strokeWidth={2.6} />
      </span>
    </button>
  );
}

/** Today's game starts as a mystery: tap to spin and reveal it, tap again to play. */

/**
 * Games. "home": the daily games and their leaderboards (Daily · Weekly ·
 * Overall). "more": everything else you play with your 25 (doesn't count
 * towards the leaderboard).
 */
export function GamesScreen({ mode }: { mode: "home" | "more" }) {
  const s = useSocial();
  const navigate = useNavigate();
  // Old links to "Play with your 25" land on that section of the one page.
  useEffect(() => {
    if (mode !== "more") return;
    const t = setTimeout(
      () => document.getElementById("play-with-your-25")?.scrollIntoView({ block: "start" }),
      150,
    );
    return () => clearTimeout(t);
  }, [mode]);
  const live = s.mode === "live" && !!s.me;
  useDaily();
  const [daily, setDaily] = useState(false);
  const [wordDaily, setWordDaily] = useState(false);
  const [tuneDaily, setTuneDaily] = useState(false);
  // Picking songs for a Name That Tune with friends (shows the loader).
  const [earLoading, setEarLoading] = useState<EarCat | null>(null);
  const earTicket = useRef(0);
  // Opened from a friend's Word Up card in chat: go straight to today's word.
  useEffect(() => {
    try {
      if (localStorage.getItem("tf.open") === "word") {
        localStorage.removeItem("tf.open");
        setWordDaily(true);
      }
    } catch {
      // ignore
    }
  }, []);
  const [wordSheet, setWordSheet] = useState(false);
  // The word list, loaded when you go to set a word (only real words can be sent).
  const [listReady, setListReady] = useState(false);
  useEffect(() => {
    if (wordSheet) void loadWords().then(() => setListReady(true));
  }, [wordSheet]);
  const [secret, setSecret] = useState("");
  const [wordFor, setWordFor] = useState<string | null>(null);
  const [lobby, setLobby] = useState(false);
  const [localTable, setLocalTable] = useState<{
    seats: Seat[];
    length: Length;
    turnSeconds?: number;
    scoring: Scoring;
  } | null>(null);
  const [packFor, setPackFor] = useState<TriviaPack | null>(null);
  const [soloPack, setSoloPack] = useState<TriviaPack | null>(null);
  const [challengePack, setChallengePack] = useState<TriviaPack | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [packs, setPacks] = useState(false);
  const [ludo, setLudo] = useState(false);
  const [chess, setChess] = useState(false);
  const [c4, setC4] = useState(false);
  const [pen, setPen] = useState(false);
  const [penBot, setPenBot] = useState<1 | 2 | 3 | null>(null);
  const [c4Bot, setC4Bot] = useState<{ level: 1 | 2 | 3; first: boolean } | null>(null);
  const [chessBot, setChessBot] = useState<{
    level: 1 | 2 | 3;
    color: "w" | "b";
    minutes?: number;
  } | null>(null);
  const [poker, setPoker] = useState(false);
  const [ear, setEar] = useState(false);
  const [earSolo, setEarSolo] = useState<{ cat: EarCat; level: EarLevel } | null>(null);
  const [soloLudo, setSoloLudo] = useState<number | null>(null);
  const [wordMenu, setWordMenu] = useState(false);

  const me = meView();
  const mySeat = (): Seat =>
    seatFor({
      id: s.me?.id ?? "me",
      name: me.name === "You" ? "You" : me.name,
      avatar: me.avatar,
      initials: me.initials,
    });

  return (
    <>
      <Tour
        id="games"
        steps={[
          {
            at: 'section[aria-label="Today\'s games"]',
            title: "Three games a day",
            body: "Today's mini game, Word Up and Name That Tune, same for your whole 25. Tap a game to play; tap your rank for its board.",
          },
          {
            at: 'section[aria-label="All games"]',
            title: "Play with your 25",
            body: "Chess, Hold'em, Ludo, Trivia, Name That Tune and more, live with your friends. Just for fun.",
          },
          {
            at: 'section[aria-label="Season"]',
            title: "The season",
            body: "Every daily game earns points. Top of your 25 after 25 days wins the season title.",
          },
        ]}
      />
      <PageBand ring title="Games" />
      {live && <YourGames meId={s.me!.id} />}
      <TodaySection
        onPlayDaily={() => setDaily(true)}
        onPlayWord={() => setWordDaily(true)}
        onPlayTune={() => setTuneDaily(true)}
      />

      {/* Everything you play with your 25 (live, just for fun). */}
      <section className="px-5 mt-7" aria-label="All games" id="play-with-your-25">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="flex items-center gap-2 font-extrabold" style={{ fontSize: 20 }}>
            <Sparkles size={20} style={{ color: "#C084FC" }} aria-hidden="true" />
            Play with your 25
          </h2>
          <span
            className="flex items-center gap-1.5 font-bold"
            style={{ fontSize: 13, color: "#B9A8F5" }}
          >
            <Users size={15} aria-hidden="true" /> 10 games
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GameTile
            tone="#2A3416"
            art="earworm"
            badge="NEW"
            title="Name That Tune"
            onClick={() => (live ? setEar(true) : setToast("Sign in to play."))}
          />
          <GameTile
            tone="#2F5BE0"
            art="connect4"
            badge="NEW"
            title="Connect 4"
            onClick={() => setC4(true)}
          />
          <GameTile art="penfight" badge="NEW" title="Pen fight" onClick={() => setPen(true)} />
          <GameTile
            tone="#1F8150"
            art="poker"
            title="Hold'em"
            onClick={() => (live ? setPoker(true) : setToast("Sign in to open a table."))}
          />
          <GameTile tone="#7E6CD6" art="chess" title="Chess" onClick={() => setChess(true)} />
          <GameTile
            tone="#2E2A3A"
            art="kachuful"
            title="Judgement"
            onClick={() => setLobby(true)}
          />
          <GameTile tone="#5BA6DD" art="trivia" title="Trivia" onClick={() => setPacks(true)} />
          <GameTile tone="#C84F5C" art="ludo" title="Ludo" onClick={() => setLudo(true)} />
          <GameTile
            tone="#2FA76A"
            art="word"
            title="Word Up 1v1"
            onClick={() => setWordSheet(true)}
          />
          <GameTile
            tone="#3A2E4A"
            art="imposter"
            tour="imposter"
            title="Imposter"
            onClick={async () => {
              if (!live) return setToast("Sign in to start a party.");
              try {
                const id = await startParty();
                navigate({ to: "/app/play/$id", params: { id } });
              } catch (e) {
                setToast((e as Error).message);
              }
            }}
          />
        </div>
      </section>

      <SeasonCard />
      <p className="text-center meta mt-6 pb-4" style={{ fontSize: 12.5 }}>
        Only your mutual 25 see your scores.
      </p>

      {chess && (
        <ChessLobby
          onClose={() => setChess(false)}
          onBot={(level, color, minutes) => {
            setChess(false);
            setChessBot({ level, color, minutes });
          }}
          onFriend={async (f, minutes) => {
            setChess(false);
            if (!live) return setToast("Sign in to challenge a friend.");
            try {
              const id = await startChess(f, minutes);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}
      {c4 && (
        <Connect4Lobby
          onClose={() => setC4(false)}
          onBot={(level, first) => {
            setC4(false);
            setC4Bot({ level, first });
          }}
          onFriend={async (f) => {
            setC4(false);
            if (!live) return setToast("Sign in to challenge a friend.");
            try {
              const id = await startConnect4(f);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}
      {pen && (
        <PenLobby
          onClose={() => setPen(false)}
          onBot={(level) => {
            setPen(false);
            setPenBot(level);
          }}
          onFriend={async (f) => {
            setPen(false);
            if (!live) return setToast("Sign in to challenge a friend.");
            try {
              const id = await startPenFight(f);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}
      {penBot && <LocalPenFight level={penBot} onClose={() => setPenBot(null)} />}
      {c4Bot && (
        <LocalConnect4 level={c4Bot.level} first={c4Bot.first} onClose={() => setC4Bot(null)} />
      )}
      {chessBot && (
        <LocalChess
          level={chessBot.level}
          color={chessBot.color}
          minutes={chessBot.minutes}
          onClose={() => setChessBot(null)}
        />
      )}
      {ear && (
        <EarwormSetup
          onClose={() => setEar(false)}
          onSolo={(cat, level) => {
            setEar(false);
            setEarSolo({ cat, level });
          }}
          onChallenge={async (friends, cat, level) => {
            setEar(false);
            // Show the loader while the songs are picked (it can take a few seconds).
            const ticket = Date.now();
            earTicket.current = ticket;
            setEarLoading(cat);
            try {
              // Skip songs anyone in this game heard lately; all checked to play.
              const songs = await pickGameSongs(
                cat,
                undefined,
                friends.map((f) => f.id),
              );
              if (earTicket.current !== ticket) return; // cancelled
              const id = await startEarworm(friends, cat, level, songs);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            } finally {
              if (earTicket.current === ticket) setEarLoading(null);
            }
          }}
        />
      )}
      {earLoading && (
        <SongsLoading
          cat={earLoading}
          onCancel={() => {
            earTicket.current = 0;
            setEarLoading(null);
          }}
        />
      )}
      {earSolo && (
        <SoloEarworm cat={earSolo.cat} level={earSolo.level} onClose={() => setEarSolo(null)} />
      )}
      {poker && (
        <PokerSetup
          onClose={() => setPoker(false)}
          onOpen={async (friends, opts) => {
            setPoker(false);
            try {
              const id = await startPoker(friends, opts);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}
      {ludo && (
        <LudoLobby
          onClose={() => setLudo(false)}
          onStart={async (friends, bots) => {
            setLudo(false);
            if (!friends.length) {
              setSoloLudo(bots);
              return;
            }
            try {
              const id = await startLudo(friends, bots);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}

      {soloLudo !== null && (
        <LocalLudo
          me={{ id: s.me?.id ?? "me", name: me.name, avatar: me.avatar, initials: me.initials }}
          bots={soloLudo}
          onClose={() => setSoloLudo(null)}
        />
      )}

      {packs && (
        <Sheet title="Trivia: pick a topic" onClose={() => setPacks(false)}>
          <p className="meta mb-3">This week's topics · new ones {switchesIn()}</p>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
            {thisWeeksPacks().map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setPacks(false);
                    setPackFor(p);
                  }}
                  className="card w-full p-3.5 flex items-center gap-3 text-left"
                >
                  <PackIcon id={p.id} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-cream">{p.name}</span>
                    <span className="block meta truncate">
                      {bankSize(p.id)} questions · {p.tagline}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {wordMenu && (
        <Sheet title="Word Up" onClose={() => setWordMenu(false)}>
          <p className="text-cool text-[14px] leading-snug">
            Guess the 5-letter word in 6 tries. Green = right spot, yellow = wrong spot.
          </p>
          <div className="mt-4 grid gap-2.5">
            <button
              onClick={() => {
                setWordMenu(false);
                setWordDaily(true);
              }}
              className="btn-primary"
            >
              Today's word (same for everyone)
            </button>
            {live ? (
              <button
                onClick={() => {
                  setWordMenu(false);
                  void loadWords();
                  setSecret("");
                  setWordSheet(true);
                }}
                className="btn-secondary"
              >
                Set a secret word for a friend
              </button>
            ) : (
              <Link to="/login" className="btn-secondary">
                Set a word for a friend
              </Link>
            )}
          </div>
        </Sheet>
      )}

      {lobby && (
        <KachufulLobby
          onClose={() => setLobby(false)}
          onStart={async (friends, bots, length, scoring, turnSeconds) => {
            setLobby(false);
            if (live && friends.length) {
              try {
                const id = await startKachuful(friends, bots, length, scoring, turnSeconds);
                navigate({ to: "/app/play/$id", params: { id } });
              } catch (e) {
                setToast((e as Error).message);
              }
            } else {
              setLocalTable({ seats: [mySeat(), ...botSeats(bots)], length, scoring, turnSeconds });
            }
          }}
        />
      )}
      {localTable && (
        <LocalKachuful
          seats={localTable.seats}
          length={localTable.length}
          scoring={localTable.scoring}
          turnSeconds={localTable.turnSeconds}
          onClose={() => setLocalTable(null)}
        />
      )}

      {packFor && (
        <Sheet title={packFor.name} onClose={() => setPackFor(null)}>
          <p className="text-sm text-cool">{packFor.tagline} · 10 seconds a question.</p>
          <div className="mt-5 grid gap-3">
            <button
              onClick={() => {
                setSoloPack(packFor);
                setPackFor(null);
              }}
              className="rounded-full py-3.5 font-semibold"
              style={{ background: "var(--bg-surface)" }}
            >
              Play solo
            </button>
            {live ? (
              <button
                onClick={() => {
                  setChallengePack(packFor);
                  setPackFor(null);
                }}
                className="rounded-full py-3.5 btn-bronze"
              >
                Challenge someone from your 25
              </button>
            ) : (
              <Link to="/login" className="rounded-full py-3.5 btn-bronze text-center">
                Sign in to challenge a friend
              </Link>
            )}
          </div>
        </Sheet>
      )}
      {soloPack && <TriviaGame pack={soloPack} onClose={() => setSoloPack(null)} />}
      {challengePack && (
        <FriendPicker
          title="who are you challenging?"
          cta="Challenge"
          single
          onClose={() => setChallengePack(null)}
          onPick={async ([fid]) => {
            const friend = friendById(fid);
            const pack = challengePack;
            setChallengePack(null);
            if (!friend) return;
            try {
              const id = await startTriviaChallenge(pack.id, friend);
              void inviteToDuel(id, friend.id, pack.name);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}

      {daily && <DailyRunner game={gameFor(today())} onClose={() => setDaily(false)} />}
      {wordDaily && <WordDaily onClose={() => setWordDaily(false)} />}
      {tuneDaily && <DailyTune onClose={() => setTuneDaily(false)} />}
      {wordSheet && (
        <Sheet title="Set a secret word" onClose={() => setWordSheet(false)}>
          <p className="text-sm text-cool">
            Pick any real 5-letter word. Your friend gets 6 guesses, and you watch live.
          </p>
          <input
            value={secret}
            onChange={(e) =>
              setSecret(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z]/g, "")
                  .slice(0, WORD_LEN),
              )
            }
            placeholder="chaos"
            autoCapitalize="none"
            autoComplete="off"
            className="input mt-4 text-center uppercase tracking-[0.4em] text-2xl font-bold"
          />
          {secret.length === WORD_LEN && listReady && !inWordList(secret) && (
            <p className="meta mt-2 text-center" style={{ color: "var(--hot)" }}>
              Not in our word list. Try another.
            </p>
          )}
          <button
            disabled={secret.length !== WORD_LEN || !listReady || !inWordList(secret)}
            onClick={() => {
              setWordFor(secret);
              setWordSheet(false);
            }}
            className="btn-primary w-full mt-4"
          >
            Pick who guesses
          </button>
        </Sheet>
      )}
      {wordFor && (
        <FriendPicker
          title="who's guessing?"
          cta="Send the word"
          single
          onClose={() => setWordFor(null)}
          onPick={async ([fid]) => {
            const friend = friendById(fid);
            const word = wordFor;
            setWordFor(null);
            if (!friend) return;
            // Never send a word that isn't in the list.
            if (!(await checkWord(word))) return setToast("That word isn't in our word list.");
            try {
              const id = await startWordChallenge(friend, word);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}

/** Games home → the live games with your 25 (Judgement, Trivia, Ludo, Imposter, Word Up 1v1). */
