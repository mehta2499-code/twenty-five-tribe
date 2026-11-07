-- Score boards for Word Up and Trivia, Word Up + Trivia in weekly and all-time
-- points, and quiz badges (Ride or Die / Real One) with a notification.

-- ---------- Word Up: daily points like the arcade game ----------
-- Fewest guesses ranks first inside your circle; 1st 10, 2nd 8, 3rd 6, 4th 5,
-- 5th 4, played (or missed it) 2.
create or replace function public.word_points(p_from date, p_to date)
returns table (user_id uuid, points int, days int, solved int, crowns int)
language sql stable security definer set search_path = public as $$
with circle as (
  select auth.uid() as id
  union
  select s.guest from public.seats s
   where s.owner = auth.uid() and public.is_friend(auth.uid(), s.guest)
),
r as (
  select w.user_id, w.day, w.guesses,
         rank() over (partition by w.day order by w.guesses) as rk
    from public.word_results w
   where w.user_id in (select id from circle) and w.day between p_from and p_to
)
select user_id,
       sum(case when guesses > 6 then 2
                else case rk when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end
           end)::int,
       count(*)::int,
       count(*) filter (where guesses <= 6)::int,
       count(*) filter (where rk = 1 and guesses <= 6)::int
  from r group by user_id
$$;

