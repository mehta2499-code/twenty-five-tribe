/** Imposter: the party game screen (lobby → clues → vote → reveal). */
import { useEffect, useState } from "react";
import { Check, Copy, Crown, Eye, Share2, UserPlus, Users, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameArt } from "@/components/GameArt";
import { Confetti, Toast, buzz } from "@/components/SocialUI";
import { changeLatest, inviteToParty, quitGame, type GameRow } from "@/lib/games";
import { friendById, mutualFriends } from "@/lib/social";

import {
  CATEGORY_NAMES,
  MIN_PLAYERS,
  POINTS,
  TURN_SECONDS,
  anotherRound,
  candidates,
  cluesOf,
  count,
  giveClue,
  guessWord,
  impostersFor,
  isImposter,
  playAgain,
  playedCategory,
  revealWord,
  roundDone,
  saysWord,
  skipTurn,
  start,
  stoleIt,
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
        {st.phase === "over" && (
          <Over st={st} meId={meId} host={host} act={act} name={name} onClose={onClose} />
        )}
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

      <p className="label-caps mt-6 mb-2">In the party · {st.players.length}</p>
      <ul className="grid grid-cols-4 gap-3">
        {st.players.map((p) => (
          <li key={p.id} className="flex flex-col items-center text-center pop">
            <span className="relative">
              <Face p={p} size={54} />
              {p.id === st.host && (
                <span
                  className="absolute -top-2 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--sun)",
                    border: "var(--bd)",
                    color: "var(--on-accent)",
                  }}
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
                    ? {
                        background: "var(--lime)",
                        color: "var(--on-accent)",
                        borderColor: "var(--edge)",
                      }
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
          Waiting for {st.players.find((p) => p.id === st.host)?.name.split(" ")[0] ?? "the host"}{" "}
          to start…
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
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 sheet-in"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="heading">Invite from your 25</p>
        {people.length === 0 ? (
          <p className="meta mt-2">
            Everyone in your 25 is already here. Share the link for others.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-3 mt-4 max-h-[50vh] overflow-y-auto">
            {people.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setPicked((x) => (on ? x.filter((i) => i !== p.id) : [...x, p.id]))
                  }
                  className="flex flex-col items-center"
                >
                  <span
                    className="relative rounded-full p-[2px]"
                    style={{ background: on ? "var(--lime)" : "transparent" }}
                  >
                    <Avatar
                      src={p.avatar || undefined}
                      initials={p.initials}
                      color={p.color}
                      size={50}
                    />
                    {on && (
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{
                          background: "var(--lime)",
                          color: "var(--on-accent)",
                          border: "var(--bd)",
                        }}
                      >
                        <Check size={12} />
                      </span>
                    )}
                  </span>
                  <span className="text-[12px] mt-1 text-cream truncate w-full">
                    {p.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <button
          disabled={!picked.length}
          onClick={() => onSend(picked)}
          className="btn-primary w-full mt-5"
        >
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
function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

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
  const [warn, setWarn] = useState<string | null>(null);
  const now = useNow();
  const turn = whoseTurn(st);
  const mine = turn === meId;
  const done = roundDone(st);
  const imp = isImposter(st, meId);
  const left = st.turnAt
    ? Math.max(0, TURN_SECONDS - Math.floor((now - st.turnAt) / 1000))
    : TURN_SECONDS;
  const send = (t: string) => {
    // Crew can't just say the word.
    if (t && !imp && saysWord(t, revealWord(st.hidden))) {
      buzz(60);
      setWarn("That gives the word away! Try something sneakier.");
      return;
    }
    buzz(12);
    setWarn(null);
    act((s) => giveClue(s, meId, t));
    setText("");
  };
  const turnPlayer = st.players.find((p) => p.id === turn);
  return (
    <>
      <div className="mt-6 text-center">
        <span className="sticker">Round {st.round}</span>
        {!done && turnPlayer && (
          <div className="mt-4 flex justify-center">
            <span className="relative">
              <span
                className="block rounded-full"
                style={{ boxShadow: `0 0 0 4px ${left <= 10 ? "var(--pink)" : "var(--lime)"}` }}
              >
                <Face p={turnPlayer} size={64} />
              </span>
              <span
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 rounded-full text-[12px] font-extrabold tabular-nums"
                style={{
                  background: left <= 10 ? "var(--pink)" : "var(--surface)",
                  color: left <= 10 ? "var(--on-accent)" : "var(--ink)",
                  border: "var(--bd)",
                }}
              >
                {left}s
              </span>
            </span>
          </div>
        )}
        <p className="title mt-4" style={{ fontSize: 26 }}>
          {done ? "Everyone's given a clue" : mine ? "Your turn" : `${name(turn)}'s turn`}
        </p>
        {!done && (
          <p className="meta mt-1">
            {mine
              ? imp
                ? "You don't know the word. Say something vague that fits the category."
                : "One word or a short hint. Not too obvious, not too vague."
              : "Listen closely. Who sounds off?"}
          </p>
        )}
      </div>

      {mine && !done && (
        <div className="mt-4 grid gap-2">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setWarn(null);
              }}
              maxLength={40}
              placeholder="Your clue"
              className="input flex-1"
              enterKeyHint="send"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && text.trim() && send(text)}
            />
            <button disabled={!text.trim()} onClick={() => send(text)} className="btn-primary px-5">
              Send
            </button>
          </div>
          {warn && (
            <p className="text-sm font-semibold" style={{ color: "var(--pink)" }}>
              {warn}
            </p>
          )}
          <button onClick={() => send("")} className="btn-secondary">
            I said it out loud
          </button>
        </div>
      )}

      {!done && !mine && host && left === 0 && (
        <button onClick={() => act(skipTurn)} className="btn-secondary w-full mt-4">
          Skip {name(turn)} (out of time)
        </button>
      )}

      <ClueLog st={st} name={name} />

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

/** Every clue so far, newest first, with who said it. */
function ClueLog({
  st,
  name,
  highlight,
}: {
  st: ImpState;
  name: (id?: string | null) => string;
  highlight?: boolean;
}) {
  if (!st.clues.length) return null;
  return (
    <ol className="mt-5 grid gap-2">
      {[...st.clues].reverse().map((c, i) => {
        const p = st.players.find((x) => x.id === c.id);
        const imp = highlight && isImposter(st, c.id);
        return (
          <li
            key={st.clues.length - i}
            className="card px-3 py-2 flex items-center gap-3 rise-in"
            style={
              imp ? { borderColor: "var(--pink)", boxShadow: "0 0 0 2px var(--pink)" } : undefined
            }
          >
            {p && <Face p={p} size={30} />}
            <span className="font-bold text-cream shrink-0">{name(c.id)}</span>
            <span className="text-cool flex-1 min-w-0 truncate text-right">“{c.text}”</span>
            <span className="meta tabular-nums text-[11px]">R{c.round}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Vote ----------
function Vote({ st, meId, host, act }: { st: ImpState; meId: string; host: boolean; act: Act }) {
  const mine = st.votes[meId];
  const n = Object.keys(st.votes).length;
  const pool = candidates(st).filter((p) => p.id !== meId);
  const voted = new Set(Object.keys(st.votes));
  return (
    <>
      <div className="mt-6 text-center">
        {st.runoff && (
          <span className="sticker pink" style={{ transform: "rotate(-2deg)" }}>
            It's a tie! Revote
          </span>
        )}
        <p className="title mt-3" style={{ fontSize: 26 }}>
          Who's the imposter?
        </p>
        <p className="meta mt-1 tabular-nums">
          {st.runoff
            ? "Only the tied players this time. Another tie and the imposter wins."
            : "Read everyone's clues, then vote."}
        </p>
        <p className="meta mt-1 tabular-nums">
          {n}/{st.players.length} voted{mine ? " · tap someone else to change" : ""}
        </p>
      </div>

      <ul className="mt-5 grid gap-2.5">
        {pool.map((p) => {
          const on = mine === p.id;
          const theirs = cluesOf(st, p.id);
          return (
            <li key={p.id}>
              <button
                onClick={() => {
                  buzz(15);
                  act((s) => vote(s, meId, p.id));
                }}
                className="w-full rounded-2xl p-3 flex items-start gap-3 text-left"
                style={{
                  background: on ? "var(--pink)" : "var(--surface)",
                  color: on ? "var(--on-accent)" : "var(--ink)",
                  border: on ? "var(--bd)" : "1px solid var(--line)",
                  boxShadow: on ? "var(--pop)" : "none",
                }}
              >
                <span className="relative shrink-0">
                  <Face p={p} size={46} />
                  {voted.has(p.id) && (
                    <span
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: "var(--lime)",
                        color: "var(--on-accent)",
                        border: "var(--bd)",
                      }}
                      title="Has voted"
                    >
                      <Check size={11} />
                    </span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-extrabold text-[15px] truncate">
                    {p.name.split(" ")[0]}
                  </span>
                  {theirs.length ? (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {theirs.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-[13px] font-semibold"
                          style={{
                            background: on ? "rgba(0,0,0,0.15)" : "var(--fill)",
                          }}
                        >
                          “{c.text}”
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span
                      className="block meta mt-0.5"
                      style={on ? { color: "inherit" } : undefined}
                    >
                      No clue given
                    </span>
                  )}
                </span>
                {on && <span className="text-[12px] font-extrabold self-center">YOUR VOTE</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!pool.length && (
        <p className="meta text-center mt-6">You're in the revote. Others decide.</p>
      )}
      {host && n > 0 && n < st.players.length && (
        <button onClick={() => act(count)} className="btn-secondary w-full mt-6">
          Count the votes now
        </button>
      )}
    </>
  );
}

// ---------- Caught imposter types the word ----------
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
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    buzz(20);
    act((s) => guessWord(s, meId, text));
  };
  return (
    <div className="mt-6 text-center">
      <span className="sticker pink">Caught!</span>
      <p className="title mt-3" style={{ fontSize: 26 }}>
        {me ? "Last chance." : `${name(st.out)} was an imposter!`}
      </p>
      <p className="meta mt-1">
        {me
          ? `Type the secret word to steal the win (+${POINTS.steal} points). Category: ${playedCategory(st)}.`
          : `${name(st.out)} gets one guess at the word… sweat.`}
      </p>
      {me && (
        <div className="mt-5 grid gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={40}
            placeholder="The word is…"
            autoFocus
            enterKeyHint="send"
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="input text-center text-lg font-bold"
          />
          <button
            disabled={!text.trim()}
            onClick={send}
            className="btn-primary"
            style={{ minHeight: 52 }}
          >
            Lock it in
          </button>
          <p className="meta">Small typos are fine. One guess only.</p>
        </div>
      )}
      {!me && <ClueLog st={st} name={name} />}
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
  const stole = stoleIt(st);
  const why =
    st.winner === "crew"
      ? `${name(st.out)} got caught${st.guess ? ` and guessed “${st.guess}”. Wrong!` : "."}`
      : stole
        ? `${name(st.out)} got caught but typed “${st.guess}”. Stolen!`
        : st.out
          ? `The crew voted out ${name(st.out)}, who was innocent.`
          : "Tied twice. Nobody got voted out.";
  // Who voted for whom.
  const votes = st.finalVotes ?? st.votes;
  const byTarget: Record<string, string[]> = {};
  for (const [voter, target] of Object.entries(votes)) (byTarget[target] ??= []).push(voter);
  const targets = Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length);
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

      {targets.length > 0 && (
        <>
          <p className="label-caps mt-6 mb-2">Who voted for who</p>
          <ul className="grid gap-2">
            {targets.map(([target, voters]) => {
              const p = st.players.find((x) => x.id === target);
              return (
                <li key={target} className="card px-3 py-2.5 flex items-center gap-3">
                  {p && <Face p={p} size={34} />}
                  <span className="flex-1 min-w-0">
                    <span
                      className="block font-bold"
                      style={{ color: isImposter(st, target) ? "var(--pink)" : "var(--ink)" }}
                    >
                      {name(target)}
                      {isImposter(st, target) ? " · imposter" : ""}
                    </span>
                    <span className="block meta truncate">
                      {voters.map((v) => name(v)).join(", ")}
                    </span>
                  </span>
                  <span className="font-extrabold tabular-nums">{voters.length}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="label-caps mt-6 mb-0">All the clues</p>
      <ClueLog st={st} name={name} highlight />

      {st.games > 0 && (
        <>
          <p className="label-caps mt-6 mb-2">
            Party points · {st.games} game{st.games > 1 ? "s" : ""}
          </p>
          <ol className="grid gap-1.5">
            {board.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-1">
                <span className="w-5 meta tabular-nums">{i + 1}</span>
                <Face p={p} size={30} />
                <span className="flex-1 font-semibold text-cream truncate">{name(p.id)}</span>
                <span className="font-extrabold tabular-nums">{st.tally[p.id] ?? 0} pts</span>
              </li>
            ))}
          </ol>
          <p className="meta mt-2">
            Crew win +{POINTS.crew} · imposter win +{POINTS.imposter} · caught but guessed it +
            {POINTS.steal}
          </p>
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
