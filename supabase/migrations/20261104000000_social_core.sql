-- =====================================================================
-- 25 — social core
-- Profiles, the 25-seat circle, chats, snaps + streaks, posts & reels,
-- likes, comments and weekly game scores. Every table is locked down
-- with row level security: you only ever see yourself and your 25.
--
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run: everything uses IF NOT EXISTS / OR REPLACE.
-- =====================================================================

create extension if not exists pgcrypto;

-- Day boundaries for streaks follow India time.
create or replace function public.today_ist() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles: signed-in users can look people up" on public.profiles;
create policy "profiles: signed-in users can look people up" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles: create your own" on public.profiles;
create policy "profiles: create your own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles: edit your own" on public.profiles;
create policy "profiles: edit your own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- The circle: a friendship is a seat at both tables. Max 25 each.
-- ---------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;

create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  )
$$;

-- Seats taken = accepted friends + requests you've sent that are still open.
create or replace function public.seats_taken(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.friendships f
  where (f.status = 'accepted' and (f.requester = u or f.addressee = u))
     or (f.status = 'pending' and f.requester = u)
$$;

create or replace function public.enforce_25() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.seats_taken(new.requester) >= 25 then
      raise exception 'All 25 seats taken. Someone has to go for someone new to come in.';
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    -- the requester's seat was already held by the pending request
    if public.seats_taken(new.addressee) >= 25 then
      raise exception 'All 25 seats taken. Free a seat before accepting.';
    end if;
    new.accepted_at := now();
  end if;
  return new;
end $$;
drop trigger if exists friendships_enforce_25 on public.friendships;
create trigger friendships_enforce_25 before insert or update on public.friendships
  for each row execute function public.enforce_25();

drop policy if exists "friendships: see your own" on public.friendships;
create policy "friendships: see your own" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "friendships: send a request" on public.friendships;
create policy "friendships: send a request" on public.friendships
  for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "friendships: accept a request sent to you" on public.friendships;
create policy "friendships: accept a request sent to you" on public.friendships
  for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
drop policy if exists "friendships: leave or decline" on public.friendships;
create policy "friendships: leave or decline" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

-- ---------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) <= 2000),
  snap_id uuid,
  shared_ref text, -- "post:<id>" or "reel:<id>"
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);
create index if not exists messages_pair_idx on public.messages (sender, recipient, created_at desc);
create index if not exists messages_recipient_idx on public.messages (recipient, created_at desc);
alter table public.messages enable row level security;

drop policy if exists "messages: see your conversations" on public.messages;
create policy "messages: see your conversations" on public.messages
  for select to authenticated using (auth.uid() in (sender, recipient));
drop policy if exists "messages: text your 25" on public.messages;
create policy "messages: text your 25" on public.messages
  for insert to authenticated with check (sender = auth.uid() and public.is_friend(sender, recipient));
drop policy if exists "messages: mark delivered or read" on public.messages;
create policy "messages: mark delivered or read" on public.messages
  for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());

-- ---------------------------------------------------------------------
-- Snaps + streaks
-- ---------------------------------------------------------------------
create table if not exists public.snaps (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles (id) on delete cascade,
  image_path text,
  bg text,
  caption text check (char_length(caption) <= 80),
  seconds int not null default 5 check (seconds between 1 and 10),
  created_at timestamptz not null default now()
);
create table if not exists public.snap_recipients (
  snap_id uuid not null references public.snaps (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  opened_at timestamptz,
  primary key (snap_id, recipient)
);
alter table public.snaps enable row level security;
alter table public.snap_recipients enable row level security;

create or replace function public.can_see_snap(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.snaps where id = s and sender = auth.uid())
      or exists (select 1 from public.snap_recipients where snap_id = s and recipient = auth.uid())
$$;

drop policy if exists "snaps: sender and recipients" on public.snaps;
create policy "snaps: sender and recipients" on public.snaps
  for select to authenticated using (public.can_see_snap(id));
drop policy if exists "snaps: send your own" on public.snaps;
create policy "snaps: send your own" on public.snaps
  for insert to authenticated with check (sender = auth.uid());

drop policy if exists "snap_recipients: sender and recipient" on public.snap_recipients;
create policy "snap_recipients: sender and recipient" on public.snap_recipients
  for select to authenticated using (
    recipient = auth.uid() or exists (select 1 from public.snaps s where s.id = snap_id and s.sender = auth.uid())
  );
drop policy if exists "snap_recipients: send to your 25" on public.snap_recipients;
create policy "snap_recipients: send to your 25" on public.snap_recipients
  for insert to authenticated with check (
    exists (select 1 from public.snaps s where s.id = snap_id and s.sender = auth.uid())
    and public.is_friend(auth.uid(), recipient)
  );

-- One row per pair (user_a < user_b). A streak day counts when both of you
-- snapped each other that day (India time). Miss a day and it starts over.
create table if not exists public.streaks (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  count int not null default 0,
  a_last date,
  b_last date,
  counted_day date,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.streaks enable row level security;
drop policy if exists "streaks: see your own" on public.streaks;
create policy "streaks: see your own" on public.streaks
  for select to authenticated using (auth.uid() in (user_a, user_b));

create or replace function public.bump_streak() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s uuid;
  a uuid;
  b uuid;
  d date := public.today_ist();
  row public.streaks;
begin
  select sender into s from public.snaps where id = new.snap_id;
  a := least(s, new.recipient);
  b := greatest(s, new.recipient);
  insert into public.streaks (user_a, user_b) values (a, b) on conflict do nothing;
  if s = a then
    update public.streaks set a_last = d where user_a = a and user_b = b;
  else
    update public.streaks set b_last = d where user_a = a and user_b = b;
  end if;
  select * into row from public.streaks where user_a = a and user_b = b;
  if row.a_last = d and row.b_last = d and row.counted_day is distinct from d then
    update public.streaks
      set count = case when row.counted_day = d - 1 then row.count + 1 else 1 end,
          counted_day = d
      where user_a = a and user_b = b;
  end if;
  return new;
end $$;
drop trigger if exists snap_recipients_bump_streak on public.snap_recipients;
create trigger snap_recipients_bump_streak after insert on public.snap_recipients
  for each row execute function public.bump_streak();

-- Opening a snap: marks it opened. After that only the sender can still load the image.
create or replace function public.open_snap(p_snap uuid) returns void
language sql security definer set search_path = public as $$
  update public.snap_recipients set opened_at = now()
  where snap_id = p_snap and recipient = auth.uid() and opened_at is null
$$;

-- ---------------------------------------------------------------------
-- Posts & reels, likes, comments
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'reel')),
  media_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  caption text not null default '' check (char_length(caption) <= 280),
  created_at timestamptz not null default now()
);
create index if not exists posts_author_idx on public.posts (author, created_at desc);
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create or replace function public.can_see_post(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts where id = p and (author = auth.uid() or public.is_friend(auth.uid(), author))
  )
