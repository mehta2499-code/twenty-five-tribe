-- Polls in group chats: a message with a question (body) and 2-4 options,
-- single or multiple choice. Everyone in the group can vote and see who voted.

alter table public.group_messages add column if not exists poll_options text[];
alter table public.group_messages add column if not exists poll_multi boolean not null default false;
alter table public.group_messages drop constraint if exists group_messages_poll_shape;
alter table public.group_messages add constraint group_messages_poll_shape check (
  poll_options is null
  or (shared_ref = 'poll' and char_length(btrim(coalesce(body, ''))) > 0
      and public.poll_options_ok(poll_options))
);

create or replace function public.in_group_of_msg(m uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_messages gm
      join public.group_members mm on mm.group_id = gm.group_id
     where gm.id = m and mm.user_id = u
  )
$$;

create table if not exists public.group_poll_votes (
  message_id uuid not null references public.group_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option int not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, option)
);
alter table public.group_poll_votes enable row level security;
grant select, insert on public.group_poll_votes to authenticated;

drop policy if exists "group poll votes: members see" on public.group_poll_votes;
create policy "group poll votes: members see" on public.group_poll_votes
  for select to authenticated using (public.in_group_of_msg(message_id, auth.uid()));
drop policy if exists "group poll votes: members vote" on public.group_poll_votes;
create policy "group poll votes: members vote" on public.group_poll_votes
  for insert to authenticated
  with check (user_id = auth.uid() and public.in_group_of_msg(message_id, auth.uid()));

create or replace function public.group_poll_vote_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select poll_options, poll_multi into p from public.group_messages where id = new.message_id;
  if p.poll_options is null or new.option >= array_length(p.poll_options, 1) then
    raise exception 'That poll option doesn''t exist.';
  end if;
  if not p.poll_multi and exists (
    select 1 from public.group_poll_votes where message_id = new.message_id and user_id = new.user_id
  ) then
    raise exception 'You''ve already voted.';
  end if;
  return new;
end $$;
drop trigger if exists group_poll_vote_guard on public.group_poll_votes;
create trigger group_poll_vote_guard before insert on public.group_poll_votes
  for each row execute function public.group_poll_vote_guard();

-- Push / preview text for a poll: "📊 <question>".
create or replace function public.msg_preview(p_body text, p_ref text) returns text
language sql immutable as $$
  select case
    when p_ref = 'poll' then '📊 ' || coalesce(p_body, 'Poll')
    when nullif(p_body, '') is not null then p_body
    when p_ref like 'gif:%' then 'sent a GIF'
    when p_ref like 'sticker:%' then 'sent a sticker'
    when p_ref like 'voice:%' then '🎤 Voice note'
    when p_ref like 'img:%' then '📷 Photo'
    when p_ref like 'vid:%' then '🎬 Video'
    when p_ref like 'game:%' then '🎮 Game invite'
    else 'New message' end
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_poll_votes'
  ) then
    alter publication supabase_realtime add table public.group_poll_votes;
  end if;
exception when others then
  raise notice 'realtime publication not available: %', sqlerrm;
end $$;
