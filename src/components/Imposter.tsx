/** Imposter: the party game screen (lobby → clues → vote → reveal). */
import { useState } from "react";
import { Check, Copy, Crown, Eye, Share2, UserPlus, Users, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt } from "@/components/GameArt";
import { Confetti, Toast, buzz } from "@/components/SocialUI";
import { changeLatest, inviteToParty, quitGame, type GameRow } from "@/lib/games";
import { friendById, mutualFriends } from "@/lib/social";

import {
  CATEGORY_NAMES,
  MIN_PLAYERS,
  anotherRound,
  count,
  giveClue,
  guessWord,
  impostersFor,
  isImposter,
  playAgain,
  playedCategory,
  revealWord,
  roundDone,
  start,
  toVote,
  vote,
  whoseTurn,
  type ImpPlayer,
  type ImpState,
} from "@/lib/imposter";

export function ImposterGame({
  game,
  meId,
  onClose,
}: {
  game: GameRow<ImpState>;
  meId: string;
  onClose: () => void;
}) {
  const st = game.state;
  const host = st.host === meId;
  const [toast, setToast] = useState<string | null>(null);
  const act = (fn: (s: ImpState) => ImpState, status?: "done") =>
    void changeLatest<ImpState>(game.id, (cur) => {
      const next = fn(cur);
      return next === cur && !status ? null : { state: next, status };
    }).then((ok) => !ok && setToast("Couldn't save that. Try again."));
  const person = (id: string) => st.players.find((p) => p.id === id);
  const name = (id?: string | null) =>
    id === meId ? "You" : (person(id ?? "")?.name.split(" ")[0] ?? "Someone");

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="mx-auto w-full max-w-md px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-28 min-h-full flex flex-col">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <GameArt kind="imposter" size={34} />
            <span className="heading" style={{ fontSize: 20 }}>
              Imposter
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span className="meta flex items-center gap-1">
              <Users size={14} aria-hidden="true" /> {st.players.length}
            </span>
            <button
              onClick={() => {
                // Leaving the lobby: a party nobody joined is deleted; guests leave it.
                if (st.phase === "lobby" && (!host || st.players.length <= 1))
                  void quitGame(game as GameRow, meId);
                onClose();
              }}
              aria-label="Close"
              className="text-cool w-10 h-10 flex items-center justify-center"
            >
              <X size={22} />
            </button>
          </span>
        </header>

        {st.phase === "lobby" && <Lobby game={game} meId={meId} act={act} setToast={setToast} />}
        {st.phase !== "lobby" && st.phase !== "over" && <RoleCard st={st} meId={meId} />}
        {st.phase === "clues" && <Clues st={st} meId={meId} host={host} act={act} name={name} />}
        {st.phase === "vote" && <Vote st={st} meId={meId} host={host} act={act} />}
        {st.phase === "guess" && <Guess st={st} meId={meId} act={act} name={name} />}
        {st.phase === "over" && <Over st={st} meId={meId} host={host} act={act} name={name} onClose={onClose} />}
      </div>
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

type Act = (fn: (s: ImpState) => ImpState, status?: "done") => void;

function Face({ p, size = 44 }: { p: ImpPlayer; size?: number }) {
  const f = friendById(p.id);
  return <Avatar src={f?.avatar || undefined} initials={p.initials} color={f?.color} size={size} />;
}

// ---------- Lobby ----------
function Lobby({
  game,
  meId,
  act,
  setToast,
}: {
  game: GameRow<ImpState>;
  meId: string;
  act: Act;
  setToast: (t: string) => void;
}) {
  const st = game.state;
  const host = st.host === meId;
  const [inviting, setInviting] = useState(false);
  const link = typeof location !== "undefined" ? `${location.origin}/app/play/${game.id}` : "";
  const share = async () => {
    buzz(8);
    const text = "Imposter on 25 🕵️ Tap to join the party:";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Imposter", text, url: link });
        return;
      } catch {
        // cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      setToast("Link copied. Paste it in your group chat.");
    } catch {
      setToast(link);
    }
  };
  const need = Math.max(0, MIN_PLAYERS - st.players.length);
  return (
    <>
      <div className="card mt-5 p-5 text-center">
        <p className="heading">Get everyone in</p>
        <p className="meta mt-1">
          Anyone with the link can join, even if they're not in your 25. 4 to 20 players.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={share} className="btn-primary">
            <Share2 size={18} aria-hidden="true" /> Share link
          </button>
          <button onClick={() => setInviting(true)} className="btn-secondary">
            <UserPlus size={18} aria-hidden="true" /> Your 25
          </button>
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(link).catch(() => undefined);
            setToast("Link copied");
          }}
          className="mt-3 meta inline-flex items-center gap-1.5 underline underline-offset-4"
        >
          <Copy size={13} aria-hidden="true" /> Copy link
        </button>
      </div>

      <p className="label-caps mt-6 mb-2">
        In the party · {st.players.length}
      </p>
      <ul className="grid grid-cols-4 gap-3">
        {st.players.map((p) => (
          <li key={p.id} className="flex flex-col items-center text-center pop">
            <span className="relative">
              <Face p={p} size={54} />
              {p.id === st.host && (
                <span
                  className="absolute -top-2 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "var(--sun)", border: "var(--bd)", color: "var(--on-accent)" }}
                  title="Host"
                >
                  <Crown size={12} aria-hidden="true" />
                </span>
              )}
            </span>
            <span className="text-[12px] font-semibold text-cream mt-1 truncate w-full">
              {p.id === meId ? "You" : p.name.split(" ")[0]}
            </span>
          </li>
        ))}
      </ul>

      {host ? (
        <>
          <p className="label-caps mt-6 mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {["random", ...CATEGORY_NAMES].map((c) => (
              <button
                key={c}
                className="chip"
                aria-pressed={st.category === c}
                onClick={() => act((s) => ({ ...s, category: c }))}
                style={
                  st.category === c
                    ? { background: "var(--lime)", color: "var(--on-accent)", borderColor: "var(--edge)" }
                    : undefined
                }
              >
                {c === "random" ? "Surprise me" : c}
              </button>
            ))}
          </div>
          <button
            disabled={need > 0}
            onClick={() => {
              buzz(20);
              act((s) => start(s));
            }}
            className="btn-primary w-full mt-6"
            style={{ minHeight: 54, fontSize: 17 }}
          >
            {need > 0
              ? `Need ${need} more player${need > 1 ? "s" : ""}`
              : `Start · ${impostersFor(st.players.length)} imposter${impostersFor(st.players.length) > 1 ? "s" : ""}`}
          </button>
        </>
      ) : (
        <p className="meta text-center mt-8">
          Waiting for {st.players.find((p) => p.id === st.host)?.name.split(" ")[0] ?? "the host"} to start…
        </p>
      )}

      {inviting && (
        <InviteSheet
          already={game.players}
          onClose={() => setInviting(false)}
          onSend={async (ids) => {
            setInviting(false);
            await inviteToParty(game.id, ids);
            setToast(`Invited ${ids.length}`);
          }}
        />
      )}
    </>
  );
}

