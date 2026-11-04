-- Fix: sending a snap failed with a row-level security error.
-- The app inserts a snap and reads it back in the same statement. The old
-- select policy only used can_see_snap(), which can't see a row inserted by
-- the statement that's still running, so the read-back was refused.
-- Checking the sender column directly lets the sender always see their snap.

drop policy if exists "snaps: sender and recipients" on public.snaps;
create policy "snaps: sender and recipients" on public.snaps
  for select to authenticated using (sender = auth.uid() or public.can_see_snap(id));
