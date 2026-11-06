-- All-time scores for you and your mutual 25.
--   Daily game: same points as the weekly table (1st 10, 2nd 8, 3rd 6, 4th 5,
--   5th 4, played 2), ranked inside your circle, added up over every day.
--   Live games (Trivia, Ludo, Kachuful, Word Up): win 10, played 2.
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
  word_wins int
)
language sql stable security definer set search_path = public as $$
with circle as (
  select auth.uid() as id
  union
  select s.guest from public.seats s
   where s.owner = auth.uid() and public.is_friend(auth.uid(), s.guest)
),
-- Daily game
best as (
  select d.user_id, d.day,
         (select max(t) from unnest(d.tries) t) as best
    from public.daily_scores d
   where d.user_id in (select id from circle)
),
ranked as (
  select user_id, day, best,
         rank() over (partition by day order by best desc) as r
    from best where best is not null and best >= 0
),
daily as (
  select user_id,
         sum(case r when 1 then 10 when 2 then 8 when 3 then 6 when 4 then 5 when 5 then 4 else 2 end)::int as pts,
         count(*)::int as days,
         count(*) filter (where r = 1)::int as crowns
    from ranked group by user_id
),
-- Live games that finished (a Ludo called off in the waiting room doesn't count)
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
    from ktot t
   where total = (select max(total) from ktot x where x.id = t.id)
),
winner as (
  -- Trivia: someone quit, the other wins
  select g.id, g.kind, p as uid from done g, unnest(g.players) p
   where g.kind = 'trivia' and g.state ? 'forfeit' and p::text <> g.state->>'forfeit'
  union all
  -- Trivia: highest score, no ties
  select g.id, g.kind, p from done g, unnest(g.players) p
   where g.kind = 'trivia' and not g.state ? 'forfeit'
     and (g.state->'results'->p::text->>'score') is not null
     and (g.state->'results'->p::text->>'score')::numeric > all (
       select (x.value->>'score')::numeric from jsonb_each(g.state->'results') x
        where x.key <> p::text)
     and (select count(*) from jsonb_each(g.state->'results')) >= 2
  union all
  -- Ludo
  select g.id, g.kind, p from done g, unnest(g.players) p
   where g.kind = 'ludo' and g.state ? 'winner'
     and p::text = g.state->'players'->((g.state->>'winner')::int)->>'id'
  union all
  -- Kachuful: highest total, no ties
  select k.id, 'kachuful', p from ktop k
    join done g on g.id = k.id, unnest(g.players) p
   where k.n = 1 and p::text = g.state->'seats'->((k.i - 1)::int)->>'id'
  union all
  -- Word Up: solved = guesser wins, otherwise the setter; a quitter loses
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
       coalesce(d.pts, 0) + coalesce(l.wins, 0) * 10 + (coalesce(l.played, 0) - coalesce(l.wins, 0)) * 2,
       coalesce(d.pts, 0), coalesce(d.days, 0), coalesce(d.crowns, 0),
       coalesce(l.played, 0), coalesce(l.wins, 0),
       coalesce(l.trivia, 0), coalesce(l.ludo, 0), coalesce(l.kachuful, 0), coalesce(l.word, 0)
  from circle c
  left join daily d on d.user_id = c.id
  left join live l on l.user_id = c.id
$$;

revoke all on function public.lifetime_scores() from public, anon;
grant execute on function public.lifetime_scores() to authenticated;
