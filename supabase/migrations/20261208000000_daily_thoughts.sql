-- Thought of the day: one short line per person per day (India time),
-- visible only to the people in their 25. Gone the next day.
create table if not exists public.daily_thoughts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default public.today_ist(),
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_thoughts enable row level security;

drop policy if exists "thoughts: yours and from people who seated you" on public.daily_thoughts;
create policy "thoughts: yours and from people who seated you" on public.daily_thoughts
  for select to authenticated
  using (user_id = auth.uid() or public.in_25(user_id, auth.uid()));
drop policy if exists "thoughts: write today's" on public.daily_thoughts;
create policy "thoughts: write today's" on public.daily_thoughts
  for insert to authenticated with check (user_id = auth.uid() and day = public.today_ist());
drop policy if exists "thoughts: edit today's" on public.daily_thoughts;
create policy "thoughts: edit today's" on public.daily_thoughts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and day = public.today_ist());
drop policy if exists "thoughts: delete yours" on public.daily_thoughts;
create policy "thoughts: delete yours" on public.daily_thoughts
  for delete to authenticated using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_thoughts'
  ) then
    alter publication supabase_realtime add table public.daily_thoughts;
  end if;
end $$;
