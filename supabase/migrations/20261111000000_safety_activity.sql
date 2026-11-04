-- =====================================================================
-- Safety: block, report, delete your account.
-- Activity: one feed of what happened to you (seated, likes, comments…).
-- =====================================================================

-- ---------- Block ----------
create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks: your own" on public.blocks;
create policy "blocks: your own" on public.blocks
  for select to authenticated using (blocker = auth.uid());
drop policy if exists "blocks: block someone" on public.blocks;
create policy "blocks: block someone" on public.blocks
  for insert to authenticated with check (blocker = auth.uid());
drop policy if exists "blocks: unblock" on public.blocks;
create policy "blocks: unblock" on public.blocks
  for delete to authenticated using (blocker = auth.uid());

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  )
$$;

-- Blocking someone takes them out of your 25 and you out of theirs.
create or replace function public.on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.seats
   where (owner = new.blocker and guest = new.blocked)
      or (owner = new.blocked and guest = new.blocker);
  return new;
end $$;
drop trigger if exists blocks_cleanup on public.blocks;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.on_block();

-- No seating across a block, either way.
create or replace function public.enforce_seat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.owner, new.guest) then
    raise exception 'You can''t seat this person.';
  end if;
  if not public.has_passed_quiz(new.owner, new.guest) then
    raise exception 'Prove it first: get 4 of 6 right in How well do you know them.';
  end if;
  if public.seats_taken(new.owner) >= 25 then
    raise exception 'All 25 seats taken. Someone has to go for someone new to come in.';
  end if;
  return new;
end $$;

-- People who blocked you can't be found in search.
create or replace function public.blocked_me(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker = p and blocked = auth.uid())
$$;
drop policy if exists "profiles: signed-in users can look people up" on public.profiles;
create policy "profiles: signed-in users can look people up" on public.profiles
  for select to authenticated using (not public.blocked_me(id));

-- ---------- Report ----------
-- Reports land here for the admin (Supabase dashboard → Table editor → reports).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles (id) on delete cascade,
  reported uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) <= 60),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "reports: send one" on public.reports;
create policy "reports: send one" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

-- ---------- Delete your account ----------
-- The app removes your files first (storage only allows that through its API),
-- then calls this. Everything else you own goes with your profile.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Activity ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  -- null for anonymous ones (polls)
  actor uuid references public.profiles (id) on delete cascade,
  ref text,
  body text not null default '' check (char_length(body) <= 300),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: yours" on public.notifications;
create policy "notifications: yours" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications: mark read" on public.notifications;
create policy "notifications: mark read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications: clear" on public.notifications;
create policy "notifications: clear" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify(u uuid, k text, a uuid, r text, b text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, actor, ref, body)
  select u, k, a, r, left(coalesce(b, ''), 300)
   where u is not null and u is distinct from a
     and not (a is not null and public.is_blocked(u, a))
$$;

create or replace function public.on_seat_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(
    new.guest,
    case when public.in_25(new.guest, new.owner) then 'seated_back' else 'seated' end,
    new.owner, null, null);
  return new;
end $$;
drop trigger if exists seats_notify on public.seats;
create trigger seats_notify after insert on public.seats
  for each row execute function public.on_seat_notify();

create or replace function public.on_like_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select author, kind into p from public.posts where id = new.post_id;
  perform public.notify(p.author, 'like', new.user_id, p.kind || ':' || new.post_id, null);
  return new;
end $$;
drop trigger if exists likes_notify on public.post_likes;
create trigger likes_notify after insert on public.post_likes
  for each row execute function public.on_like_notify();

create or replace function public.on_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select author, kind into p from public.posts where id = new.post_id;
  perform public.notify(p.author, 'comment', new.author, p.kind || ':' || new.post_id, new.body);
  return new;
end $$;
drop trigger if exists comments_notify on public.post_comments;
create trigger comments_notify after insert on public.post_comments
  for each row execute function public.on_comment_notify();

-- Word Up: tell the setter how their friend did.
create or replace function public.on_game_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g uuid;
  n int;
begin
  if new.kind = 'word' and new.status = 'done' and old.status = 'playing' then
    g := (new.state ->> 'guesser')::uuid;
    n := jsonb_array_length(new.state -> 'guesses');
    perform public.notify((new.state ->> 'setter')::uuid, 'word_done', g, 'game:' || new.id,
      case when n <= 6 and exists (
             select 1 from jsonb_array_elements_text(new.state -> 'guesses') x
              where x = reverse(convert_from(decode(new.state ->> 'hidden', 'base64'), 'utf8')))
           then 'cracked your word in ' || n || '/6'
           else 'couldn''t crack your word 😈' end);
  end if;
  return new;
end $$;
drop trigger if exists games_notify on public.games;
create trigger games_notify after update on public.games
  for each row execute function public.on_game_notify();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
