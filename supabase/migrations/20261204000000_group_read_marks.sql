-- Group chat "read up to here", saved per member so it follows you across
-- logins and devices (it used to live only on the phone).
alter table public.group_members add column if not exists last_read_at timestamptz;
-- Everything sent before today counts as read.
update public.group_members set last_read_at = now() where last_read_at is null;
alter table public.group_members alter column last_read_at set default now();

create or replace function public.mark_group_read(p_group uuid) returns void
language sql security definer set search_path = public as $$
  update public.group_members
     set last_read_at = now()
   where group_id = p_group and user_id = auth.uid()
$$;
revoke all on function public.mark_group_read(uuid) from public, anon;
grant execute on function public.mark_group_read(uuid) to authenticated;
