-- Fix: the activity trigger referred to new.sender / new.author / new.user_id
-- in one expression, and Postgres checks every field name against the row it
-- fires on, so posting a Drop failed ("record new has no field sender").
-- Read the person from the row as JSON instead, which never errors, and never
-- let this bookkeeping block the real insert.
create or replace function public.trg_active_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(new);
begin
  begin
    perform public.note_active_day(
      coalesce(r->>'user_id', r->>'sender', r->>'author')::uuid,
      coalesce((r->>'created_at')::timestamptz, now()));
  exception when others then
    null;
  end;
  return null;
end $$;
