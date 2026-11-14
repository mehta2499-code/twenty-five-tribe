import { Tour } from "@/components/Tour";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  CircleHelp,
  X,
  Dices,
  Gamepad2,
  Spade,
  Trophy,
  Type,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt, type ArtKind } from "@/components/GameArt";
import {
  Confetti,
  FriendPicker,
  PageBand,
  Sheet,
  Toast,
  buzz,
  clientOnly,
} from "@/components/SocialUI";
import { DailyRunner, GAMES } from "@/components/ArcadeGames";
import { Scoreboard } from "@/components/Scoreboard";
import { WordDaily, isWord, loadWords, WORD_LEN } from "@/components/WordUp";
import { LINEUP, TRIES, gameFor, today, useDaily, type DailyId, dayGameName } from "@/lib/daily";
import { KachufulLobby, LocalKachuful } from "@/components/Kachuful";
import { LocalLudo, LudoLobby } from "@/components/Ludo";
import type { LudoState } from "@/lib/ludo";
import type { Length } from "@/lib/kachuful";
import type { ImpState } from "@/lib/imposter";
import { TriviaGame } from "@/components/TriviaGame";
import { PackIcon } from "@/components/PackIcon";
import { TRIVIA_PACKS, thisWeeksPacks, type TriviaPack } from "@/lib/data";
import { switchesIn } from "@/lib/triviaWeeks";
import { ROUND, bankSize } from "@/lib/trivia";
import {
  botSeats,
  listMyGames,
  seatFor,
  startKachuful,
  inviteToDuel,
  quitGame,
  startLudo,
  startParty,
  startTriviaChallenge,
  startWordChallenge,
  type GameRow,
  type TriviaState,
  type WordState,
} from "@/lib/games";
import type { KState, Scoring, Seat } from "@/lib/kachuful";
import { friendById, meView, useSocial } from "@/lib/social";

export const Route = createFileRoute("/app/games")({
  component: clientOnly(Games),
});

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
  return (
    <section className="mt-7">
      <div className="px-5 flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-semibold text-cream">Your games</h2>
        <span className="meta">{open.length} in progress</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {open.map((g) => {
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
            status = yourTurn
              ? "Your turn"
              : turn
                ? `${turn.name.split(" ")[0]}'s turn`
                : "In play";
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
            status = yourTurn
              ? "Your turn"
              : `Waiting for ${others[0]?.name.split(" ")[0] ?? "them"}`;
          }
          if (confirm === g.id)
            return (
              <div key={g.id} className="shrink-0 w-56 card p-4 flex flex-col justify-between">
                <p className="font-semibold text-cream text-sm">Quit {title}?</p>
                <p className="meta mt-1" style={{ fontSize: 12 }}>
                  {g.kind === "kachuful" ? "A bot takes your seat." : "You can't come back to it."}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setConfirm(null)}
                    className="btn-secondary flex-1"
                    style={{ minHeight: 38 }}
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => void remove(g)}
                    className="btn-danger flex-1"
                    style={{ minHeight: 38 }}
                  >
                    Quit
                  </button>
                </div>
              </div>
            );
          return (
            <Link
              key={g.id}
              to="/app/play/$id"
              params={{ id: g.id }}
              className="shrink-0 w-56 card p-4 text-left hover:bg-[var(--fill)] relative"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-cream text-sm truncate">{title}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirm(g.id);
                  }}
                  aria-label={`Quit ${title}`}
                  className="w-7 h-7 -mr-1.5 -mt-1 rounded-full flex items-center justify-center text-cool shrink-0 hover:bg-[var(--fill-2)]"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="mt-3 flex -space-x-2">
                {others.slice(0, 5).map((f) => (
                  <span key={f!.id} className="rounded-full" style={{ outline: "2px solid #fff" }}>
                    <Avatar
                      src={f!.avatar || undefined}
                      initials={f!.initials}
                      color={f!.color}
                      size={28}
                    />
                  </span>
                ))}
              </div>
              <p
                className="mt-3 text-[13px] font-semibold"
                style={{ color: yourTurn ? "var(--coral-deep)" : "var(--text-muted)" }}
              >
                {status}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function GameTile({
  tone,
  light,
  Icon,
  art,
  sticker,
  title,
  line,
  tilt,
  onClick,
  wide,
  outline,
  tour,
  tall,
}: {
  /** Bigger tile (today's game). */
  tall?: boolean;
  wide?: boolean;
  tone: string;
  light?: boolean;
  Icon: LucideIcon;
  /** Coloured illustration; falls back to the line icon. */
  art?: ArtKind;
  sticker: string;
  title: string;
  line: string;
  tilt: number;
  onClick: () => void;
  /** Coloured outline on a dark tile (instead of a coloured fill). */
  outline?: string;
  tour?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-tour={tour}
      className={`rounded-[24px] p-4 text-left flex flex-col active:scale-95 transition-transform ${wide ? "col-span-2" : ""}`}
      style={{
        background: tone,
        color: light ? "var(--ink)" : "var(--on-accent)",
        border: outline ? `1.5px solid ${outline}` : "var(--bd)",
        boxShadow: outline ? "0 4px 0 rgba(193, 239, 98, 0.35), var(--soft)" : "var(--pop-lg)",
        transform: `rotate(${tilt}deg)`,
        minHeight: tall ? 250 : 178,
      }}
    >
      <span
        className="self-start text-[10.5px] font-extrabold px-2 py-0.5 rounded-full"
        style={{
          background: light ? "var(--lime)" : "var(--edge)",
          color: light ? "var(--on-accent)" : "#fff",
        }}
      >
        {sticker}
      </span>
      {art ? (
        <span className="mt-3 -ml-1" aria-hidden="true">
          <GameArt kind={art} size={tall ? 92 : 60} />
        </span>
      ) : (
        <span
          className="mt-3 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: light ? "var(--lime)" : "rgba(255,255,255,0.45)",
            color: "var(--on-accent)",
            border: "var(--bd)",
            transform: "rotate(-6deg)",
          }}
          aria-hidden="true"
        >
          <Icon size={30} strokeWidth={2.25} />
        </span>
      )}
      <span className="display mt-auto pt-2" style={{ fontSize: 22, lineHeight: 1.05 }}>
        {title}
      </span>
      <span className="text-[12.5px] font-semibold leading-snug mt-1 opacity-85">{line}</span>
    </button>
  );
}

