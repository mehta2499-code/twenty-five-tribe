-- =====================================================================
-- Birthdays: friends are reminded the evening before (7 PM), so the card is
-- full when it opens for the birthday person at 12 AM on the day (they get
-- "your card is ready" then). And the birthday person can look back at every
-- past year's card.
-- =====================================================================

-- Who wished, for any year; the words only for the birthday person (once that
-- year's card has opened) and for your own wish.
drop function if exists public.card_wishes(uuid);
create or replace function public.card_wishes(p_target uuid, p_year int default null)
returns table (author uuid, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.author,
         case when c.author = auth.uid()
                or (p_target = auth.uid() and public.card_open(c.target, c.year))
              then c.body end,
         c.created_at
    from public.birthday_cards c
   where c.target = p_target
     and c.year = coalesce(p_year, extract(year from public.today_ist())::int)
     and (
       p_target = auth.uid() and public.card_open(c.target, c.year)
       or c.author = auth.uid()
       or public.is_friend(auth.uid(), p_target)
     )
   order by c.created_at
$$;
revoke all on function public.card_wishes(uuid, int) from public, anon;
grant execute on function public.card_wishes(uuid, int) to authenticated;

-- Your own past birthday cards: which years, and how many wishes in each.
create or replace function public.my_card_years()
returns table (year int, wishes int)
language sql stable security definer set search_path = public as $$
  select c.year, count(*)::int
    from public.birthday_cards c
   where c.target = auth.uid() and public.card_open(c.target, c.year)
   group by c.year
   order by c.year desc
$$;
revoke all on function public.my_card_years() from public, anon;
grant execute on function public.my_card_years() to authenticated;

-- ---------- Pushes: birthday reminder the evening before ----------
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

  -- 🎂 Birthdays tomorrow, at 7 PM, to their mutual 25: sign the card tonight,
  -- so it's full when it opens for them at 12 AM.
  if t >= '19:00'
     and not exists (select 1 from public.push_sent where kind = 'bday_eve' and day = d) then
    insert into public.push_sent values ('bday_eve', d);
    for b in
      select v.user_id from public.vibe_answers v
       where extract(month from v.birthday) = extract(month from d + 1)
         and extract(day from v.birthday) = extract(day from d + 1)
    loop
      perform public.push_to(
        array(select guest from public.seats where owner = b.user_id and public.is_friend(b.user_id, guest)),
        '🎂 ' || public.first_name(b.user_id) || '''s birthday is tomorrow',
        'Sign their card tonight. They open it at 12 AM 🎁', '/app/card/' || b.user_id, 'bday-' || b.user_id);
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
