import { GameOverBoard } from "@/components/Leaderboard";
import { gameLabel, useDoing } from "@/lib/status";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { KachufulBoard, useBotTurns } from "@/components/Kachuful";
import { TriviaGame } from "@/components/TriviaGame";
import { LudoTable, LudoWaiting, useLudoBots } from "@/components/Ludo";
import {
  beginLudo,
  joinLudo,
  leaveLobby,
  ludoDriver,
  moveToken,
  resign,
  roll,
  skipTurn,
  waitingFor,
  type LudoState,
} from "@/lib/ludo";
import { TriviaDuel, duelMax } from "@/components/TriviaDuel";
import { Sheet, clientOnly } from "@/components/SocialUI";
import { TRIVIA_PACKS } from "@/lib/data";
import {
  changeLatest,
  inviteToTrivia,
  joinParty,
  leaveGame,
  type GameRow,
  saveTriviaResult,
  revealWord,
  useGame,
  type TriviaState,
  type WordState,
} from "@/lib/games";
import { MAX_GUESSES, WordBoard, gridOf } from "@/components/WordUp";
import { Confetti } from "@/components/SocialUI";
import { Dices, Flag, X } from "lucide-react";
import {
  applyMove,
  kachufulDriver,
  nextRound,
  quitSeat,
  type KState,
  type Move,
} from "@/lib/kachuful";
import { _get, friendById, personView, useSocial } from "@/lib/social";
import { GameChat } from "@/components/GameChat";
import { ImposterGame } from "@/components/Imposter";
import type { ImpState } from "@/lib/imposter";
import { ChessTable } from "@/components/Chess";
import { Connect4Table, Connect4Waiting } from "@/components/Connect4";
import { PenTable, PenWaiting } from "@/components/PenFight";
import {
  applyShot,
  beginPenFight,
  endSetup,
  markReady,
  penStarted,
  placePen,
  resignPen,
  skipTurn as skipPenTurn,
  type PenState,
} from "@/lib/penfight";
import { loadPenWins, myPenId, unlockNote } from "@/lib/penSkins";
import { c4Started, dropDisc, resignC4, type C4State } from "@/lib/connect4";
import { PokerTable, PokerWaiting } from "@/components/Poker";
import { claimTimeout, makeMove, resign as resignChess, type ChessState } from "@/lib/chess";
import {
  act as pokerAct,
  beginPoker,
  foldAway,
  joinPoker,
  leave as leavePoker,
  standUp,
  startHand,
  type PokerState,
} from "@/lib/poker";
import {
  endSongEarly,
  finishLiveEarworm,
  inviteToPoker,
  joinEarworm,
  pickEarworm,
  quitGame,
  saveEarworm,
  startChess,
  startConnect4,
  startPenFight,
  startLiveEarworm,
} from "@/lib/games";
import { EarwormLobby, EarwormPlay, EarwormStandings, type LiveCtl } from "@/components/Earworm";
import {
  COUNTDOWN_MS,
  liveActive,
  liveAt,
  liveResults,
  serverNow,
  syncClock,
  type EarState,
} from "@/lib/earworm";

export const Route = createFileRoute("/app/play/$id")({
  component: clientOnly(PlayScreen),
});

