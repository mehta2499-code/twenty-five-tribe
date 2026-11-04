-- =====================================================================
-- 25 — multiplayer games (Kachuful / Judgement, trivia challenges)
-- Run after 20261104000000_social_core.sql, in the SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('kachuful', 'trivia')),
  host uuid not null references public.profiles (id) on delete cascade,
  players uuid[] not null,
  status text not null default 'playing' check (status in ('playing', 'done')),
  state jsonb not null default '{}'::jsonb,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host = any (players)),
  check (cardinality(players) between 1 and 7)
);
create index if not exists games_players_idx on public.games using gin (players);
alter table public.games enable row level security;

-- Everyone you invite has to be in your 25.
create or replace function public.all_in_circle(h uuid, ps uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(bool_and(p = h or public.is_friend(h, p)), true) from unnest(ps) as p
$$;

drop policy if exists "games: players can see their games" on public.games;
create policy "games: players can see their games" on public.games
  for select to authenticated using (auth.uid() = any (players));
drop policy if exists "games: start a game with your 25" on public.games;
create policy "games: start a game with your 25" on public.games
  for insert to authenticated
  with check (host = auth.uid() and public.all_in_circle(host, players) and version = 0);
drop policy if exists "games: host can delete" on public.games;
create policy "games: host can delete" on public.games
  for delete to authenticated using (host = auth.uid());

-- Moves go through here: only players can save, and only on top of the version they saw,
-- so two phones can't overwrite each other.
create or replace function public.save_game(p_id uuid, p_version int, p_state jsonb, p_status text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  next_version int;
begin
  update public.games
     set state = p_state,
         status = coalesce(p_status, status),
         version = version + 1,
         updated_at = now()
   where id = p_id
     and version = p_version
     and auth.uid() = any (players)
  returning version into next_version;
  if next_version is null then
    raise exception 'stale game: someone moved first';
  end if;
  return next_version;
end $$;

-- Game invites show up in chat as messages with shared_ref = 'game:<id>'.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;
