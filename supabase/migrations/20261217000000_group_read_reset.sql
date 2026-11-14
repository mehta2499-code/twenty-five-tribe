-- Group "read up to here" marks were never actually saved from the app (the
-- request wasn't being sent), so every new login showed old group messages as
-- unread. Start everyone from "all read" now; from here on, marks are saved.
update public.group_members set last_read_at = now();
