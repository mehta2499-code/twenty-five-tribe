-- Prove it: if you pass (4+ right), the result also lists the questions you
-- got wrong with their real answer. Fail, and nothing is revealed.
create or replace function public.submit_vibe_quiz(p_attempt uuid, p_guesses jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.quiz_attempts;
  v public.vibe_answers;
  q text;
  s int := 0;
  truth text;
  wrong jsonb := '[]'::jsonb;
begin
  select * into a from public.quiz_attempts
   where id = p_attempt and guesser = auth.uid() and score is null
     and created_at > now() - interval '20 minutes';
  if a.id is null then raise exception 'This quiz has expired. Start a new one.'; end if;
  select * into v from public.vibe_answers where user_id = a.target;

  foreach q in array a.questions loop
    if q = 'bday_month' then
      truth := extract(month from v.birthday)::int::text;
      if (p_guesses ->> q) ~ '^[0-9]{1,2}$' and (p_guesses ->> q)::int = truth::int then
        s := s + 1;
        continue;
      end if;
    else
      truth := v.answers ->> q;
      if (p_guesses ->> q) is not null and (p_guesses ->> q) = truth then
        s := s + 1;
        continue;
      end if;
    end if;
    wrong := wrong || jsonb_build_object('q', q, 'guess', p_guesses ->> q, 'answer', truth);
  end loop;

  update public.quiz_attempts
     set score = s, passed = s >= 4, finished_at = now(), guesses = p_guesses
   where id = a.id;

  return jsonb_build_object('score', s, 'total', a.total, 'passed', s >= 4,
                            'wrong', case when s >= 4 then wrong else '[]'::jsonb end);
end $$;
