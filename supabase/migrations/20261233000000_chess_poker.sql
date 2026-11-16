-- Chess (vs a friend; bot games aren't saved) and No-limit Hold'em tables.
alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check
  check (kind in ('kachuful', 'trivia', 'word', 'ludo', 'imposter', 'chess', 'poker'));

-- A poker host invites more of their 25 to a table that hasn't started yet.
create or replace function public.add_game_players(p_id uuid, p_players uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g public.games;
  add uuid[];
begin
  select * into g from public.games where id = p_id for update;
  if g.id is null or g.host <> me then raise exception 'Only the host can invite people.'; end if;
  if g.kind <> 'poker' or g.status <> 'playing' or g.state->>'phase' <> 'lobby' then
    raise exception 'The game has already started.';
  end if;
  select coalesce(array_agg(distinct p), '{}') into add
    from unnest(p_players) p
   where not (p = any (g.players)) and public.is_friend(me, p) and not public.is_blocked(me, p);
  if cardinality(add) = 0 then return; end if;
  update public.games
     set players = players || add, version = version + 1, updated_at = now()
   where id = p_id;
end $$;
revoke all on function public.add_game_players(uuid, uuid[]) from public, anon;
grant execute on function public.add_game_players(uuid, uuid[]) to authenticated;
