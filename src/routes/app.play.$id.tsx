import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { KachufulBoard, useBotTurns } from "@/components/Kachuful";
import { TriviaGame } from "@/components/TriviaGame";
import { LudoTable } from "@/components/Ludo";
import { moveToken, roll, skipTurn, type LudoState } from "@/lib/ludo";
import { TriviaDuel, duelMax } from "@/components/TriviaDuel";
import { clientOnly } from "@/components/SocialUI";
import { TRIVIA_PACKS } from "@/lib/data";
import {
  inviteToTrivia,
  saveTriviaResult,
  revealWord,
  useGame,
  type TriviaState,
  type WordState,
} from "@/lib/games";
import { MAX_GUESSES, WordBoard, gridOf } from "@/components/WordUp";
import { Confetti } from "@/components/SocialUI";
import { X } from "lucide-react";
import { applyMove, nextRound, type KState, type Move } from "@/lib/kachuful";
import { friendById, useSocial } from "@/lib/social";

export const Route = createFileRoute("/app/play/$id")({
  component: clientOnly(PlayScreen),
});

function PlayScreen() {
  const { id } = Route.useParams();
  const s = useSocial();
  const navigate = useNavigate();
  const close = () => navigate({ to: "/app/games" });

  if (s.mode !== "live" || !s.me) {
    return (
      <div className="px-6 pt-24 text-center">
        <p className="font-semibold text-cream">Sign in to join this game.</p>
        <Link to="/login" className="btn-bronze inline-block mt-5 px-6 py-3">
          Sign in
        </Link>
      </div>
    );
  }
  return <OnlineGame id={id} meId={s.me.id} onClose={close} />;
}

type Live<S> = ReturnType<typeof useGame<S>>;

function OnlineGame({ id, meId, onClose }: { id: string; meId: string; onClose: () => void }) {
  const live = useGame<KState | TriviaState | WordState | LudoState>(id);
  const { game, error } = live;
  if (error) {
    return (
      <div className="px-6 pt-24 text-center">
        <p className="font-semibold text-cream">{error}</p>
        <button onClick={onClose} className="btn-bronze mt-5 px-6 py-3">
          Back to games
        </button>
      </div>
    );
  }
  if (!game) return <p className="pt-24 text-center text-faint">Pulling up a chair…</p>;
  if (game.kind === "word")
    return <OnlineWord live={live as Live<WordState>} meId={meId} onClose={onClose} />;
  if (game.kind === "ludo")
    return <OnlineLudo live={live as Live<LudoState>} meId={meId} onClose={onClose} />;
  return game.kind === "kachuful" ? (
    <OnlineKachuful live={live as Live<KState>} meId={meId} onClose={onClose} />
  ) : (
    <OnlineTrivia live={live as Live<TriviaState>} id={id} meId={meId} onClose={onClose} />
  );
}

