-- =====================================================================
-- Group chats (with people from your mutual 25), emoji reactions on
-- messages, and voice notes stored in the media bucket.
-- =====================================================================

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '💬' check (char_length(emoji) <= 16),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  sender uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) <= 2000),
  shared_ref text, -- "voice:<path>", "post:<id>", …
  created_at timestamptz not null default now()
);
create index if not exists group_messages_idx on public.group_messages (group_id, created_at desc);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create or replace function public.is_member(g uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = u)
$$;
create or replace function public.created_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groups where id = g and created_by = auth.uid())
$$;

drop policy if exists "groups: members see it" on public.groups;
create policy "groups: members see it" on public.groups
  for select to authenticated using (created_by = auth.uid() or public.is_member(id, auth.uid()));
drop policy if exists "groups: start one" on public.groups;
create policy "groups: start one" on public.groups
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "groups: members rename" on public.groups;
create policy "groups: members rename" on public.groups
  for update to authenticated using (public.is_member(id, auth.uid())) with check (public.is_member(id, auth.uid()));
drop policy if exists "groups: creator deletes" on public.groups;
create policy "groups: creator deletes" on public.groups
  for delete to authenticated using (created_by = auth.uid());

drop policy if exists "group_members: members see each other" on public.group_members;
create policy "group_members: members see each other" on public.group_members
  for select to authenticated using (public.is_member(group_id, auth.uid()));
-- Add yourself to a group you made, or add someone from your mutual 25 to a group you're in.
drop policy if exists "group_members: add" on public.group_members;
create policy "group_members: add" on public.group_members
  for insert to authenticated
  with check (
    (user_id = auth.uid() and public.created_group(group_id))
    or (public.is_member(group_id, auth.uid()) and public.is_friend(auth.uid(), user_id))
  );
-- Leave, or the creator removes someone.
drop policy if exists "group_members: leave or remove" on public.group_members;
create policy "group_members: leave or remove" on public.group_members
  for delete to authenticated using (user_id = auth.uid() or public.created_group(group_id));

create or replace function public.group_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.group_members where group_id = new.group_id) >= 25 then
    raise exception 'Groups max out at 25. Obviously.';
  end if;
  if public.is_blocked(new.user_id, (select created_by from public.groups where id = new.group_id)) then
    raise exception 'You can''t add this person.';
  end if;
  return new;
end $$;
drop trigger if exists group_members_cap on public.group_members;
create trigger group_members_cap before insert on public.group_members
  for each row execute function public.group_cap();

drop policy if exists "group_messages: members read" on public.group_messages;
create policy "group_messages: members read" on public.group_messages
  for select to authenticated using (public.is_member(group_id, auth.uid()));
drop policy if exists "group_messages: members send" on public.group_messages;
create policy "group_messages: members send" on public.group_messages
  for insert to authenticated with check (sender = auth.uid() and public.is_member(group_id, auth.uid()));

-- Group voice notes live at media/<you>/g/<group id>/…; every member can play them.
drop policy if exists "storage: group files for members" on storage.objects;
create policy "storage: group files for members" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = 'g'
    and public.is_member(((storage.foldername(name))[3])::uuid, auth.uid())
  );

-- ---------- Reactions (1:1 and group messages) ----------
create table if not exists public.reactions (
  msg_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (msg_id, user_id)
);
alter table public.reactions enable row level security;

create or replace function public.can_see_msg(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.messages where id = m and auth.uid() in (sender, recipient))
      or exists (select 1 from public.group_messages gm where gm.id = m and public.is_member(gm.group_id, auth.uid()))
$$;

drop policy if exists "reactions: see on messages you see" on public.reactions;
create policy "reactions: see on messages you see" on public.reactions
  for select to authenticated using (public.can_see_msg(msg_id));
drop policy if exists "reactions: react" on public.reactions;
create policy "reactions: react" on public.reactions
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_msg(msg_id));
drop policy if exists "reactions: change" on public.reactions;
create policy "reactions: change" on public.reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "reactions: remove" on public.reactions;
create policy "reactions: remove" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['groups', 'group_members', 'group_messages', 'reactions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
