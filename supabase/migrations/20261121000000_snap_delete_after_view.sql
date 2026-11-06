-- Snaps vanish from storage once every recipient has opened them.
-- open_snap now returns the file path when the last recipient opens it; the
-- app deletes the file and then calls forget_snap_file to clear the path.

drop function if exists public.open_snap(uuid);
create or replace function public.open_snap(p_snap uuid) returns text
language plpgsql security definer set search_path = public as $$
declare path text;
begin
  update public.snap_recipients set opened_at = now()
   where snap_id = p_snap and recipient = auth.uid() and opened_at is null;
  select s.image_path into path from public.snaps s
   where s.id = p_snap
     and s.image_path is not null
     and not exists (select 1 from public.snap_recipients r where r.snap_id = s.id and r.opened_at is null);
  return path;
end $$;

-- True once nobody is left to open it.
create or replace function public.snap_fully_opened(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.snaps s
     where s.image_path = p_path
       and not exists (select 1 from public.snap_recipients r where r.snap_id = s.id and r.opened_at is null)
       and (s.sender = auth.uid()
            or exists (select 1 from public.snap_recipients r where r.snap_id = s.id and r.recipient = auth.uid()))
  )
$$;

-- The last person to open a snap may delete its file (the sender already can).
drop policy if exists "storage: delete snaps everyone has opened" on storage.objects;
create policy "storage: delete snaps everyone has opened" on storage.objects
  for delete to authenticated
  using (bucket_id = 'snaps' and public.snap_fully_opened(name));

create or replace function public.forget_snap_file(p_snap uuid) returns void
language sql security definer set search_path = public as $$
  update public.snaps s set image_path = null
   where s.id = p_snap
     and (s.sender = auth.uid()
          or exists (select 1 from public.snap_recipients r where r.snap_id = s.id and r.recipient = auth.uid()))
     and not exists (select 1 from public.snap_recipients r where r.snap_id = s.id and r.opened_at is null)
$$;
