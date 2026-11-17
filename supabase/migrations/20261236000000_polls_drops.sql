-- 1. Scene polls: who voted for what.
--    The poll's author sees everyone's vote. Everyone else sees only the votes
--    of people in their mutual 25 (and their own). Totals are for everyone.
drop policy if exists "poll votes: see on scenes you can see" on public.post_poll_votes;
drop policy if exists "poll votes: see yours, your mutual 25's, or all on your poll" on public.post_poll_votes;
create policy "poll votes: see yours, your mutual 25's, or all on your poll" on public.post_poll_votes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
    or (public.can_see_post(post_id) and public.is_friend(auth.uid(), user_id))
  );

-- Totals per option (and how many voted) for polls you can see.
create or replace function public.poll_counts(p_ids uuid[])
returns table (post_id uuid, option int, n int, voters int)
language sql stable security definer set search_path = public as $$
  select v.post_id, v.option, count(*)::int,
         (select count(distinct v2.user_id)::int from public.post_poll_votes v2 where v2.post_id = v.post_id)
    from public.post_poll_votes v
   where v.post_id = any(p_ids) and public.can_see_post(v.post_id)
   group by v.post_id, v.option
$$;
revoke all on function public.poll_counts(uuid[]) from public, anon;
grant execute on function public.poll_counts(uuid[]) to authenticated;

-- 2. The Drop: up to two photos a day. The first is your Drop (on time or
--    late); you can add one more the same day.
alter table public.drops add column if not exists image_path_2 text;
alter table public.drops add column if not exists caption_2 text check (char_length(caption_2) <= 120);
alter table public.drops add column if not exists at_2 timestamptz;

drop policy if exists "drops: add a second photo today" on public.drops;
create policy "drops: add a second photo today" on public.drops
  for update to authenticated
  using (user_id = auth.uid() and day = public.today_ist())
  with check (user_id = auth.uid() and day = public.today_ist());

create or replace function public.drops_second_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.user_id is distinct from old.user_id or new.day is distinct from old.day
      or new.image_path is distinct from old.image_path or new.caption is distinct from old.caption
      or new.late_minutes is distinct from old.late_minutes or new.created_at is distinct from old.created_at then
      raise exception 'You can only add a second photo.';
    end if;
    if old.image_path_2 is not null then
      raise exception 'Two Drops a day is the max.';
    end if;
    if new.image_path_2 is null then
      raise exception 'Add a photo.';
    end if;
    new.at_2 := now();
  end if;
  return new;
end $$;
drop trigger if exists drops_second_guard on public.drops;
create trigger drops_second_guard before update on public.drops
  for each row execute function public.drops_second_guard();

-- 3. Drop streaks: how many days in a row someone has posted. Still alive if
--    they posted yesterday and not yet today. Only for you and your mutual 25.
create or replace function public.drop_streaks(p_users uuid[])
returns table (user_id uuid, streak int, today boolean)
language sql stable security definer set search_path = public as $$
  with u as (
    select x as id from unnest(p_users) x
     where x = auth.uid() or public.is_friend(auth.uid(), x)
  ), last as (
    select u.id,
           exists (select 1 from public.drops d where d.user_id = u.id and d.day = public.today_ist()) as posted
      from u
  )
  select l.id,
         (select count(*)::int from (
            select d.day, row_number() over (order by d.day desc) as rn
              from public.drops d
             where d.user_id = l.id
               and d.day <= public.today_ist() - (case when l.posted then 0 else 1 end)
          ) t
          where t.day = public.today_ist() - (case when l.posted then 0 else 1 end) - (t.rn - 1)::int),
         l.posted
    from last l
$$;
revoke all on function public.drop_streaks(uuid[]) from public, anon;
grant execute on function public.drop_streaks(uuid[]) to authenticated;
