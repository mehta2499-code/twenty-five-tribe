-- Chat actions (WhatsApp style): reply to a message, delete it for everyone.
-- Also: the recipient may only mark messages delivered/read, never edit them.

alter table public.messages add column if not exists reply_to uuid;
alter table public.messages add column if not exists deleted boolean not null default false;
alter table public.group_messages add column if not exists reply_to uuid;
alter table public.group_messages add column if not exists deleted boolean not null default false;

-- The recipient's update rights are for "delivered" and "read" only.
create or replace function public.messages_recipient_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and auth.uid() = old.recipient and auth.uid() <> old.sender then
    if new.sender is distinct from old.sender
      or new.recipient is distinct from old.recipient
      or new.body is distinct from old.body
      or new.snap_id is distinct from old.snap_id
      or new.shared_ref is distinct from old.shared_ref
      or new.created_at is distinct from old.created_at
      or new.reply_to is distinct from old.reply_to
      or new.deleted is distinct from old.deleted then
      raise exception 'You can only mark messages as read.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists messages_recipient_guard on public.messages;
create trigger messages_recipient_guard before update on public.messages
  for each row execute function public.messages_recipient_guard();

-- Delete for everyone: your own message becomes "This message was deleted".
create or replace function public.delete_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.messages
     set body = null, shared_ref = null, snap_id = null, reply_to = null, deleted = true
   where id = p_id and sender = auth.uid();
  if not found then raise exception 'You can only delete your own messages.'; end if;
end $$;
revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;

create or replace function public.delete_group_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.group_messages
     set body = null, shared_ref = null, reply_to = null, deleted = true,
         poll_options = null
   where id = p_id and sender = auth.uid();
  if not found then raise exception 'You can only delete your own messages.'; end if;
  delete from public.group_poll_votes where message_id = p_id;
end $$;
revoke all on function public.delete_group_message(uuid) from public, anon;
grant execute on function public.delete_group_message(uuid) to authenticated;
