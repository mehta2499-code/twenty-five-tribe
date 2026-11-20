-- One-off clean-up: a bug let the winner of a Judgement game roast someone who
-- never played (their turns were auto-played on the timer). Remove Jayveer's
-- game roast posts about Aman. Only posts written from the roast templates
-- are touched; anything else they posted stays. Likes and comments go with
-- the posts (cascade).
do $$
declare
  jay uuid;
  n int;
begin
  select id into jay from public.profiles where display_name ilike 'jayveer%';
  if (select count(*) from public.profiles where display_name ilike 'jayveer%') <> 1 then
    raise notice 'remove_bad_roasts: expected exactly one Jayveer, skipping';
    return;
  end if;
  delete from public.posts
  where author = jay
    and caption ~* '\maman\M'
    and (
      caption ~* '^Just beat .* Anyone else want to lose'
      or caption ~* ': me 1, .* 0'
      or caption ~* '^Sorry .* just isn.t your thing'
      or caption ~* '^Another day, another .* win over '
      or caption ~* ' really thought\. '
      or caption ~* '^Dear .*, practice more\. Love, the .* champ'
      or caption ~* '^Took .* to school in '
    );
  get diagnostics n = row_count;
  raise notice 'remove_bad_roasts: removed % post(s)', n;
end $$;
