-- Polls in Scenes: a text scene can carry 2-4 options (single or multiple
-- choice). Votes are anonymous on screen; anyone who can see the scene can vote.

-- Each option: 1-40 characters.
create or replace function public.poll_options_ok(o text[]) returns boolean
language sql immutable as $$
  select array_length(o, 1) between 2 and 4
     and coalesce((select bool_and(char_length(btrim(x)) between 1 and 40) from unnest(o) x), false)
$$;

alter table public.posts add column if not exists poll_options text[];
alter table public.posts add column if not exists poll_multi boolean not null default false;
alter table public.posts drop constraint if exists posts_poll_shape;
alter table public.posts add constraint posts_poll_shape check (
  poll_options is null or (media_type = 'text' and public.poll_options_ok(poll_options))
);

-- Editing a scene never changes its poll.
create or replace function public.posts_edit_guard() returns trigger
language plpgsql as $$
begin
  new.id := old.id; new.author := old.author; new.kind := old.kind;
  new.media_path := old.media_path; new.media_type := old.media_type; new.created_at := old.created_at;
  new.poll_options := old.poll_options; new.poll_multi := old.poll_multi;
  new.caption := btrim(new.caption);
  if new.caption is distinct from old.caption then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end $$;

create table if not exists public.post_poll_votes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option int not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, option)
);
alter table public.post_poll_votes enable row level security;
grant select, insert on public.post_poll_votes to authenticated;

drop policy if exists "poll votes: see on scenes you can see" on public.post_poll_votes;
create policy "poll votes: see on scenes you can see" on public.post_poll_votes
  for select to authenticated using (public.can_see_post(post_id));
drop policy if exists "poll votes: vote on scenes you can see" on public.post_poll_votes;
create policy "poll votes: vote on scenes you can see" on public.post_poll_votes
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));

-- The option must exist, and single-choice polls take one vote per person.
create or replace function public.poll_vote_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select poll_options, poll_multi into p from public.posts where id = new.post_id;
  if p.poll_options is null or new.option >= array_length(p.poll_options, 1) then
    raise exception 'That poll option doesn''t exist.';
  end if;
  if not p.poll_multi and exists (
    select 1 from public.post_poll_votes where post_id = new.post_id and user_id = new.user_id
  ) then
    raise exception 'You''ve already voted.';
  end if;
  return new;
end $$;
drop trigger if exists poll_vote_guard on public.post_poll_votes;
create trigger poll_vote_guard before insert on public.post_poll_votes
  for each row execute function public.poll_vote_guard();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_poll_votes'
  ) then
    alter publication supabase_realtime add table public.post_poll_votes;
  end if;
exception when others then
  raise notice 'realtime publication not available: %', sqlerrm;
end $$;
