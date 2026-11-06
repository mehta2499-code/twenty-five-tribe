/**
 * Multiplayer games stored in Supabase (`games` table): Kachuful and trivia challenges.
 * Each move saves the whole game state on top of the version the phone last saw,
 * so two players can't overwrite each other.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { uuid } from "@/lib/uuid";
import { supabase } from "@/integrations/supabase/client";
import { _get, type Person } from "@/lib/social";
import { newGame, type KState, type Scoring, type Seat } from "@/lib/kachuful";
import { newLudo, type LudoState } from "@/lib/ludo";

export type TriviaState = {
  pack: string;
  /** "live": both play at the same time (duel). "async": each plays when they can. */
  mode?: "live" | "async";
  /** Picks the questions and their order; the same for both players. */
  seed?: number;
  results: Record<
    string,
    { score: number; total: number; at: number; correct?: number; points?: number }
  >;
};

/** Word Up challenge: the setter picks a word, the guesser has 6 tries. */
export type WordState = {
  /** The word, lightly scrambled so it isn't readable at a glance. */
  hidden: string;
  setter: string;
  guesser: string;
  guesses: string[];
};
export const hideWord = (w: string) => btoa([...w].reverse().join(""));
export const revealWord = (h: string) => [...atob(h)].reverse().join("");

export type GameRow<S = KState | TriviaState | WordState | LudoState> = {
  id: string;
  kind: "kachuful" | "trivia" | "word" | "ludo";
  host: string;
  players: string[];
  status: "playing" | "done";
  state: S;
  version: number;
  created_at: string;
  updated_at: string;
};

const BOT_NAMES = ["Chintu", "Pinky", "Bunty", "Golu", "Sweety", "Monu"];

export function seatFor(p: {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  color?: string;
}): Seat {
  return {
    id: p.id,
    name: p.name,
    bot: false,
    avatar: p.avatar || undefined,
    initials: p.initials,
    color: p.color,
  };
}

export function botSeats(count: number): Seat[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bot-${i + 1}`,
    name: BOT_NAMES[i % BOT_NAMES.length],
    bot: true,
    initials: BOT_NAMES[i % BOT_NAMES.length].slice(0, 2).toUpperCase(),
    color: "#5B7590",
  }));
}

function myId() {
  const me = _get().me;
  if (!me) throw new Error("Sign in to play with friends.");
  return me.id;
}

async function invite(friendIds: string[], gameId: string, text: string) {
  const me = myId();
  if (!friendIds.length) return;
  await supabase.from("messages").insert(
    friendIds.map((r) => ({
      sender: me,
      recipient: r,
      shared_ref: `game:${gameId}`,
      body: text,
    })),
  );
}

export async function startKachuful(
  friends: Person[],
  bots: number,
  length: "short" | "full",
  scoring: Scoring = "classic",
) {
  const s = _get();
  const me = s.me!;
  const seats = [
    seatFor({ id: me.id, name: me.name, avatar: me.avatar, initials: me.initials }),
    ...friends.map(seatFor),
    ...botSeats(bots),
  ];
  const state = newGame(seats, length, undefined, scoring);
  const id = uuid();
  const { error } = await supabase.from("games").insert({
    id,
    kind: "kachuful",
    host: me.id,
    players: [me.id, ...friends.map((f) => f.id)],
    state,
    version: 0,
  });
  if (error) throw new Error(error.message);
  await invite(
    friends.map((f) => f.id),
    id,
    `Kachuful at my table. ${seats.length} players. Pull up a chair 🃏`,
  );
  return id;
}

export async function startTriviaChallenge(packId: string, friend: Person) {
  const me = myId();
  const id = uuid();
  const state: TriviaState = {
    pack: packId,
    mode: "live",
    seed: Math.floor(Math.random() * 2 ** 31),
    results: {},
  };
  const { error } = await supabase
    .from("games")
    .insert({ id, kind: "trivia", host: me, players: [me, friend.id], state, version: 0 });
  if (error) throw new Error(error.message);
  return id;
}

export async function startLudo(friends: Person[], bots = 0) {
  const me = _get().me!;
  const { ludoBots } = await import("@/components/Ludo");
  const players = [
    { id: me.id, name: me.name, avatar: me.avatar, initials: me.initials },
    ...friends.map((f) => ({
      id: f.id,
      name: f.name,
      avatar: f.avatar || undefined,
      initials: f.initials,
    })),
    ...ludoBots(bots),
  ];
  const state = newLudo(players, { lobby: true });
  const id = uuid();
  const { error } = await supabase.from("games").insert({
    id,
    kind: "ludo",
    host: me.id,
    players: [me.id, ...friends.map((f) => f.id)],
    state,
    version: 0,
  });
  if (error) throw new Error(error.message);
  await invite(
    friends.map((f) => f.id),
    id,
    `🎲 Ludo, ${players.length} players${bots ? ` (${bots} bot${bots > 1 ? "s" : ""})` : ""}. Join now, it's live!`,
  );
  return id;
}

