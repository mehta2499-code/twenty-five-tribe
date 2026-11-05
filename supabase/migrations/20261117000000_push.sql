-- =====================================================================
-- Push notifications.
-- Phones register a Web Push subscription here. When something happens
-- (activity, a message, a snap, a group message, Drop time, a birthday),
-- the database posts it to our own server (/api/push), which holds the
-- push keys and delivers it. The server's address and a shared secret are
-- set once by the owner in the SQL editor: select public.set_push_config(...)
-- =====================================================================

-- pg_net sends HTTP from the database; pg_cron runs the daily check.
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net not available: %', sqlerrm;
end $$;
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron not available: %', sqlerrm;
end $$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: your own devices" on public.push_subscriptions;
create policy "push: your own devices" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "push: add a device" on public.push_subscriptions;
create policy "push: add a device" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "push: update a device" on public.push_subscriptions;
create policy "push: update a device" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "push: remove a device" on public.push_subscriptions;
create policy "push: remove a device" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Where to send pushes. Nobody can read this from the app (no policies).
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  url text not null,
  secret text not null
);
alter table public.push_config enable row level security;

create or replace function public.set_push_config(p_url text, p_secret text) returns void
language sql security definer set search_path = public as $$
  insert into public.push_config (id, url, secret) values (1, p_url, p_secret)
  on conflict (id) do update set url = excluded.url, secret = excluded.secret
$$;
revoke all on function public.set_push_config(text, text) from public, anon, authenticated;

-- The server reports subscriptions that no longer work (phone unsubscribed).
create or replace function public.remove_dead_push(p_secret text, p_endpoints text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.push_config where secret = p_secret) then
    raise exception 'not allowed';
  end if;
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.remove_dead_push(text, text[]) to anon, authenticated;

