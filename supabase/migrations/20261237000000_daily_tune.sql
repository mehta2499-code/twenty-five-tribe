-- Name That Tune as the third daily game: one song a day, the same for
-- everyone. Bollywood, then Punjabi, then English, round and round; medium or
-- hard. A daily song is never used twice. Quickest correct answer wins.

create table if not exists public.daily_tunes (
  day date primary key,
  cat text not null check (cat in ('bollywood', 'punjabi', 'english')),
  level text not null check (level in ('medium', 'hard')),
  song_id text not null unique check (song_id ~ '^[0-9]{1,15}$'),
  title text not null check (char_length(title) <= 200),
  artist text not null check (char_length(artist) <= 200),
  created_at timestamptz not null default now()
);
alter table public.daily_tunes enable row level security;
grant select on public.daily_tunes to authenticated;
drop policy if exists "daily tunes: everyone signed in" on public.daily_tunes;
create policy "daily tunes: everyone signed in" on public.daily_tunes
  for select to authenticated using (true);

-- Today's song: the first person to open it picks it from a few candidates
-- (the first one never used before); everyone after gets the same one.
create or replace function public.claim_daily_tune(
  p_cat text, p_level text, p_ids text[], p_titles text[], p_artists text[]
) returns public.daily_tunes
language plpgsql security definer set search_path = public as $$
declare
  d date := public.today_ist();
  r public.daily_tunes;
  i int;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into r from public.daily_tunes where day = d;
  if found then return r; end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    begin
      insert into public.daily_tunes (day, cat, level, song_id, title, artist)
      values (d, p_cat, p_level, p_ids[i], left(p_titles[i], 200), left(p_artists[i], 200))
      returning * into r;
      return r;
    exception
      when unique_violation then
        -- Someone else just picked today's song, or this song was used before.
        select * into r from public.daily_tunes where day = d;
        if found then return r; end if;
    end;
  end loop;
  raise exception 'Couldn''t pick a song. Try again.';
end $$;
revoke all on function public.claim_daily_tune(text, text, text[], text[], text[]) from public, anon;
grant execute on function public.claim_daily_tune(text, text, text[], text[], text[]) to authenticated;

-- Results: how long it took to name it (ms), or null if missed.
create table if not exists public.tune_results (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  ms int check (ms is null or ms between 0 and 3600000),
  stage int check (stage is null or stage between 0 and 10),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.tune_results enable row level security;
grant select, insert on public.tune_results to authenticated;
drop policy if exists "tunes: you and your mutual 25" on public.tune_results;
create policy "tunes: you and your mutual 25" on public.tune_results
  for select to authenticated using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
drop policy if exists "tunes: post today's result" on public.tune_results;
create policy "tunes: post today's result" on public.tune_results
  for insert to authenticated
  with check (user_id = auth.uid() and day between public.today_ist() - 1 and public.today_ist());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tune_results'
  ) then
    alter publication supabase_realtime add table public.tune_results;
  end if;
end $$;

-- Season points now count all three daily games.
create or replace function public.circle_points(p_user uuid, p_from date, p_to date)
returns table (user_id uuid, points int)
language sql stable security definer set search_path = public as $$
with circle as (
  select p_user as id
  union
  select s.guest from public.seats s
   where s.owner = p_user and public.is_friend(p_user, s.guest)
),
best as (
  select d.user_id, d.day, (select max(t) from unnest(d.tries) t) as best
    from public.daily_scores d
   where d.user_id in (select id from circle) and d.day between p_from and p_to
),
game as (
  select user_id,
         case rank() over (partition by day order by best desc)
           when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end as pts
    from best where best is not null and best >= 0
),
word as (
  select w.user_id,
         case when w.guesses > 6 then 2
              else case rank() over (partition by w.day order by w.guesses)
                when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end
         end as pts
    from public.word_results w
   where w.user_id in (select id from circle) and w.day between p_from and p_to
),
tune as (
  select t.user_id,
         case when t.ms is null then 2
              else case rank() over (partition by t.day, (t.ms is null) order by t.ms)
                when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end
         end as pts
    from public.tune_results t
   where t.user_id in (select id from circle) and t.day between p_from and p_to
)
select user_id, sum(pts)::int from (
  select user_id, pts from game
  union all select user_id, pts from word
  union all select user_id, pts from tune
) x group by user_id
$$;
revoke all on function public.circle_points(uuid, date, date) from public, anon, authenticated;
