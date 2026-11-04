import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { KachufulBoard, useBotTurns } from "@/components/Kachuful";
import { TriviaGame } from "@/components/TriviaGame";
import { clientOnly } from "@/components/SocialUI";
import { TRIVIA_PACKS } from "@/lib/data";
import { inviteToTrivia, useGame, type TriviaState } from "@/lib/games";
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
  const live = useGame<KState | TriviaState>(id);
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
  if (!game) return null;
  const pack = TRIVIA_PACKS.find((p) => p.id === game.state.pack) ?? TRIVIA_PACKS[0];
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

  if (mine) {
    // Already played: show where it stands.
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
        <p className="label-caps">
          {pack.emoji} {pack.name} · challenge
        </p>
        <h2 className="font-display mt-3" style={{ fontSize: 30 }}>
          {verdict}
        </h2>
        <p className="mt-6 text-2xl font-black tabular-nums text-cream">
          You {mine.score}/{total} · {opponent.name.split(" ")[0]}{" "}
          {theirs ? `${theirs.score}/${total}` : "?"}
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
