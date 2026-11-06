-- The "Are you in my 25?" card now includes the profile photo path.
drop function if exists public.public_card(text);
create or replace function public.public_card(p_username text)
returns table (id uuid, display_name text, username text, seats int, vibe_done boolean, avatar_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username,
         public.seats_taken(p.id),
         exists (select 1 from public.vibe_answers v where v.user_id = p.id),
         p.avatar_path
    from public.profiles p
   where p.username = lower(p_username)
$$;
grant execute on function public.public_card(text) to anon, authenticated;
