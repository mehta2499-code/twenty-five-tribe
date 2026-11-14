-- Live status at the Table: while you have 25 open, everyone who has you at
-- their Table can see that you're here and what you're doing (playing a game,
-- taking your Drop). Nobody else can read it.
alter table public.presence
  add column if not exists doing text check (doing is null or doing in ('game', 'drop')),
  add column if not exists detail text check (detail is null or char_length(detail) <= 40),
  add column if not exists ref text check (ref is null or char_length(ref) <= 80);

-- Heartbeat with what you're doing (null = just here).
create or replace function public.set_status(p_doing text, p_detail text default null, p_ref text default null)
returns void
language sql security definer set search_path = public as $$
  insert into public.presence (user_id, active_at, doing, detail, ref)
  values (auth.uid(), now(),
          case when p_doing in ('game', 'drop') then p_doing end,
          left(p_detail, 40), left(p_ref, 80))
  on conflict (user_id) do update
    set active_at = excluded.active_at, doing = excluded.doing,
        detail = excluded.detail, ref = excluded.ref
$$;
revoke all on function public.set_status(text, text, text) from public, anon;
grant execute on function public.set_status(text, text, text) to authenticated;

-- Leaving (or hiding the app) clears what you were doing too.
create or replace function public.set_active(p_active boolean) returns void
language sql security definer set search_path = public as $$
  insert into public.presence (user_id, active_at)
  values (auth.uid(), case when p_active then now() else null end)
  on conflict (user_id) do update
    set active_at = excluded.active_at,
        doing = case when p_active then public.presence.doing end,
        detail = case when p_active then public.presence.detail end,
        ref = case when p_active then public.presence.ref end
$$;
grant execute on function public.set_active(boolean) to authenticated;

-- Everyone at your Table who is in the app right now (seen in the last 90 seconds).
create or replace function public.friends_now()
returns table (user_id uuid, doing text, detail text, ref text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.doing, p.detail, p.ref
    from public.presence p
    join public.seats s on s.owner = auth.uid() and s.guest = p.user_id
   where p.active_at > now() - interval '90 seconds'
$$;
revoke all on function public.friends_now() from public, anon;
grant execute on function public.friends_now() to authenticated;
