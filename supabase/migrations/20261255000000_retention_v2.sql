-- =====================================================================
-- Retention, done properly (admin panel).
--
-- 1. user_days: one row per person per India-time day they were active.
--    "Active" = any real use: a tap/keypress heartbeat (set_active), an
--    analytics event, a chat or group message, a post, a Drop, or a daily
--    game try. Backfilled from what's already stored, then kept up to date.
--    (Before this, only the analytics log counted, and that misses people
--    who resume the home-screen app without a fresh page load.)
--
-- 2. admin_retention(group, mode, filter): cohort table, aggregated here.
--    Day 0 is the India-time calendar day of signup. A person only counts
--    in a column once that day/window is completely over (immature people
--    are left out of both the top and bottom of the fraction).
--      exact:  day +1, day +7, day +14
--      window: days +1..3, +4..7, +8..14 (active at least once)
--    group: daily (last 30 days, empty days included) or weekly (last 8
--    rolling 7-day buckets ending today). filter: all | activated
--    (activated = has at least one mutual seat).
--
-- 3. admin_retention_users(...): the people behind one cell, for the
--    drill-down drawer.
-- =====================================================================

create table if not exists public.user_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.user_days enable row level security;
-- No policies: only security-definer functions read or write it.

-- Backfill from everything that already says someone used the app that day.
insert into public.user_days (user_id, day)
select distinct x.uid, x.day from (
  select e.user_id as uid, (e.created_at at time zone 'Asia/Kolkata')::date as day
    from public.events e where e.user_id is not null
  union all
  select m.sender, (m.created_at at time zone 'Asia/Kolkata')::date from public.messages m
  union all
  select g.sender, (g.created_at at time zone 'Asia/Kolkata')::date from public.group_messages g
  union all
  select p.author, (p.created_at at time zone 'Asia/Kolkata')::date from public.posts p
  union all
  select d.user_id, (d.created_at at time zone 'Asia/Kolkata')::date from public.drops d
  union all
  select s.user_id, (s.updated_at at time zone 'Asia/Kolkata')::date from public.daily_scores s
  union all
  select pr.user_id, (pr.active_at at time zone 'Asia/Kolkata')::date
    from public.presence pr where pr.active_at is not null
) x
where exists (select 1 from public.profiles p where p.id = x.uid)
on conflict do nothing;

-- Record a day of activity (quietly; never gets in the way).
create or replace function public.note_active_day(p_user uuid, p_at timestamptz default now())
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.user_days (user_id, day)
  select p_user, (p_at at time zone 'Asia/Kolkata')::date
   where exists (select 1 from public.profiles where id = p_user)
  on conflict do nothing;
exception when others then
  return;
end $$;
revoke all on function public.note_active_day(uuid, timestamptz) from public, anon, authenticated;

