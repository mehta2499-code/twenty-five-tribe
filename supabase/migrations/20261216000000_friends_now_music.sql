-- The Table's 5-second check also says who at your Table is sharing a song
-- (online or not), so they come onto the table, and go back to their seat as
-- soon as they stop.
drop function if exists public.friends_now();
create function public.friends_now()
returns table (user_id uuid, here boolean, doing text, detail text, ref text,
               np_track_id text, np_title text, np_artist text, np_image text, np_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.guest,
         coalesce(p.active_at > now() - interval '90 seconds', false),
         case when p.active_at > now() - interval '90 seconds' then p.doing end,
         case when p.active_at > now() - interval '90 seconds' then p.detail end,
         case when p.active_at > now() - interval '90 seconds' then p.ref end,
         case when pr.np_at > now() - interval '24 hours' then pr.np_track_id end,
         case when pr.np_at > now() - interval '24 hours' then pr.np_title end,
         case when pr.np_at > now() - interval '24 hours' then pr.np_artist end,
         case when pr.np_at > now() - interval '24 hours' then pr.np_image end,
         case when pr.np_at > now() - interval '24 hours' then pr.np_at end
    from public.seats s
    join public.profiles pr on pr.id = s.guest
    left join public.presence p on p.user_id = s.guest
   where s.owner = auth.uid()
     and (p.active_at > now() - interval '90 seconds'
          or (pr.np_at > now() - interval '24 hours' and pr.np_track_id is not null))
$$;
revoke all on function public.friends_now() from public, anon;
grant execute on function public.friends_now() to authenticated;
