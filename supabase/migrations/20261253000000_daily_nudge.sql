-- =====================================================================
-- 10 PM nudge for today's game: if you haven't played it, or you still have
-- tries left and aren't in the top 3 among your 25, a push to catch up.
-- (push_daily is redefined in full, with the new block at the end.)
-- =====================================================================
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
  -- ⏰ 10 PM: catch up on today's game. To anyone who hasn't played it yet,
  -- or who still has tries left and isn't in the top 3 among their 25.
  -- (Used all 3 tries, or already on the board: no nudge.)
  if t >= '22:00'
     and not exists (select 1 from public.push_sent where kind = 'daily_nudge' and day = public.game_day()) then
    insert into public.push_sent values ('daily_nudge', public.game_day());
    for b in
      with me as (
        select distinct s.user_id from public.push_subscriptions s
      ), mine as (
        select me.user_id,
               ds.tries,
               coalesce(cardinality(ds.tries), 0) as used,
               coalesce((select max(greatest(x, 0)) from unnest(ds.tries) x), 0) as best
          from me
          left join public.daily_scores ds on ds.user_id = me.user_id and ds.day = public.game_day()
      )
      select m.user_id, m.used,
             3 - m.used as left_n,
             1 + (select count(*) from public.daily_scores f
                   where f.day = public.game_day()
                     and f.user_id <> m.user_id
                     and public.is_friend(m.user_id, f.user_id)
                     and (select max(greatest(x, 0)) from unnest(f.tries) x) > m.best) as place
        from mine m
       where m.used < 3
    loop
      if b.used = 0 then
        perform public.push_to(array[b.user_id],
          '⏰ You haven''t played today''s game',
          '2 hours left. Get on the board before the new game at 12 AM!', '/app/games', 'daily-nudge');
      elsif b.place > 3 then
        perform public.push_to(array[b.user_id],
          '⏰ You''re #' || b.place || ' today. Not on the board yet',
          b.left_n || ' tr' || case when b.left_n = 1 then 'y' else 'ies' end
            || ' left. Catch up before 12 AM!', '/app/games', 'daily-nudge');
      end if;
    end loop;
  end if;
end $$;

revoke all on function public.push_daily() from public, anon, authenticated;
