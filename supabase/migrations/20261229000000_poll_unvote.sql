-- Poll votes count the moment you tap; tap again to take your vote back
-- (or, in single choice, tap another option to switch). So you can remove
-- your own votes.
grant delete on public.post_poll_votes to authenticated;
grant delete on public.group_poll_votes to authenticated;

drop policy if exists "poll votes: take back your own" on public.post_poll_votes;
create policy "poll votes: take back your own" on public.post_poll_votes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "group poll votes: take back your own" on public.group_poll_votes;
create policy "group poll votes: take back your own" on public.group_poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- Realtime: a vote taken back should refresh everyone's counts too.
alter table public.post_poll_votes replica identity full;
alter table public.group_poll_votes replica identity full;
