import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, PageBand, Sheet, Toast, clientOnly } from "@/components/SocialUI";
import { DailyRunner, GAMES } from "@/components/ArcadeGames";
import { Scoreboard } from "@/components/Scoreboard";
import { WordDaily, isWord, loadWords, WORD_LEN } from "@/components/WordUp";
import { TRIES, gameFor, today, useDaily } from "@/lib/daily";
import { KachufulLobby, LocalKachuful } from "@/components/Kachuful";
import { LocalLudo, LudoLobby } from "@/components/Ludo";
import type { LudoState } from "@/lib/ludo";
import { TriviaGame } from "@/components/TriviaGame";
import { PackIcon } from "@/components/PackIcon";
import { TRIVIA_PACKS, type TriviaPack } from "@/lib/data";
import { ROUND, bankSize } from "@/lib/trivia";
import {
  botSeats,
  listMyGames,
  seatFor,
  startKachuful,
  inviteToDuel,
  startLudo,
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
  // Hide games that are over, and trivia you've already played (the result comes in chat).
  const open = (games ?? []).filter(
    (g) =>
      g.status === "playing" && !(g.kind === "trivia" && (g.state as TriviaState).results[meId]),
  );
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
            title = `Kachuful · round ${k.round + 1}/${k.plan.length}`;
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
                ? "Waiting room ⏳"
                : yourTurn
                  ? "Your turn 🎲"
                  : `${turn?.name.split(" ")[0] ?? "Their"}'s turn`;
          } else if (g.kind === "word") {
            const w = g.state as WordState;
            const guessing = w.guesser === meId;
            yourTurn = guessing;
            title = guessing ? "Word Up · your word" : "Word Up · you set it";
            status = guessing
              ? `Your turn · ${w.guesses.length}/6`
              : `${others[0]?.name.split(" ")[0] ?? "They"}'re on ${w.guesses.length}/6 👀`;
          } else {
            const t = g.state as TriviaState;
            const pack = TRIVIA_PACKS.find((p) => p.id === t.pack);
            yourTurn = !t.results[meId];
            title = `${pack?.name ?? "Trivia"} challenge`;
            status = yourTurn
              ? "Your turn"
              : `Waiting for ${others[0]?.name.split(" ")[0] ?? "them"}`;
          }
          return (
            <Link
              key={g.id}
              to="/app/play/$id"
              params={{ id: g.id }}
              className="shrink-0 w-56 card p-4 text-left hover:bg-[var(--fill)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-cream text-sm truncate">{title}</span>
                <ChevronRight size={16} className="text-bronze shrink-0" />
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
  emoji,
  sticker,
  title,
  line,
  tilt,
  onClick,
  wide,
}: {
  wide?: boolean;
  tone: string;
  light?: boolean;
  emoji: string;
  sticker: string;
  title: string;
  line: string;
  tilt: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[22px] p-4 text-left flex flex-col active:scale-95 transition-transform ${wide ? "col-span-2" : ""}`}
      style={{
        background: tone,
        color: light ? "var(--ink)" : "var(--on-accent)",
        border: "2px solid var(--edge)",
        boxShadow: "4px 4px 0 var(--edge)",
        transform: `rotate(${tilt}deg)`,
        minHeight: 178,
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
      <span className="text-5xl mt-3 float" aria-hidden="true">
        {emoji}
      </span>
      <span className="display mt-auto pt-2" style={{ fontSize: 22, lineHeight: 1.05 }}>
        {title}
      </span>
      <span className="text-[12.5px] font-semibold leading-snug mt-1 opacity-85">{line}</span>
    </button>
  );
}

function Games() {
  const s = useSocial();
  const navigate = useNavigate();
  const live = s.mode === "live" && !!s.me;
  useDaily();
  const [daily, setDaily] = useState(false);
  const [wordDaily, setWordDaily] = useState(false);
  const [wordSheet, setWordSheet] = useState(false);
  const [secret, setSecret] = useState("");
  const [wordFor, setWordFor] = useState<string | null>(null);
  const [lobby, setLobby] = useState(false);
  const [localTable, setLocalTable] = useState<{
    seats: Seat[];
    length: "short" | "full";
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
      <PageBand title="Games" sub="Pick one. Your 25 is waiting." />

      <div className="px-5">
        <div className="segmented w-full" role="tablist" aria-label="Games">
          <button
            className="flex-1"
            role="tab"
            aria-pressed={tab === "play"}
            onClick={() => setTab("play")}
          >
            🎮 Play
          </button>
          <button
            className="flex-1"
            role="tab"
            aria-pressed={tab === "scores"}
            onClick={() => setTab("scores")}
          >
            🏆 Scores
          </button>
        </div>
      </div>

      {tab === "play" ? (
        <>
          {live && <YourGames meId={s.me!.id} />}

          <section className="px-5 mt-6 grid grid-cols-2 gap-3.5" aria-label="All games">
            <GameTile
              tone="var(--lime)"
              emoji={todayGame.emoji}
              sticker={
                dailyLeft > 0
                  ? `NEW TODAY · ${dailyLeft} ${dailyLeft === 1 ? "try" : "tries"}`
                  : "DONE TODAY ✅"
              }
              title={todayGame.name}
              line="Today's game. Best of 3 counts."
              tilt={-0.8}
              wide
              onClick={() => setDaily(true)}
            />
            <GameTile
              tone="#1F1B2B"
              light
              emoji="🃏"
              sticker="2–7 PLAYERS"
              title="Kachuful"
              line="Call your tricks. Nail them."
              tilt={1.5}
              onClick={() => setLobby(true)}
            />
            <GameTile
              tone="var(--sky)"
              emoji="⚡"
              sticker="LIVE DUEL"
              title="Trivia"
              line="Same questions, same time. Fastest wins."
              tilt={1.2}
              onClick={() => setPacks(true)}
            />
            <GameTile
              tone="var(--pink)"
              emoji="🎲"
              sticker="LIVE · 2–4"
              title="Ludo"
              line="Roll, race, capture. Send them home."
              tilt={-1}
              onClick={() => setLudo(true)}
            />
            <GameTile
              tone="var(--sun)"
              emoji="🔤"
              sticker="DAILY WORD"
              title="Word Up"
              line="Guess it in 6, or set one for a friend."
              tilt={-1.2}
              onClick={() => setWordMenu(true)}
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
        <Sheet title="⚡ Trivia: pick a pack" onClose={() => setPacks(false)}>
          <ul className="grid gap-2.5">
            {TRIVIA_PACKS.filter((p) => p.price === "Free").map((p) => (
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
        <Sheet title="🔤 Word Up" onClose={() => setWordMenu(false)}>
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
                Set a secret word for a friend 😈
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
          onStart={async (friends, bots, length, scoring) => {
            setLobby(false);
            if (live && friends.length) {
              try {
                const id = await startKachuful(friends, bots, length, scoring);
                navigate({ to: "/app/play/$id", params: { id } });
              } catch (e) {
                setToast((e as Error).message);
              }
            } else {
              setLocalTable({ seats: [mySeat(), ...botSeats(bots)], length, scoring });
            }
          }}
        />
      )}
      {localTable && (
        <LocalKachuful
          seats={localTable.seats}
          length={localTable.length}
          scoring={localTable.scoring}
          onClose={() => setLocalTable(null)}
        />
      )}

      {packFor && (
        <Sheet title={packFor.name} onClose={() => setPackFor(null)}>
          <p className="text-sm text-cool">{packFor.tagline} 10 seconds a question.</p>
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
