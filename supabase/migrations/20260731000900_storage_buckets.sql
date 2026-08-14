-- Wesup migration 0009: storage buckets
-- Covers PRD 2.4.2 (Media Upload Management): two buckets with
-- folder-based RLS on storage.objects:
--   - wesup-assets (private): ktp, business, disputes, dispute-evidence, archive
--   - wesup-public (public): products (anonymous read access)
-- Client-side compression caps raw files at 10 MB (PRD 2.1.1); the bucket
-- limit is 20 MB to leave headroom. HEIC/HEIF are rejected and must be
-- converted by the frontend. Deleted media is moved to the archive/ folder
-- by the application for audit history; objects are never cascade-deleted.

-- ============================================================
-- Buckets
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wesup-assets', 'wesup-assets', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wesup-public', 'wesup-public', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ============================================================
-- RLS on storage.objects
-- ============================================================
alter table storage.objects enable row level security;

-- ============================================================
-- Helper functions (security definer, consistent with is_admin())
-- ============================================================

-- Extracts the record uuid from the second path segment
-- (e.g. 'products/{batch_id}/{file}.jpg'); null when malformed.
create or replace function public.storage_path_id(object_name text) returns uuid
  language sql stable as $$
  select (regexp_match(object_name, '^[^/]+/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1]::uuid;
$$;

create or replace function public.storage_is_admin() returns boolean
  language sql stable security definer as $$
  select public.is_admin();
$$;

-- Owner check for ktp/ and business/: second segment is the supplier user id.
create or replace function public.storage_is_owner(object_name text) returns boolean
  language sql stable security definer as $$
  select split_part(object_name, '/', 2) = auth.uid()::text;
$$;

-- Owner check for products/: second segment is the batch id.
create or replace function public.storage_is_batch_supplier(object_name text) returns boolean
  language sql stable security definer as $$
  select exists (
    select 1 from public.batches b
    where b.id = public.storage_path_id(object_name)
      and b.supplier_id = auth.uid()
  );
$$;

-- UMKM side of a dispute.
create or replace function public.storage_is_dispute_umkm(object_name text) returns boolean
  language sql stable security definer as $$
  select exists (
    select 1 from public.disputes d
    where d.id = public.storage_path_id(object_name)
      and d.umkm_id = auth.uid()
  );
$$;

-- Either party of a dispute (UMKM or supplier).
create or replace function public.storage_is_dispute_counterparty(object_name text) returns boolean
  language sql stable security definer as $$
  select exists (
    select 1 from public.disputes d
    where d.id = public.storage_path_id(object_name)
      and (d.umkm_id = auth.uid() or d.supplier_id = auth.uid())
  );
$$;

-- Uploader of a dispute_evidence attachment.
create or replace function public.storage_is_evidence_uploader(object_name text) returns boolean
  language sql stable security definer as $$
  select exists (
    select 1 from public.dispute_evidence de
    where de.id = public.storage_path_id(object_name)
      and de.uploaded_by = auth.uid()
  );
$$;

-- Either party of the dispute an evidence row belongs to.
create or replace function public.storage_is_evidence_counterparty(object_name text) returns boolean
  language sql stable security definer as $$
  select exists (
    select 1 from public.dispute_evidence de
    join public.disputes d on d.id = de.dispute_id
    where de.id = public.storage_path_id(object_name)
      and (d.umkm_id = auth.uid() or d.supplier_id = auth.uid())
  );
$$;

-- ============================================================
-- wesup-assets: ktp/ (supplier own + admin)
-- ============================================================
create policy "storage_objects_ktp_insert" on storage.objects
  for insert with check (
    bucket_id = 'wesup-assets'
    and name like 'ktp/%'
    and (public.storage_is_owner(name) or public.storage_is_admin())
  );
create policy "storage_objects_ktp_select" on storage.objects
  for select using (
    bucket_id = 'wesup-assets'
    and name like 'ktp/%'
    and (public.storage_is_owner(name) or public.storage_is_admin())
  );
create policy "storage_objects_ktp_delete" on storage.objects
  for delete using (
    bucket_id = 'wesup-assets'
    and name like 'ktp/%'
    and (public.storage_is_owner(name) or public.storage_is_admin())
  );

-- ============================================================
-- wesup-assets: business/ (supplier own + admin)
-- ============================================================
create policy "storage_objects_business_insert" on storage.objects
  for insert with check (
    bucket_id = 'wesup-assets'
    and name like 'business/%'
    and (public.storage_is_owner(name) or public.storage_is_admin())
  );
create policy "storage_objects_business_select" on storage.objects
  for select using (
    bucket_id = 'wesup-assets'
    and name like 'business/%'
    and (public.storage_is_owner(name) or public.storage_is_admin())
  );
create policy "storage_objects_business_delete" on storage.objects
  for delete using (
    bucket_id = 'wesup-assets'
    and name like 'business/%'
    and (public.storage_is_owner(name) or public.storage_is_admin())
  );

-- ============================================================
-- wesup-assets: disputes/ (umkm own + counterparty select + admin)
-- ============================================================
create policy "storage_objects_disputes_insert" on storage.objects
  for insert with check (
    bucket_id = 'wesup-assets'
    and name like 'disputes/%'
    and (public.storage_is_dispute_umkm(name) or public.storage_is_admin())
  );
create policy "storage_objects_disputes_select" on storage.objects
  for select using (
    bucket_id = 'wesup-assets'
    and name like 'disputes/%'
    and (
      public.storage_is_dispute_umkm(name)
      or public.storage_is_dispute_counterparty(name)
      or public.storage_is_admin()
    )
  );
create policy "storage_objects_disputes_delete" on storage.objects
  for delete using (
    bucket_id = 'wesup-assets'
    and name like 'disputes/%'
    and (public.storage_is_dispute_umkm(name) or public.storage_is_admin())
  );

-- ============================================================
-- wesup-assets: dispute-evidence/ (uploader + counterparty select + admin)
-- ============================================================
create policy "storage_objects_dispute_evidence_insert" on storage.objects
  for insert with check (
    bucket_id = 'wesup-assets'
    and name like 'dispute-evidence/%'
    and (public.storage_is_evidence_uploader(name) or public.storage_is_admin())
  );
create policy "storage_objects_dispute_evidence_select" on storage.objects
  for select using (
    bucket_id = 'wesup-assets'
    and name like 'dispute-evidence/%'
    and (
      public.storage_is_evidence_uploader(name)
      or public.storage_is_evidence_counterparty(name)
      or public.storage_is_admin()
    )
  );
create policy "storage_objects_dispute_evidence_delete" on storage.objects
  for delete using (
    bucket_id = 'wesup-assets'
    and name like 'dispute-evidence/%'
    and (public.storage_is_evidence_uploader(name) or public.storage_is_admin())
  );

-- ============================================================
-- wesup-assets: archive/ (admin only - soft-delete history)
-- ============================================================
create policy "storage_objects_archive_insert" on storage.objects
  for insert with check (
    bucket_id = 'wesup-assets'
    and name like 'archive/%'
    and public.storage_is_admin()
  );
create policy "storage_objects_archive_select" on storage.objects
  for select using (
    bucket_id = 'wesup-assets'
    and name like 'archive/%'
    and public.storage_is_admin()
  );
create policy "storage_objects_archive_delete" on storage.objects
  for delete using (
    bucket_id = 'wesup-assets'
    and name like 'archive/%'
    and public.storage_is_admin()
  );

-- ============================================================
-- wesup-public: products/ (public read, supplier own + admin write)
-- ============================================================
create policy "storage_objects_products_insert" on storage.objects
  for insert with check (
    bucket_id = 'wesup-public'
    and name like 'products/%'
    and (public.storage_is_batch_supplier(name) or public.storage_is_admin())
  );
create policy "storage_objects_products_select" on storage.objects
  for select using (
    bucket_id = 'wesup-public'
    and name like 'products/%'
  );
create policy "storage_objects_products_delete" on storage.objects
  for delete using (
    bucket_id = 'wesup-public'
    and name like 'products/%'
    and (public.storage_is_batch_supplier(name) or public.storage_is_admin())
  );
