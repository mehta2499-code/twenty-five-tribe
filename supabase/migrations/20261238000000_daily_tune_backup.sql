-- The daily song can also come from the app's built-in hit list (ids like
-- "q:Title|Artist") when Deezer can't be reached, so the day never breaks.
alter table public.daily_tunes drop constraint if exists daily_tunes_song_id_check;
alter table public.daily_tunes add constraint daily_tunes_song_id_check
  check (char_length(song_id) between 1 and 300);
