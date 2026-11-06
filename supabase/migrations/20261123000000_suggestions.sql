-- "People you may know": people your 25 have seated, ranked by how many of
-- your 25 seated them, plus newcomers so a brand-new user always sees someone.
-- Only the count of mutuals comes back, never who they are.
-- Profile photos become visible to every signed-in user (profiles already are),
-- so suggestions and search show faces, not just initials.

drop policy if exists "storage: avatars for signed-in users" on storage.objects;
create policy "storage: avatars for signed-in users" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

create or replace function public.suggestions(p_limit int default 30)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  mutuals int,
  reason text
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  mine as (select guest from public.seats, me where owner = me.uid),
  excluded as (
    select uid as pid from me
    union select guest from mine
    union select blocked from public.blocks, me where blocker = me.uid
    union select blocker from public.blocks, me where blocked = me.uid
  ),
  via as (
    -- people the members of my 25 have seated
    select s.guest as pid, s.owner as through
      from public.seats s
      join mine m on m.guest = s.owner
  ),
  ranked as (
    select v.pid,
           count(distinct v.through)::int as mutuals
      from via v
     where v.pid not in (select pid from excluded)
       and exists (select 1 from public.vibe_answers va where va.user_id = v.pid)
     group by v.pid
  ),
  newcomers as (
    select p.id as pid, 0 as mutuals
      from public.profiles p
     where p.id not in (select pid from excluded)
       and p.id not in (select pid from ranked)
       and exists (select 1 from public.vibe_answers v where v.user_id = p.id)
     order by p.created_at desc
     limit 20
  ),
  pool as (
    select pid, mutuals, 'mutuals' as reason from ranked
    union all
    select pid, mutuals, 'new' from newcomers
  )
  select p.id, p.display_name, p.username, p.avatar_path, pool.mutuals, pool.reason
    from pool join public.profiles p on p.id = pool.pid
   order by pool.mutuals desc, p.created_at desc
   limit greatest(1, least(p_limit, 60))
$$;
