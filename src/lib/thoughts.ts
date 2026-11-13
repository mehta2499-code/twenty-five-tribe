/** Thought of the day: one line per person per day, seen by their 25 only. */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { _get, useSocial } from "@/lib/social";
import { today } from "@/lib/daily";

export type Thought = { id: string; body: string; at: number };
const DEMO_KEY = "tf.thought.v1";

export function useThoughts() {
  const s = useSocial();
  const [list, setList] = useState<Thought[] | null>(null);
  const me = s.me?.id;

  const load = useCallback(async () => {
    const day = today();
    if (s.mode !== "live" || !me) {
      try {
        const t = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "null") as
          | (Thought & { day: string })
          | null;
        setList(t && t.day === day ? [t] : []);
      } catch {
        setList([]);
      }
      return;
    }
    const { data } = await supabase
      .from("daily_thoughts" as never)
      .select("user_id,body,updated_at")
      .eq("day", day)
      .order("updated_at", { ascending: false });
    setList(
      ((data ?? []) as { user_id: string; body: string; updated_at: string }[]).map((r) => ({
        id: r.user_id === me ? "me" : r.user_id,
        body: r.body,
        at: Date.parse(r.updated_at),
      })),
    );
  }, [s.mode, me]);

  useEffect(() => {
    void load();
    if (s.mode !== "live" || !me) return;
    const ch = supabase
      .channel(`thoughts:${me}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_thoughts" },
        () => void load(),
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [load, s.mode, me]);

  const save = async (body: string) => {
    const text = body.trim().slice(0, 200);
    if (!text) return;
    const mine = { id: "me", body: text, at: Date.now() };
    setList((l) => [mine, ...(l ?? []).filter((t) => t.id !== "me")]);
    const st = _get();
    if (st.mode !== "live" || !st.me) {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ ...mine, day: today() }));
      return;
    }
    const { error } = await supabase
      .from("daily_thoughts" as never)
      .upsert(
        {
          user_id: st.me.id,
          day: today(),
          body: text,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,day" },
      );
    if (error) throw new Error(error.message);
  };

  const remove = async () => {
    setList((l) => (l ?? []).filter((t) => t.id !== "me"));
    const st = _get();
    if (st.mode !== "live" || !st.me) {
      localStorage.removeItem(DEMO_KEY);
      return;
    }
    await supabase
      .from("daily_thoughts" as never)
      .delete()
      .eq("user_id", st.me.id)
      .eq("day", today());
  };

  return { list, save, remove };
}
