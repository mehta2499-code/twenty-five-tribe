-- Pushes to everyone with notifications on (India time):
--   10:00 every day   🎮 today's daily game is live
--   13:00 every day   🔤 a new Word Up word
--   Saturdays 11:00   🧠 this week's 5 new trivia topics
-- The daily ones only go out inside their hour, so a late deploy or a missed
-- run doesn't fire them at odd times. The trivia one goes out any time on
-- Saturday after 11:00 (so it still reaches people on the first Saturday).
-- Runs inside push_daily(), which pg_cron calls every minute.

-- This week's trivia topics, in the same order as src/lib/triviaWeeks.ts
-- (week 1 started Saturday 14 Nov 2026; loops after 8 weeks).
create or replace function public.trivia_week_topics(d date) returns text
language sql immutable as $$
  select (array[
    'Cricket World Cups, Bollywood 2010s, Desi Food, Space & ISRO, Indian TV & OTT',
    'Football, Indian Mythology, World Geography, Bollywood 90s, Tech & Startups',
    'Olympics, Modern Indian History, Hollywood, English Pop, Brands & Logos',
    'Tennis & Badminton, Festivals, The Human Body, Bollywood Songs, Video Games',
    'Indian Sports, Famous Indians, Animals, Marvel & DC, Indian Cities',
    'F1, Ancient India, Capitals & Flags, Anime & Cartoons, Money & Business',
    'Cricket Records, Books, Science, Sitcoms, Travel India',
    'Sports Mix, Wonders of the World, World Food, Bollywood Classics, Internet'
  ])[(((floor((d - date '2026-11-14') / 7.0)::int % 8) + 8) % 8) + 1]
$$;

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

  -- 🎂 Birthdays, at 9 AM India time, to their mutual 25.
  if t >= '09:00'
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
        'Sign their card before midnight ✍️', '/app/card/' || b.user_id, 'bday-' || b.user_id);
    end loop;
  end if;

  -- 🎮 Today's daily game (its name stays a surprise until you play).
  if t >= '10:00' and t < '11:00'
     and not exists (select 1 from public.push_sent where kind = 'daily_game' and day = d) then
    insert into public.push_sent values ('daily_game', d);
    everyone := array(select distinct user_id from public.push_subscriptions);
    perform public.push_to(everyone,
      '🎮 ' || trim(to_char(d, 'Day')) || '''s game is live',
      '3 tries to top your 25. Go!', '/app/games', 'daily-game');
  end if;

  -- 🔤 A new Word Up word.
  if t >= '13:00' and t < '14:00'
     and not exists (select 1 from public.push_sent where kind = 'word_new' and day = d) then
    insert into public.push_sent values ('word_new', d);
    everyone := array(select distinct user_id from public.push_subscriptions);
    perform public.push_to(everyone,
      '🔤 New Word Up word',
      'Today''s 5-letter word is waiting. 6 guesses.', '/app/games', 'word-new');
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
