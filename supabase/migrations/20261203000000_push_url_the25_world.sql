-- Notifications now go through the new domain (the25.duckdns.org is being retired).
-- Only the address changes; the shared secret stays as it is.
update public.push_config
   set url = 'https://the25.world/api/push'
 where id = 1 and url like '%the25.duckdns.org%';
