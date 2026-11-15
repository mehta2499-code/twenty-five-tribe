-- Scenes, part 2:
--  * Edit your own scenes and comments (text only; marked "edited"). Delete your
--    own, and the author of a scene can delete any comment on it.
--  * @tags inside replies/comments notify the people tagged (and @all).
--  * Notifications about a scene open that scene.
--  * Thoughts are gone: drop their table.

alter table public.posts add column if not exists edited_at timestamptz;
alter table public.post_comments add column if not exists edited_at timestamptz;

-- Only the words can change; everything else stays as it was.
create or replace function public.posts_edit_guard() returns trigger
language plpgsql as $$
begin
  new.id := old.id; new.author := old.author; new.kind := old.kind;
  new.media_path := old.media_path; new.media_type := old.media_type; new.created_at := old.created_at;
  new.caption := btrim(new.caption);
  if new.caption is distinct from old.caption then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end $$;
drop trigger if exists posts_edit_guard on public.posts;
create trigger posts_edit_guard before update on public.posts
  for each row execute function public.posts_edit_guard();

create or replace function public.comments_edit_guard() returns trigger
language plpgsql as $$
begin
  new.id := old.id; new.author := old.author; new.post_id := old.post_id; new.created_at := old.created_at;
  new.body := btrim(new.body);
  if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end $$;
drop trigger if exists comments_edit_guard on public.post_comments;
create trigger comments_edit_guard before update on public.post_comments
  for each row execute function public.comments_edit_guard();

drop policy if exists "posts: edit your own" on public.posts;
create policy "posts: edit your own" on public.posts
  for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
drop policy if exists "comments: edit your own" on public.post_comments;
create policy "comments: edit your own" on public.post_comments
  for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
drop policy if exists "comments: delete your own" on public.post_comments;
drop policy if exists "comments: delete yours or on your scene" on public.post_comments;
create policy "comments: delete yours or on your scene" on public.post_comments
  for delete to authenticated using (
    author = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
  );

-- Replies/comments: tell the scene's author, and anyone tagged in it.
create or replace function public.on_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
  r record;
begin
  select author, kind, media_type into p from public.posts where id = new.post_id;
  perform public.notify(p.author, case when p.media_type = 'text' then 'reply' else 'comment' end,
                        new.author, p.kind || ':' || new.post_id, new.body);
  for r in select * from public.post_tagged(p.author, new.body) loop
    if r.user_id <> new.author and r.user_id <> p.author then
      perform public.notify(r.user_id, case when p.media_type = 'text' then 'reply_tag' else 'comment_tag' end,
                            new.author, p.kind || ':' || new.post_id, new.body);
    end if;
  end loop;
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
    when 'like' then t := '❤️ ' || who || ' liked your post'; b := ''; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'reply' then t := '💬 ' || who || ' replied'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'reply_tag' then t := '🏷️ ' || who || ' tagged you in a reply'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'comment_tag' then t := '🏷️ ' || who || ' tagged you in a comment'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'post_tag' then t := '🏷️ ' || who || ' tagged you in a scene'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'post_tag_all' then t := '📣 ' || who || ' tagged everyone in a scene'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
    when 'comment' then t := '💬 ' || who || ' commented'; b := new.body; u := '/app/feed?post=' || split_part(new.ref, ':', 2);
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

drop table if exists public.daily_thoughts cascade;
