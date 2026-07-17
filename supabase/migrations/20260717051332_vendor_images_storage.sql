-- Storage bucket for vendor gallery images (PRD F2, §11). `public: true`
-- means reads happen via a public URL that bypasses RLS by Supabase's own
-- design — no SELECT policy needed below, the bucket flag *is* the read
-- policy. file_size_limit/allowed_mime_types are a bucket-enforced
-- backstop (PRD §11: jpeg/png/webp, ≤5MB, server-side) in addition to,
-- not instead of, the Zod validation in the upload mutation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-images',
  'vendor-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage paths are structured as <vendor_id>/<filename> — the first path
-- segment is the vendor's UUID, extracted via storage.foldername() to
-- check ownership. Same one-hop join pattern as event/vendor_image.
--
-- invariant: a user may only upload objects into a path prefixed with a
-- vendor id they own.
create policy "vendor_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'vendor-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.vendor where owner_user_id = auth.uid()
    )
  );

-- invariant: a user may only delete objects under a vendor id they own.
-- No UPDATE policy — replacing an image is delete-then-reinsert, matching
-- vendor_image's insert-only storage_path.
create policy "vendor_images_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'vendor-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.vendor where owner_user_id = auth.uid()
    )
  );
