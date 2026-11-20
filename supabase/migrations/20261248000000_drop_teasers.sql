-- The Drop: before you post yours, see who dropped, as heavily blurred
-- thumbnails. Each photo gets a tiny blurred copy (made on the phone, a
-- ~24px JPEG, about 1 KB) stored with it; the real photo still stays locked
-- until you post.
alter table public.drops add column if not exists blur text check (char_length(blur) <= 4000);
alter table public.drops add column if not exists blur_2 text check (char_length(blur_2) <= 4000);

-- The second-photo guard: the first photo's blur can't be changed later either.
create or replace function public.drops_second_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.user_id is distinct from old.user_id or new.day is distinct from old.day
      or new.image_path is distinct from old.image_path or new.caption is distinct from old.caption
      or new.late_minutes is distinct from old.late_minutes or new.created_at is distinct from old.created_at
      or new.blur is distinct from old.blur then
      raise exception 'You can only add a second photo.';
    end if;
    if old.image_path_2 is not null then
      raise exception 'Two Drops a day is the max.';
    end if;
    if new.image_path_2 is null then
      raise exception 'Add a photo.';
    end if;
    new.at_2 := now();
  end if;
  return new;
end $$;

-- Today's drops from your mutual 25: who, when, and the blurred thumbnails
-- only (never the photo, caption or comments).
create or replace function public.drop_teasers()
returns table (user_id uuid, blur text, blur_2 text, two boolean, late_minutes int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.user_id, d.blur, d.blur_2, d.image_path_2 is not null, d.late_minutes, d.created_at
    from public.drops d
   where d.day = public.today_ist()
     and d.user_id <> auth.uid()
     and public.is_friend(auth.uid(), d.user_id)
   order by d.created_at
$$;
revoke all on function public.drop_teasers() from public, anon;
grant execute on function public.drop_teasers() to authenticated;
