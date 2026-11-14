-- =====================================================================
-- Game notifications, quieter and more useful:
--  • A live game win no longer pings the winner's whole 25 (the players
--    already know).
--  • Daily game: your mutual 25 hears your score when you finish your
--    first try (once a day), and again only if you later take #1.
--  • Word Up (word of the day): your mutual 25 hears how you did.
-- =====================================================================

drop trigger if exists games_done_circle on public.games;

create or replace function public.daily_label(p_game text, p_score int) returns text
language sql immutable as $$
  select p_score || ' ' ||
         case p_game when 'tap-rush' then 'taps' when 'quick-math' then 'correct'
                     when 'colour-clash' then 'correct' when 'odd-one-out' then 'found'
                     when 'pattern' then 'long' else 'points' end
         || ' in ' ||
         case p_game when 'tap-rush' then 'Tap Rush' when 'quick-math' then 'Quick Maths'
                     when 'colour-clash' then 'Colour Clash' when 'pair-up' then 'Pair Up'
                     when 'odd-one-out' then 'Odd One Out' when 'pattern' then 'Pattern Recall'
                     when 'reflex' then 'Reflex' else 'today''s game' end
$$;

create or replace function public.on_daily_top() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_done int := (select count(*) from unnest(old.tries) t where t >= 0);
  new_done int := (select count(*) from unnest(new.tries) t where t >= 0);
  mine int := (select max(t) from unnest(new.tries) t where t >= 0);
  before int := (select max(t) from unnest(old.tries) t where t >= 0);
  others int;
  top boolean;
  label text;
begin
  if new_done <= old_done or mine is null then return new; end if;
  select max((select max(t) from unnest(d.tries) t)) into others
    from public.daily_scores d
    join public.seats s on s.owner = new.user_id and s.guest = d.user_id
   where d.day = new.day and public.is_friend(new.user_id, d.user_id);
  top := mine > 0 and (others is null or mine > others);
  label := public.daily_label(new.game, mine);

  if old_done = 0 then
    -- First finished try today: share the score.
    perform public.notify_mutuals(new.user_id, 'daily_score', 'daily:' || new.day,
                                  label || case when top then ' · #1 so far 👑' else '' end);
  elsif top and mine > coalesce(before, -1)
        and not exists (select 1 from public.notifications
                         where actor = new.user_id and ref = 'daily:' || new.day
                           and (kind = 'daily_top' or (kind = 'daily_score' and body like '%#1%'))) then
    -- Later try that takes #1: one more ping, once a day.
    perform public.notify_mutuals(new.user_id, 'daily_top', 'daily:' || new.day, label);
  end if;
  return new;
end $$;
drop trigger if exists daily_top on public.daily_scores;
create trigger daily_top after update of tries on public.daily_scores
  for each row execute function public.on_daily_top();

-- Word Up: word of the day result.
create or replace function public.on_word_daily() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_mutuals(new.user_id, 'word_daily', 'word:' || new.day,
    case when new.guesses between 1 and 6
         then 'solved today''s Word Up in ' || new.guesses || '/6'
         else 'couldn''t crack today''s Word Up' end);
  return new;
end $$;
drop trigger if exists word_daily_notify on public.word_results;
create trigger word_daily_notify after insert on public.word_results
  for each row execute function public.on_word_daily();

create or replace function public.on_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := coalesce(public.first_name(new.actor), 'Someone');
  t text;
  b text;
  u text := '/app/activity';
begin
  case new.kind
    when 'seated' then t := '👀 ' || who || ' put you in their 25'; b := 'Seat them back?'; u := '/app/people';
    when 'unseated' then t := '🚪 ' || who || ' removed themselves from your 25'; b := 'They can''t be re-added unless they add you.'; u := '/app/people';
    when 'seated_back' then t := '🤝 ' || who || ' seated you back'; b := 'Chats and blinks unlocked.';
    when 'like' then t := '❤️ ' || who || ' liked your post'; b := ''; u := '/app/feed';
    when 'comment' then t := '💬 ' || who || ' commented'; b := new.body; u := '/app/feed';
    when 'word_done' then t := '🔤 ' || who || ' ' || new.body; b := 'Word Up';
    when 'poll' then t := '🗳️ Someone in your 25 picked you'; b := new.body; u := '/app/polls';
    when 'card' then t := '🎂 ' || who || ' signed your birthday card'; b := ''; u := '/app/card/me';
    when 'drop_like' then t := '❤️ ' || who || ' liked your Drop'; b := ''; u := '/app/drop';
    when 'drop_comment' then t := '💬 ' || who || ' commented on your Drop'; b := new.body; u := '/app/drop';
    when 'quiz_ace' then
      t := (case when split_part(new.body, '/', 1) = split_part(new.body, '/', 2) then '💯 ' else '🔥 ' end)
           || who || ' got ' || new.body || ' on you';
      b := 'They really know you.'; u := '/app/profile';
    when 'quiz_try' then
      t := '👀 ' || who || ' tried to add you';
      b := 'Got ' || new.body || ' on your quiz. Not quite.'; u := '/app/people';
    when 'post' then t := '📸 ' || who || ' just posted'; b := new.body; u := '/app/feed';
    when 'drop' then t := '⚡ ' || who || ' dropped'; b := coalesce(new.body, 'Post yours to see it.'); u := '/app/drop';
    when 'game_win' then t := '🏆 ' || who || ' won ' || new.body; b := 'Think you can beat them?'; u := '/app/games';
    when 'daily_score' then t := '🎮 ' || who || ' scored ' || new.body; b := 'Your turn. 3 tries.'; u := '/app/games';
    when 'word_daily' then t := '🔤 ' || who || ' ' || new.body; b := 'Can you beat that?'; u := '/app/games';
    when 'daily_top' then t := '👑 ' || who || ' is #1 in today''s game'; b := 'Score: ' || new.body || '. Beat that.'; u := '/app/games';
    else t := '25'; b := new.body;
  end case;
  -- One notification per person and kind on the phone (two friends posting don't overwrite).
  perform public.push_to(array[new.user_id], t, coalesce(b, ''), u, new.kind || coalesce(':' || new.actor, ''));
  return new;
end $$;
