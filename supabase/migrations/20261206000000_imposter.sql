-- Imposter: a party game anyone with the link can join (not just your 25),
-- so a group in the same room can all play.
alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check
  check (kind in ('kachuful', 'trivia', 'word', 'ludo', 'imposter'));

-- Join a party from its link while it's still in the lobby.
create or replace function public.join_party(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g public.games;
  p public.profiles;
  initials text;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select * into g from public.games where id = p_id for update;
  if g.id is null or g.kind <> 'imposter' then raise exception 'That party doesn''t exist.'; end if;
  if me = any (g.players) then return; end if;
  if g.status <> 'playing' or g.state->>'phase' <> 'lobby' then
    raise exception 'This round already started. Ask the host to let you in next round.';
  end if;
  if public.is_blocked(me, g.host) then raise exception 'You can''t join this party.'; end if;
  if cardinality(g.players) >= 20 then raise exception 'The party is full (20 max).'; end if;
  select * into p from public.profiles where id = me;
  initials := upper(left(coalesce(p.display_name, '?'), 1)
              || coalesce(left(split_part(p.display_name, ' ', 2), 1), ''));
  update public.games
     set players = array_append(players, me),
         state = jsonb_set(state, '{players}',
                   (state->'players') || jsonb_build_array(jsonb_build_object(
                     'id', me, 'name', coalesce(p.display_name, 'Someone'), 'initials', initials))),
         version = version + 1,
         updated_at = now()
   where id = p_id;
end $$;
revoke all on function public.join_party(uuid) from public, anon;
grant execute on function public.join_party(uuid) to authenticated;
