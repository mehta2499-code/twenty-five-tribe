import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, PageBand, Sheet, Toast, clientOnly } from "@/components/SocialUI";
import { DailyRunner } from "@/components/ArcadeGames";
import { DailyHero, TodayTable, WeekTable } from "@/components/DailyBoard";
import { WordDaily, isWord, loadWords, WORD_LEN } from "@/components/WordUp";
import { gameFor, today, useDaily } from "@/lib/daily";
import { KachufulLobby, LocalKachuful } from "@/components/Kachuful";
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
      <PageBand
        title="Games"
        sub="A new game every day. 3 tries, best one counts. Bragging rights reset Monday."
      />

      <DailyHero onPlay={() => setDaily(true)} />

      {live && <YourGames meId={s.me!.id} />}

      <TodayTable />
      <WeekTable />

      <div className="px-5 mt-10">
        <h2 className="heading" style={{ fontSize: 22 }}>
          Play anytime 🃏
        </h2>
        <p className="meta mt-0.5">No limits. Just you and your 25.</p>
      </div>

      {/* Kachuful */}
      <section className="px-5 mt-4">
        <button
          onClick={() => setLobby(true)}
          className="w-full text-left p-5 relative overflow-hidden band"
          style={{ borderRadius: 20 }}
        >
          <span className="label-caps">Most played in India</span>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {["♠", "♦", "♣", "♥"].map((x, i) => (
              <span
                key={x}
                className="w-10 h-14 rounded-lg bg-white flex items-center justify-center text-2xl font-bold"
                style={{
                  color: i % 2 ? "#C8364F" : "#17130F",
                  transform: `rotate(${(i - 1.5) * 6}deg)`,
                }}
              >
                {x}
              </span>
            ))}
          </div>
          <h3 className="mt-4 font-display" style={{ fontSize: 28 }}>
            Kachuful
          </h3>
          <p className="sub mt-1" style={{ fontSize: 14, lineHeight: 1.5 }}>
            Also called Judgement. Call your tricks, then win exactly that many. 3 to 7 players;
            bots fill empty seats.
          </p>
          <span className="mt-4 inline-block btn-cream px-5 py-2.5" style={{ fontSize: 14 }}>
            Deal me in →
          </span>
        </button>
      </section>

      {/* Word Up */}
      <section className="px-5 mt-4">
        <div className="card p-5">
          <div className="flex gap-1" aria-hidden="true">
            {["W", "O", "R", "D"].map((l, i) => (
              <span
                key={l}
                className="w-9 h-9 rounded-lg flex items-center justify-center display"
                style={{
                  border: "2px solid var(--edge)",
                  background: ["var(--lime)", "var(--sun)", "var(--fill-2)", "var(--lime)"][i],
                  color: i === 2 ? "var(--ink)" : "var(--on-accent)",
                  transform: `rotate(${[-4, 3, -2, 4][i]}deg)`,
                }}
              >
                {l}
              </span>
            ))}
          </div>
          <h3 className="heading mt-3" style={{ fontSize: 24 }}>
            Word Up
          </h3>
          <p className="text-cool mt-1 text-[14px] leading-snug">
            Guess the 5-letter word in 6. One daily word for everyone, or set a secret word for a
            friend and watch them struggle live 😈
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button onClick={() => setWordDaily(true)} className="btn-primary">
              Today's word
            </button>
            {live ? (
              <button
                onClick={() => {
                  void loadWords();
                  setSecret("");
                  setWordSheet(true);
                }}
                className="btn-secondary"
              >
                Set a word
              </button>
            ) : (
              <Link to="/login" className="btn-secondary">
                Set a word
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Trivia */}
      <section className="mt-6">
        <div className="px-5 flex items-baseline justify-between mb-2.5">
          <h2 className="text-[15px] font-semibold text-cream">India trivia</h2>
          <span className="meta">Solo or challenge a friend</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
          {TRIVIA_PACKS.map((p) => {
            const free = p.price === "Free";
            const count = bankSize(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setPackFor(p)}
                disabled={!free}
                aria-label={free ? `${p.name}, ${count} questions` : `${p.name}, coming soon`}
                className="shrink-0 w-44 overflow-hidden text-left card"
                style={{ opacity: free ? 1 : 0.6 }}
              >
                <div className="p-4 h-32 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <PackIcon id={p.id} />
                    {!free && (
                      <span className="chip" style={{ minHeight: 24, fontSize: 12 }}>
                        Coming soon
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-cream" style={{ fontSize: 16 }}>
                      {p.name}
                    </div>
                    <div className="meta mt-0.5 line-clamp-2" style={{ fontSize: 12.5 }}>
                      {ROUND} of {count} questions · {p.tagline}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <p className="text-center meta px-6 pt-8 pb-2">Only your mutual 25 see your scores.</p>

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
