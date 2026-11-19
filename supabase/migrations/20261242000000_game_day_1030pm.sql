-- =====================================================================
-- The daily games (today's game, Word Up, Name That Tune) turn over at
-- 10:30 PM India time instead of midnight. From 10:30 PM it's already the
-- next game day. Birthdays, polls and the Drop still go by the calendar day.
-- =====================================================================

-- The game day: India time, 90 minutes ahead (so 10:30 PM is the next day).
create or replace function public.game_day() returns date
language sql stable as $$
  select ((now() at time zone 'Asia/Kolkata') + interval '90 minutes')::date
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
    raise exception 'No tries left today. New game at 10:30 PM.';
  end if;
  update public.daily_scores set tries = tries || -1, updated_at = now()
   where user_id = me and day = d;
  return jsonb_build_object('day', d, 'try', cardinality(t) + 1, 'game', public.daily_game(d));
end $$;

create or replace function public.finish_daily_try(p_day date, p_score int) returns int[]
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t int[];
  n int;
  top int := case when public.daily_game(p_day) = 'sec25' then 25000 else 1000 end;
begin
  if p_score < 0 or p_score > top then raise exception 'That score doesn''t look right.'; end if;
  if p_day < public.game_day() - 1 then raise exception 'That day is over.'; end if;
  select tries into t from public.daily_scores where user_id = me and day = p_day for update;
  n := coalesce(cardinality(t), 0);
  if n = 0 or t[n] <> -1 then raise exception 'Start a try first.'; end if;
  t[n] := p_score;
  update public.daily_scores set tries = t, updated_at = now() where user_id = me and day = p_day;
  return t;
end $$;

drop policy if exists "words: post today's result" on public.word_results;
create policy "words: post today's result" on public.word_results
  for insert to authenticated
  with check (user_id = auth.uid() and day between public.game_day() - 1 and public.game_day());

drop policy if exists "tunes: post today's result" on public.tune_results;
create policy "tunes: post today's result" on public.tune_results
  for insert to authenticated
  with check (user_id = auth.uid() and day between public.game_day() - 1 and public.game_day());

-- Today's song: the first person to open it picks it (for the game day).
create or replace function public.claim_daily_tune(
  p_cat text, p_level text, p_ids text[], p_titles text[], p_artists text[]
) returns public.daily_tunes
language plpgsql security definer set search_path = public as $$
declare
  d date := public.game_day();
  r public.daily_tunes;
  i int;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into r from public.daily_tunes where day = d;
  if found then return r; end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    begin
      insert into public.daily_tunes (day, cat, level, song_id, title, artist)
      values (d, p_cat, p_level, p_ids[i], left(p_titles[i], 200), left(p_artists[i], 200))
      returning * into r;
      return r;
    exception
      when unique_violation then
        select * into r from public.daily_tunes where day = d;
        if found then return r; end if;
    end;
  end loop;
  raise exception 'Couldn''t pick a song. Try again.';
end $$;
revoke all on function public.claim_daily_tune(text, text, text[], text[], text[]) from public, anon;
grant execute on function public.claim_daily_tune(text, text, text[], text[], text[]) to authenticated;

-- ---------- Pushes: new games at 10:30 PM, birthdays at 12 AM ----------
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
