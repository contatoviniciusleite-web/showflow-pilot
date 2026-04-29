
drop policy if exists "Fotos de artistas são públicas" on storage.objects;
-- Allow only authenticated users to list/select objects in the bucket
create policy "Autenticados leem fotos de artistas"
  on storage.objects for select to authenticated
  using (bucket_id = 'artists');
-- Public URLs (https://.../storage/v1/object/public/...) continue to work via the storage server
