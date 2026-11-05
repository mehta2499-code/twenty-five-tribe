-- "Party or stay in?" becomes "Vodka or whiskey?" (new id: booze).
-- Old party/stay-in answers are cleared so they don't count as the new question.
update public.vibe_answers set answers = answers - 'weekend' where answers ? 'weekend';

create or replace function public.start_vibe_quiz(p_target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target_answers jsonb;
  last_fail timestamptz;
  qs text[];
  attempt_id uuid;
  valid text[] := array['food', 'pet', 'drink', 'plan', 'colour', 'time', 'trip', 'talk', 'taste', 'booze'];
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

  -- 6 random this-or-thats they've answered, then always the birthday.
  select coalesce(array_agg(k), '{}') into qs from (
    select k from jsonb_object_keys(target_answers) as k
     where k = any (valid)
     order by random()
     limit 6
  ) picked;
  qs := qs || array['bday_month'];

  insert into public.quiz_attempts (guesser, target, questions, total)
  values (me, p_target, qs, cardinality(qs))
  returning id into attempt_id;

  return jsonb_build_object('attempt', attempt_id, 'questions', to_jsonb(qs), 'passed', false);
end $$;
