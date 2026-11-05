-- New accounts need a profile photo (people should recognise who's asking
-- for a seat). Existing profiles aren't affected: this only checks new ones.
create or replace function public.validate_profile_avatar() returns trigger
language plpgsql security definer set search_path = public, storage as $$
begin
  if new.avatar_path is null or btrim(new.avatar_path) = '' then
    raise exception 'Add a profile photo to create your account.';
  end if;
  if (storage.foldername(new.avatar_path))[1] <> new.id::text then
    raise exception 'Profile photos must be in your own folder.';
  end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'avatars' and name = new.avatar_path
  ) then
    raise exception 'Upload your profile photo before creating your account.';
  end if;
  return new;
end $$;

drop trigger if exists profiles_require_avatar on public.profiles;
create trigger profiles_require_avatar before insert on public.profiles
  for each row execute function public.validate_profile_avatar();
