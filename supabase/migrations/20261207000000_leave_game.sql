-- Quitting a game takes you off it (it leaves "Your games"). Your seat was
-- already handed to a bot or resigned by the app. If fewer than two people
-- are left, the game ends.
create or replace function public.leave_game(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g public.games;
  rest uuid[];
begin
  select * into g from public.games where id = p_id for update;
  if g.id is null or not (me = any (g.players)) then return; end if;
  rest := array_remove(g.players, me);
  update public.games
     set players = rest,
         status = case when cardinality(rest) < 2 then 'done' else status end,
         host = case when host = me and cardinality(rest) > 0 then rest[1] else host end,
         version = version + 1,
         updated_at = now()
   where id = p_id;
end $$;
revoke all on function public.leave_game(uuid) from public, anon;
grant execute on function public.leave_game(uuid) to authenticated;
