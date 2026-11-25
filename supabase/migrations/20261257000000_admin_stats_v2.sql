-- =====================================================================
-- Admin stats: fix the measurement gaps.
--  * Visitors / home-screen users: a browser that has ever been signed in
--    counts as that person (iPhone Safari + its home-screen app were two).
--  * Active today / 7 days / the chart: from user_days (any real use), not
--    just the analytics log.
--  * Feature usage adds Drops posted and messages sent (chats + groups).
--  * New "health" block: people active this week, stickiness (average
--    daily active ÷ weekly active) and week-1 retention, each vs last week.
-- =====================================================================
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
  -- Each browser that has ever been signed in belongs to that person, so a
  -- phone's Safari and its home-screen app (separate storage on iPhone)
  -- count as one visitor once they've signed in on both.
  owner as (
    select anon_id, (array_agg(user_id order by created_at desc))[1] as user_id
      from public.events where user_id is not null group by anon_id
  ),
  ev as (
    select e.*, (e.created_at at time zone 'Asia/Kolkata')::date as day,
           coalesce(e.user_id, o.user_id)::text as person,
           coalesce(e.user_id::text, o.user_id::text, e.anon_id) as who
      from public.events e
      left join owner o on o.anon_id = e.anon_id
  ),
  people as (
    select p.id, p.display_name, p.username, p.created_at,
           (p.created_at at time zone 'Asia/Kolkata')::date as signup_day
      from public.profiles p
  ),
  standalone_users as (
    select distinct person::uuid as user_id from ev
     where event_name = 'app_open' and (properties->>'standalone')::boolean and person is not null
  ),
  seaters as (select distinct owner as id from public.seats),
  mutuals as (
    select distinct s.owner as id
      from public.seats s
      join public.seats r on r.owner = s.guest and r.guest = s.owner
  ),
  active as (
    select day, user_id from public.user_days
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
      'visitors', (select count(distinct who) from ev),
      'signups', (select count(*) from people),
      'home_screen_users', (select count(distinct who) from ev
                             where event_name = 'app_open' and (properties->>'standalone')::boolean),
      'mutual_users', (select count(*) from mutuals),
      'active_today', (select count(distinct user_id) from active where day = d),
      'active_7d', (select count(distinct user_id) from active where day > d - 7)
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Visited', 'n', (select count(distinct who) from ev)),
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
      'installs', (select count(*) from ev where event_name = 'pwa_installed' and day > d - 7),
      'drops', (select count(*) from public.drops where day > d - 7),
      'messages', (select count(*) from public.messages
                    where (created_at at time zone 'Asia/Kolkata')::date > d - 7)
                + (select count(*) from public.group_messages
                    where (created_at at time zone 'Asia/Kolkata')::date > d - 7)
    ),
    -- The three numbers to watch each week (this week vs the week before).
    'health', jsonb_build_object(
      'wau', (select count(distinct user_id) from active where day between d - 7 and d - 1),
      'wau_prev', (select count(distinct user_id) from active where day between d - 14 and d - 8),
      -- Average people active a day ÷ people active that week (complete days only).
      'stickiness', (select round(avg(n)::numeric / nullif(max(w), 0), 3) from (
          select (select count(*) from active a where a.day = x.day) as n,
                 (select count(distinct user_id) from active where day between d - 7 and d - 1) as w
            from generate_series(d - 7, d - 1, interval '1 day') as x(day)) s),
      'stickiness_prev', (select round(avg(n)::numeric / nullif(max(w), 0), 3) from (
          select (select count(*) from active a where a.day = x.day) as n,
                 (select count(distinct user_id) from active where day between d - 14 and d - 8) as w
            from generate_series(d - 14, d - 8, interval '1 day') as x(day)) s),
      -- Week-1 retention: signed up 8-14 days ago, active at least once on days 1-7.
      'week1', (select jsonb_build_object('of', count(*),
                  'returned', count(*) filter (where exists (
                     select 1 from active a where a.user_id = p.id
                        and a.day between p.signup_day + 1 and p.signup_day + 7)))
                  from people p where p.signup_day between d - 14 and d - 8),
      'week1_prev', (select jsonb_build_object('of', count(*),
                  'returned', count(*) filter (where exists (
                     select 1 from active a where a.user_id = p.id
                        and a.day between p.signup_day + 1 and p.signup_day + 7)))
                  from people p where p.signup_day between d - 21 and d - 15)
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
               'active', (select count(*) from active a where a.day = ds.day),
               'visitors', (select count(distinct who) from ev where ev.day = ds.day))
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
