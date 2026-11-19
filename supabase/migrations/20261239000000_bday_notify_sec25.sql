-- =====================================================================
-- Birthdays out in the open, quieter game pushes, and 25 Sec.
--  * Birthday cards: the birthday person's mutual 25 can read every wish
--    (the birthday person still only sees theirs on the day).
--  * Pushes at 12 AM India time: birthdays (wish them), "your card is ready",
--    and "today's games are out". No more 10 AM / 1 PM reminders.
--  * Daily scores no longer ping everyone. Only "X just beat you", sent when
--    X's new best passes yours and you still have a try left to hit back.
--  * 25 Sec: a new daily game. Stop the clock at exactly 25 seconds without
--    seeing it. Closest wins. 3 tries, best one counts.
--  * Daily Name That Tune ranks by skips (fewest wins), not by time.
-- =====================================================================

-- ---------- Birthday cards: readable by the birthday person's 25 ----------
drop policy if exists "cards: birthday person and signers" on public.birthday_cards;
create policy "cards: birthday person and signers" on public.birthday_cards
  for select to authenticated
  using (
    (target = auth.uid() and public.card_open(target, year))
    or author = auth.uid()
    or public.signed_card(target, year)
    or public.is_friend(auth.uid(), target)
  );

-- ---------- 25 Sec ----------
-- tries: how far off 25 s each try landed (ms); -1 = started, not stopped.
create table if not exists public.sec25_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  tries int[] not null default '{}',
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  check (cardinality(tries) <= 3)
);
alter table public.sec25_scores enable row level security;
grant select on public.sec25_scores to authenticated;
drop policy if exists "sec25: you and your mutual 25" on public.sec25_scores;
create policy "sec25: you and your mutual 25" on public.sec25_scores
  for select to authenticated using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
-- No insert/update policies: tries only change through the two functions below.

create or replace function public.start_sec25_try() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d date := public.today_ist();
  t int[];
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select tries into t from public.sec25_scores where user_id = me and day = d for update;
  if t is null then
    insert into public.sec25_scores (user_id, day, tries, started_at) values (me, d, array[-1], now());
    return jsonb_build_object('day', d, 'try', 1);
  end if;
  if cardinality(t) >= 3 then raise exception 'No tries left today. Back at midnight.'; end if;
  update public.sec25_scores set tries = tries || -1, started_at = now(), updated_at = now()
   where user_id = me and day = d;
  return jsonb_build_object('day', d, 'try', cardinality(t) + 1);
end $$;
revoke all on function public.start_sec25_try() from public, anon;
grant execute on function public.start_sec25_try() to authenticated;

-- p_ms: how long they held, as their phone measured it. The server checks it
-- against its own clock (you can't claim more time than really passed).
create or replace function public.finish_sec25_try(p_day date, p_ms int) returns int[]
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t int[];
  s timestamptz;
  n int;
  real_ms int;
begin
  if p_ms < 0 or p_ms > 120000 then raise exception 'That time doesn''t look right.'; end if;
  if p_day < public.today_ist() - 1 then raise exception 'That day is over.'; end if;
  select tries, started_at into t, s from public.sec25_scores where user_id = me and day = p_day for update;
  n := coalesce(cardinality(t), 0);
  if n = 0 or t[n] <> -1 then raise exception 'Start a try first.'; end if;
  real_ms := (extract(epoch from (now() - s)) * 1000)::int;
  if p_ms > real_ms + 1500 then raise exception 'That time doesn''t look right.'; end if;
  t[n] := abs(p_ms - 25000);
  update public.sec25_scores set tries = t, updated_at = now() where user_id = me and day = p_day;
  return t;
end $$;
revoke all on function public.finish_sec25_try(date, int) from public, anon;
grant execute on function public.finish_sec25_try(date, int) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sec25_scores'
  ) then
    alter publication supabase_realtime add table public.sec25_scores;
  end if;
end $$;

