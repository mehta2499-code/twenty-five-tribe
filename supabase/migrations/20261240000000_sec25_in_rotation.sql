-- =====================================================================
-- 25 Sec joins the daily game rotation (instead of being a fourth game).
-- The rotation is now 8 games long, counted from Monday 16 Nov 2026, so this
-- week's days keep their game and 25 Sec first comes up on Mon 23 Nov.
-- Its score: 25,000 minus how many ms off 25 s you stopped (higher is better).
-- =====================================================================

create or replace function public.daily_game(d date) returns text
language sql immutable as $$
  select (array['tap-rush', 'quick-math', 'colour-clash', 'pair-up', 'odd-one-out', 'pattern',
                'reflex', 'sec25'])
         [1 + (((d - date '2026-11-16') % 8) + 8) % 8]
$$;

create or replace function public.finish_daily_try(p_day date, p_score int) returns int[]
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t int[];
  n int;
  top int := case when public.daily_game(p_day) = 'sec25' then 25000 else 1000 end;
begin
  if p_score < 0 or p_score > top then raise exception 'That score doesn''t look right.'; end if;
  if p_day < public.today_ist() - 1 then raise exception 'That day is over.'; end if;
  select tries into t from public.daily_scores where user_id = me and day = p_day for update;
  n := coalesce(cardinality(t), 0);
  if n = 0 or t[n] <> -1 then raise exception 'Start a try first.'; end if;
  t[n] := p_score;
  update public.daily_scores set tries = t, updated_at = now() where user_id = me and day = p_day;
  return t;
end $$;

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
      'Today''s game, Word Up and Name That Tune. Play now!', '/app/games', 'daily-new');
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
