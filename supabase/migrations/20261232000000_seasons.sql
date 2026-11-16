-- Seasons: 25 days each (India time), season 1 starts 16 Nov 2026.
-- Points are the same as the daily leaderboard (daily game + Word Up, by your
-- place at your table each day). When a season ends, everyone who finished #1
-- among their own 25 (them + their mutual 25) gets that season's winner title.

create or replace function public.season_start(p_season int) returns date
language sql immutable as $$
  select date '2026-11-16' + (p_season - 1) * 25
$$;

create or replace function public.season_of(p_day date) returns int
language sql immutable as $$
  select (floor((p_day - date '2026-11-16') / 25.0))::int + 1
$$;

-- Points for everyone in one person's circle, between two days (inclusive).
-- Internal only: it can see past what that person is allowed to see.
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
)
select user_id, sum(pts)::int from (
  select user_id, pts from game union all select user_id, pts from word
) x group by user_id
$$;
revoke all on function public.circle_points(uuid, date, date) from public, anon, authenticated;

create table if not exists public.season_winners (
  season int not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points int not null,
  created_at timestamptz not null default now(),
  primary key (season, user_id)
);
alter table public.season_winners enable row level security;
grant select on public.season_winners to authenticated;
drop policy if exists "season winners: anyone signed in sees titles" on public.season_winners;
create policy "season winners: anyone signed in sees titles" on public.season_winners
  for select to authenticated using (true);

create table if not exists public.seasons_awarded (
  season int primary key,
  at timestamptz not null default now()
);
alter table public.seasons_awarded enable row level security;

-- Hand out titles for every season that has ended and isn't done yet.
create or replace function public.award_seasons() returns void
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  s int;
  f date;
  t date;
  u uuid;
  mine int;
  top int;
  rivals int;
begin
  for s in 1 .. public.season_of(today) - 1 loop
    continue when exists (select 1 from public.seasons_awarded where season = s);
    f := public.season_start(s);
    t := f + 24;
    for u in
      select d.user_id from public.daily_scores d where d.day between f and t
      union
      select w.user_id from public.word_results w where w.day between f and t
    loop
      select coalesce(max(points) filter (where user_id = u), 0), coalesce(max(points), 0),
             count(*) filter (where user_id <> u and points > 0)
        into mine, top, rivals
        from public.circle_points(u, f, t);
      -- #1 among your 25, and at least one of them played too.
      if mine > 0 and mine = top and rivals > 0 then
        insert into public.season_winners (season, user_id, points)
        values (s, u, mine) on conflict do nothing;
        if found then
          begin
            perform public.push_to(
              array[u],
              '🏆 Season ' || s || ' winner',
              'You topped your 25 this season. The title is yours.',
              '/app/games',
              'season-' || s);
          exception when others then null;
          end;
        end if;
      end if;
    end loop;
    insert into public.seasons_awarded (season) values (s) on conflict do nothing;
  end loop;
end $$;
revoke all on function public.award_seasons() from public, anon, authenticated;

-- Every day just after midnight India time (18:35 UTC).
do $$
begin
  perform cron.unschedule('25-seasons') where exists (select 1 from cron.job where jobname = '25-seasons');
  perform cron.schedule('25-seasons', '35 18 * * *', 'select public.award_seasons()');
exception when others then
  raise notice 'pg_cron not available; season titles are off';
end $$;
