-- =====================================================================
-- "Remove me": leave the 25 of someone who seated you (e.g. a stranger).
-- They're told, and they can't seat you again unless you seat them first.
-- Also: a Drop sent two pushes to friends (one direct, one via Activity);
-- keep only the Activity one.
-- =====================================================================

create table if not exists public.seat_refusals (
  owner uuid not null references auth.users (id) on delete cascade,
  guest uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, guest)
);
alter table public.seat_refusals enable row level security;
-- No policies: only the functions below touch it.

create or replace function public.leave_their_25(p_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if p_owner is null or p_owner = me then return; end if;
  delete from public.seats where owner = p_owner and guest = me;
  if not found then return; end if;
  insert into public.seat_refusals (owner, guest) values (p_owner, me)
  on conflict do nothing;
  perform public.notify(p_owner, 'unseated', me, 'seat', null);
end $$;
revoke all on function public.leave_their_25(uuid) from public, anon;
grant execute on function public.leave_their_25(uuid) to authenticated;

-- Seating rules, now also refusing people who removed themselves.
create or replace function public.enforce_seat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.owner, new.guest) then
    raise exception 'You can''t seat this person.';
  end if;
  if exists (select 1 from public.seat_refusals where owner = new.owner and guest = new.guest) then
    raise exception 'This person removed themselves from your 25.';
  end if;
  if not public.has_passed_quiz(new.owner, new.guest) then
    raise exception 'Prove it first: get 4 of 7 right in How well do you know them.';
  end if;
  if public.seats_taken(new.owner) >= 25 then
    raise exception 'All 25 seats taken. Someone has to go for someone new to come in.';
  end if;
  return new;
end $$;

-- If you later seat them yourself, they're allowed to seat you again.
create or replace function public.on_seat_clear_refusal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.seat_refusals where owner = new.guest and guest = new.owner;
  return new;
end $$;
drop trigger if exists seats_clear_refusal on public.seats;
create trigger seats_clear_refusal after insert on public.seats
  for each row execute function public.on_seat_clear_refusal();

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
    when 'daily_top' then t := '👑 ' || who || ' is #1 in today''s game'; b := 'Score: ' || new.body || '. Beat that.'; u := '/app/games';
    else t := '25'; b := new.body;
  end case;
  -- One notification per person and kind on the phone (two friends posting don't overwrite).
  perform public.push_to(array[new.user_id], t, coalesce(b, ''), u, new.kind || coalesce(':' || new.actor, ''));
  return new;
end $$;

-- One push per Drop, not two (drops_circle already notifies + pushes).
drop trigger if exists drops_push on public.drops;
