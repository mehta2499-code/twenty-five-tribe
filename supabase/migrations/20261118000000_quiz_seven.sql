-- Vibe check: 9 this-or-that questions + birthday ("Black or white?" retired).
-- Prove it: 7 picked at random from those 10; 4 right gets the seat.
update public.vibe_answers set answers = answers - 'colour' where answers ? 'colour';

create or replace function public.start_vibe_quiz(p_target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target_answers jsonb;
  last_fail timestamptz;
  qs text[];
  attempt_id uuid;
  valid text[] := array['food', 'pet', 'drink', 'plan', 'time', 'trip', 'talk', 'taste', 'weekend'];
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

  -- 7 at random from their answered this-or-thats plus the birthday month.
  select array_agg(k) into qs from (
    select k from (
      select k from jsonb_object_keys(target_answers) as k where k = any (valid)
      union all select 'bday_month'
    ) pool
    order by random()
    limit 7
  ) picked;

  insert into public.quiz_attempts (guesser, target, questions, total)
  values (me, p_target, qs, cardinality(qs))
  returning id into attempt_id;

  return jsonb_build_object('attempt', attempt_id, 'questions', to_jsonb(qs), 'passed', false);
end $$;

-- Same seat rules, updated wording.
create or replace function public.enforce_seat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.owner, new.guest) then
    raise exception 'You can''t seat this person.';
  end if;
  if not public.has_passed_quiz(new.owner, new.guest) then
    raise exception 'Prove it first: get 4 of 7 right in How well do you know them.';
  end if;
  if public.seats_taken(new.owner) >= 25 then
    raise exception 'All 25 seats taken. Someone has to go for someone new to come in.';
  end if;
  return new;
end $$;