$$;

drop policy if exists "posts: you and your 25" on public.posts;
create policy "posts: you and your 25" on public.posts
  for select to authenticated using (author = auth.uid() or public.is_friend(auth.uid(), author));
drop policy if exists "posts: share your own" on public.posts;
create policy "posts: share your own" on public.posts
  for insert to authenticated with check (author = auth.uid());
drop policy if exists "posts: delete your own" on public.posts;
create policy "posts: delete your own" on public.posts
  for delete to authenticated using (author = auth.uid());

drop policy if exists "likes: visible with the post" on public.post_likes;
create policy "likes: visible with the post" on public.post_likes
  for select to authenticated using (public.can_see_post(post_id));
drop policy if exists "likes: like what you can see" on public.post_likes;
create policy "likes: like what you can see" on public.post_likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));
drop policy if exists "likes: unlike" on public.post_likes;
create policy "likes: unlike" on public.post_likes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments: visible with the post" on public.post_comments;
create policy "comments: visible with the post" on public.post_comments
  for select to authenticated using (public.can_see_post(post_id));
drop policy if exists "comments: comment on what you can see" on public.post_comments;
create policy "comments: comment on what you can see" on public.post_comments
  for insert to authenticated with check (author = auth.uid() and public.can_see_post(post_id));
drop policy if exists "comments: delete your own" on public.post_comments;
create policy "comments: delete your own" on public.post_comments
  for delete to authenticated using (author = auth.uid());

-- ---------------------------------------------------------------------
-- Weekly game scores (week starts Monday, India time)
-- ---------------------------------------------------------------------
create table if not exists public.game_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('tap-rush', 'quick-math', 'trivia')),
  week date not null,
  best int not null check (best >= 0 and best <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game, week)
);
alter table public.game_scores enable row level security;
drop policy if exists "scores: you and your 25" on public.game_scores;
create policy "scores: you and your 25" on public.game_scores
  for select to authenticated using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));

create or replace function public.record_score(p_game text, p_score int) returns int
language plpgsql security definer set search_path = public as $$
declare
  wk date := date_trunc('week', public.today_ist())::date;
  result int;
begin
  insert into public.game_scores (user_id, game, week, best)
  values (auth.uid(), p_game, wk, p_score)
  on conflict (user_id, game, week)
    do update set best = greatest(public.game_scores.best, excluded.best), updated_at = now()
  returning best into result;
  return result;
end $$;

-- ---------------------------------------------------------------------
-- Storage: private buckets. Files live under "<your user id>/…".
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('snaps', 'snaps', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false) on conflict (id) do nothing;

drop policy if exists "storage: upload to your own folder" on storage.objects;
create policy "storage: upload to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('media', 'snaps', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage: delete your own files" on storage.objects;
create policy "storage: delete your own files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'snaps', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage: media and avatars for you and your 25" on storage.objects;
create policy "storage: media and avatars for you and your 25" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('media', 'avatars')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_friend(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

-- A snap image can be loaded by its sender, or by a recipient who hasn't opened it yet.
drop policy if exists "storage: unopened snaps only" on storage.objects;
create policy "storage: unopened snaps only" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'snaps'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.snaps s
        join public.snap_recipients r on r.snap_id = s.id
        where s.image_path = storage.objects.name
          and r.recipient = auth.uid()
          and r.opened_at is null
      )
    )
  );

-- ---------------------------------------------------------------------
-- Realtime: push new rows to the app as they happen (RLS still applies).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['messages', 'friendships', 'snap_recipients', 'posts', 'post_likes', 'post_comments', 'streaks']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
