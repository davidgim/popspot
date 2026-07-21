-- Maintains vendor.like_count / avg_rating / rating_count — columns with
-- no client UPDATE grant at all (see vendor.sql, Phase 2), so only an
-- elevated (security definer) trigger can write them. Both do a full
-- recompute from source rows rather than incremental +1/-1 math: a
-- simpler, more obviously-correct invariant ("always derived fresh"),
-- and cheap at this table's expected volume. AVG() over zero rows
-- returns NULL naturally — matches /v/[slug]'s existing "No ratings yet"
-- rendering for a null avg_rating, built in Phase 2 before any rating
-- ever existed.
create or replace function public.update_vendor_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_vendor_id uuid := coalesce(new.vendor_id, old.vendor_id);
begin
  update public.vendor
  set like_count = (
    select count(*) from public.vendor_like where vendor_id = affected_vendor_id
  )
  where id = affected_vendor_id;
  return coalesce(new, old);
end;
$$;

create trigger vendor_like_count_trigger
  after insert or delete on public.vendor_like
  for each row execute function public.update_vendor_like_count();

-- Handles old.vendor_id != new.vendor_id defensively on UPDATE, even
-- though authenticated's column grant on rating restricts UPDATE to
-- `stars` only (vendor_id can't change through the app). service_role
-- was separately granted unrestricted UPDATE on rating (no column
-- limits — same as its grants on every other table, Phase 2's
-- grant_service_role migration), so this trigger must stay correct
-- under that path too, not just the app's own.
create or replace function public.update_vendor_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.vendor
    set avg_rating = (select avg(stars) from public.rating where vendor_id = old.vendor_id),
        rating_count = (select count(*) from public.rating where vendor_id = old.vendor_id)
    where id = old.vendor_id;
    return old;
  end if;

  update public.vendor
  set avg_rating = (select avg(stars) from public.rating where vendor_id = new.vendor_id),
      rating_count = (select count(*) from public.rating where vendor_id = new.vendor_id)
  where id = new.vendor_id;

  if tg_op = 'UPDATE' and old.vendor_id is distinct from new.vendor_id then
    update public.vendor
    set avg_rating = (select avg(stars) from public.rating where vendor_id = old.vendor_id),
        rating_count = (select count(*) from public.rating where vendor_id = old.vendor_id)
    where id = old.vendor_id;
  end if;

  return new;
end;
$$;

create trigger vendor_rating_stats_trigger
  after insert or update or delete on public.rating
  for each row execute function public.update_vendor_rating_stats();