-- ---------- "X just beat you" ----------
-- Only to people in X's mutual 25 who had played today, whom X's new best has
-- just passed, and who still have a try left to hit back.
create or replace function public.notify_beaten(
  p_actor uuid, p_day date, p_old int, p_new int, p_higher boolean, p_game text, p_table text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  f record;
begin
  for f in
    execute format(
      'select x.user_id, x.tries from public.%I x
         join public.seats s on s.owner = $1 and s.guest = x.user_id
        where x.day = $2 and x.user_id <> $1 and public.is_friend($1, x.user_id)', p_table)
    using p_actor, p_day
  loop
    declare
      fb int := case when p_higher
                     then (select max(v) from unnest(f.tries) v where v >= 0)
                     else (select min(v) from unnest(f.tries) v where v >= 0) end;
    begin
      continue when fb is null;                     -- hasn't finished a try
      continue when cardinality(f.tries) >= 3;      -- no tries left: no point
      if p_higher then
        continue when not (p_new > fb and (p_old is null or p_old <= fb));
      else
        continue when not (p_new < fb and (p_old is null or p_old >= fb));
      end if;
      perform public.notify(f.user_id, 'beat', p_actor, p_game || ':' || p_day, p_game);
    end;
  end loop;
end $$;
revoke all on function public.notify_beaten(uuid, date, int, int, boolean, text, text) from public, anon, authenticated;

-- Today's game: no more "X scored …" to everyone. Just the beat.
create or replace function public.on_daily_top() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mine int := (select max(t) from unnest(new.tries) t where t >= 0);
  before int := (select max(t) from unnest(old.tries) t where t >= 0);
begin
  if mine is null or mine <= coalesce(before, -1) then return new; end if;
  perform public.notify_beaten(new.user_id, new.day, before, mine, true, 'today''s game', 'daily_scores');
  return new;
end $$;

create or replace function public.on_sec25_beat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mine int := (select min(t) from unnest(new.tries) t where t >= 0);
  before int := (select min(t) from unnest(old.tries) t where t >= 0);
begin
  if mine is null or (before is not null and mine >= before) then return new; end if;
  perform public.notify_beaten(new.user_id, new.day, before, mine, false, '25 Sec', 'sec25_scores');
  return new;
end $$;
drop trigger if exists sec25_beat on public.sec25_scores;
create trigger sec25_beat after update of tries on public.sec25_scores
  for each row execute function public.on_sec25_beat();

-- Word Up and the daily tune are one go each: nobody can hit back, so no ping.
drop trigger if exists word_daily_notify on public.word_results;

-- ---------- Pushes at 12 AM ----------
create or replace function public.push_daily() returns void
language plpgsql security definer set search_path = public as $$
declare
  d date := public.today_ist();
  t time := (now() at time zone 'Asia/Kolkata')::time;
  everyone uuid[];
  b record;
begin
  -- 📸 Drop time, for everyone with notifications on.
  if now() >= public.drop_at(d) and now() < public.drop_at(d) + interval '10 minutes'
     and not exists (select 1 from public.push_sent where kind = 'drop' and day = d) then
    insert into public.push_sent values ('drop', d);
    perform public.push_to(
      array(select distinct user_id from public.push_subscriptions),
      '📸 It''s Drop time!', '10 minutes. One real photo. Go!', '/app/drop', 'drop-time');
  end if;

  -- 🎮 New daily games, right at midnight.
  if t < '01:00'
     and not exists (select 1 from public.push_sent where kind = 'daily_new' and day = d) then
    insert into public.push_sent values ('daily_new', d);
    everyone := array(select distinct user_id from public.push_subscriptions);
    perform public.push_to(everyone,
      '🎮 New daily games are out!',
      'Today''s game, Word Up, Name That Tune and 25 Sec. Play now!', '/app/games', 'daily-new');
  end if;

  -- 🎂 Birthdays, at midnight, to their mutual 25: go wish them.
  if t < '01:00'
     and not exists (select 1 from public.push_sent where kind = 'bday' and day = d) then
    insert into public.push_sent values ('bday', d);
    for b in
      select v.user_id from public.vibe_answers v
       where extract(month from v.birthday) = extract(month from d)
         and extract(day from v.birthday) = extract(day from d)
    loop
      perform public.push_to(
        array(select guest from public.seats where owner = b.user_id and public.is_friend(b.user_id, guest)),
        '🎂 It''s ' || public.first_name(b.user_id) || '''s birthday!',
        'Be the first to wish them ✍️', '/app/card/' || b.user_id, 'bday-' || b.user_id);
    end loop;
  end if;

  -- 🎂 At midnight on your birthday: your card is ready (if anyone signed).
  if t < '01:00'
     and not exists (select 1 from public.push_sent where kind = 'card_ready' and day = d) then
    insert into public.push_sent values ('card_ready', d);
    for b in
      select v.user_id from public.vibe_answers v
       where extract(month from v.birthday) = extract(month from d)
         and extract(day from v.birthday) = extract(day from d)
         and exists (select 1 from public.birthday_cards c
                      where c.target = v.user_id and c.year = extract(year from d)::int)
    loop
      perform public.notify(b.user_id, 'card_ready', null, 'card:' || b.user_id,
        'Your 25 left you a birthday card. Open it 🎉');
    end loop;
  end if;

  -- 🧠 New trivia topics, Saturdays.
  if extract(isodow from d) = 6 and t >= '11:00'
     and not exists (select 1 from public.push_sent where kind = 'trivia_week' and day = d) then
    insert into public.push_sent values ('trivia_week', d);
    everyone := array(select distinct user_id from public.push_subscriptions);
    perform public.push_to(everyone,
      '🧠 5 new trivia topics this week',
      public.trivia_week_topics(d), '/app/games', 'trivia-week');
  end if;
end $$;
revoke all on function public.push_daily() from public, anon, authenticated;

-- Today's push for midnight already went out under the old schedule? Then the
-- 'bday' row for today exists; that's fine (it was sent at 9 AM).

create or replace function public.on_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := coalesce(public.first_name(new.actor), 'Someone');
  t text;
  b text;
  u text := '/app/activity';
begin
  case new.kind
    when 'seated' then t := '👀 ' || who || ' put you in their 25'; b := 'Seat them back?'; u := '/app/seat/' || new.actor;
    when 'unseated' then t := '🚪 ' || who || ' removed themselves from your 25'; b := 'They can''t be re-added unless they add you.'; u := '/app/people';
    when 'seated_back' then t := '🤝 ' || who || ' seated you back'; b := 'Chats unlocked.'; u := '/app/seat/' || new.actor;
    when 'like' then t := '❤️ ' || who || ' liked your post'; b := ''; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'reply' then t := '💬 ' || who || ' replied'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'reply_tag' then t := '🏷️ ' || who || ' tagged you in a reply'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'comment_tag' then t := '🏷️ ' || who || ' tagged you in a comment'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'post_tag' then t := '🏷️ ' || who || ' tagged you in a scene'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'post_tag_all' then t := '📣 ' || who || ' tagged everyone in a scene'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'comment' then t := '💬 ' || who || ' commented'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'word_done' then t := '🔤 ' || who || ' ' || new.body; b := 'Word Up'; u := case when new.ref like 'game:%' then '/app/play/' || substr(new.ref, 6) else '/app/games' end;
    when 'poll' then t := '🗳️ Someone in your 25 picked you'; b := new.body; u := '/app/polls';
    when 'card_ready' then t := '🎂 Happy birthday, ' || coalesce(public.first_name(new.user_id), 'you') || '!'; b := new.body; u := '/app/card/me';
    when 'card' then t := '🎂 ' || who || ' signed your birthday card'; b := ''; u := '/app/card/me';
    when 'drop_like' then t := '❤️ ' || who || ' liked your Drop'; b := ''; u := '/app/drop';
    when 'drop_comment' then t := '💬 ' || who || ' commented on your Drop'; b := new.body; u := '/app/drop';
    when 'quiz_ace' then
      t := (case when split_part(new.body, '/', 1) = split_part(new.body, '/', 2) then '💯 ' else '🔥 ' end)
           || who || ' got ' || new.body || ' on you';
      b := 'They really know you.'; u := '/app/seat/' || new.actor;
    when 'quiz_try' then
      t := '👀 ' || who || ' tried to add you';
      b := 'Got ' || new.body || ' on your quiz. Not quite.'; u := '/app/people';
    when 'post' then t := '✨ ' || who || ' shared a new scene'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'drop' then t := '⚡ ' || who || ' dropped'; b := coalesce(new.body, 'Post yours to see it.'); u := '/app/drop';
    when 'game_win' then t := '🏆 ' || who || ' won ' || new.body; b := 'Think you can beat them?'; u := '/app/games';
    when 'mention_all' then t := '📣 ' || who || ' mentioned everyone'; b := new.body; u := '/app/group/' || substr(new.ref, 7);
    when 'daily_score' then t := '🎮 ' || who || ' scored ' || new.body; b := 'Your turn. 3 tries.'; u := '/app/games';
    when 'word_daily' then t := '🔤 ' || who || ' ' || new.body; b := 'Can you beat that?'; u := '/app/games';
    when 'beat' then t := '⚔️ ' || who || ' just beat you in ' || new.body; b := 'You still have a try left. Hit back!'; u := '/app/games';
    when 'daily_top' then t := '👑 ' || who || ' is #1 in today''s game'; b := 'Score: ' || new.body || '. Beat that.'; u := '/app/games';
    else t := '25'; b := new.body;
  end case;
  -- One notification per person and kind on the phone (two friends posting don't overwrite).
  perform public.push_to(array[new.user_id], t, coalesce(b, ''), u, new.kind || coalesce(':' || new.actor, ''));
  return new;
end $$;


-- ---------- Season points: four daily games; the tune ranks by skips ----------
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
              else case rank() over (partition by t.day, (t.ms is null) order by coalesce(t.stage, 0))
                when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end
         end as pts
    from public.tune_results t
   where t.user_id in (select id from circle) and t.day between p_from and p_to
),
secbest as (
  select x.user_id, x.day, (select min(t) from unnest(x.tries) t where t >= 0) as best
    from public.sec25_scores x
   where x.user_id in (select id from circle) and x.day between p_from and p_to
),
sec as (
  select user_id,
         case rank() over (partition by day order by best)
           when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end as pts
    from secbest where best is not null
)
select user_id, sum(pts)::int from (
  select user_id, pts from game
  union all select user_id, pts from word
  union all select user_id, pts from tune
  union all select user_id, pts from sec
) x group by user_id
$$;
revoke all on function public.circle_points(uuid, date, date) from public, anon, authenticated;
