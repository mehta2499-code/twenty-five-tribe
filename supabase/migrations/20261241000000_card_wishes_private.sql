-- Birthday cards: only the birthday person reads every wish (on the day).
-- Everyone else in their 25 sees who wished, but not what they wrote (their
-- own wish they can read). The hidden text never leaves the database.

drop policy if exists "cards: birthday person and signers" on public.birthday_cards;
create policy "cards: birthday person and signers" on public.birthday_cards
  for select to authenticated
  using ((target = auth.uid() and public.card_open(target, year)) or author = auth.uid());

-- Who signed this year's card; the words only for the birthday person (once
-- it's open) and for your own wish.
create or replace function public.card_wishes(p_target uuid)
returns table (author uuid, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.author,
         case when c.author = auth.uid()
                or (p_target = auth.uid() and public.card_open(c.target, c.year))
              then c.body end,
         c.created_at
    from public.birthday_cards c
   where c.target = p_target
     and c.year = extract(year from public.today_ist())::int
     and (
       p_target = auth.uid() and public.card_open(c.target, c.year)
       or c.author = auth.uid()
       or public.is_friend(auth.uid(), p_target)
     )
   order by c.created_at
$$;
revoke all on function public.card_wishes(uuid) from public, anon;
grant execute on function public.card_wishes(uuid) to authenticated;