function OnlineKachuful({
  live,
  meId,
  onClose,
}: {
  live: Live<KState>;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  const state = game?.state ?? null;
  const isHost = game?.host === meId;

  const commit = useCallback(
    (next: KState) => void save(next, next.phase === "over" ? "done" : undefined),
    [save],
  );
  // The host's phone plays for the bots, so only one phone moves them.
  useBotTurns(state, isHost, commit);

  if (!game || !state) return null;
  const mySeat = state.seats.findIndex((p) => p.id === meId);
  const waitingOn = state.seats[state.turn];
  const note =
    !isHost && waitingOn?.bot
      ? `Bots play from ${state.seats.find((p) => p.id === game.host)?.name.split(" ")[0] ?? "the host"}'s phone.`
      : undefined;

  return (
    <KachufulBoard
      state={state}
      mySeat={mySeat}
      note={note}
      onMove={(m: Move) => commit(applyMove(state, m))}
      onNext={() => commit(nextRound(state))}
      onClose={onClose}
    />
  );
}

function OnlineTrivia({
  live,
  id,
  meId,
  onClose,
}: {
  live: Live<TriviaState>;
  id: string;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  const s = useSocial();
  if (!game) return null;
  const pack = TRIVIA_PACKS.find((p) => p.id === game.state.pack) ?? TRIVIA_PACKS[0];
  const isLive = game.state.mode === "live";
  const otherId = game.players.find((p) => p !== meId)!;
  const other = friendById(otherId);
  const mine = game.state.results[meId];
  const theirs = game.state.results[otherId];
  const opponent = {
    name: other?.name ?? "Your friend",
    avatar: other?.avatar || undefined,
    initials: other?.initials ?? "?",
    color: other?.color,
    score: theirs?.score,
  };

  const saveResult = (r: { score: number; total: number; correct?: number; points?: number }) =>
    saveTriviaResult(id, meId, { ...r, at: Date.now() }).then(() => live.reload());

  // Live duel: both play at the same time.
  if (isLive && !mine && !theirs) {
    const meP = {
      id: meId,
      name: s.me?.name ?? "You",
      avatar: s.me?.avatar,
      initials: s.me?.initials ?? "YO",
    };
    return (
      <TriviaDuel
        gameId={id}
        pack={pack}
        seed={game.state.seed ?? 1}
        me={meP}
        them={{ id: otherId, ...opponent }}
        isHost={game.host === meId}
        onClose={onClose}
        onPlayLater={() => void save({ ...game.state, mode: "async" })}
        onFinish={(r) =>
          void saveResult({
            score: r.points,
            total: duelMax(),
            correct: r.correct,
            points: r.points,
          })
        }
      />
    );
  }

  if (mine || (isLive && theirs)) {
    // Already played (or the duel is over): show where it stands.
    if (!mine) {
      return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
          <p className="label-caps">{pack.name} · duel</p>
          <h2 className="font-display mt-3" style={{ fontSize: 30 }}>
            You missed this duel
          </h2>
          <p className="mt-4 text-cool">
            {opponent.name.split(" ")[0]} scored {theirs!.score}. Challenge them back 😤
          </p>
          <button onClick={onClose} className="mt-10 btn-primary px-8">
            Back to games
          </button>
        </div>
      );
    }
    const total = mine.total;
    const verdict =
      theirs === undefined
        ? `Waiting for ${opponent.name.split(" ")[0]} to play.`
        : mine.score > theirs.score
          ? "You won this one."
          : mine.score === theirs.score
            ? "It's a tie."
            : `${opponent.name.split(" ")[0]} won this one.`;
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
        <p className="label-caps">{pack.name} · challenge</p>
        <h2 className="font-display mt-3" style={{ fontSize: 30 }}>
          {verdict}
        </h2>
        <p className="mt-6 text-2xl font-black tabular-nums text-cream">
          {mine.points !== undefined
            ? `You ${mine.score} pts · ${opponent.name.split(" ")[0]} ${theirs ? `${theirs.score} pts` : "?"}`
            : `You ${mine.score}/${total} · ${opponent.name.split(" ")[0]} ${theirs ? `${theirs.score}/${total}` : "?"}`}
        </p>
        <button onClick={onClose} className="mt-10 btn-bronze px-8 py-3.5">
          Back to games
        </button>
      </div>
    );
  }

  return (
    <TriviaGame
      pack={pack}
      seed={game.state.seed ?? 1}
      opponent={opponent}
      onClose={onClose}
      onFinish={(score, total) => {
        const results = { ...game.state.results, [meId]: { score, total, at: Date.now() } };
        const everyone = game.players.every((p) => results[p]);
        void save({ ...game.state, results }, everyone ? "done" : undefined).then(() => {
          if (game.host === meId && !theirs)
            void inviteToTrivia(id, otherId, score, total, pack.name);
        });
      }}
    />
  );
}

function OnlineWord({
  live,
  meId,
  onClose,
}: {
  live: Live<WordState>;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  if (!game) return null;
  const st = game.state;
  const answer = revealWord(st.hidden);
  const guessing = st.guesser === meId;
  const other = friendById(guessing ? st.setter : st.guesser);
  const first = other?.name.split(" ")[0] ?? "Your friend";
  const solved = st.guesses.includes(answer);
  const over = solved || st.guesses.length >= MAX_GUESSES;

  const guess = (g: string) => {
    const next = { ...st, guesses: [...st.guesses, g] };
    const done = g === answer || next.guesses.length >= MAX_GUESSES;
    void save(next, done ? "done" : undefined);
  };

  const headline = over
    ? guessing
      ? solved
        ? `Got it in ${st.guesses.length}/6 😎`
        : `It was ${answer.toUpperCase()} 💀`
      : solved
        ? `${first} cracked it in ${st.guesses.length}/6`
        : `${first} couldn't get it 😈`
    : guessing
      ? `${first} set you a word`
      : `Watching ${first} guess ${answer.toUpperCase()} 👀`;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="mx-auto w-full max-w-md min-h-full flex flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="heading">Word Up 🔤</p>
            <p className="meta">{headline}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-cool">
            <X size={22} />
          </button>
        </header>
        <div className="mt-5">
          <WordBoard
            answer={answer}
            guesses={st.guesses}
            onGuess={guess}
            readOnly={!guessing || over}
          />
        </div>
        {!guessing && !over && (
          <p className="meta text-center mt-4">{st.guesses.length}/6 guesses used. Updates live.</p>
        )}
        {over && (
          <div className="text-center mt-6">
            <pre className="text-[20px] leading-tight">{gridOf(st.guesses, answer)}</pre>
            <button onClick={onClose} className="btn-primary mt-5 px-6">
              Back to games
            </button>
          </div>
        )}
      </div>
      <Confetti fire={over && solved && guessing ? 1 : 0} />
    </div>
  );
}

function OnlineLudo({
  live,
  meId,
  onClose,
}: {
  live: Live<LudoState>;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  if (!game) return null;
  const st = game.state;
  const mine = st.players.findIndex((p) => p.id === meId);
  const commit = (next: LudoState) => void save(next, next.phase === "over" ? "done" : undefined);
  return (
    <LudoTable
      state={st}
      mine={mine}
      onRoll={() => commit(roll(st))}
      onMove={(t) => commit(moveToken(st, t))}
      onSkip={() => commit(skipTurn(st))}
      onClose={onClose}
    />
  );
}
