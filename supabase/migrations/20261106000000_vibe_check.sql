-- =====================================================================
-- 25 — Vibe check + "How well do you know them?"
--
-- Everyone answers a short this-or-that quiz and their birthday.
-- To save someone a seat (or accept their request) you must guess at
-- least 4 of 6 of their answers. Raw answers are never readable by
-- anyone else; guesses are checked here, on the server.
-- Safe to re-run.
-- =====================================================================

create table if not exists public.vibe_answers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  answers jsonb not null,           -- { "<question id>": "a" | "b", ... }
  birthday date not null,
  updated_at timestamptz not null default now()
);
alter table public.vibe_answers enable row level security;

drop policy if exists "vibe: read your own" on public.vibe_answers;
create policy "vibe: read your own" on public.vibe_answers
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "vibe: write your own" on public.vibe_answers;
create policy "vibe: write your own" on public.vibe_answers
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "vibe: update your own" on public.vibe_answers;
create policy "vibe: update your own" on public.vibe_answers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  guesser uuid not null references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  questions text[] not null,
  score int,
  total int not null,
  passed boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (guesser <> target)
);
create index if not exists quiz_attempts_pair_idx on public.quiz_attempts (guesser, target, created_at desc);
alter table public.quiz_attempts enable row level security;

-- You can see attempts you made, and attempts made on you ("Priya got 5/6 on you").
drop policy if exists "quiz: guesser and target" on public.quiz_attempts;
create policy "quiz: guesser and target" on public.quiz_attempts
  for select to authenticated using (auth.uid() in (guesser, target));

create or replace function public.has_passed_quiz(g uuid, t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quiz_attempts where guesser = g and target = t and passed)
$$;

-- Start a quiz about someone: 5 of their this-or-that answers + their birthday month.
create or replace function public.start_vibe_quiz(p_target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target_answers jsonb;
  last_fail timestamptz;
  qs text[];
  attempt_id uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if me = p_target then raise exception 'Nice try. You can''t quiz yourself.'; end if;
  if not exists (select 1 from public.vibe_answers where user_id = me) then
    raise exception 'Do your own vibe check first.';
  end if;
  select answers into target_answers from public.vibe_answers where user_id = p_target;
  if target_answers is null then
    raise exception 'They haven''t done their vibe check yet. Ask them to open 25.';
  end if;
  if public.has_passed_quiz(me, p_target) then
    return jsonb_build_object('passed', true);
  end if;
  select max(created_at) into last_fail from public.quiz_attempts
   where guesser = me and target = p_target and score is not null and not passed;
  if last_fail is not null and last_fail > now() - interval '30 minutes' then
    raise exception 'Not quite last time. Try again in % minutes.',
      ceil(extract(epoch from (last_fail + interval '30 minutes' - now())) / 60)::int;
  end if;

  select array_agg(k) into qs from (
    select k from jsonb_object_keys(target_answers) as k order by random() limit 5
  ) picked;
  qs := qs || array['bday_month'];

  insert into public.quiz_attempts (guesser, target, questions, total)
  values (me, p_target, qs, cardinality(qs))
  returning id into attempt_id;

  return jsonb_build_object('attempt', attempt_id, 'questions', to_jsonb(qs), 'passed', false);
end $$;

-- Check guesses. Only the score comes back, never the right answers.
create or replace function public.submit_vibe_quiz(p_attempt uuid, p_guesses jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.quiz_attempts;
  v public.vibe_answers;
  q text;
  s int := 0;
begin
  select * into a from public.quiz_attempts
   where id = p_attempt and guesser = auth.uid() and score is null
     and created_at > now() - interval '20 minutes';
  if a.id is null then raise exception 'This quiz has expired. Start a new one.'; end if;
  select * into v from public.vibe_answers where user_id = a.target;

  foreach q in array a.questions loop
    if q = 'bday_month' then
      if (p_guesses ->> q) ~ '^[0-9]{1,2}$' and (p_guesses ->> q)::int = extract(month from v.birthday)::int then
        s := s + 1;
      end if;
    elsif (p_guesses ->> q) is not null and (p_guesses ->> q) = (v.answers ->> q) then
      s := s + 1;
    end if;
  end loop;

  update public.quiz_attempts
     set score = s, passed = s >= 4, finished_at = now()
   where id = a.id;

  return jsonb_build_object('score', s, 'total', a.total, 'passed', s >= 4);
end $$;

-- The 25-seat rule now also needs proof you know each other.
create or replace function public.enforce_25() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.has_passed_quiz(new.requester, new.addressee) then
      raise exception 'Prove it first: get 4 of 6 right in How well do you know them.';
    end if;
    if public.seats_taken(new.requester) >= 25 then
      raise exception 'All 25 seats taken. Someone has to go for someone new to come in.';
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    if not public.has_passed_quiz(new.addressee, new.requester) then
      raise exception 'Prove it first: get 4 of 6 right about them to accept.';
    end if;
    if public.seats_taken(new.addressee) >= 25 then
      raise exception 'All 25 seats taken. Free a seat before accepting.';
    end if;
    new.accepted_at := now();
  end if;
  return new;
end $$;

-- "Are you in my 25?" share links: a tiny public card, safe to show anyone.
create or replace function public.public_card(p_username text)
returns table (id uuid, display_name text, username text, seats int, vibe_done boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username,
         (select count(*)::int from public.friendships f
           where f.status = 'accepted' and p.id in (f.requester, f.addressee)),
         exists (select 1 from public.vibe_answers v where v.user_id = p.id)
    from public.profiles p
   where p.username = lower(p_username)
$$;
grant execute on function public.public_card(text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_attempts'
  ) then
    alter publication supabase_realtime add table public.quiz_attempts;
  end if;
end $$;
