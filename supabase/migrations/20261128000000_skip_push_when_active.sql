-- No push notifications while someone has the app open: the app checks in
-- every 30s while visible, and pushes skip anyone seen in the last 45s
-- (they get the in-app banner instead).
create table if not exists public.presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  active_at timestamptz
);
alter table public.presence enable row level security;
-- No policies: only the functions below touch it.

create or replace function public.set_active(p_active boolean) returns void
language sql security definer set search_path = public as $$
  insert into public.presence (user_id, active_at)
  values (auth.uid(), case when p_active then now() else null end)
  on conflict (user_id) do update set active_at = excluded.active_at
$$;
grant execute on function public.set_active(boolean) to authenticated;

create or replace function public.push_to(p_users uuid[], p_title text, p_body text, p_url text, p_tag text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  cfg public.push_config;
  subs jsonb;
begin
  select * into cfg from public.push_config where id = 1;
  if cfg.url is null then return; end if;
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
    into subs
    from public.push_subscriptions s
   where s.user_id = any (p_users)
     and not exists (
       select 1 from public.presence pr
        where pr.user_id = s.user_id and pr.active_at > now() - interval '45 seconds'
     );
  if jsonb_array_length(subs) = 0 then return; end if;
  perform net.http_post(
    url := cfg.url,
    body := jsonb_build_object('subs', subs, 'title', p_title, 'body', left(coalesce(p_body, ''), 180),
                               'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret)
  );
exception when others then
  return;
end $$;
revoke all on function public.push_to(uuid[], text, text, text, text) from public, anon, authenticated;
