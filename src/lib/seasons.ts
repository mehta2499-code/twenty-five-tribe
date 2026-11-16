/** Season winner titles (25-day seasons of the daily games). */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { _get } from "@/lib/social";

const cache = new Map<string, number[]>();

/** Seasons someone won (newest first). */
export function useSeasonWins(userId?: string | null) {
  const [wins, setWins] = useState<number[]>(() => (userId ? (cache.get(userId) ?? []) : []));
  useEffect(() => {
    if (!userId || _get().mode !== "live") return;
    let alive = true;
    void supabase
      .from("season_winners" as never)
      .select("season")
      .eq("user_id" as never, userId as never)
      .order("season" as never, { ascending: false })
      .then(({ data }) => {
        const list = ((data as { season: number }[] | null) ?? []).map((r) => r.season);
        cache.set(userId, list);
        if (alive) setWins(list);
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  return wins;
}
