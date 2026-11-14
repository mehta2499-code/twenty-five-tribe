-- The person who made a group can delete it, for everyone (members and
-- messages go with it).
create or replace function public.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.groups where id = p_group and created_by = auth.uid()) then
    raise exception 'Only the person who made this group can delete it.';
  end if;
  delete from public.groups where id = p_group;
end
$$;
revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;
