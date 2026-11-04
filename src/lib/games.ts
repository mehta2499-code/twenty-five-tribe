/**
 * Multiplayer games stored in Supabase (`games` table): Kachuful and trivia challenges.
 * Each move saves the whole game state on top of the version the phone last saw,
 * so two players can't overwrite each other.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { _get, type Person } from "@/lib/social";
import { newGame, type KState, type Seat } from "@/lib/kachuful";

export type TriviaState = {
  pack: string;
  results: Record<string, { score: number; total: number; at: number }>;
};

export type GameRow<S = KState | TriviaState> = {
  id: string;
  kind: "kachuful" | "trivia";
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

export async function startKachuful(friends: Person[], bots: number, length: "short" | "full") {
  const s = _get();
  const me = s.me!;
  const seats = [
    seatFor({ id: me.id, name: me.name, avatar: me.avatar, initials: me.initials }),
    ...friends.map(seatFor),
    ...botSeats(bots),
  ];
  const state = newGame(seats, length);
  const id = crypto.randomUUID();
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
  const id = crypto.randomUUID();
  const state: TriviaState = { pack: packId, results: {} };
  const { error } = await supabase
    .from("games")
    .insert({ id, kind: "trivia", host: me, players: [me, friend.id], state, version: 0 });
  if (error) throw new Error(error.message);
  return id;
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
