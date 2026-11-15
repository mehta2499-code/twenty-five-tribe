-- Your birthday card arrives at 12 AM on your birthday (India time), as a
-- surprise: no count of who signed. Friends' "sign their card" reminder stays
-- at 9 AM so nobody gets woken up.
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

  -- 🎂 At midnight on your birthday: your card is ready (if anyone signed).
  -- No count, no names: it's a surprise until you open it.
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
    when 'daily_top' then t := '👑 ' || who || ' is #1 in today''s game'; b := 'Score: ' || new.body || '. Beat that.'; u := '/app/games';
    else t := '25'; b := new.body;
  end case;
  -- One notification per person and kind on the phone (two friends posting don't overwrite).
  perform public.push_to(array[new.user_id], t, coalesce(b, ''), u, new.kind || coalesce(':' || new.actor, ''));
  return new;
end $$;
