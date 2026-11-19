-- Name That Tune: which songs each person has heard (any game, any phone), so
-- a game can skip songs anyone playing it had recently. Song ids only.
create table if not exists public.ear_heard (
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_id text not null check (char_length(song_id) between 1 and 300),
  heard_at timestamptz not null default now(),
  primary key (user_id, song_id)
);
alter table public.ear_heard enable row level security;
grant select, insert, update, delete on public.ear_heard to authenticated;
drop policy if exists "heard: your own" on public.ear_heard;
create policy "heard: your own" on public.ear_heard
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Songs you, or anyone in your mutual 25 among p_users, heard in the last 60 days.
create or replace function public.songs_heard(p_users uuid[])
returns setof text
language sql stable security definer set search_path = public as $$
  select distinct h.song_id
    from public.ear_heard h
   where h.heard_at > now() - interval '60 days'
     and (h.user_id = auth.uid()
          or (h.user_id = any (p_users) and public.is_friend(auth.uid(), h.user_id)))
   limit 4000
$$;
revoke all on function public.songs_heard(uuid[]) from public, anon;
grant execute on function public.songs_heard(uuid[]) to authenticated;
