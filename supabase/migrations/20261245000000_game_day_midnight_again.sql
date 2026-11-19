-- =====================================================================
-- Daily games go back to turning over at midnight India time. The 10:30 PM
-- switch happened once (Thu 19 Nov), so the game day of Fri 20 Nov started
-- then and runs to midnight; from Sat 21 Nov it's midnight again.
-- Keep in sync with today() in src/lib/daily.ts.
-- =====================================================================

create or replace function public.game_day() returns date
language sql stable as $$
  select case
    when now() < timestamptz '2026-11-20 00:00:00+05:30'
      then ((now() at time zone 'Asia/Kolkata') + interval '90 minutes')::date
    else (now() at time zone 'Asia/Kolkata')::date
  end
$$;

create or replace function public.start_daily_try() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d date := public.game_day();
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

-- ---------- Pushes: new daily games back at midnight ----------
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

  -- 🎮 New daily games, at midnight.
  if t < '01:00'
     and not exists (select 1 from public.push_sent where kind = 'daily_new' and day = public.game_day()) then
    insert into public.push_sent values ('daily_new', public.game_day());
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

  -- 🌶️ New weekly polls, Thursdays at 9 PM (the moment they switch; the
  -- first one is Thu 26 Nov, since this week's set came out today).
  if extract(isodow from d) = 4 and t >= '21:00' and d >= date '2026-11-26'
     and not exists (select 1 from public.push_sent where kind = 'polls_week' and day = d) then
    insert into public.push_sent values ('polls_week', d);
    everyone := array(select distinct user_id from public.push_subscriptions);
    perform public.push_to(everyone,
      '🌶️ New spicy polls are out',
      '10 new questions about your 25. Nobody sees who you pick.', '/app/polls', 'polls-week');
  end if;

  -- 🧠 New trivia topics, Fridays at 9 PM (the moment they switch).
  if extract(isodow from d) = 5 and t >= '21:00'
     and not exists (select 1 from public.push_sent where kind = 'trivia_week' and day = d) then
    insert into public.push_sent values ('trivia_week', d);
    everyone := array(select distinct user_id from public.push_subscriptions);
    perform public.push_to(everyone,
      '🧠 5 new trivia topics are out',
      public.trivia_week_now(), '/app/games', 'trivia-week');
  end if;
end $$;
revoke all on function public.push_daily() from public, anon, authenticated;
