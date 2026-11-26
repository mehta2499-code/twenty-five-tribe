-- Perfect Pitch joins the daily rotation (16 games) as Fri 27 Nov's game.
-- Still counted from Mon 16 Nov 2026; it goes in right after Arrow Swipe
-- (today, Thu 26 Nov), so every day so far keeps its game and the ones after
-- move back a day. Keep in sync with LINEUP in src/lib/daily.ts.
-- Its score is 0-1000 (how close your tone was).
create or replace function public.daily_game(d date) returns text
language sql immutable as $$
  select (array['tap-rush', 'quick-math', 'colour-clash', 'pair-up', 'odd-one-out', 'pattern',
                'reflex', 'sec25', 'tile-dash', 'stack-up', 'arrow-swipe', 'pitch',
                'one-to-25', 'rickshaw', 'chai-catch', 'hot-cold'])
         [1 + (((d - date '2026-11-16') % 16) + 16) % 16]
$$;
