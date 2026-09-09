-- Repair remote schema drift for supplier product uploads.
-- The original Storage migration is already recorded as applied, so this
-- forward migration restores only the missing policies and hardens the
-- existing SECURITY DEFINER helpers.

create or replace function public.storage_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;

create or replace function public.storage_is_batch_supplier(object_name text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.batches b
    where b.id = public.storage_path_id(object_name)
      and b.supplier_id = auth.uid()
  );
$$;

drop policy if exists "storage_objects_products_insert" on storage.objects;
create policy "storage_objects_products_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'wesup-public'
    and name like 'products/%'
    and (public.storage_is_batch_supplier(name) or public.storage_is_admin())
  );

drop policy if exists "storage_objects_products_delete" on storage.objects;
create policy "storage_objects_products_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'wesup-public'
    and name like 'products/%'
    and (public.storage_is_batch_supplier(name) or public.storage_is_admin())
  );