/** Today's game starts as a mystery: tap to spin and reveal it, tap again to play. */
function MysteryTile({ left, onPlay }: { left: number; onPlay: () => void }) {
  const day = today();
  const key = `tf.reveal.${day}`;
  const game = GAMES[gameFor(day)];
  const [revealed, setRevealed] = useState(() => {
    try {
      return localStorage.getItem(key) === "1" || left < TRIES;
    } catch {
      return false;
    }
  });
  const [spinning, setSpinning] = useState(false);
  const [face, setFace] = useState<DailyId>(gameFor(day));
  const [party, setParty] = useState(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    buzz(10);
    // Slot machine: fast, then slower, landing on today's game.
    const target = LINEUP.indexOf(gameFor(day));
    const total = LINEUP.length * 3 + target;
    let t = 0;
    for (let k = 0; k <= total; k++) {
      t += 45 + Math.pow(k / total, 3) * 260;
      const g = LINEUP[k % LINEUP.length];
      setTimeout(() => {
        setFace(g);
        buzz(4);
        if (k === total) {
          setSpinning(false);
          setRevealed(true);
          setParty((n) => n + 1);
          buzz(40);
          try {
            localStorage.setItem(key, "1");
          } catch {
            // ignore
          }
        }
      }, t);
    }
  };

  if (!revealed || spinning) {
    const g = GAMES[face];
    return (
      <button
        onClick={spin}
        data-tour="daily"
        className="col-span-2 rounded-[24px] p-4 text-left flex flex-col active:scale-[0.98] transition-transform relative overflow-hidden"
        style={{
          background: "var(--surface)",
          color: "var(--ink)",
          border: "1.5px solid var(--lime)",
          boxShadow: "0 4px 0 rgba(193, 239, 98, 0.35), var(--soft)",
          minHeight: 250,
        }}
      >
        <span
          className="self-start text-[11px] font-extrabold px-2.5 py-0.5 rounded-full"
          style={{ background: "var(--lime)", color: "var(--on-accent)" }}
        >
          {spinning ? "SPINNING…" : "TODAY · TAP TO REVEAL"}
        </span>
        <span className="flex-1 flex items-center justify-center gap-4 py-2">
          {spinning ? (
            <span key={face} className="shrink-0 slot-tick" aria-hidden="true">
              <GameArt kind={face} size={76} />
            </span>
          ) : (
            <span className="shrink-0" aria-hidden="true">
              <GameArt kind="mystery" size={76} />
            </span>
          )}
          <span
            className="display min-w-0"
            style={{ fontSize: "clamp(19px, 6.8vw, 32px)", lineHeight: 1.05 }}
          >
            {spinning ? g.name : dayGameName(day)}
          </span>
        </span>
        <span className="text-[12.5px] font-semibold opacity-80">
          A new one every day. Best of 3 counts.
        </span>
      </button>
    );
  }
  return (
    <>
      <GameTile
        tone="var(--surface)"
        light
        outline="var(--lime)"
        tour="daily"
        Icon={game.Icon}
        art={gameFor(day)}
        sticker={`${dayGameName(day).toUpperCase()} · ${left > 0 ? `${left} ${left === 1 ? "TRY" : "TRIES"} LEFT` : "DONE"}`}
        title={game.name}
        line={game.blurb}
        tilt={-0.8}
        wide
        tall
        onClick={onPlay}
      />
      <Confetti fire={party} />
    </>
  );
}

