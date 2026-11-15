-- GIFs and stickers in replies/comments: notifications say "sent a GIF"
-- instead of showing the raw link.
create or replace function public.on_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
  r record;
  -- GIFs and stickers are stored as "gif:<url>" / "sticker:<id>": say so in words.
  v_text text := case
    when new.body like 'gif:%' then 'sent a GIF'
    when new.body like 'sticker:%' then 'sent a sticker'
    else new.body end;
begin
  select author, kind, media_type into p from public.posts where id = new.post_id;
  perform public.notify(p.author, case when p.media_type = 'text' then 'reply' else 'comment' end,
                        new.author, p.kind || ':' || new.post_id, v_text);
  for r in select * from public.post_tagged(p.author, new.body) loop
    if r.user_id <> new.author and r.user_id <> p.author then
      perform public.notify(r.user_id, case when p.media_type = 'text' then 'reply_tag' else 'comment_tag' end,
                            new.author, p.kind || ':' || new.post_id, v_text);
    end if;
  end loop;
  return new;
end $$;
