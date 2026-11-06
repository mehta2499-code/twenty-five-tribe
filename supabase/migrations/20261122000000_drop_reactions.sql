-- Likes and comments on the 25 Drop. Same rule as seeing a drop: yours, or a
-- mutual's once you've posted yours that day.
create or replace function public.can_see_drop(p_owner uuid, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.drops where user_id = p_owner and day = p_day)
     and (p_owner = auth.uid() or (public.is_friend(auth.uid(), p_owner) and public.posted_drop(p_day)))
$$;

create table if not exists public.drop_likes (
  owner uuid not null,
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, day, user_id),
  foreign key (owner, day) references public.drops (user_id, day) on delete cascade
);
create table if not exists public.drop_comments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null,
  day date not null,
  author uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  foreign key (owner, day) references public.drops (user_id, day) on delete cascade
);
alter table public.drop_likes enable row level security;
alter table public.drop_comments enable row level security;

drop policy if exists "drop likes: see" on public.drop_likes;
create policy "drop likes: see" on public.drop_likes
  for select to authenticated using (public.can_see_drop(owner, day));
drop policy if exists "drop likes: like" on public.drop_likes;
create policy "drop likes: like" on public.drop_likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_drop(owner, day));
drop policy if exists "drop likes: unlike" on public.drop_likes;
create policy "drop likes: unlike" on public.drop_likes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "drop comments: see" on public.drop_comments;
create policy "drop comments: see" on public.drop_comments
  for select to authenticated using (public.can_see_drop(owner, day));
drop policy if exists "drop comments: comment" on public.drop_comments;
create policy "drop comments: comment" on public.drop_comments
  for insert to authenticated with check (author = auth.uid() and public.can_see_drop(owner, day));
drop policy if exists "drop comments: delete own" on public.drop_comments;
create policy "drop comments: delete own" on public.drop_comments
  for delete to authenticated using (author = auth.uid());

-- Activity + push for the drop owner.
create or replace function public.on_drop_like_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.owner, 'drop_like', new.user_id, 'drop', null);
  return new;
end $$;
drop trigger if exists drop_likes_notify on public.drop_likes;
create trigger drop_likes_notify after insert on public.drop_likes
  for each row execute function public.on_drop_like_notify();

create or replace function public.on_drop_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.owner, 'drop_comment', new.author, 'drop', new.body);
  return new;
end $$;
drop trigger if exists drop_comments_notify on public.drop_comments;
create trigger drop_comments_notify after insert on public.drop_comments
  for each row execute function public.on_drop_comment_notify();

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
    when 'seated_back' then t := '🤝 ' || who || ' seated you back'; b := 'Chats and snaps unlocked.';
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

do $$
declare t text;
begin
  foreach t in array array['drop_likes', 'drop_comments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
