-- Polls are weekly now: a new set every Sunday (India time). A vote is filed
-- under the Sunday its week started, one vote per question per week.
create or replace function public.poll_week() returns date
language sql stable as $$
  select public.today_ist() - extract(dow from public.today_ist())::int
$$;

alter table public.poll_votes alter column day set default public.poll_week();

drop policy if exists "polls: vote for your mutual 25" on public.poll_votes;
create policy "polls: vote for your mutual 25" on public.poll_votes
  for insert to authenticated
  with check (voter = auth.uid() and day = public.poll_week() and public.is_friend(voter, target));
