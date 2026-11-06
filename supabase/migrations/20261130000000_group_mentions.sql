-- @mentions in group chats: people tagged get "X mentioned you", everyone else
-- gets the usual group notification.
create or replace function public.on_group_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  tagged uuid[];
  body text := coalesce(new.body, '');
begin
  select * into g from public.groups where id = new.group_id;

  select coalesce(array_agg(m.user_id), '{}') into tagged
    from public.group_members m
    join public.profiles p on p.id = m.user_id
   where m.group_id = new.group_id
     and m.user_id <> new.sender
     and p.username is not null
     and position('@' in body) > 0
     and lower(body) ~ ('(^|[^a-z0-9_.])@' || regexp_replace(lower(p.username), '([.])', '\\\1', 'g') || '([^a-z0-9_]|$)');

  if array_length(tagged, 1) > 0 then
    perform public.push_to(
      tagged,
      '📣 ' || public.first_name(new.sender) || ' mentioned you',
      g.emoji || ' ' || g.name || ': ' || body,
      '/app/group/' || new.group_id,
      'group-' || new.group_id);
  end if;

  perform public.push_to(
    array(select user_id from public.group_members
           where group_id = new.group_id and user_id <> new.sender and not (user_id = any (tagged))),
    g.emoji || ' ' || g.name,
    public.first_name(new.sender) || ': ' || body,
    '/app/group/' || new.group_id,
    'group-' || new.group_id);
  return new;
end $$;
