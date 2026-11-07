-- More energy: tell your mutual 25 when you post, Drop, win a game, or take #1
-- in today's game; and tell someone when you tried (and failed) to add them.

-- Everyone in someone's mutual 25.
create or replace function public.notify_mutuals(p_actor uuid, p_kind text, p_ref text, p_body text,
                                                 p_skip uuid[] default '{}')
returns void language sql security definer set search_path = public as $$
  select public.notify(s.guest, p_kind, p_actor, p_ref, p_body)
    from public.seats s
   where s.owner = p_actor
     and public.is_friend(p_actor, s.guest)
     and not (s.guest = any (p_skip))
$$;
revoke all on function public.notify_mutuals(uuid, text, text, text, uuid[]) from public, anon, authenticated;

-- New post or reel.
create or replace function public.on_post_circle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_mutuals(new.author, 'post', new.kind || ':' || new.id,
                                coalesce(nullif(new.caption, ''), case when new.kind = 'reel' then 'New reel' else 'New post' end));
  return new;
end $$;
drop trigger if exists posts_circle on public.posts;
create trigger posts_circle after insert on public.posts
  for each row execute function public.on_post_circle();

-- Today's Drop.
create or replace function public.on_drop_circle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_mutuals(new.user_id, 'drop', 'drop', nullif(new.caption, ''));
  return new;
end $$;
drop trigger if exists drops_circle on public.drops;
create trigger drops_circle after insert on public.drops
  for each row execute function public.on_drop_circle();

-- Who won a finished game (null for a tie, a bot, or a called-off game).
create or replace function public.game_winner(g public.games) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  w text;
  word text;
begin
  if g.kind = 'trivia' then
    select t.winner::text into w from public.trivia_winners() t where t.game_id = g.id;
  elsif g.kind = 'ludo' then
    if g.state->>'phase' = 'lobby' or not g.state ? 'winner' then return null; end if;
    w := g.state->'players'->((g.state->>'winner')::int)->>'id';
  elsif g.kind = 'kachuful' then
    select g.state->'seats'->((t.i - 1)::int)->>'id' into w
      from (
        select s.i, sum(s.v::numeric) as total, count(*) over () as n,
               rank() over (order by sum(s.v::numeric) desc) as rk
          from jsonb_array_elements(g.state->'scores') r(round),
               jsonb_array_elements_text(r.round) with ordinality s(v, i)
         where s.v ~ '^-?[0-9.]+$'
         group by s.i
      ) t
     where t.rk = 1
     order by t.i
     limit 1;
  elsif g.kind = 'word' then
    if g.state ? 'gaveUp' then
      w := case when g.state->>'gaveUp' = g.state->>'guesser' then g.state->>'setter' else g.state->>'guesser' end;
    else
      word := reverse(convert_from(decode(g.state->>'hidden', 'base64'), 'UTF8'));
      w := case when g.state->'guesses' ? word then g.state->>'guesser' else g.state->>'setter' end;
    end if;
  end if;
  if w is null or not (w = any (g.players::text[])) then return null; end if;
  return w::uuid;
exception when others then
  return null;
end $$;

create or replace function public.on_game_done_circle() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w uuid;
  label text := case new.kind when 'kachuful' then 'Judgement' when 'word' then 'Word Up'
                              when 'ludo' then 'Ludo' when 'trivia' then 'Trivia' else 'a game' end;
begin
  if old.status = 'done' or new.status <> 'done' then return new; end if;
  w := public.game_winner(new);
  -- Players already know; tell the winner's other mutuals.
  if w is not null then
    perform public.notify_mutuals(w, 'game_win', 'game:' || new.id, label, new.players);
  end if;
  return new;
end $$;
drop trigger if exists games_done_circle on public.games;
create trigger games_done_circle after update of status on public.games
  for each row execute function public.on_game_done_circle();

-- Taking #1 in today's daily game among your mutual 25 (once a day).
create or replace function public.on_daily_top() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mine int := (select max(t) from unnest(new.tries) t);
  others int;
begin
  if mine is null or mine <= 0 then return new; end if;
  select max((select max(t) from unnest(d.tries) t)) into others
    from public.daily_scores d
    join public.seats s on s.owner = new.user_id and s.guest = d.user_id
   where d.day = new.day and public.is_friend(new.user_id, d.user_id);
  if others is not null and mine <= others then return new; end if;
  if exists (select 1 from public.notifications
              where actor = new.user_id and kind = 'daily_top' and ref = 'daily:' || new.day) then
    return new;
  end if;
  perform public.notify_mutuals(new.user_id, 'daily_top', 'daily:' || new.day, mine::text);
  return new;
end $$;
drop trigger if exists daily_top on public.daily_scores;
create trigger daily_top after update of tries on public.daily_scores
  for each row execute function public.on_daily_top();

-- Quiz: aced it (6+) → "got 7/7 on you"; failed → "tried to add you".
create or replace function public.on_quiz_ace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.score is null and new.score is not null then
    if new.score >= new.total - 1 and new.total >= 6 then
      perform public.notify(new.target, 'quiz_ace', new.guesser, 'quiz:' || new.id,
                            new.score || '/' || new.total);
    elsif not new.passed then
      perform public.notify(new.target, 'quiz_try', new.guesser, 'quiz:' || new.id,
                            new.score || '/' || new.total);
    end if;
  end if;
  return new;
end $$;

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
    when 'daily_top' then t := '👑 ' || who || ' is #1 in today''s game'; b := 'Score: ' || new.body || '. Beat that.'; u := '/app/games';
    else t := '25'; b := new.body;
  end case;
  -- One notification per person and kind on the phone (two friends posting don't overwrite).
  perform public.push_to(array[new.user_id], t, coalesce(b, ''), u, new.kind || coalesce(':' || new.actor, ''));
  return new;
end $$;