-- Send one notification to some people's devices. Never blocks the caller.
create or replace function public.push_to(p_users uuid[], p_title text, p_body text, p_url text, p_tag text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  cfg public.push_config;
  subs jsonb;
begin
  select * into cfg from public.push_config where id = 1;
  if cfg.url is null then return; end if;
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
    into subs
    from public.push_subscriptions
   where user_id = any (p_users);
  if jsonb_array_length(subs) = 0 then return; end if;
  perform net.http_post(
    url := cfg.url,
    body := jsonb_build_object('subs', subs, 'title', p_title, 'body', left(coalesce(p_body, ''), 180),
                               'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret)
  );
exception when others then
  -- Push is best-effort; never break the action that triggered it.
  return;
end $$;
revoke all on function public.push_to(uuid[], text, text, text, text) from public, anon, authenticated;

create or replace function public.first_name(u uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(split_part(display_name, ' ', 1), 'Someone') from public.profiles where id = u
$$;

-- Everything in Activity.
create or replace function public.on_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := coalesce(public.first_name(new.actor), 'Someone');
  t text;
  b text;
  u text := '/app/activity';
begin
  case new.kind
    when 'seated' then t := '👀 ' || who || ' put you in their 25'; b := 'Seat them back?'; u := '/app/people';
    when 'seated_back' then t := '🤝 ' || who || ' seated you back'; b := 'Chats and snaps unlocked.';
    when 'like' then t := '❤️ ' || who || ' liked your post'; b := ''; u := '/app/feed';
    when 'comment' then t := '💬 ' || who || ' commented'; b := new.body; u := '/app/feed';
    when 'word_done' then t := '🔤 ' || who || ' ' || new.body; b := 'Word Up';
    when 'poll' then t := '🗳️ Someone in your 25 picked you'; b := new.body; u := '/app/polls';
    when 'card' then t := '🎂 ' || who || ' signed your birthday card'; b := ''; u := '/app/card/me';
    else t := '25'; b := new.body;
  end case;
  perform public.push_to(array[new.user_id], t, b, u, new.kind);
  return new;
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.on_notification_push();

-- Messages (including game invites, photos, voice notes).
create or replace function public.on_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_to(
    array[new.recipient],
    public.first_name(new.sender),
    coalesce(nullif(new.body, ''), 'New message'),
    '/app/chat/' || new.sender,
    'chat-' || new.sender);
  return new;
end $$;
drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages
  for each row execute function public.on_message_push();

-- Snaps.
create or replace function public.on_snap_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  select sender into s from public.snaps where id = new.snap_id;
  perform public.push_to(array[new.recipient], '📸 ' || public.first_name(s), 'sent you a snap', '/app/snap', 'snap-' || s);
  return new;
end $$;
drop trigger if exists snaps_push on public.snap_recipients;
create trigger snaps_push after insert on public.snap_recipients
  for each row execute function public.on_snap_push();

-- Group messages.
create or replace function public.on_group_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  select * into g from public.groups where id = new.group_id;
  perform public.push_to(
    array(select user_id from public.group_members where group_id = new.group_id and user_id <> new.sender),
    g.emoji || ' ' || g.name,
    public.first_name(new.sender) || ': ' || coalesce(new.body, ''),
    '/app/group/' || new.group_id,
    'group-' || new.group_id);
  return new;
end $$;
drop trigger if exists group_messages_push on public.group_messages;
create trigger group_messages_push after insert on public.group_messages
  for each row execute function public.on_group_message_push();

-- Drops: tell your mutual 25 when you post yours.
create or replace function public.on_drop_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_to(
    array(select guest from public.seats where owner = new.user_id and public.is_friend(new.user_id, guest)),
    '📸 ' || public.first_name(new.user_id) || ' dropped',
    'Post yours to see theirs 👀', '/app/drop', 'drop');
  return new;
end $$;
drop trigger if exists drops_push on public.drops;
create trigger drops_push after insert on public.drops
  for each row execute function public.on_drop_push();

-- ---------- Scheduled: Drop time and birthdays ----------
create table if not exists public.push_sent (
  kind text not null,
  day date not null,
  primary key (kind, day)
);
alter table public.push_sent enable row level security;

create or replace function public.push_daily() returns void
language plpgsql security definer set search_path = public as $$
declare
  d date := public.today_ist();
  b record;
begin
  -- 📸 Drop time, for everyone with notifications on.
  if now() >= public.drop_at(d) and now() < public.drop_at(d) + interval '10 minutes'
     and not exists (select 1 from public.push_sent where kind = 'drop' and day = d) then
    insert into public.push_sent values ('drop', d);
    perform public.push_to(
      array(select distinct user_id from public.push_subscriptions),
      '📸 It''s Drop time!', '10 minutes. One real photo. Go!', '/app/drop', 'drop-time');
  end if;

  -- 🎂 Birthdays, at 9 AM India time, to their mutual 25.
  if (now() at time zone 'Asia/Kolkata')::time >= '09:00'
     and not exists (select 1 from public.push_sent where kind = 'bday' and day = d) then
    insert into public.push_sent values ('bday', d);
    for b in
      select v.user_id from public.vibe_answers v
       where extract(month from v.birthday) = extract(month from d)
         and extract(day from v.birthday) = extract(day from d)
    loop
      perform public.push_to(
        array(select guest from public.seats where owner = b.user_id and public.is_friend(b.user_id, guest)),
        '🎂 It''s ' || public.first_name(b.user_id) || '''s birthday!',
        'Sign their card before midnight ✍️', '/app/card/' || b.user_id, 'bday-' || b.user_id);
    end loop;
  end if;
end $$;
revoke all on function public.push_daily() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('25-push-daily') where exists (select 1 from cron.job where jobname = '25-push-daily');
  perform cron.schedule('25-push-daily', '* * * * *', 'select public.push_daily()');
exception when others then
  raise notice 'pg_cron not available; Drop-time and birthday pushes are off';
end $$;