function InviteSheet({
  already,
  onClose,
  onSend,
}: {
  already: string[];
  onClose: () => void;
  onSend: (ids: string[]) => void;
}) {
  const people = mutualFriends().filter((f) => !already.includes(f.id));
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl p-5 sheet-in" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} onClick={(e) => e.stopPropagation()}>
        <p className="heading">Invite from your 25</p>
        {people.length === 0 ? (
          <p className="meta mt-2">Everyone in your 25 is already here. Share the link for others.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 mt-4 max-h-[50vh] overflow-y-auto">
            {people.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setPicked((x) => (on ? x.filter((i) => i !== p.id) : [...x, p.id]))}
                  className="flex flex-col items-center"
                >
                  <span className="relative rounded-full p-[2px]" style={{ background: on ? "var(--lime)" : "transparent" }}>
                    <Avatar src={p.avatar || undefined} initials={p.initials} color={p.color} size={50} />
                    {on && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--lime)", color: "var(--on-accent)", border: "var(--bd)" }}>
                        <Check size={12} />
                      </span>
                    )}
                  </span>
                  <span className="text-[12px] mt-1 text-cream truncate w-full">{p.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        )}
        <button disabled={!picked.length} onClick={() => onSend(picked)} className="btn-primary w-full mt-5">
          Send invite{picked.length ? ` to ${picked.length}` : ""}
        </button>
      </div>
    </div>
  );
}