-- The heartbeat (sent on real taps and keypresses while the app is open).
create or replace function public.set_active(p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.presence (user_id, active_at)
  values (auth.uid(), case when p_active then now() else null end)
  on conflict (user_id) do update
    set active_at = excluded.active_at,
        doing = case when p_active then public.presence.doing end,
        detail = case when p_active then public.presence.detail end,
        ref = case when p_active then public.presence.ref end;
  if p_active then perform public.note_active_day(auth.uid()); end if;
end $$;
grant execute on function public.set_active(boolean) to authenticated;

-- New events, messages and posts count too.
create or replace function public.trg_active_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.note_active_day(
    case tg_table_name
      when 'events' then new.user_id
      when 'messages' then new.sender
      when 'group_messages' then new.sender
      when 'posts' then new.author
      when 'drops' then new.user_id
    end,
    new.created_at);
  return null;
end $$;
drop trigger if exists active_day on public.events;
create trigger active_day after insert on public.events
  for each row when (new.user_id is not null) execute function public.trg_active_day();
drop trigger if exists active_day on public.messages;
create trigger active_day after insert on public.messages
  for each row execute function public.trg_active_day();
drop trigger if exists active_day on public.group_messages;
create trigger active_day after insert on public.group_messages
  for each row execute function public.trg_active_day();
drop trigger if exists active_day on public.posts;
create trigger active_day after insert on public.posts
  for each row execute function public.trg_active_day();
drop trigger if exists active_day on public.drops;
create trigger active_day after insert on public.drops
  for each row execute function public.trg_active_day();

-- ---------------------------------------------------------------------
-- Shared: who's in scope, their cohort, and per column whether they're
-- old enough to count (eligible) and whether they came back (returned).
-- ---------------------------------------------------------------------
create or replace function public.admin_retention_flags(p_group text, p_mode text, p_filter text)
returns table (
  user_id uuid, signup_day date, cohort_start date, cohort_end date,
  e1 boolean, r1 boolean, e2 boolean, r2 boolean, e3 boolean, r3 boolean
)
language sql stable security definer set search_path = public as $$
  with
  cfg as (
    select public.today_ist() as d,
           case when p_group = 'weekly' then 56 else 30 end as span,
           case when p_mode = 'window' then array[1, 4, 8] else array[1, 7, 14] end as a,
           case when p_mode = 'window' then array[3, 7, 14] else array[1, 7, 14] end as b
  ),
  u as (
    select p.id, (p.created_at at time zone 'Asia/Kolkata')::date as sd
      from public.profiles p, cfg
     where (p.created_at at time zone 'Asia/Kolkata')::date > cfg.d - cfg.span
       and (p_filter is distinct from 'activated' or exists (
             select 1 from public.seats s
               join public.seats r on r.owner = s.guest and r.guest = s.owner
              where s.owner = p.id))
  )
  select u.id, u.sd,
         case when p_group = 'weekly' then cfg.d - 6 - 7 * ((cfg.d - u.sd) / 7) else u.sd end,
         case when p_group = 'weekly' then cfg.d - 7 * ((cfg.d - u.sd) / 7) else u.sd end,
         u.sd + cfg.b[1] < cfg.d,
         exists (select 1 from public.user_days a where a.user_id = u.id
                  and a.day between u.sd + cfg.a[1] and u.sd + cfg.b[1]),
         u.sd + cfg.b[2] < cfg.d,
         exists (select 1 from public.user_days a where a.user_id = u.id
                  and a.day between u.sd + cfg.a[2] and u.sd + cfg.b[2]),
         u.sd + cfg.b[3] < cfg.d,
         exists (select 1 from public.user_days a where a.user_id = u.id
                  and a.day between u.sd + cfg.a[3] and u.sd + cfg.b[3])
    from u, cfg
$$;
revoke all on function public.admin_retention_flags(text, text, text) from public, anon, authenticated;

-- The cohort table: one row per cohort (empty days/weeks included), each
-- column as {returned, eligible}, plus the weighted totals.
create or replace function public.admin_retention(
  p_group text default 'daily', p_mode text default 'exact', p_filter text default 'all'
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d date := public.today_ist();
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  with
  f as (select * from public.admin_retention_flags(p_group, p_mode, p_filter)),
  buckets as (
    select case when p_group = 'weekly' then d - 6 - 7 * k else d - k end as cs,
           case when p_group = 'weekly' then d - 7 * k else d - k end as ce
      from generate_series(0, case when p_group = 'weekly' then 7 else 29 end) k
  ),
  agg as (
    select b.cs, b.ce,
           count(f.user_id) as people,
           count(f.user_id) filter (where f.e1) as e1, count(f.user_id) filter (where f.e1 and f.r1) as r1,
           count(f.user_id) filter (where f.e2) as e2, count(f.user_id) filter (where f.e2 and f.r2) as r2,
           count(f.user_id) filter (where f.e3) as e3, count(f.user_id) filter (where f.e3 and f.r3) as r3
      from buckets b
      left join f on f.cohort_start = b.cs
     group by b.cs, b.ce
  )
  select jsonb_build_object(
    'today', d,
    'rows', coalesce(jsonb_agg(jsonb_build_object(
              'start', a.cs, 'end', a.ce, 'people', a.people,
              'cols', jsonb_build_array(
                jsonb_build_object('returned', a.r1, 'eligible', a.e1),
                jsonb_build_object('returned', a.r2, 'eligible', a.e2),
                jsonb_build_object('returned', a.r3, 'eligible', a.e3)))
            order by a.cs desc), '[]'::jsonb),
    'total', jsonb_build_object(
      'people', coalesce(sum(a.people), 0),
      'cols', jsonb_build_array(
        jsonb_build_object('returned', coalesce(sum(a.r1), 0), 'eligible', coalesce(sum(a.e1), 0)),
        jsonb_build_object('returned', coalesce(sum(a.r2), 0), 'eligible', coalesce(sum(a.e2), 0)),
        jsonb_build_object('returned', coalesce(sum(a.r3), 0), 'eligible', coalesce(sum(a.e3), 0))))
  ) into result
  from agg a;
  return result;
end $$;
revoke all on function public.admin_retention(text, text, text) from public, anon;
grant execute on function public.admin_retention(text, text, text) to authenticated;

-- The people behind a cell. p_col 0 = everyone in the cohort; 1-3 = that
-- column (only people old enough to count, each marked returned or not).
create or replace function public.admin_retention_users(
  p_start date, p_group text, p_mode text, p_filter text, p_col int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', p.display_name,
           'username', p.username,
           'email', au.email,
           'signed_up', p.created_at,
           -- The exact time if we have one from that day; otherwise just the day.
           'last_active', case when la.ts is not null
                                and (la.ts at time zone 'Asia/Kolkata')::date >= coalesce(la.day, '-infinity')
                               then la.ts::text else la.day::text end,
           'seats', (select count(*) from public.seats s where s.owner = p.id),
           'mutuals', (select count(*) from public.seats s
                         join public.seats r on r.owner = s.guest and r.guest = s.owner
                        where s.owner = p.id),
           'returned', case p_col when 1 then f.r1 when 2 then f.r2 when 3 then f.r3
                       else (f.r1 or f.r2 or f.r3) end)
         order by p.created_at desc), '[]'::jsonb)
    into result
    from public.admin_retention_flags(p_group, p_mode, p_filter) f
    join public.profiles p on p.id = f.user_id
    left join auth.users au on au.id = p.id
    left join lateral (
      select greatest(
               (select pr.active_at from public.presence pr where pr.user_id = p.id),
               (select max(e.created_at) from public.events e where e.user_id = p.id)) as ts,
             (select max(ud.day) from public.user_days ud where ud.user_id = p.id) as day
    ) la on true
   where f.cohort_start = p_start
     and case p_col when 1 then f.e1 when 2 then f.e2 when 3 then f.e3 else true end;
  return result;
end $$;
revoke all on function public.admin_retention_users(date, text, text, text, int) from public, anon;
grant execute on function public.admin_retention_users(date, text, text, text, int) to authenticated;