function PlayScreen() {
  const { id } = Route.useParams();
  const s = useSocial();
  const navigate = useNavigate();
  const close = () => navigate({ to: "/app/arcade" });

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
  const live = useGame<
    | KState
    | TriviaState
    | WordState
    | LudoState
    | ImpState
    | ChessState
    | PokerState
    | EarState
    | C4State
    | PenState
  >(id);
  const { game, error } = live;
  // Your 25 see you playing at the Table.
  useDoing(game ? { doing: "game", detail: gameLabel(game.kind), ref: `game:${id}` } : null);
  const [leaving, setLeaving] = useState(false);
  // Opened a party link you're not in yet: join it, then load.
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    if (!error || joining || joinError) return;
    setJoining(true);
    joinParty(id)
      .then(() => live.reload())
      .catch((e: Error) => setJoinError(/doesn't exist/.test(e.message) ? error : e.message))
      .finally(() => setJoining(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  if (error && !joinError) return <p className="pt-24 text-center text-faint">Getting you in…</p>;
  if (error) {
    return (
      <div className="px-6 pt-24 text-center">
        <p className="font-semibold text-cream">{joinError ?? error}</p>
        <button onClick={onClose} className="btn-bronze mt-5 px-6 py-3">
          Back to games
        </button>
      </div>
    );
  }
  if (!game) return <p className="pt-24 text-center text-faint">Pulling up a chair…</p>;

  // Quitting (Ludo has its own menu). Null when there's nothing to quit.
  let quit: (() => void) | null = null;
  let quitNote = "";
  if (game.status === "playing" && game.kind === "kachuful") {
    const st = game.state as KState;
    const seat = st.seats.findIndex((p) => p.id === meId && !p.bot);
    if (seat >= 0 && st.phase !== "over") {
      quit = () =>
        void changeLatest<KState>(id, (cur) => {
          const i = cur.seats.findIndex((p) => p.id === meId && !p.bot);
          if (i < 0 || cur.phase === "over") return null;
          const next = quitSeat(cur, i);
          return { state: next, status: next.phase === "over" ? "done" : undefined };
        }).then(() => leaveGame(id));
      quitNote =
        st.seats.filter((p) => !p.bot).length <= 2
          ? "Only one person would be left, so the game ends."
          : "A bot takes your seat and the game goes on.";
    }
  } else if (game.status === "playing" && game.kind === "word") {
    const st = game.state as WordState;
    quit = () =>
      void changeLatest<WordState>(id, (cur) => ({
        state: { ...cur, gaveUp: meId },
        status: "done",
      })).then(() => leaveGame(id));
    quitNote =
      st.guesser === meId
        ? "You give up and the word is revealed."
        : "The challenge is called off.";
  } else if (game.status === "playing" && game.kind === "trivia") {
    const st = game.state as TriviaState;
    if (!st.results[meId]) {
      quit = () =>
        void changeLatest<TriviaState>(id, (cur) =>
          cur.results[meId] ? null : { state: { ...cur, forfeit: meId }, status: "done" },
        ).then(() => leaveGame(id));
      quitNote = "You forfeit and the other player wins.";
    }
  } else if (game.status === "playing" && game.kind === "earworm") {
    const st = game.state as EarState;
    if (st.mode === "live" && !st.left?.includes(meId)) {
      quit = () => void quitGame(game, meId).then(() => leaveGame(id));
      quitNote = "You're out of this game. The others play on.";
    }
  }
  const close = quit ? () => setLeaving(true) : onClose;

  const board =
    game.kind === "earworm" ? (
      <OnlineEarworm live={live as Live<EarState>} meId={meId} onClose={close} />
    ) : game.kind === "penfight" ? (
      <OnlinePenFight live={live as Live<PenState>} meId={meId} onClose={onClose} />
    ) : game.kind === "connect4" ? (
      <OnlineConnect4 live={live as Live<C4State>} meId={meId} onClose={onClose} />
    ) : game.kind === "chess" ? (
      <OnlineChess live={live as Live<ChessState>} meId={meId} onClose={onClose} />
    ) : game.kind === "poker" ? (
      <OnlinePoker live={live as Live<PokerState>} meId={meId} onClose={onClose} />
    ) : game.kind === "imposter" ? (
      <ImposterGame game={game as GameRow<ImpState>} meId={meId} onClose={onClose} />
    ) : game.kind === "word" ? (
      <OnlineWord live={live as Live<WordState>} meId={meId} onClose={close} />
    ) : game.kind === "ludo" ? (
      <OnlineLudo live={live as Live<LudoState>} meId={meId} onClose={onClose} />
    ) : game.kind === "kachuful" ? (
      <OnlineKachuful live={live as Live<KState>} meId={meId} onClose={close} />
    ) : (
      <OnlineTrivia live={live as Live<TriviaState>} id={id} meId={meId} onClose={close} />
    );
  return (
    <>
      {board}
      {leaving && quit && (
        <div className="relative z-[70]">
          <Sheet title="Leave the game?" onClose={() => setLeaving(false)}>
            <div className="grid gap-2.5">
              <button onClick={() => setLeaving(false)} className="btn-primary">
                Keep playing
              </button>
              <button onClick={onClose} className="btn-secondary">
                Leave for now (come back from Your games)
              </button>
              <button
                onClick={() => {
                  quit?.();
                  setLeaving(false);
                  onClose();
                }}
                className="btn-danger"
              >
                <Flag size={16} aria-hidden="true" /> Quit
              </button>
            </div>
            <p className="meta mt-3">{quitNote}</p>
          </Sheet>
        </div>
      )}
      {game.status === "playing" && (
        <GameChat
          gameId={id}
          meId={meId}
          myName={_get().me?.name ?? "You"}
          kind={game.kind}
          hideTab={["poker", "kachuful", "ludo", "connect4", "penfight"].includes(game.kind)}
        />
      )}
    </>
  );
}

/** Note that this person moved themselves (so they really played). */
const actedBy = (s: KState, id: string): KState =>
  s.acted?.includes(id) ? s : { ...s, acted: [...(s.acted ?? []), id] };

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
  // The first human at the table plays the bots (so it still works if the host quits).
  const isHost = !!state && kachufulDriver(state) === meId;

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
      ? `Bots play from ${state.seats.find((p) => p.id === kachufulDriver(state))?.name.split(" ")[0] ?? "the host"}'s phone.`
      : undefined;

  return (
    <KachufulBoard
      state={state}
      mySeat={mySeat}
      note={note}
      onMove={(m: Move) => commit(actedBy(applyMove(state, m), meId))}
      onNext={() => commit(actedBy(nextRound(state), meId))}
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

  if (game.state.forfeit) {
    const iQuit = game.state.forfeit === meId;
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
        <p className="label-caps">{pack.name}</p>
        <h2 className="font-display mt-3" style={{ fontSize: 30 }}>
          {iQuit ? "You quit this one" : `${opponent.name.split(" ")[0]} quit. You win`}
        </h2>
        <button onClick={onClose} className="mt-10 btn-primary px-8">
          Back to games
        </button>
      </div>
    );
  }

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
            {opponent.name.split(" ")[0]} scored {theirs!.score}. Challenge them back
          </p>
          <button onClick={onClose} className="mt-10 btn-primary px-8">
            Back to games
          </button>
        </div>
      );
    }
    const total = mine.total;
    // Both have played: the leaderboard with just the winner (both on a tie).
    if (theirs) {
      const fmt = (r: { score: number }) =>
        mine.points !== undefined ? r.score : `${r.score}/${total}`;
      const meFirst = mine.score >= theirs.score;
      const rows = [
        {
          id: meId,
          rank: mine.score >= theirs.score ? 1 : 2,
          name: s.me?.name ?? "You",
          avatar: s.me?.avatar,
          initials: s.me?.initials ?? "YO",
          value: fmt(mine),
          me: true,
        },
        {
          id: otherId,
          rank: theirs.score >= mine.score ? 1 : 2,
          name: opponent.name,
          avatar: opponent.avatar,
          initials: opponent.initials,
          color: opponent.color,
          value: fmt(theirs),
          link: true,
        },
      ];
      return (
        <GameOverBoard
          game={`${pack.name} · challenge`}
          roast={{ game: "Trivia", detail: pack.name }}
          rows={meFirst ? rows : [rows[1], rows[0]]}
          onClose={onClose}
        />
      );
    }
    const verdict = `Waiting for ${opponent.name.split(" ")[0]} to play.`;
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
        <p className="label-caps">{pack.name} · challenge</p>
        <h2 className="font-display mt-3" style={{ fontSize: 30 }}>
          {verdict}
        </h2>
        <p className="mt-6 text-2xl font-black tabular-nums text-cream">
          {mine.points !== undefined
            ? `You scored ${mine.score} pts`
            : `You got ${mine.score}/${total}`}
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
  const quitter = st.gaveUp ? (st.gaveUp === meId ? "You" : first) : null;
  const over = solved || st.guesses.length >= MAX_GUESSES || !!quitter;

  const guess = (g: string) => {
    const next = { ...st, guesses: [...st.guesses, g] };
    const done = g === answer || next.guesses.length >= MAX_GUESSES;
    void save(next, done ? "done" : undefined);
  };

  const headline = quitter
    ? `${quitter} quit. The word was ${answer.toUpperCase()}`
    : over
      ? guessing
        ? solved
          ? `Got it in ${st.guesses.length}/6`
          : `It was ${answer.toUpperCase()}`
        : solved
          ? `${first} cracked it in ${st.guesses.length}/6`
          : `${first} couldn't get it`
      : guessing
        ? `${first} set you a word`
        : `Watching ${first} guess ${answer.toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="mx-auto w-full max-w-md min-h-full flex flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="heading">Word Up</p>
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
  const isHost = game.host === meId;
  // The first human still playing runs the bots (works even if the host resigned).
  useLudoBots(st, ludoDriver(st) === meId, commit);

  // Waiting room: mark me as in; the host starts once everyone is.
  const inLobby = st.phase === "lobby";
  const amIn = (st.joined ?? []).includes(meId);
  const everyoneIn = inLobby && waitingFor(st).length === 0;
  useEffect(() => {
    if (game.status === "done") return;
    if (inLobby && !amIn) commit(joinLudo(st, meId));
    else if (everyoneIn && isHost) {
      const t = setTimeout(() => commit(beginLudo(st)), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inLobby, amIn, everyoneIn, isHost, game.version]);

  if (inLobby && game.status === "done")
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
        <Dices
          size={44}
          strokeWidth={2}
          aria-hidden="true"
          className="mx-auto"
          style={{ color: "var(--lime)" }}
        />
        <h2 className="font-display mt-3" style={{ fontSize: 28 }}>
          Game called off
        </h2>
        <p className="mt-3 text-cool">Not enough people stayed to play.</p>
        <button onClick={onClose} className="mt-8 btn-primary px-8">
          Back to games
        </button>
      </div>
    );
  if (inLobby)
    return (
      <LudoWaiting
        state={st}
        meId={meId}
        isHost={isHost}
        onStart={() => commit(beginLudo(st))}
        onClose={() => {
          // Host leaving, or only one person left: the game is called off.
          void changeLatest<LudoState>(game.id, (cur) => {
            if (cur.phase !== "lobby") return null;
            const next = isHost ? null : leaveLobby(cur, meId);
            return next ? { state: next } : { state: cur, status: "done" };
          });
          onClose();
        }}
      />
    );
  return (
    <LudoTable
      state={st}
      mine={mine}
      onRoll={() => commit(roll(st))}
      onMove={(t) => commit(moveToken(st, t))}
      onSkip={() => commit(skipTurn(st))}
      onResign={() => {
        const next = resign(st, mine);
        // Show it right away, then make sure it lands even if someone moved at the same moment.
        commit(next);
        void changeLatest<LudoState>(game.id, (cur) => {
          if (cur.phase === "over" || cur.players[mine]?.out) return null;
          const r = resign(cur, mine);
          return { state: r, status: r.phase === "over" ? "done" : undefined };
        }).then(() => leaveGame(game.id));
      }}
      onClose={onClose}
    />
  );
}

function OnlinePenFight({
  live,
  meId,
  onClose,
}: {
  live: Live<PenState>;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  const navigate = useNavigate();
  const s = useSocial();
  // Waiting room: say I'm in, and bring my pen.
  const needsJoin =
    !!game && game.status !== "done" && !!game.state.joined && !game.state.joined.includes(meId);
  useEffect(() => {
    if (!needsJoin || !game) return;
    void myPenId().then((pen) =>
      changeLatest<PenState>(game.id, (cur) => {
        const seat = cur.players.indexOf(meId);
        if (!cur.joined || cur.joined.includes(meId) || seat < 0) return null;
        const skins = cur.players.map((_, i) => cur.skins?.[i] ?? "classic");
        skins[seat] = pen;
        const joined = [...cur.joined, meId];
        // The setup clock starts once everyone needed is in.
        const next: PenState = { ...cur, joined, skins, turnAt: Date.now() };
        // Everyone's here: off we go.
        return {
          state:
            cur.lobby && cur.players.every((p) => joined.includes(p)) ? beginPenFight(next) : next,
        };
      }),
    );
  }, [needsJoin, game?.id, meId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Your wins before this game, to say if winning it unlocks something.
  const [winsBefore, setWinsBefore] = useState<number | null>(null);
  useEffect(() => {
    void loadPenWins().then(setWinsBefore);
  }, []);
  if (!game) return null;
  const st = game.state;
  const sideOf = (id: string) => {
    if (id === meId)
      return {
        id: meId,
        name: s.me?.name ?? "You",
        avatar: s.me?.avatar,
        initials: s.me?.initials ?? "YO",
      };
    const f = friendById(id);
    return {
      id,
      name: f?.name ?? "Your friend",
      avatar: f?.avatar || undefined,
      initials: f?.initials ?? "?",
      color: f?.color,
    };
  };
  const sides = st.players.map(sideOf);
  const mySeat = st.players.indexOf(meId);
  const pickSkin = (id: string) =>
    void changeLatest<PenState>(game.id, (cur) => {
      const seat = cur.players.indexOf(meId);
      if (seat < 0 || cur.shots > 0 || cur.skins?.[seat] === id) return null;
      return {
        state: {
          ...cur,
          skins: cur.players.map((_, i) => (i === seat ? id : (cur.skins?.[i] ?? "classic"))),
        },
      };
    });
  if (!penStarted(st))
    return (
      <PenWaiting
        pick={st.skins?.[mySeat] ?? "classic"}
        onPick={pickSkin}
        sides={sides}
        joined={st.joined ?? []}
        isHost={game.host === meId}
        cancelled={game.status === "done"}
        onStart={() =>
          void changeLatest<PenState>(game.id, (cur) =>
            penStarted(cur) || (cur.joined ?? []).length < 2 ? null : { state: beginPenFight(cur) },
          )
        }
        onCancel={() =>
          game.host === meId
            ? void changeLatest<PenState>(game.id, (cur) =>
                penStarted(cur) ? null : { state: cur, status: "done" },
              ).then(onClose)
            : void quitGame(game, meId).then(onClose)
        }
        onClose={onClose}
      />
    );
  if (mySeat < 0) return null;
  const friends = st.players
    .filter((p) => p !== meId)
    .map((p) => friendById(p))
    .filter((f): f is NonNullable<typeof f> => !!f);
  return (
    <PenTable
      state={st}
      mySeat={mySeat}
      sides={sides}
      unlock={
        st.winner === mySeat && winsBefore !== null && game.status === "done"
          ? unlockNote(winsBefore, winsBefore + 1)
          : undefined
      }
      onShot={(shot) => {
        if (st.turn !== mySeat || st.winner !== undefined) return;
        const next = applyShot(st, shot);
        void save(next, next.winner !== undefined ? "done" : undefined);
      }}
      onPickSkin={pickSkin}
      onPlace={(pose) =>
        void changeLatest<PenState>(game.id, (cur) => {
          const seat = cur.players.indexOf(meId);
          const next = placePen(cur, seat, pose);
          return next === cur ? null : { state: next };
        })
      }
      onReady={() =>
        void changeLatest<PenState>(game.id, (cur) =>
          cur.setup ? { state: markReady(cur, meId) } : null,
        )
      }
      onStartNow={() =>
        void changeLatest<PenState>(game.id, (cur) =>
          cur.setup && Date.now() - (cur.turnAt ?? 0) > 40_000 ? { state: endSetup(cur) } : null,
        )
      }
      onSkip={() =>
        void changeLatest<PenState>(game.id, (cur) =>
          cur.winner !== undefined || cur.turn !== st.turn ? null : { state: skipPenTurn(cur) },
        )
      }
      onResign={() =>
        void changeLatest<PenState>(game.id, (cur) => {
          if (cur.winner !== undefined) return null;
          const next = resignPen(cur, mySeat);
          return { state: next, status: next.winner !== undefined ? "done" : undefined };
        })
      }
      onClose={onClose}
      onPlayAgain={
        friends.length
          ? () =>
              void startPenFight(friends).then((id) =>
                navigate({ to: "/app/play/$id", params: { id } }),
              )
          : undefined
      }
    />
  );
}

function OnlineConnect4({
  live,
  meId,
  onClose,
}: {
  live: Live<C4State>;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  const navigate = useNavigate();
  const s = useSocial();
  // Waiting room: say I'm in. The game starts as soon as both of you are.
  const needsJoin =
    !!game && game.status !== "done" && !!game.state.joined && !game.state.joined.includes(meId);
  useEffect(() => {
    if (!needsJoin || !game) return;
    void changeLatest<C4State>(game.id, (cur) =>
      !cur.joined || cur.joined.includes(meId)
        ? null
        : { state: { ...cur, joined: [...cur.joined, meId] } },
    );
  }, [needsJoin, game?.id, meId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!game) return null;
  const st = game.state;
  const me = st.red === meId ? "r" : "y";
  const otherId = me === "r" ? st.yellow : st.red;
  const other = friendById(otherId);
  const youSide = {
    id: meId,
    name: s.me?.name ?? "You",
    avatar: s.me?.avatar,
    initials: s.me?.initials ?? "YO",
  };
  const themSide = {
    id: otherId,
    name: other?.name ?? "Your friend",
    avatar: other?.avatar || undefined,
    initials: other?.initials ?? "?",
    color: other?.color,
  };
  // Called off (someone left before playing): nobody won.
  if (!c4Started(st) || (game.status === "done" && !st.result))
    return (
      <Connect4Waiting
        you={youSide}
        them={themSide}
        themIn={(st.joined ?? []).includes(otherId)}
        cancelled={game.status === "done"}
        onCancel={() =>
          void changeLatest<C4State>(game.id, (cur) =>
            c4Started(cur) ? null : { state: cur, status: "done" },
          ).then(onClose)
        }
        onClose={onClose}
      />
    );
  return (
    <Connect4Table
      state={st}
      me={me}
      you={{
        id: meId,
        name: s.me?.name ?? "You",
        avatar: s.me?.avatar,
        initials: s.me?.initials ?? "YO",
      }}
      them={{
        id: otherId,
        name: other?.name ?? "Your friend",
        avatar: other?.avatar || undefined,
        initials: other?.initials ?? "?",
        color: other?.color,
      }}
      onDrop={(c) => {
        if (st.turn !== me) return;
        const next = dropDisc(st, c);
        if (next) void save(next, next.result ? "done" : undefined);
      }}
      onResign={() =>
        void changeLatest<C4State>(game.id, (cur) =>
          cur.result
            ? null
            : // Before your first disc, leaving calls it off instead of losing.
              cur.board.includes(me)
              ? { state: resignC4(cur, me), status: "done" }
              : { state: cur, status: "done" },
        )
      }
      onClose={onClose}
      onPlayAgain={
        other
          ? () =>
              void startConnect4(other).then((id) =>
                navigate({ to: "/app/play/$id", params: { id } }),
              )
          : undefined
      }
    />
  );
}

function OnlineChess({
  live,
  meId,
  onClose,
}: {
  live: Live<ChessState>;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  const navigate = useNavigate();
  const s = useSocial();
  if (!game) return null;
  const st = game.state;
  const me = st.white === meId ? "w" : "b";
  const otherId = me === "w" ? st.black : st.white;
  const other = friendById(otherId);
  const done = (next: ChessState) => void save(next, next.result ? "done" : undefined);
  return (
    <ChessTable
      state={st}
      me={me}
      you={{
        id: meId,
        name: s.me?.name ?? "You",
        avatar: s.me?.avatar,
        initials: s.me?.initials ?? "YO",
      }}
      them={{
        id: otherId,
        name: other?.name ?? "Your friend",
        avatar: other?.avatar || undefined,
        initials: other?.initials ?? "?",
        color: other?.color,
      }}
      onMove={(m) => {
        const next = makeMove(st, m);
        if (next) done(next);
      }}
      onResign={() =>
        void changeLatest<ChessState>(game.id, (cur) =>
          cur.result ? null : { state: resignChess(cur, me), status: "done" },
        )
      }
      onOfferDraw={() => void save({ ...st, drawOffer: me })}
      onTimeout={() =>
        void changeLatest<ChessState>(game.id, (cur) => {
          const next = claimTimeout(cur);
          return next ? { state: next, status: "done" } : null;
        })
      }
      onAcceptDraw={() =>
        done({ ...st, drawOffer: undefined, result: { winner: null, reason: "agreed" } })
      }
      onClose={onClose}
      onPlayAgain={
        other
          ? () =>
              void startChess(
                other,
                st.clock ? Math.round(st.clock.base / 60_000) : undefined,
              ).then((id) => navigate({ to: "/app/play/$id", params: { id } }))
          : undefined
      }
    />
  );
}

function OnlinePoker({
  live,
  meId,
  onClose,
}: {
  live: Live<PokerState>;
  meId: string;
  onClose: () => void;
}) {
  const { game, save } = live;
  const s = useSocial();
  if (!game) return null;
  const st = game.state;
  const commit = (next: PokerState | null) =>
    next && void save(next, next.phase === "over" ? "done" : undefined);
  const isHost = game.host === meId;

  if (st.phase === "lobby") {
    if (game.status === "done")
      return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
          <h2 className="font-display" style={{ fontSize: 28 }}>
            Table closed
          </h2>
          <p className="mt-3 text-cool">The host closed this table before the first hand.</p>
          <button onClick={onClose} className="mt-8 btn-primary px-8">
            Back to games
          </button>
        </div>
      );
    return (
      <PokerWaiting
        s={st}
        meId={meId}
        isHost={isHost}
        invited={game.players.filter((p) => p !== game.host)}
        onSit={() =>
          commit(
            joinPoker(st, {
              id: meId,
              name: s.me?.name ?? "Player",
              avatar: s.me?.avatar,
              initials: s.me?.initials ?? "?",
            }),
          )
        }
        onStart={() => commit(beginPoker(st))}
        onInvite={(ids) =>
          void inviteToPoker(game.id, ids, { buyIn: st.startStack, sb: st.sb, bb: st.bb }).then(
            () => live.reload(),
          )
        }
        onLeave={() => {
          if (isHost)
            void changeLatest<PokerState>(game.id, (cur) =>
              cur.phase === "lobby" ? { state: cur, status: "done" } : null,
            );
          else if (st.seats.some((p) => p.id === meId))
            void changeLatest<PokerState>(game.id, (cur) =>
              cur.phase === "lobby" ? { state: standUp(cur, meId) } : null,
            );
          onClose();
        }}
      />
    );
  }

  return (
    <PokerTable
      s={st}
      meId={meId}
      hostId={game.host}
      onAction={(a) => {
        const mine = st.seats.findIndex((p) => p.id === meId);
        commit(pokerAct(st, mine, a));
      }}
      onNextHand={() => st.phase === "showdown" && commit(startHand(st))}
      onFoldAway={() => commit(foldAway(st))}
      onLeave={() => {
        void changeLatest<PokerState>(game.id, (cur) => {
          const next = leavePoker(cur, meId);
          return { state: next, status: next.phase === "over" ? "done" : undefined };
        }).then(() => leaveGame(game.id));
        onClose();
      }}
      onClose={onClose}
    />
  );
}

function OnlineEarworm(props: { live: Live<EarState>; meId: string; onClose: () => void }) {
  const st = props.live.game?.state;
  return st?.mode === "live" ? <LiveEarworm {...props} /> : <ChallengeEarworm {...props} />;
}

/** Live: everyone hears the same song at the same time, on a shared timer. */
function LiveEarworm({
  live,
  meId,
  onClose,
}: {
  live: Live<EarState>;
  meId: string;
  onClose: () => void;
}) {
  const { game } = live;
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    void syncClock().then(() => setNow(serverNow()));
    const t = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(t);
  }, []);
  // Realtime can drop (phone locked, app in the background): check in now and then too.
  const reload = live.reload;
  useEffect(() => {
    const t = setInterval(() => void reload(), 4000);
    const back = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", back);
    };
  }, [reload]);
  const st = game?.state;
  const id = game?.id ?? "";
  const players = game?.players ?? [];
  // Opening it puts you in (and brings you back in after stepping out).
  const out = !!st?.left?.includes(meId);
  const inIt = !!st?.joined?.includes(meId);
  useEffect(() => {
    if (st && !inIt && !out && game?.status === "playing")
      void joinEarworm(id, meId).then(() => reload());
  }, [st, inIt, out, id, meId, game?.status]);
  const at = st ? liveAt(st, now) : null;
  const active = st ? liveActive(st) : [];
  // Everyone still in has answered: move on without waiting out the clock.
  const k = at && (at.phase === "song" || at.phase === "reveal") ? at.k : -1;
  const allIn =
    !!st &&
    at?.phase === "song" &&
    active.length > 0 &&
    active.every((p) => st.picks?.[p]?.[k] != null);
  useEffect(() => {
    if (allIn) void endSongEarly(id, k, serverNow()).then(() => reload());
  }, [allIn, id, k]);
  // The last song's over: save everyone's scores (whoever gets there first).
  const over = at?.phase === "over";
  useEffect(() => {
    if (over && game?.status === "playing") void finishLiveEarworm(id, players);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, id]);

  if (!game || !st || !at) return null;
  const inGame = players.filter((p) => st.joined?.includes(p));
  if (over || game.status === "done" || out) {
    // Everyone sees the final board at the same moment.
    const results = game.status === "done" ? st.results : liveResults(st, players);
    return (
      <EarwormStandings
        st={{ ...st, results }}
        players={inGame.filter((p) => results[p])}
        meId={meId}
        onClose={onClose}
      />
    );
  }
  if (at.phase === "lobby" || at.phase === "countdown")
    return (
      <EarwormLobby
        st={st}
        players={players}
        meId={meId}
        countdown={at.phase === "countdown" ? at.endsAt - now : null}
        onStart={() => void startLiveEarworm(id, serverNow() + COUNTDOWN_MS).then(() => reload())}
        onClose={onClose}
      />
    );
  const ctl: LiveCtl = {
    gameId: id,
    k: at.k,
    phase: at.phase,
    endsAt: at.endsAt,
    now,
    players: inGame.map((p) => {
      const f = personView(p);
      return {
        id: p,
        name: f?.name.split(" ")[0] ?? "Someone",
        avatar: f?.avatar,
        initials: f?.initials ?? "?",
        color: f?.color,
        me: p === meId,
        out: !!st.left?.includes(p),
        picks: st.picks?.[p] ?? [],
      };
    }),
    onPick: (k, got) => void pickEarworm(id, meId, k, got).then(() => reload()),
  };
  return (
    <EarwormPlay cat={st.cat} level={st.level} songs={st.songs} onClose={onClose} live={ctl} />
  );
}

/** Older games: each played on their own, scores compared at the end. */
function ChallengeEarworm({
  live,
  meId,
  onClose,
}: {
  live: Live<EarState>;
  meId: string;
  onClose: () => void;
}) {
  const { game } = live;
  if (!game) return null;
  const st = game.state;
  if (st.results[meId] || game.status === "done")
    return <EarwormStandings st={st} players={game.players} meId={meId} onClose={onClose} />;
  return (
    <EarwormPlay
      cat={st.cat}
      level={st.level}
      songs={st.songs}
      onClose={onClose}
      onFinish={(r) =>
        void saveEarworm(game.id, meId, r).then(async () => {
          // Everyone's played: the challenge is done.
          await changeLatest<EarState>(game.id, (cur) =>
            game.players.every((p) => cur.results[p]) ? { state: cur, status: "done" } : null,
          );
          live.reload();
        })
      }
    />
  );
}
