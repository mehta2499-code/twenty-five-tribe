-- Pen fight: how many games you've won against your 25 (unlocks pens and medals).
create or replace function public.my_pen_wins()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.games g
   where g.kind = 'penfight'
     and g.status = 'done'
     and auth.uid() = any (g.players)
     and (g.state ? 'winner')
     and (g.state -> 'players' ->> ((g.state ->> 'winner')::int)) = auth.uid()::text
$$;
revoke all on function public.my_pen_wins() from public, anon;
grant execute on function public.my_pen_wins() to authenticated;
