-- =====================================================================
-- Daily game: one quick game a day (India time), same for everyone.
-- 3 tries a day; your score for the day is the average of your tries.
-- A try counts the moment you start it, so quitting a bad run doesn't help.
-- Plus Word Up: one daily word for everyone, and words you set for a friend.
-- =====================================================================

-- Monday..Sunday lineup.
create or replace function public.daily_game(d date) returns text
language sql immutable as $$
  select (array['tap-rush', 'quick-math', 'colour-clash', 'pair-up', 'odd-one-out', 'pattern', 'reflex'])
         [extract(isodow from d)::int]
$$;

create table if not exists public.daily_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  game text not null,
  -- one entry per try; -1 means started but not finished (counts as 0)
  tries int[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  check (cardinality(tries) <= 3)
);
alter table public.daily_scores enable row level security;

drop policy if exists "daily: you and your mutual 25" on public.daily_scores;
create policy "daily: you and your mutual 25" on public.daily_scores
  for select to authenticated using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
-- No insert/update policies: tries only change through the two functions below.

create or replace function public.start_daily_try() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d date := public.today_ist();
  t int[];
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select tries into t from public.daily_scores where user_id = me and day = d for update;
  if t is null then
    insert into public.daily_scores (user_id, day, game, tries)
    values (me, d, public.daily_game(d), array[-1]);
    return jsonb_build_object('day', d, 'try', 1, 'game', public.daily_game(d));
  end if;
  if cardinality(t) >= 3 then
    raise exception 'No tries left today. New game at midnight.';
  end if;
  update public.daily_scores set tries = tries || -1, updated_at = now()
   where user_id = me and day = d;
  return jsonb_build_object('day', d, 'try', cardinality(t) + 1, 'game', public.daily_game(d));
end $$;

create or replace function public.finish_daily_try(p_day date, p_score int) returns int[]
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t int[];
  n int;
begin
  if p_score < 0 or p_score > 1000 then raise exception 'That score doesn''t look right.'; end if;
  if p_day < public.today_ist() - 1 then raise exception 'That day is over.'; end if;
  select tries into t from public.daily_scores where user_id = me and day = p_day for update;
  n := coalesce(cardinality(t), 0);
  if n = 0 or t[n] <> -1 then raise exception 'Start a try first.'; end if;
  t[n] := p_score;
  update public.daily_scores set tries = t, updated_at = now() where user_id = me and day = p_day;
  return t;
end $$;

-- Word Up daily word: one go per day. guesses 1-6, or 7 when you didn't get it.
create table if not exists public.word_results (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  guesses int not null check (guesses between 1 and 7),
  grid text not null check (char_length(grid) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.word_results enable row level security;
drop policy if exists "words: you and your mutual 25" on public.word_results;
create policy "words: you and your mutual 25" on public.word_results
  for select to authenticated using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
drop policy if exists "words: post today's result" on public.word_results;
create policy "words: post today's result" on public.word_results
  for insert to authenticated
  with check (user_id = auth.uid() and day between public.today_ist() - 1 and public.today_ist());

-- "Set a word for a friend" lives in the games table.
alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check
  check (kind in ('kachuful', 'trivia', 'word'));

do $$
declare t text;
begin
  foreach t in array array['daily_scores', 'word_results', 'games']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
