-- vendor_image: gallery images for a vendor's public page (PRD F2, up to
-- 10/vendor). The 10-image cap is enforced in the upload route handler,
-- not here — a business rule, not a data-integrity invariant (same split
-- as everywhere else in this schema: RLS protects ownership, app code
-- protects data quality/business rules).
create table public.vendor_image (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor (id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index vendor_image_vendor_id_idx on public.vendor_image (vendor_id);

alter table public.vendor_image enable row level security;

-- invariant: images are public — they're part of the public vendor page.
create policy "vendor_image_select_public"
  on public.vendor_image
  for select
  to anon, authenticated
  using (true);

-- invariant: a user may only add images to a vendor they own. Same
-- one-hop ownership join as event.
create policy "vendor_image_insert_own"
  on public.vendor_image
  for insert
  to authenticated
  with check (
    vendor_id in (select id from public.vendor where owner_user_id = auth.uid())
  );

create policy "vendor_image_update_own"
  on public.vendor_image
  for update
  to authenticated
  using (
    vendor_id in (select id from public.vendor where owner_user_id = auth.uid())
  )
  with check (
    vendor_id in (select id from public.vendor where owner_user_id = auth.uid())
  );

-- invariant: a user may only delete images belonging to a vendor they
-- own. Unlike vendor/event, images have no soft-delete concept — removal
-- here should be paired with deleting the underlying Storage object.
create policy "vendor_image_delete_own"
  on public.vendor_image
  for delete
  to authenticated
  using (
    vendor_id in (select id from public.vendor where owner_user_id = auth.uid())
  );

grant select on public.vendor_image to anon;
grant select on public.vendor_image to authenticated;

-- storage_path is insert-only, never updatable — replacing an image is
-- delete-then-reinsert, matching how Storage objects actually work.
grant insert (
  vendor_id, storage_path, caption, sort_order
) on public.vendor_image to authenticated;

grant update (caption, sort_order) on public.vendor_image to authenticated;
grant delete on public.vendor_image to authenticated;
