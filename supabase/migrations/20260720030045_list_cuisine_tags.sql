-- Powers the /discover cuisine filter's option list (Phase 3 plan
-- decision 5): live distinct-tags query, not a curated fixed list —
-- consistent with vendor.cuisine_tags being freeform text with no
-- controlled vocabulary anywhere in the schema. Accepted tradeoff: near-
-- duplicate variants (e.g. "Taco" vs "Tacos") can both appear, since
-- nothing normalizes vendor-entered tags.
--
-- result_limit (default 100), same discipline as search_events: cuisine_
-- tags is capped at 10/vendor and DISTINCT collapses duplicates, so
-- unbounded growth is slower than search_events' — but the same
-- principle applies (a public RPC's result set is never unbounded), and
-- 100 doubles as a sane UX cap (a filter UI showing hundreds of
-- checkboxes would be a bad interface regardless).
--
-- SECURITY INVOKER, same reasoning as search_events — vendor_select_public
-- already allows anon to read is_active vendors' cuisine_tags directly,
-- no elevation needed.
create or replace function public.list_cuisine_tags(result_limit int default 100)
returns setof text
language sql
security invoker
stable
set search_path = public
as $$
  select distinct unnest(cuisine_tags) as tag
  from vendor
  where is_active
  order by tag
  limit result_limit;
$$;

grant execute on function public.list_cuisine_tags to anon, authenticated;
