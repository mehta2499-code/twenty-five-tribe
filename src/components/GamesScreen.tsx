import { Tour } from "@/components/Tour";
import { DailyTune, EarwormSetup, SoloEarworm } from "@/components/Earworm";
import { pickGameSongs, type EarCat, type EarLevel, type EarState } from "@/lib/earworm";
import { ChessLobby, LocalChess } from "@/components/Chess";
import { PokerSetup } from "@/components/Poker";
import type { ChessState } from "@/lib/chess";
import type { PokerState } from "@/lib/poker";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { GameArt, type ArtKind } from "@/components/GameArt";
import { FriendPicker, PageBand, Sheet, Toast } from "@/components/SocialUI";
import { DailyRunner } from "@/components/ArcadeGames";
import { SeasonCard } from "@/components/Scoreboard";
import { TodaySection } from "@/components/DayResults";
import { WordDaily, isWord, loadWords, WORD_LEN } from "@/components/WordUp";
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

function GameTile({
  tone,
  art,
  title,
  badge,
  onClick,
  tour,
}: {
  tone: string;
  art: ArtKind;
  title: string;
  badge?: string;
  onClick: () => void;
  tour?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-tour={tour}
      className="rounded-[18px] px-2 py-3 flex flex-col items-center justify-center gap-1.5 text-center active:scale-95 transition-transform"
      style={{
        background: tone,
        color: "#fff",
        border: "2px solid rgba(255,255,255,0.12)",
        minHeight: 104,
      }}
    >
      {badge && (
        <span
          className="text-[9.5px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: "var(--lime)", color: "var(--on-accent)", letterSpacing: "0.04em" }}
        >
          {badge}
        </span>
      )}
      <GameArt kind={art} size={badge ? 38 : 44} />
      <span className="font-extrabold leading-tight" style={{ fontSize: 12.5 }}>
        {title}
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
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="label-caps">Play with your 25</h2>
          <span className="meta font-semibold" style={{ fontSize: 12.5 }}>
            8 games
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <GameTile
            tone="#2A3416"
            art="earworm"
            badge="NEW"
            title="Name That Tune"
            onClick={() => (live ? setEar(true) : setToast("Sign in to play."))}
          />
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
            try {
              const songs = await pickGameSongs(cat);
              const id = await startEarworm(friends, cat, level, songs);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
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
          {secret.length === WORD_LEN && !isWord(secret) && (
            <p className="meta mt-2 text-center">Not in our word list. Try another.</p>
          )}
          <button
            disabled={secret.length !== WORD_LEN || !isWord(secret)}
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
