-- =====================================================================
-- Analytics: a private event log and an admin-only stats function.
--
-- Events hold only the event name and small, non-personal properties
-- (counts, true/false, game names). Never message text, images or quiz
-- answers. Nobody can read events from the app; only admin_stats() sees
-- them, and only for accounts listed in app_admins.
--
-- To make yourself admin, run ONCE in Supabase → SQL Editor (your email):
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- =====================================================================

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  anon_id text not null check (char_length(anon_id) between 8 and 64),
  event_name text not null check (char_length(event_name) between 1 and 40),
  properties jsonb not null default '{}'::jsonb check (pg_column_size(properties) < 1024),
  created_at timestamptz not null default now()
);
create index if not exists events_name_time_idx on public.events (event_name, created_at desc);
create index if not exists events_user_time_idx on public.events (user_id, created_at desc);
create index if not exists events_anon_idx on public.events (anon_id);
alter table public.events enable row level security;
-- No policies: the app can't read or write this table directly.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- No policies: only the SQL editor (or security-definer functions) can see it.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Log one event. Works signed in (user_id filled) or not (anon_id only).
create or replace function public.track_event(p_anon text, p_name text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_name not in (
    'app_open', 'pwa_installed', 'signup_completed', 'seat_added', 'quiz_started',
    'quiz_completed', 'mutual_seat', 'blink_sent', 'post_created', 'game_started',
    'leaderboard_viewed'
  ) then
    return;
  end if;
  if p_anon is null or char_length(p_anon) not between 8 and 64 then return; end if;
  -- Light flood guard: at most 120 events a minute from one browser.
  if (select count(*) from public.events
       where anon_id = p_anon and created_at > now() - interval '1 minute') >= 120 then
    return;
  end if;
  insert into public.events (user_id, anon_id, event_name, properties)
  values (auth.uid(), p_anon, p_name,
          case when jsonb_typeof(p_props) = 'object' and pg_column_size(p_props) < 1024
               then p_props else '{}'::jsonb end);
exception when others then
  return; -- analytics must never break the app
end $$;
revoke all on function public.track_event(text, text, jsonb) from public;
grant execute on function public.track_event(text, text, jsonb) to anon, authenticated;

-- Everything the admin panel shows, worked out on the server.
-- Non-admins get an error that the app shows as a 404.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d date := public.today_ist();
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  with
  ev as (
    select e.*, (e.created_at at time zone 'Asia/Kolkata')::date as day,
           coalesce(e.user_id::text, e.anon_id) as who
      from public.events e
  ),
  people as (
    select p.id, p.display_name, p.username, p.created_at,
           (p.created_at at time zone 'Asia/Kolkata')::date as signup_day
      from public.profiles p
  ),
  standalone_users as (
    select distinct user_id from ev
     where event_name = 'app_open' and (properties->>'standalone')::boolean and user_id is not null
  ),
  seaters as (select distinct owner as id from public.seats),
  mutuals as (
    select distinct s.owner as id
      from public.seats s
      join public.seats r on r.owner = s.guest and r.guest = s.owner
  ),
  active as (
    select day, user_id from ev where user_id is not null group by day, user_id
  ),
  cohorts as (
    select p.signup_day as day, count(*) as signed_up,
           count(*) filter (where exists (select 1 from active a where a.user_id = p.id and a.day = p.signup_day + 1)) as d1,
           count(*) filter (where exists (select 1 from active a where a.user_id = p.id and a.day = p.signup_day + 7)) as d7,
           count(*) filter (where exists (select 1 from active a where a.user_id = p.id and a.day = p.signup_day + 14)) as d14
      from people p
     where p.signup_day >= d - 30
     group by p.signup_day
  ),
  days as (select generate_series(d - 29, d, interval '1 day')::date as day)
  select jsonb_build_object(
    'generated_at', now(),
    'cards', jsonb_build_object(
      'visitors', (select count(distinct anon_id) from ev),
      'signups', (select count(*) from people),
      'home_screen_users', (select count(distinct who) from ev
                             where event_name = 'app_open' and (properties->>'standalone')::boolean),
      'mutual_users', (select count(*) from mutuals),
      'active_today', (select count(distinct user_id) from ev where user_id is not null and day = d),
      'active_7d', (select count(distinct user_id) from ev where user_id is not null and day > d - 7)
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Visited', 'n', (select count(distinct anon_id) from ev)),
      jsonb_build_object('step', 'Signed up', 'n', (select count(*) from people)),
      jsonb_build_object('step', 'Seated ≥1 person', 'n', (select count(*) from seaters s join people p on p.id = s.id)),
      jsonb_build_object('step', 'Got ≥1 mutual seat', 'n', (select count(*) from mutuals m join people p on p.id = m.id)),
      jsonb_build_object('step', 'Opened from home screen', 'n', (select count(*) from standalone_users u join people p on p.id = u.user_id))
    ),
    'retention', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', c.day, 'signed_up', c.signed_up,
               'd1', case when c.day + 1 <= d then c.d1 end,
               'd7', case when c.day + 7 <= d then c.d7 end,
               'd14', case when c.day + 14 <= d then c.d14 end)
             order by c.day desc)
        from cohorts c), '[]'::jsonb),
    'features_7d', jsonb_build_object(
      'quizzes', (select count(*) from ev where event_name = 'quiz_completed' and day > d - 7),
      'quizzes_started', (select count(*) from ev where event_name = 'quiz_started' and day > d - 7),
      'blinks', (select count(*) from ev where event_name = 'blink_sent' and day > d - 7),
      'posts', (select count(*) from ev where event_name = 'post_created' and day > d - 7),
      'games', (select count(*) from ev where event_name = 'game_started' and day > d - 7),
      'leaderboard_views', (select count(*) from ev where event_name = 'leaderboard_viewed' and day > d - 7),
      'seats', (select count(*) from ev where event_name = 'seat_added' and day > d - 7),
      'mutual_seats', (select count(*) from ev where event_name = 'mutual_seat' and day > d - 7),
      'installs', (select count(*) from ev where event_name = 'pwa_installed' and day > d - 7)
    ),
    'games_7d', coalesce((
      select jsonb_object_agg(g, n) from (
        select coalesce(properties->>'game', 'other') as g, count(*) as n
          from ev where event_name = 'game_started' and day > d - 7 group by 1
      ) x), '{}'::jsonb),
    'daily', (
      select jsonb_agg(jsonb_build_object(
               'day', ds.day,
               'signups', (select count(*) from people p where p.signup_day = ds.day),
               'active', (select count(distinct user_id) from ev where user_id is not null and ev.day = ds.day),
               'visitors', (select count(distinct anon_id) from ev where ev.day = ds.day))
             order by ds.day)
        from days ds),
    'recent', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select p.display_name as name, p.username, p.created_at,
               (select count(*) from public.seats s where s.owner = p.id) as seats,
               exists (select 1 from standalone_users u where u.user_id = p.id) as home_screen
          from people p
         order by p.created_at desc
         limit 20
      ) x), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