// ---------- Your secret ----------
function RoleCard({ st, meId }: { st: ImpState; meId: string }) {
  const [peek, setPeek] = useState(false);
  const imp = isImposter(st, meId);
  return (
    <button
      className="mt-5 w-full rounded-3xl p-5 text-center select-none"
      style={{
        background: peek ? (imp ? "var(--pink)" : "var(--lime)") : "var(--fill)",
        color: peek ? "var(--on-accent)" : "var(--ink)",
        border: "var(--bd)",
        boxShadow: "var(--pop)",
        touchAction: "none",
      }}
      onPointerDown={() => {
        buzz(10);
        setPeek(true);
      }}
      onPointerUp={() => setPeek(false)}
      onPointerLeave={() => setPeek(false)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Hold to see your secret"
    >
      {peek ? (
        imp ? (
          <>
            <p className="label-caps" style={{ color: "inherit" }}>
              You are the
            </p>
            <p className="display mt-1" style={{ fontSize: 40, lineHeight: 1 }}>
              IMPOSTER
            </p>
            <p className="mt-2 font-semibold">
              Category: {playedCategory(st)}. Blend in.
              {(st.imposters?.length ?? 0) > 1 ? " There's one more of you." : ""}
            </p>
          </>
        ) : (
          <>
            <p className="label-caps" style={{ color: "inherit" }}>
              The word is
            </p>
            <p className="display mt-1" style={{ fontSize: 40, lineHeight: 1 }}>
              {revealWord(st.hidden)}
            </p>
            <p className="mt-2 font-semibold">Category: {playedCategory(st)}. Don't say it.</p>
          </>
        )
      ) : (
        <span className="flex items-center justify-center gap-2 font-bold py-4">
          <Eye size={20} aria-hidden="true" /> Hold to see your secret
        </span>
      )}
    </button>
  );
}

// ---------- Clues ----------
function Clues({
  st,
  meId,
  host,
  act,
  name,
}: {
  st: ImpState;
  meId: string;
  host: boolean;
  act: Act;
  name: (id?: string | null) => string;
}) {
  const [text, setText] = useState("");
  const turn = whoseTurn(st);
  const mine = turn === meId;
  const done = roundDone(st);
  const send = (t: string) => {
    buzz(12);
    act((s) => giveClue(s, meId, t));
    setText("");
  };
  return (
    <>
      <div className="mt-6 text-center">
        <span className="sticker">Round {st.round}</span>
        <p className="title mt-3" style={{ fontSize: 26 }}>
          {done ? "Everyone's given a clue" : mine ? "Your turn" : `${name(turn)}'s turn`}
        </p>
        {!done && (
          <p className="meta mt-1">
            {mine ? "One word or a short hint. Not too obvious." : "Listen closely. Who sounds off?"}
          </p>
        )}
      </div>

      {mine && !done && (
        <div className="mt-4 grid gap-2">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={40}
              placeholder="Your clue"
              className="input flex-1"
              enterKeyHint="send"
              onKeyDown={(e) => e.key === "Enter" && text.trim() && send(text)}
            />
            <button disabled={!text.trim()} onClick={() => send(text)} className="btn-primary px-5">
              Send
            </button>
          </div>
          <button onClick={() => send("")} className="btn-secondary">
            I said it out loud
          </button>
        </div>
      )}

      <ol className="mt-5 grid gap-2">
        {st.clues.map((c, i) => (
          <li key={i} className="card px-4 py-2.5 flex items-center gap-3 rise-in">
            <span className="meta w-8 tabular-nums">R{c.round}</span>
            <span className="font-bold text-cream flex-1 min-w-0 truncate">{name(c.id)}</span>
            <span className="text-cool truncate" style={{ maxWidth: "55%" }}>
              {c.text}
            </span>
          </li>
        ))}
      </ol>

      {done &&
        (host ? (
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <button onClick={() => act(anotherRound)} className="btn-secondary">
              Another round
            </button>
            <button onClick={() => act(toVote)} className="btn-primary">
              Vote now
            </button>
          </div>
        ) : (
          <p className="meta text-center mt-6">Host decides: another round or vote.</p>
        ))}
      {!done && host && st.clues.length >= st.players.length && (
        <button onClick={() => act(toVote)} className="btn-secondary w-full mt-5">
          Skip to the vote
        </button>
      )}
    </>
  );
}

// ---------- Vote ----------
function Vote({ st, meId, host, act }: { st: ImpState; meId: string; host: boolean; act: Act }) {
  const mine = st.votes[meId];
  const n = Object.keys(st.votes).length;
  return (
    <>
      <div className="mt-6 text-center">
        <p className="title" style={{ fontSize: 26 }}>
          Who's the imposter?
        </p>
        <p className="meta mt-1 tabular-nums">
          {n}/{st.players.length} voted{mine ? " · tap someone else to change" : ""}
        </p>
      </div>
      <ul className="mt-5 grid grid-cols-3 gap-3">
        {st.players
          .filter((p) => p.id !== meId)
          .map((p) => {
            const on = mine === p.id;
            return (
              <li key={p.id}>
                <button
                  onClick={() => {
                    buzz(15);
                    act((s) => vote(s, meId, p.id));
                  }}
                  className="w-full rounded-2xl p-3 flex flex-col items-center"
                  style={{
                    background: on ? "var(--pink)" : "var(--surface)",
                    color: on ? "var(--on-accent)" : "var(--ink)",
                    border: on ? "var(--bd)" : "1px solid var(--line)",
                    boxShadow: on ? "var(--pop)" : "none",
                  }}
                >
                  <Face p={p} size={50} />
                  <span className="mt-1.5 text-[13px] font-bold truncate w-full text-center">
                    {p.name.split(" ")[0]}
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
      {host && n > 0 && n < st.players.length && (
        <button onClick={() => act(count)} className="btn-secondary w-full mt-6">
          Count the votes now
        </button>
      )}
    </>
  );
}

// ---------- Caught imposter guesses ----------
function Guess({
  st,
  meId,
  act,
  name,
}: {
  st: ImpState;
  meId: string;
  act: Act;
  name: (id?: string | null) => string;
}) {
  const me = st.out === meId;
  return (
    <div className="mt-6 text-center">
      <p className="title" style={{ fontSize: 26 }}>
        {me ? "Caught. Last chance." : `${name(st.out)} was an imposter!`}
      </p>
      <p className="meta mt-1">
        {me ? "Guess the word to steal the win." : `${name(st.out)} gets one guess at the word…`}
      </p>
      {me && (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {(st.options ?? []).map((w) => (
            <button key={w} onClick={() => act((s) => guessWord(s, meId, w))} className="btn-secondary">
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Result ----------
function Over({
  st,
  meId,
  host,
  act,
  name,
  onClose,
}: {
  st: ImpState;
  meId: string;
  host: boolean;
  act: Act;
  name: (id?: string | null) => string;
  onClose: () => void;
}) {
  const imp = isImposter(st, meId);
  const won = (st.winner === "imposters") === imp;
  const word = revealWord(st.hidden);
  const why =
    st.winner === "crew"
      ? `${name(st.out)} got caught${st.guess ? ` and guessed "${st.guess}"` : ""}.`
      : st.guess
        ? `${name(st.out)} got caught but guessed the word.`
        : st.out
          ? `The crew voted out ${name(st.out)}, who was innocent.`
          : "It was a tie. Nobody got voted out.";
  const board = [...st.players].sort((a, b) => (st.tally[b.id] ?? 0) - (st.tally[a.id] ?? 0));
  return (
    <>
      <div className="mt-6 text-center">
        <span className={`sticker ${st.winner === "crew" ? "" : "pink"}`}>
          {st.winner === "crew" ? "Crew wins" : "Imposter wins"}
        </span>
        <p className="title mt-3" style={{ fontSize: 30 }}>
          {won ? "You won" : "You lost"}
        </p>
        <p className="mt-2 text-cool">{why}</p>
        <div className="card mt-5 p-4 grid grid-cols-2 gap-3 text-left">
          <div>
            <p className="meta">The word</p>
            <p className="font-extrabold text-cream text-lg">{word}</p>
          </div>
          <div>
            <p className="meta">Imposter{(st.imposters?.length ?? 0) > 1 ? "s" : ""}</p>
            <p className="font-extrabold text-lg" style={{ color: "var(--pink)" }}>
              {(st.imposters ?? []).map((i) => name(i)).join(" & ")}
            </p>
          </div>
        </div>
      </div>

      {st.games > 1 && (
        <>
          <p className="label-caps mt-6 mb-2">Party scores · {st.games} games</p>
          <ol className="grid gap-1.5">
            {board.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-1">
                <span className="w-5 meta tabular-nums">{i + 1}</span>
                <Face p={p} size={30} />
                <span className="flex-1 font-semibold text-cream truncate">{name(p.id)}</span>
                <span className="font-extrabold tabular-nums">{st.tally[p.id] ?? 0}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {host ? (
        <div className="mt-6 grid gap-2.5">
          <button onClick={() => act(playAgain)} className="btn-primary" style={{ minHeight: 54 }}>
            Play again (new word)
          </button>
          <button
            onClick={() => {
              act((s) => s, "done");
              onClose();
            }}
            className="btn-secondary"
          >
            End the party
          </button>
        </div>
      ) : (
        <p className="meta text-center mt-6">Waiting for the host to start the next one…</p>
      )}
      <Confetti fire={won ? 1 : 0} />
    </>
  );
}

