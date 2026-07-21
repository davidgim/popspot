-- vendor_like: the source-of-truth rows behind vendor.like_count (public,
-- readable since Phase 2). This table itself stays private — its only
-- purpose is answering "have I liked this," never "who liked this
-- vendor." The public count is maintained by a trigger added in a
-- separate migration (counter triggers need vendor_like to exist first).
create table public.vendor_like (
  user_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.vendor (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);

alter table public.vendor_like enable row level security;

-- invariant: a user may only see, create, or remove their own likes.
create policy "vendor_like_select_own"
  on public.vendor_like
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "vendor_like_insert_own"
  on public.vendor_like
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "vendor_like_delete_own"
  on public.vendor_like
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.vendor_like to authenticated;