function Games() {
  const s = useSocial();
  const navigate = useNavigate();
  const live = s.mode === "live" && !!s.me;
  useDaily();
  const [daily, setDaily] = useState(false);
  const [wordDaily, setWordDaily] = useState(false);
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
  const [tab, setTab] = useState<"play" | "scores">("play");
  const [packs, setPacks] = useState(false);
  const [ludo, setLudo] = useState(false);
  const [soloLudo, setSoloLudo] = useState<number | null>(null);
  const [wordMenu, setWordMenu] = useState(false);
  const dailyState = useDaily();
  const todayGame = GAMES[gameFor(today())];
  const dailyLeft = TRIES - (dailyState.board[today()]?.me ?? []).length;

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
            at: '[data-tour="daily"]',
            title: "A new game every day",
            body: "Same mini game for everyone in your 25. Best of 3 tries counts. Win the day, climb the week.",
          },
          {
            at: 'section[aria-label="All games"]',
            title: "Play live with your 25",
            body: "Judgement, Trivia duels, Ludo and Word Up. Invite friends, chat and react while you play.",
          },
          {
            at: '[data-tour="imposter"]',
            title: "Together in a room? Imposter",
            body: "A party game for 4 to 20. Share the link and anyone can join, even if they're new to 25.",
          },
          {
            at: 'div[role="tablist"][aria-label="Games"]',
            title: "Scores",
            body: "Weekly and all-time tables, Word Up and Trivia boards. Bragging rights live here.",
          },
        ]}
      />
      <PageBand ring title="Games" sub="Pick one. Your 25 is waiting." />

      <div className="px-5">
        <div className="segmented w-full" role="tablist" aria-label="Games">
          <button
            className="flex-1 gap-1.5"
            role="tab"
            aria-pressed={tab === "play"}
            onClick={() => setTab("play")}
          >
            <Gamepad2 size={16} aria-hidden="true" /> Play
          </button>
          <button
            className="flex-1 gap-1.5"
            role="tab"
            aria-pressed={tab === "scores"}
            onClick={() => setTab("scores")}
          >
            <Trophy size={16} aria-hidden="true" /> Scores
          </button>
        </div>
      </div>

      {tab === "play" ? (
        <>
          {live && <YourGames meId={s.me!.id} />}

          <section className="px-5 mt-6 grid grid-cols-2 gap-3.5" aria-label="All games">
            <MysteryTile left={dailyLeft} onPlay={() => setDaily(true)} />
            <GameTile
              tone="#2B2736"
              light
              Icon={Spade}
              art="kachuful"
              sticker="2–7 PLAYERS"
              title="Judgement"
              line="Call your tricks. Nail them."
              tilt={1.5}
              onClick={() => setLobby(true)}
            />
            <GameTile
              tone="var(--sky)"
              Icon={Zap}
              art="trivia"
              sticker="LIVE DUEL"
              title="Trivia"
              line="Same questions, same time. Fastest wins."
              tilt={1.2}
              onClick={() => setPacks(true)}
            />
            <GameTile
              tone="var(--pink)"
              Icon={Dices}
              art="ludo"
              sticker="LIVE · 2–4"
              title="Ludo"
              line="Roll, race, capture. Send them home."
              tilt={-1}
              onClick={() => setLudo(true)}
            />
            <GameTile
              tone="var(--sun)"
              Icon={Type}
              art="word"
              sticker="DAILY WORD"
              title="Word Up"
              line="Guess it in 6, or set one for a friend."
              tilt={-1.2}
              onClick={() => setWordMenu(true)}
            />
            <GameTile
              wide
              tone="var(--sky)"
              Icon={Users}
              art="imposter"
              tour="imposter"
              sticker="PARTY · 4–20"
              title="Imposter"
              line="Everyone knows the word except the imposter. Give clues, vote them out. Best with the whole group."
              tilt={0.6}
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
          </section>

          <p className="text-center meta px-6 pt-8 pb-2">Only your mutual 25 see your scores.</p>
        </>
      ) : (
        <>
          <Scoreboard />
        </>
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
