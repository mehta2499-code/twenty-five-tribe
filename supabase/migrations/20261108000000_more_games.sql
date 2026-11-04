-- Two new quick games on the weekly leaderboard: Colour Clash and Pair Up.
alter table public.game_scores drop constraint if exists game_scores_game_check;
alter table public.game_scores add constraint game_scores_game_check
  check (game in ('tap-rush', 'quick-math', 'trivia', 'colour-clash', 'pair-up'));