-- ---------- Trivia: who won each finished duel ----------
create or replace function public.trivia_winners()
returns table (game_id uuid, players uuid[], winner uuid, finished_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.players,
         case
           when g.state ? 'forfeit' then
             (select p from unnest(g.players) p where p::text <> g.state->>'forfeit' limit 1)
           else (
             select p from unnest(g.players) p
              where (g.state->'results'->p::text->>'score') is not null
                and (select count(*) from jsonb_each(g.state->'results')) >= 2
                and (g.state->'results'->p::text->>'score')::numeric > all (
                  select (x.value->>'score')::numeric from jsonb_each(g.state->'results') x
                   where x.key <> p::text)
              limit 1)
         end,
         g.updated_at
    from public.games g
   where g.kind = 'trivia' and g.status = 'done'
$$;
revoke all on function public.trivia_winners() from public, anon, authenticated;

-- Trivia board for you and your mutual 25, with each person's record against you.
create or replace function public.trivia_board()
returns table (user_id uuid, duels int, wins int, vs_me int, vs_me_wins int, vs_me_losses int)
language sql stable security definer set search_path = public as $$
with circle as (
  select auth.uid() as id
  union
  select s.guest from public.seats s
   where s.owner = auth.uid() and public.is_friend(auth.uid(), s.guest)
),
t as (select * from public.trivia_winners())
select c.id,
       (select count(*) from t where c.id = any (t.players))::int,
       (select count(*) from t where t.winner = c.id)::int,
       (select count(*) from t where c.id = any (t.players) and auth.uid() = any (t.players) and c.id <> auth.uid())::int,
       (select count(*) from t where t.winner = c.id and auth.uid() = any (t.players) and c.id <> auth.uid())::int,
       (select count(*) from t where t.winner = auth.uid() and c.id = any (t.players) and c.id <> auth.uid())::int
  from circle c
$$;

-- Extra weekly points on top of the arcade game: Word Up (as above) and
-- Trivia (win 10, played 2), for the week starting p_start.
create or replace function public.week_extra(p_start date)
returns table (user_id uuid, word int, trivia int)
language sql stable security definer set search_path = public as $$
with circle as (
  select auth.uid() as id
  union
  select s.guest from public.seats s
   where s.owner = auth.uid() and public.is_friend(auth.uid(), s.guest)
),
w as (select * from public.word_points(p_start, p_start + 6)),
t as (
  select * from public.trivia_winners()
   where (finished_at at time zone 'Asia/Kolkata')::date between p_start and p_start + 6
)
select c.id,
       coalesce((select points from w where w.user_id = c.id), 0),
       (select coalesce(sum(case when t.winner = c.id then 10 else 2 end), 0) from t where c.id = any (t.players))::int
  from circle c
$$;

-- All-time scores now include Word Up points too.
drop function if exists public.lifetime_scores();
create or replace function public.lifetime_scores()
returns table (
  user_id uuid,
  points int,
  daily_points int,
  daily_days int,
  daily_crowns int,
  live_played int,
  live_wins int,
  trivia_wins int,
  ludo_wins int,
  kachuful_wins int,
  word_wins int,
  word_points int,
  word_days int
)
language sql stable security definer set search_path = public as $$
with circle as (
  select auth.uid() as id
  union
  select s.guest from public.seats s
   where s.owner = auth.uid() and public.is_friend(auth.uid(), s.guest)
),
best as (
  select d.user_id, d.day, (select max(t) from unnest(d.tries) t) as best
    from public.daily_scores d
   where d.user_id in (select id from circle)
),
ranked as (
  select user_id, day, best, rank() over (partition by day order by best desc) as r
    from best where best is not null and best >= 0
),
daily as (
  select user_id,
         sum(case r when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end)::int as pts,
         count(*)::int as days,
         count(*) filter (where r = 1)::int as crowns
    from ranked group by user_id
),
words as (select * from public.word_points('2000-01-01', '2999-12-31')),
done as (
  select g.* from public.games g
   where g.status = 'done'
     and g.players && array(select id from circle)
     and not (g.kind = 'ludo' and g.state->>'phase' = 'lobby')
),
ktot as (
  select g.id, s.i, sum(s.v::numeric) as total
    from done g,
         jsonb_array_elements(g.state->'scores') r(round),
         jsonb_array_elements_text(r.round) with ordinality s(v, i)
   where g.kind = 'kachuful' and s.v ~ '^-?[0-9.]+$'
   group by g.id, s.i
),
ktop as (
  select id, i, count(*) over (partition by id) as n
    from ktot t where total = (select max(total) from ktot x where x.id = t.id)
),
winner as (
  select t.game_id as id, 'trivia'::text as kind, t.winner as uid
    from public.trivia_winners() t
   where t.winner is not null and t.game_id in (select id from done)
  union all
  select g.id, g.kind, p from done g, unnest(g.players) p
   where g.kind = 'ludo' and g.state ? 'winner'
     and p::text = g.state->'players'->((g.state->>'winner')::int)->>'id'
  union all
  select k.id, 'kachuful', p from ktop k
    join done g on g.id = k.id, unnest(g.players) p
   where k.n = 1 and p::text = g.state->'seats'->((k.i - 1)::int)->>'id'
  union all
  select g.id, g.kind, p from done g, unnest(g.players) p
   where g.kind = 'word'
     and p::text = case
       when g.state ? 'gaveUp' then
         case when g.state->>'gaveUp' = g.state->>'guesser' then g.state->>'setter' else g.state->>'guesser' end
       when g.state->'guesses' ? reverse(convert_from(decode(g.state->>'hidden', 'base64'), 'UTF8'))
         then g.state->>'guesser'
       else g.state->>'setter' end
),
live as (
  select c.id as user_id,
         (select count(*) from done g where c.id = any (g.players))::int as played,
         count(w.id)::int as wins,
         count(w.id) filter (where w.kind = 'trivia')::int as trivia,
         count(w.id) filter (where w.kind = 'ludo')::int as ludo,
         count(w.id) filter (where w.kind = 'kachuful')::int as kachuful,
         count(w.id) filter (where w.kind = 'word')::int as word
    from circle c left join winner w on w.uid = c.id
   group by c.id
)
select c.id,
       coalesce(d.pts, 0) + coalesce(wd.points, 0)
         + coalesce(l.wins, 0) * 10 + (coalesce(l.played, 0) - coalesce(l.wins, 0)) * 2,
       coalesce(d.pts, 0), coalesce(d.days, 0), coalesce(d.crowns, 0),
       coalesce(l.played, 0), coalesce(l.wins, 0),
       coalesce(l.trivia, 0), coalesce(l.ludo, 0), coalesce(l.kachuful, 0), coalesce(l.word, 0),
       coalesce(wd.points, 0), coalesce(wd.days, 0)
  from circle c
  left join daily d on d.user_id = c.id
  left join words wd on wd.user_id = c.id
  left join live l on l.user_id = c.id
$$;

-- ---------- Quiz badges ----------
-- Who knows someone best: top scores on their quiz. You can ask about yourself
-- or anyone in your mutual 25.
create or replace function public.knows_best(p_user uuid)
returns table (guesser uuid, score int, total int)
language sql stable security definer set search_path = public as $$
  select q.guesser, max(q.score)::int, max(q.total)::int
    from public.quiz_attempts q
   where q.target = p_user and q.score is not null
     and (p_user = auth.uid() or public.is_friend(auth.uid(), p_user))
   group by q.guesser
   order by max(q.score::numeric / q.total) desc, min(q.finished_at)
   limit 3
$$;

-- Tell the person when someone nails their quiz (6+ right).
create or replace function public.on_quiz_ace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.score is null and new.score is not null and new.score >= new.total - 1 and new.total >= 6 then
    perform public.notify(new.target, 'quiz_ace', new.guesser, 'quiz:' || new.id,
                          new.score || '/' || new.total);
  end if;
  return new;
end $$;
drop trigger if exists quiz_ace on public.quiz_attempts;
create trigger quiz_ace after update of score on public.quiz_attempts
  for each row execute function public.on_quiz_ace();

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
    else t := '25'; b := new.body;
  end case;
  perform public.push_to(array[new.user_id], t, b, u, new.kind);
  return new;
end $$;

grant execute on function public.word_points(date, date) to authenticated;
grant execute on function public.trivia_board() to authenticated;
grant execute on function public.week_extra(date) to authenticated;
grant execute on function public.lifetime_scores() to authenticated;
grant execute on function public.knows_best(uuid) to authenticated;
revoke all on function public.lifetime_scores() from anon;