export async function startWordChallenge(friend: Person, word: string) {
  const me = myId();
  const id = uuid();
  const state: WordState = { hidden: hideWord(word), setter: me, guesser: friend.id, guesses: [] };
  const { error } = await supabase
    .from("games")
    .insert({ id, kind: "word", host: me, players: [me, friend.id], state, version: 0 });
  if (error) throw new Error(error.message);
  await invite([friend.id], id, "I set you a word 🔤 6 guesses. I'm watching live 👀");
  return id;
}

export async function inviteToDuel(gameId: string, friendId: string, packName: string) {
  await invite([friendId], gameId, `⚡ Trivia duel: ${packName}. Join now, we play live!`);
}

export async function inviteToTrivia(
  gameId: string,
  friendId: string,
  score: number,
  total: number,
  packName: string,
) {
  await invite(
    [friendId],
    gameId,
    `I got ${score}/${total} in ${packName} trivia. Same questions, your turn 🧠`,
  );
}

export async function listMyGames(): Promise<GameRow[]> {
  const s = _get();
  if (s.mode !== "live" || !s.me) return [];
  const { data } = await supabase
    .from("games")
    .select("*")
    .contains("players", [s.me.id])
    .order("updated_at", { ascending: false })
    .limit(20);
  return (data ?? []) as GameRow[];
}

/** Load one game, keep it live, and save moves on top of the latest version. */
export function useGame<S>(id: string) {
  const [game, setGame] = useState<GameRow<S> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<GameRow<S> | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (e) setError(e.message);
    else if (!data) setError("This game doesn't exist, or you're not in it.");
    else {
      latest.current = data as GameRow<S>;
      setGame(data as GameRow<S>);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`game:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        ({ new: row }) => {
          const g = row as GameRow<S>;
          if (!latest.current || g.version >= latest.current.version) {
            latest.current = g;
            setGame(g);
          }
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [id, load]);

  /** Save a new state. Returns false if someone else moved first (the game reloads). */
  const save = useCallback(
    async (state: S, status?: "playing" | "done") => {
      const cur = latest.current;
      if (!cur) return false;
      const optimistic = { ...cur, state, status: status ?? cur.status, version: cur.version + 1 };
      latest.current = optimistic;
      setGame(optimistic);
      const { error: e } = await supabase.rpc("save_game", {
        p_id: id,
        p_version: cur.version,
        p_state: state,
        p_status: status ?? null,
      });
      if (e) {
        await load();
        return false;
      }
      return true;
    },
    [id, load],
  );

  return { game, error, save, reload: load };
}

/**
 * Save my trivia result on top of whatever is there now. Both players finish
 * a duel at the same moment, so retry with the latest version if we collide.
 */
export async function saveTriviaResult(
  id: string,
  meId: string,
  result: TriviaState["results"][string],
  extra?: Partial<TriviaState>,
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (!data) return false;
    const g = data as GameRow<TriviaState>;
    const results = { ...g.state.results, [meId]: result };
    const everyone = g.players.every((p) => results[p]);
    const { error } = await supabase.rpc("save_game", {
      p_id: id,
      p_version: g.version,
      p_state: { ...g.state, ...extra, results },
      p_status: everyone ? "done" : null,
    });
    if (!error) return true;
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));
  }
  return false;
}
