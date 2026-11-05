-- Who you can share someone's post with: people in your mutual 25 who can
-- also see that author's posts (the author put them in their 25).
create or replace function public.share_targets(p_author uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.guest
    from public.seats s
   where s.owner = auth.uid()
     and public.is_friend(auth.uid(), s.guest)
     and (s.guest = p_author or public.in_25(p_author, s.guest))
     -- you must be able to see the author's posts yourself
     and (p_author = auth.uid() or public.in_25(p_author, auth.uid()))
$$;
