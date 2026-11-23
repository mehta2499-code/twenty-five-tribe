-- =====================================================================
-- Seven more daily games join the rotation (15 in all): Tile Dash, Stack Up,
-- Arrow Swipe, 1 to 25, Rickshaw Run, Chai Catch, Hot or Cold. Still counted
-- from Mon 16 Nov 2026; the new ones come after 25 Sec, so the days so far
-- keep their game. Keep in sync with LINEUP in src/lib/daily.ts.
-- =====================================================================
create or replace function public.daily_game(d date) returns text
language sql immutable as $$
  select (array['tap-rush', 'quick-math', 'colour-clash', 'pair-up', 'odd-one-out', 'pattern',
                'reflex', 'sec25', 'tile-dash', 'stack-up', 'arrow-swipe', 'one-to-25',
                'rickshaw', 'chai-catch', 'hot-cold'])
         [1 + (((d - date '2026-11-16') % 15) + 15) % 15]
$$;
