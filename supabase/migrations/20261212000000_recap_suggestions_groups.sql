-- =====================================================================
-- Monthly Drop recap, Instagram-style suggestions, group photos,
-- @all in group chats, and friendly push text for GIFs and stickers.
-- =====================================================================

-- ---------- Drop recap: your Drops for one month ----------
create or replace function public.my_drop_month(p_month date)
returns table (day date, image_path text, caption text, late_minutes int, likes int, comments int)
language sql stable security definer set search_path = public as $$
  select d.day, d.image_path, d.caption, d.late_minutes,
         (select count(*) from public.drop_likes l where l.owner = d.user_id and l.day = d.day)::int,
         (select count(*) from public.drop_comments c where c.owner = d.user_id and c.day = d.day)::int
    from public.drops d
   where d.user_id = auth.uid()
     and d.day >= date_trunc('month', p_month)::date
     and d.day < (date_trunc('month', p_month) + interval '1 month')::date
   order by d.day
$$;
revoke all on function public.my_drop_month(date) from public, anon;
grant execute on function public.my_drop_month(date) to authenticated;

-- ---------- Suggestions, scored like Instagram ----------
-- Seated you (like "follows you") > mutual connections > quiz links >
-- friends of people who seated you > new on 25.
drop function if exists public.suggestions(int, boolean);
create function public.suggestions(p_limit int default 30, p_include_new boolean default false)
returns table (
  id uuid, display_name text, username text, avatar_path text,
  mutuals int, reason text, via_names text[], via_avatars text[]
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  mine as (select guest from public.seats, me where owner = me.uid),
  seated_me as (select owner as pid from public.seats, me where guest = me.uid),
  excluded as (
    select uid as pid from me
    union select guest from mine
    union select blocked from public.blocks, me where blocker = me.uid
    union select blocker from public.blocks, me where blocked = me.uid
    union select owner from public.seat_refusals, me where guest = me.uid
    union select guest from public.seat_refusals, me where owner = me.uid
    -- The Add page already lists people who seated you, separately.
    union select pid from seated_me where p_include_new
  ),
  via_mine as (
    select s.guest as pid, s.owner as through
      from public.seats s join mine m on m.guest = s.owner
  ),
  via_fans as (
    select s.guest as pid from public.seats s join seated_me f on f.pid = s.owner
  ),
  quiz as (
    select distinct case when q.guesser = me.uid then q.target else q.guesser end as pid
      from public.quiz_attempts q, me
     where q.score is not null and me.uid in (q.guesser, q.target)
  ),
  scored as (
    select x.pid, sum(x.w)::int as score
      from (
        select pid, 100 as w from seated_me
        union all select pid, 3 from via_mine
        union all select pid, 1 from via_fans
        union all select pid, 2 from quiz
      ) x
     where x.pid not in (select pid from excluded)
       and exists (select 1 from public.vibe_answers va where va.user_id = x.pid)
     group by x.pid
  ),
  newcomers as (
    select p.id as pid, 0 as score
      from public.profiles p
     where p.id not in (select pid from excluded)
       and p.id not in (select pid from scored)
       and exists (select 1 from public.vibe_answers v where v.user_id = p.id)
       and (p_include_new or not exists (select 1 from mine))
     order by p.created_at desc
     limit 20
  ),
  pool as (select pid, score from scored union all select pid, score from newcomers)
  select p.id, p.display_name, p.username, p.avatar_path,
         coalesce(m.n, 0),
         case when exists (select 1 from seated_me sm where sm.pid = pool.pid) then 'seated_you'
              when coalesce(m.n, 0) > 0 then 'mutuals'
              when exists (select 1 from quiz q where q.pid = pool.pid) then 'quiz'
              when pool.score > 0 then 'friends'
              else 'new' end,
         coalesce(m.names, '{}'), coalesce(m.avatars, '{}')
    from pool
    join public.profiles p on p.id = pool.pid
    left join lateral (
      select count(*)::int as n,
             (array_agg(split_part(pr.display_name, ' ', 1) order by pr.display_name))[1:2] as names,
             (array_agg(coalesce(pr.avatar_path, '') order by pr.display_name))[1:2] as avatars
        from via_mine v join public.profiles pr on pr.id = v.through
       where v.pid = pool.pid
    ) m on true
   order by pool.score desc, p.created_at desc
   limit greatest(1, least(p_limit, 60))
$$;
revoke all on function public.suggestions(int, boolean) from public, anon;
grant execute on function public.suggestions(int, boolean) to authenticated;

-- ---------- Group photo ----------
alter table public.groups add column if not exists avatar_path text
  check (avatar_path is null or char_length(avatar_path) <= 300);

-- ---------- Push text for media ----------
create or replace function public.msg_preview(p_body text, p_ref text) returns text
language sql immutable as $$
  select case
    when nullif(p_body, '') is not null then p_body
    when p_ref like 'gif:%' then 'sent a GIF'
    when p_ref like 'sticker:%' then 'sent a sticker'
    when p_ref like 'voice:%' then '🎤 Voice note'
    when p_ref like 'img:%' then '📷 Photo'
    when p_ref like 'vid:%' then '🎬 Video'
    when p_ref like 'game:%' then '🎮 Game invite'
    else 'New message' end
$$;

create or replace function public.on_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_to(
    array[new.recipient],
    public.first_name(new.sender),
    public.msg_preview(new.body, new.shared_ref),
    '/app/chat/' || new.sender,
    'chat-' || new.sender);
  return new;
end $$;

-- ---------- Group pushes: @all / @everyone, @mentions, everyone else ----------
create or replace function public.on_group_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  tagged uuid[];
  body text := coalesce(new.body, '');
  preview text := public.msg_preview(new.body, new.shared_ref);
begin
  select * into g from public.groups where id = new.group_id;

  -- @all: everyone gets a mention (and an Activity row).
  if lower(body) ~ '(^|[^a-z0-9_.])@(all|everyone)([^a-z0-9_]|$)' then
    perform public.notify(m.user_id, 'mention_all', new.sender, 'group:' || new.group_id,
                          g.emoji || ' ' || g.name || ': ' || left(body, 140))
       from public.group_members m
      where m.group_id = new.group_id and m.user_id <> new.sender;
    return new;
  end if;

  select coalesce(array_agg(m.user_id), '{}') into tagged
    from public.group_members m
    join public.profiles p on p.id = m.user_id
   where m.group_id = new.group_id
     and m.user_id <> new.sender
     and p.username is not null
     and position('@' in body) > 0
     and lower(body) ~ ('(^|[^a-z0-9_.])@' || regexp_replace(lower(p.username), '([.])', '\\\1', 'g') || '([^a-z0-9_]|$)');

  if array_length(tagged, 1) > 0 then
    perform public.push_to(
      tagged,
      '📣 ' || public.first_name(new.sender) || ' mentioned you',
      g.emoji || ' ' || g.name || ': ' || preview,
      '/app/group/' || new.group_id,
      'group-' || new.group_id);
  end if;

  perform public.push_to(
    array(select user_id from public.group_members
           where group_id = new.group_id and user_id <> new.sender and not (user_id = any (tagged))),
    g.emoji || ' ' || g.name,
    public.first_name(new.sender) || ': ' || preview,
    '/app/group/' || new.group_id,
    'group-' || new.group_id);
  return new;
end $$;

create or replace function public.on_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := coalesce(public.first_name(new.actor), 'Someone');
  t text;
  b text;
  u text := '/app/activity';
begin
  case new.kind
    when 'seated' then t := '👀 ' || who || ' put you in their 25'; b := 'Seat them back?'; u := '/app/people';
    when 'unseated' then t := '🚪 ' || who || ' removed themselves from your 25'; b := 'They can''t be re-added unless they add you.'; u := '/app/people';
    when 'seated_back' then t := '🤝 ' || who || ' seated you back'; b := 'Chats and blinks unlocked.';
    when 'like' then t := '❤️ ' || who || ' liked your post'; b := ''; u := '/app/feed';
    when 'comment' then t := '💬 ' || who || ' commented'; b := new.body; u := '/app/feed';
    when 'word_done' then t := '🔤 ' || who || ' ' || new.body; b := 'Word Up';
    when 'poll' then t := '🗳️ Someone in your 25 picked you'; b := new.body; u := '/app/polls';
    when 'card' then t := '🎂 ' || who || ' signed your birthday card'; b := ''; u := '/app/card/me';
    when 'drop_like' then t := '❤️ ' || who || ' liked your Drop'; b := ''; u := '/app/drop';
    when 'drop_comment' then t := '💬 ' || who || ' commented on your Drop'; b := new.body; u := '/app/drop';
    when 'quiz_ace' then
      t := (case when split_part(new.body, '/', 1) = split_part(new.body, '/', 2) then '💯 ' else '🔥 ' end)
           || who || ' got ' || new.body || ' on you';
      b := 'They really know you.'; u := '/app/profile';
    when 'quiz_try' then
      t := '👀 ' || who || ' tried to add you';
      b := 'Got ' || new.body || ' on your quiz. Not quite.'; u := '/app/people';
    when 'post' then t := '📸 ' || who || ' just posted'; b := new.body; u := '/app/feed';
    when 'drop' then t := '⚡ ' || who || ' dropped'; b := coalesce(new.body, 'Post yours to see it.'); u := '/app/drop';
    when 'game_win' then t := '🏆 ' || who || ' won ' || new.body; b := 'Think you can beat them?'; u := '/app/games';
    when 'mention_all' then t := '📣 ' || who || ' mentioned everyone'; b := new.body; u := '/app/group/' || substr(new.ref, 7);
    when 'daily_score' then t := '🎮 ' || who || ' scored ' || new.body; b := 'Your turn. 3 tries.'; u := '/app/games';
    when 'word_daily' then t := '🔤 ' || who || ' ' || new.body; b := 'Can you beat that?'; u := '/app/games';
    when 'daily_top' then t := '👑 ' || who || ' is #1 in today''s game'; b := 'Score: ' || new.body || '. Beat that.'; u := '/app/games';
    else t := '25'; b := new.body;
  end case;
  -- One notification per person and kind on the phone (two friends posting don't overwrite).
  perform public.push_to(array[new.user_id], t, coalesce(b, ''), u, new.kind || coalesce(':' || new.actor, ''));
  return new;
end $$;
