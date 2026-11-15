-- Scenes (the old Feed): posts can be text only, and people can be tagged.
--  * media_type 'text' = a text post (no file). Photo/video posts keep a file.
--  * @username tags someone (they must be at the author's Table, i.e. able to see
--    the post); @all tags everyone who can see it. Tagged people get a
--    "tagged you" notification instead of the usual "shared a new scene".
--  * A comment on a text post is a "reply".
alter table public.posts alter column media_path drop not null;
alter table public.posts drop constraint if exists posts_media_type_check;
alter table public.posts add constraint posts_media_type_check
  check (media_type in ('image', 'video', 'text'));
alter table public.posts drop constraint if exists posts_text_has_words;
alter table public.posts add constraint posts_text_has_words
  check (media_type <> 'text' or char_length(btrim(caption)) > 0);
alter table public.posts drop constraint if exists posts_media_has_file;
alter table public.posts add constraint posts_media_has_file
  check (media_type = 'text' or media_path is not null);

-- Who a post tags (people the author seated). @all = all of them.
create or replace function public.post_tagged(p_author uuid, p_caption text)
returns table (user_id uuid, via_all boolean)
language sql stable security definer set search_path = public as $$
  with handles as (
    select distinct lower(regexp_replace(m[1], '\.+$', '')) h
      from regexp_matches(coalesce(p_caption, ''), '@([A-Za-z0-9_.]+)', 'g') m
  ), everyone as (
    select exists (select 1 from handles where h in ('all', 'everyone')) e
  )
  select s.guest, (select e from everyone)
    from public.seats s
    join public.profiles pr on pr.id = s.guest
   where s.owner = p_author
     and ((select e from everyone) or lower(pr.username) in (select h from handles))
$$;
revoke all on function public.post_tagged(uuid, text) from public, anon, authenticated;

create or replace function public.on_post_circle() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_body text := coalesce(nullif(new.caption, ''),
                  case new.media_type when 'video' then 'New video' else 'New photo' end);
  v_tagged uuid[] := '{}';
  r record;
begin
  for r in select * from public.post_tagged(new.author, new.caption) loop
    perform public.notify(r.user_id, case when r.via_all then 'post_tag_all' else 'post_tag' end,
                          new.author, new.kind || ':' || new.id, v_body);
    v_tagged := v_tagged || r.user_id;
  end loop;
  perform public.notify_mutuals(new.author, 'post', new.kind || ':' || new.id, v_body, v_tagged);
  return new;
end $$;

create or replace function public.on_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select author, kind, media_type into p from public.posts where id = new.post_id;
  perform public.notify(p.author, case when p.media_type = 'text' then 'reply' else 'comment' end,
                        new.author, p.kind || ':' || new.post_id, new.body);
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
    when 'seated' then t := '👀 ' || who || ' put you in their 25'; b := 'Seat them back?'; u := '/app/seat/' || new.actor;
    when 'unseated' then t := '🚪 ' || who || ' removed themselves from your 25'; b := 'They can''t be re-added unless they add you.'; u := '/app/people';
    when 'seated_back' then t := '🤝 ' || who || ' seated you back'; b := 'Chats and blinks unlocked.'; u := '/app/seat/' || new.actor;
    when 'like' then t := '❤️ ' || who || ' liked your post'; b := ''; u := '/app/feed';
    when 'reply' then t := '💬 ' || who || ' replied'; b := new.body; u := '/app/feed';
    when 'post_tag' then t := '🏷️ ' || who || ' tagged you in a scene'; b := new.body; u := '/app/feed';
    when 'post_tag_all' then t := '📣 ' || who || ' tagged everyone in a scene'; b := new.body; u := '/app/feed';
    when 'comment' then t := '💬 ' || who || ' commented'; b := new.body; u := '/app/feed';
    when 'word_done' then t := '🔤 ' || who || ' ' || new.body; b := 'Word Up'; u := case when new.ref like 'game:%' then '/app/play/' || substr(new.ref, 6) else '/app/games' end;
    when 'poll' then t := '🗳️ Someone in your 25 picked you'; b := new.body; u := '/app/polls';
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
    when 'post' then t := '✨ ' || who || ' shared a new scene'; b := new.body; u := '/app/feed';
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
