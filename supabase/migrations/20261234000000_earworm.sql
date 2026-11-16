-- Earworm: name-the-song challenges with your 25.
alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check
  check (kind in ('kachuful', 'trivia', 'word', 'ludo', 'imposter', 'chess', 'poker', 'earworm'));
