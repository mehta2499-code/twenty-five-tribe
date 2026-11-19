-- Connect 4 (vs a friend; bot games aren't saved).
alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check
  check (kind in ('kachuful', 'trivia', 'word', 'ludo', 'imposter', 'chess', 'poker', 'earworm',
                  'connect4'));
