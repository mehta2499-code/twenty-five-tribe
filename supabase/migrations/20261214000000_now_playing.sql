-- "Listening now": a Spotify song you picked, shown to your 25 for 24 hours.
-- Written with the existing "profiles: edit your own" policy.
alter table public.profiles
  add column if not exists np_track_id text check (np_track_id is null or np_track_id ~ '^[A-Za-z0-9]{22}$'),
  add column if not exists np_title text check (np_title is null or char_length(np_title) <= 120),
  add column if not exists np_artist text check (np_artist is null or char_length(np_artist) <= 120),
  add column if not exists np_image text check (np_image is null or np_image ~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$'),
  add column if not exists np_at timestamptz;
