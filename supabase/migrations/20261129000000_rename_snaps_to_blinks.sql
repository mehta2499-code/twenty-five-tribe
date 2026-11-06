-- Rename snaps to "blinks" in push notification text (the tables keep their names).

-- Snaps.
create or replace function public.on_snap_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  select sender into s from public.snaps where id = new.snap_id;
  perform public.push_to(array[new.recipient], '📸 ' || public.first_name(s), 'sent you a blink 👁️', '/app/snap', 'snap-' || s);
  return new;
end $$;
drop trigger if exists snaps_push on public.snap_recipients;
create trigger snaps_push after insert on public.snap_recipients
  for each row execute function public.on_snap_push();

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
    else t := '25'; b := new.body;
  end case;
  perform public.push_to(array[new.user_id], t, b, u, new.kind);
  return new;
end $$;
