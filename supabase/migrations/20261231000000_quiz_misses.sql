-- Prove it, from their profile: your best passing attempt on someone, with the
-- questions you got wrong and their real answer. Nothing if you never passed.
create or replace function public.my_quiz_misses(p_target uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a public.quiz_attempts;
  v public.vibe_answers;
  q text;
  truth text;
  wrong jsonb := '[]'::jsonb;
begin
  select * into a from public.quiz_attempts
   where guesser = auth.uid() and target = p_target and passed and score is not null
     and guesses is not null
   order by score desc, finished_at desc nulls last
   limit 1;
  if a.id is null then return null; end if;
  select * into v from public.vibe_answers where user_id = p_target;

  foreach q in array a.questions loop
    if q = 'bday_month' then
      truth := extract(month from v.birthday)::int::text;
      continue when (a.guesses ->> q) ~ '^[0-9]{1,2}$' and (a.guesses ->> q)::int = truth::int;
    else
      truth := v.answers ->> q;
      continue when (a.guesses ->> q) = truth;
    end if;
    wrong := wrong || jsonb_build_object('q', q, 'guess', a.guesses ->> q, 'answer', truth);
  end loop;

  return jsonb_build_object('score', a.score, 'total', a.total, 'wrong', wrong);
end $$;
grant execute on function public.my_quiz_misses(uuid) to authenticated;
