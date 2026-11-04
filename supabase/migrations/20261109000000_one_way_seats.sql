-- =====================================================================
-- One-way seats.
-- Your 25 is yours: seat anyone you know (pass the quiz about them) and they
-- can see your posts and reels. They don't have to seat you back.
-- Chats, snaps, streaks and games need a mutual seat (you're in each
-- other's 25), so nobody gets DMs from someone they didn't pick.
-- =====================================================================

create table if not exists public.seats (
  owner uuid not null references public.profiles (id) on delete cascade,
  guest uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, guest),
  check (owner <> guest)
);
create index if not exists seats_guest_idx on public.seats (guest);
alter table public.seats enable row level security;

-- Keep everyone who was already connected. An accepted friendship becomes a
-- seat in both directions; an open request becomes a seat from the person who asked.
insert into public.seats (owner, guest, created_at)
select requester, addressee, coalesce(accepted_at, created_at) from public.friendships
union all
select addressee, requester, accepted_at from public.friendships where status = 'accepted'
on conflict do nothing;

-- Has `owner` put `guest` in their 25?
create or replace function public.in_25(owner uuid, guest uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.seats s where s.owner = $1 and s.guest = $2)
$$;

-- "Friends" now means a mutual seat. Messages, snaps, streaks, games and
-- scores already check this, so they stay mutual.
create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.in_25(a, b) and public.in_25(b, a)
$$;

create or replace function public.seats_taken(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.seats where owner = u
$$;

create or replace function public.enforce_seat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_passed_quiz(new.owner, new.guest) then
    raise exception 'Prove it first: get 4 of 6 right in How well do you know them.';
  end if;
  if public.seats_taken(new.owner) >= 25 then
    raise exception 'All 25 seats taken. Someone has to go for someone new to come in.';
  end if;
  return new;
end $$;
drop trigger if exists seats_enforce on public.seats;
create trigger seats_enforce before insert on public.seats
  for each row execute function public.enforce_seat();

drop policy if exists "seats: see seats you're part of" on public.seats;
create policy "seats: see seats you're part of" on public.seats
  for select to authenticated using (auth.uid() in (owner, guest));
drop policy if exists "seats: seat someone" on public.seats;
create policy "seats: seat someone" on public.seats
  for insert to authenticated with check (owner = auth.uid());
drop policy if exists "seats: free a seat" on public.seats;
create policy "seats: free a seat" on public.seats
  for delete to authenticated using (owner = auth.uid());

-- Posts and reels: yours, plus posts by anyone who put you in their 25.
create or replace function public.can_see_post(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts
    where id = p and (author = auth.uid() or public.in_25(author, auth.uid()))
  )
$$;

drop policy if exists "posts: you and your 25" on public.posts;
create policy "posts: you and your 25" on public.posts
  for select to authenticated using (author = auth.uid() or public.in_25(author, auth.uid()));

-- Post and reel files follow the same rule. Avatars are visible to anyone
-- connected either way, so you can see who seated you.
drop policy if exists "storage: media and avatars for you and your 25" on storage.objects;
create policy "storage: media and avatars for you and your 25" on storage.objects
  for select to authenticated
  using (
    (bucket_id in ('media', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text)
    or (
      bucket_id = 'media'
      and public.in_25(((storage.foldername(name))[1])::uuid, auth.uid())
    )
    or (
      bucket_id = 'avatars'
      and (
        public.in_25(((storage.foldername(name))[1])::uuid, auth.uid())
        or public.in_25(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- Share card: seats taken = how many people you've seated.
create or replace function public.public_card(p_username text)
returns table (id uuid, display_name text, username text, seats int, vibe_done boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username,
         public.seats_taken(p.id),
         exists (select 1 from public.vibe_answers v where v.user_id = p.id)
    from public.profiles p
   where p.username = lower(p_username)
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'seats'
  ) then
    alter publication supabase_realtime add table public.seats;
  end if;
end $$;
