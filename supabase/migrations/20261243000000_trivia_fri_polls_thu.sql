-- =====================================================================
-- Weekly trivia topics switch every Friday at 9 PM India time (with a push).
-- Weekly polls switch every Thursday at 9 PM. The poll set launched on Thu
-- 19 Nov keeps its key ('2026-11-15') until Thu 26 Nov, 9 PM, so votes
-- already cast still count; after that each week's key is the Thursday it
-- started. Keep in sync with src/lib/triviaWeeks.ts and src/lib/polls.ts.
-- =====================================================================

-- This week's trivia topics (weeks count from Fri 13 Nov 2026, 9 PM IST).
create or replace function public.trivia_week_now() returns text
language sql stable as $$
  select (array[
    'Cricket World Cups, Bollywood 2010s, Desi Food, Space & ISRO, Indian TV & OTT',
    'Football, Indian Mythology, World Geography, Bollywood 90s, Tech & Startups',
    'Olympics, Modern Indian History, Hollywood, English Pop, Brands & Logos',
    'Tennis & Badminton, Festivals, The Human Body, Bollywood Songs, Video Games',
    'Indian Sports, Famous Indians, Animals, Marvel & DC, Indian Cities',
    'F1, Ancient India, Capitals & Flags, Anime & Cartoons, Money & Business',
    'Cricket Records, Books, Science, Sitcoms, Travel India',
    'Sports Mix, Wonders of the World, World Food, Bollywood Classics, Internet'
  ])[(((floor(extract(epoch from (now() - timestamptz '2026-11-13 21:00:00+05:30')) / 604800)::int % 8) + 8) % 8) + 1]
$$;

-- Which poll week it is.
create or replace function public.poll_week() returns date
language sql stable as $$
  select case
    when s < date '2026-11-27' then date '2026-11-15'
    else date '2026-11-26' + 7 * ((s - date '2026-11-27') / 7)
  end
  from (select ((now() at time zone 'Asia/Kolkata') + interval '3 hours')::date as s) x
$$;

-- ---------- Pushes: trivia Fridays 9 PM ----------
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

  -- 🎮 New daily games, at 10:30 PM (the game day turns over then).
  if t >= '22:30'
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
