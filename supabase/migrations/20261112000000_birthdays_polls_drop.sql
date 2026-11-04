-- =====================================================================
-- Birthdays (+ a birthday card your 25 signs), anonymous compliment polls,
-- and the 25 Drop (one surprise photo moment a day).
-- =====================================================================

-- ---------- Birthdays ----------
-- Day and month only (never the year), for you and your mutual 25.
create or replace function public.birthdays()
returns table (user_id uuid, month int, day int)
language sql stable security definer set search_path = public as $$
  select v.user_id, extract(month from v.birthday)::int, extract(day from v.birthday)::int
    from public.vibe_answers v
   where v.user_id = auth.uid() or public.is_friend(auth.uid(), v.user_id)
$$;

create table if not exists public.birthday_cards (
  target uuid not null references public.profiles (id) on delete cascade,
  year int not null,
  author uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  primary key (target, year, author)
);
alter table public.birthday_cards enable row level security;

create or replace function public.signed_card(t uuid, y int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.birthday_cards where target = t and year = y and author = auth.uid())
$$;

-- The birthday person sees their card; everyone who signed sees the others.
drop policy if exists "cards: birthday person and signers" on public.birthday_cards;
create policy "cards: birthday person and signers" on public.birthday_cards
  for select to authenticated
  using (target = auth.uid() or author = auth.uid() or public.signed_card(target, year));
drop policy if exists "cards: sign for your mutual 25" on public.birthday_cards;
create policy "cards: sign for your mutual 25" on public.birthday_cards
  for insert to authenticated
  with check (
    author = auth.uid()
    and public.is_friend(auth.uid(), target)
    and year between extract(year from public.today_ist())::int - 1 and extract(year from public.today_ist())::int + 1
  );

create or replace function public.on_card_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.target, 'card', new.author, 'card:' || new.target, null);
  return new;
end $$;
drop trigger if exists cards_notify on public.birthday_cards;
create trigger cards_notify after insert on public.birthday_cards
  for each row execute function public.on_card_notify();

-- ---------- Anonymous compliment polls ----------
create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  voter uuid not null references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 120),
  day date not null default public.today_ist(),
  created_at timestamptz not null default now(),
  unique (voter, day, question)
);
alter table public.poll_votes enable row level security;
-- Only the voter can read their votes. The person picked never sees who.
drop policy if exists "polls: your own votes" on public.poll_votes;
create policy "polls: your own votes" on public.poll_votes
  for select to authenticated using (voter = auth.uid());
drop policy if exists "polls: vote for your mutual 25" on public.poll_votes;
create policy "polls: vote for your mutual 25" on public.poll_votes
  for insert to authenticated
  with check (voter = auth.uid() and day = public.today_ist() and public.is_friend(voter, target));

-- What you've been picked for, without who picked you.
create or replace function public.my_poll_picks()
returns table (question text, picks int, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select question, count(*)::int, max(created_at)
    from public.poll_votes
   where target = auth.uid()
   group by question
   order by max(created_at) desc
   limit 100
$$;

create or replace function public.on_poll_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.target, 'poll', null, 'poll', new.question);
  return new;
end $$;
drop trigger if exists polls_notify on public.poll_votes;
create trigger polls_notify after insert on public.poll_votes
  for each row execute function public.on_poll_notify();

-- ---------- The 25 Drop ----------
-- Same surprise time for everyone each day, between 10:00 and 22:00 India time.
create or replace function public.drop_at(d date) returns timestamptz
language sql immutable as $$
  select (d::timestamp + interval '10 hours'
          + make_interval(mins => (abs(hashtext('drop:' || d::text)) % 720)))
         at time zone 'Asia/Kolkata'
$$;
create or replace function public.drop_time() returns timestamptz
language sql stable as $$ select public.drop_at(public.today_ist()) $$;

create table if not exists public.drops (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default public.today_ist(),
  image_path text not null,
  caption text not null default '' check (char_length(caption) <= 120),
  late_minutes int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.drops enable row level security;

create or replace function public.posted_drop(d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.drops where user_id = auth.uid() and day = d)
$$;

-- You see your mutual 25's drops only after posting yours that day.
drop policy if exists "drops: post yours to see theirs" on public.drops;
create policy "drops: post yours to see theirs" on public.drops
  for select to authenticated
  using (user_id = auth.uid() or (public.is_friend(auth.uid(), user_id) and public.posted_drop(day)));
drop policy if exists "drops: post today's" on public.drops;
create policy "drops: post today's" on public.drops
  for insert to authenticated
  with check (user_id = auth.uid() and day = public.today_ist() and now() >= public.drop_at(day));

-- Lateness is worked out here, not on the phone.
create or replace function public.drop_lateness() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.late_minutes := greatest(0, floor(extract(epoch from (now() - public.drop_at(new.day))) / 60)::int - 10);
  return new;
end $$;
drop trigger if exists drops_lateness on public.drops;
create trigger drops_lateness before insert on public.drops
  for each row execute function public.drop_lateness();

do $$
declare t text;
begin
  foreach t in array array['drops', 'birthday_cards']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
