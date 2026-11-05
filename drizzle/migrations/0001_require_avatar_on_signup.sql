CREATE OR REPLACE FUNCTION public.validate_profile_avatar() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NEW.avatar_path IS NULL OR btrim(NEW.avatar_path) = '' THEN
    RAISE EXCEPTION 'A profile photo is required to create your account.';
  END IF;
  IF (storage.foldername(NEW.avatar_path))[1] <> NEW.id::text THEN
    RAISE EXCEPTION 'Profile photos must be stored in your own private folder.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'avatars' AND name = NEW.avatar_path
  ) THEN
    RAISE EXCEPTION 'Upload your profile photo before creating your account.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_require_avatar_on_signup
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_avatar();