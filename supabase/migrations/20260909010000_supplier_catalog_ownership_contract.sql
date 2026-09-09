-- Wesup migration 0020: supplier catalog ownership/error contract.
-- This is deliberately additive: 0019 remains immutable and this migration
-- replaces only the exposed RPC definitions with stable authorization errors.

create or replace function public.assert_active_approved_supplier()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.catalog_supplier_approved() then
    raise exception using errcode = '42501', message = 'active approved supplier required';
  end if;
end;
$$;

create or replace function public.assert_supplier_batch_owner(p_batch_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
begin
  if p_batch_id is null then
    raise exception using errcode = '22023', message = 'batch id is required';
  end if;

  select supplier_id into v_supplier_id
    from public.batches
   where id = p_batch_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'batch not found';
  end if;
  if auth.uid() is null or v_supplier_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'batch access denied';
  end if;
end;
$$;

create or replace function public.publish_supplier_batch(
  p_batch_id uuid,
  p_product_photo_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.batch_status;
  v_opens_at timestamptz;
begin
  perform public.assert_supplier_batch_owner(p_batch_id);
  perform public.assert_active_approved_supplier();
  if p_product_photo_url is null
     or p_product_photo_url !~ ('^https?://.*/storage/v1/object/public/wesup-public/products/' || p_batch_id::text || '/[^/]+\.webp$') then
    raise exception using errcode = '22023', message = 'published batch requires a public product photo URL';
  end if;

  select b.status, t.registration_opens_at into v_status, v_opens_at
    from public.batches b
    join public.batch_timeline t on t.batch_id = b.id
   where b.id = p_batch_id
   for update;
  if v_status <> 'draft' then
    raise exception using errcode = '55000', message = 'batch is not a publishable draft';
  end if;
  if v_opens_at <= now() then
    raise exception using errcode = '55000', message = 'registration window must be in the future';
  end if;

  update public.batches
     set product_photo_url = p_product_photo_url, status = 'published', updated_at = now()
   where id = p_batch_id;
end;
$$;

create or replace function public.update_supplier_batch(
  p_batch_id uuid, p_title text, p_description text, p_category text,
  p_min_quantity integer, p_product_photo_url text, p_pickup_name text,
  p_pickup_address text, p_latitude numeric, p_longitude numeric,
  p_registration_opens_at timestamptz, p_registration_closes_at timestamptz,
  p_payment_opens_at timestamptz, p_payment_closes_at timestamptz,
  p_estimated_ready_at timestamptz, p_tiers jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
  v_participants bigint;
  v_distance numeric;
  v_timeline_changed boolean;
  v_location_changed boolean;
  v_tiers_changed boolean;
begin
  perform public.assert_supplier_batch_owner(p_batch_id);
  perform public.assert_active_approved_supplier();

  select * into v_batch from public.batches where id = p_batch_id for update;
  if v_batch.status not in ('draft', 'published') then
    raise exception using errcode = '55000', message = 'batch is read-only';
  end if;

  select count(*) into v_participants from public.registrations where batch_id = p_batch_id;
  v_location_changed := p_pickup_name <> v_batch.pickup_name
    or p_pickup_address <> v_batch.pickup_address or p_latitude <> v_batch.latitude or p_longitude <> v_batch.longitude;
  v_tiers_changed := p_tiers <> coalesce((
    select jsonb_agg(jsonb_build_object('tier_number', bt.tier_number, 'min_volume', bt.min_volume,
      'max_volume', bt.max_volume, 'price_per_unit', bt.price_per_unit) order by bt.tier_number)
    from public.batch_tiers bt where bt.batch_id = p_batch_id
  ), '[]'::jsonb);
  v_timeline_changed := exists (
    select 1 from public.batch_timeline t where t.batch_id = p_batch_id and
      (t.registration_opens_at <> p_registration_opens_at or t.registration_closes_at <> p_registration_closes_at
       or t.payment_opens_at <> p_payment_opens_at or t.payment_closes_at <> p_payment_closes_at
       or t.estimated_ready_at <> p_estimated_ready_at)
  );
  if v_participants > 0 and v_location_changed then
    raise exception using errcode = '55000', message = 'pickup location is locked after first participant';
  end if;
  if v_participants > 0 and v_tiers_changed then
    raise exception using errcode = '55000', message = 'tier scheme is locked after first participant';
  end if;
  if v_batch.status = 'published' and now() >= (select registration_opens_at from public.batch_timeline where batch_id = p_batch_id) and v_timeline_changed then
    raise exception using errcode = '55000', message = 'timeline is locked after registration opens';
  end if;
  perform public.validate_catalog_timeline(p_registration_opens_at, p_registration_closes_at, p_payment_opens_at, p_payment_closes_at, p_estimated_ready_at, v_batch.status = 'draft' or v_timeline_changed);
  if p_min_quantity is null or p_min_quantity <= 0 then
    raise exception using errcode = '22023', message = 'target quantity must be positive';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null then
    raise exception using errcode = '22023', message = 'catalog title and description are required';
  end if;
  if nullif(trim(p_pickup_name), '') is null or nullif(trim(p_pickup_address), '') is null then
    raise exception using errcode = '22023', message = 'pickup name and address are required';
  end if;
  if p_category is null or trim(p_category) not in ('Sayur & Buah', 'Daging & Ikan', 'Makanan Siap Saji', 'Kerajinan', 'Jasa') then
    raise exception using errcode = '22023', message = 'catalog category is invalid';
  end if;
  if p_latitude is null or p_longitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception using errcode = '22023', message = 'pickup coordinates are invalid';
  end if;
  v_distance := 6371 * acos(least(1.0, greatest(-1.0, sin(radians(-6.914744)) * sin(radians(p_latitude)) + cos(radians(-6.914744)) * cos(radians(p_latitude)) * cos(radians(p_longitude) - radians(107.60981)))));
  if v_distance > 50 then
    raise exception using errcode = '22023', message = 'pickup location must be within Bandung';
  end if;
  perform public.validate_catalog_tiers(p_tiers);

  update public.batches set title = trim(p_title), description = trim(p_description), category = trim(p_category),
    min_quantity = p_min_quantity, product_photo_url = coalesce(p_product_photo_url, product_photo_url),
    pickup_name = trim(p_pickup_name), pickup_address = trim(p_pickup_address), latitude = p_latitude,
    longitude = p_longitude, updated_at = now() where id = p_batch_id;
  update public.batch_timeline set registration_opens_at = p_registration_opens_at,
    registration_closes_at = p_registration_closes_at, payment_opens_at = p_payment_opens_at,
    payment_closes_at = p_payment_closes_at, estimated_ready_at = p_estimated_ready_at where batch_id = p_batch_id;
  if not v_tiers_changed then return; end if;
  delete from public.batch_tiers where batch_id = p_batch_id;
  insert into public.batch_tiers (batch_id, tier_number, min_volume, max_volume, price_per_unit)
  select p_batch_id, tier_number, min_volume, max_volume, price_per_unit from jsonb_to_recordset(p_tiers)
    as t(tier_number integer, min_volume integer, max_volume integer, price_per_unit numeric);
end;
$$;

create or replace function public.delete_supplier_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status public.batch_status;
begin
  perform public.assert_supplier_batch_owner(p_batch_id);
  perform public.assert_active_approved_supplier();
  select status into v_status from public.batches where id = p_batch_id for update;
  if v_status <> 'draft' then
    raise exception using errcode = '55000', message = 'only an empty draft can be deleted';
  end if;
  if exists (select 1 from public.registrations where batch_id = p_batch_id) then
    raise exception using errcode = '55000', message = 'batch has participants';
  end if;
  delete from public.batches where id = p_batch_id;
end;
$$;

create or replace function public.get_supplier_batch(p_batch_id uuid)
returns table (
  id uuid, supplier_name text, title text, description text, category text, min_quantity integer,
  product_photo_url text, pickup_name text, pickup_address text, latitude numeric, longitude numeric,
  status public.batch_status, registration_opens_at timestamptz, registration_closes_at timestamptz,
  payment_opens_at timestamptz, payment_closes_at timestamptz, estimated_ready_at timestamptz,
  tiers jsonb, registered_quantity bigint, participant_count bigint, paid_participant_count bigint,
  cancelled_reason text, updated_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_supplier_batch_owner(p_batch_id);
  perform public.assert_active_approved_supplier();
  return query
  with volume as (
    select r.batch_id, coalesce(sum(r.quantity) filter (where r.status <> 'cancelled'), 0)::bigint as registered_quantity,
      count(*) filter (where r.status <> 'cancelled')::bigint as participant_count,
      count(*) filter (where r.status in ('paid', 'picked_up', 'completed'))::bigint as paid_participant_count
    from public.registrations r where r.batch_id = p_batch_id group by r.batch_id
  )
  select b.id, coalesce(sp.business_name, p.full_name), b.title, b.description, b.category, b.min_quantity,
    b.product_photo_url, b.pickup_name, b.pickup_address, b.latitude, b.longitude, b.status,
    t.registration_opens_at, t.registration_closes_at, t.payment_opens_at, t.payment_closes_at, t.estimated_ready_at,
    coalesce(jsonb_agg(jsonb_build_object('tier_number', bt.tier_number, 'min_volume', bt.min_volume,
      'max_volume', bt.max_volume, 'price_per_unit', bt.price_per_unit) order by bt.tier_number) filter (where bt.id is not null), '[]'::jsonb),
    coalesce(v.registered_quantity, 0), coalesce(v.participant_count, 0), coalesce(v.paid_participant_count, 0),
    b.cancelled_reason, b.updated_at, b.created_at
  from public.batches b join public.profiles p on p.id = b.supplier_id
  left join public.supplier_profiles sp on sp.user_id = b.supplier_id
  left join public.batch_timeline t on t.batch_id = b.id left join public.batch_tiers bt on bt.batch_id = b.id
  left join volume v on v.batch_id = b.id where b.id = p_batch_id
  group by b.id, sp.business_name, p.full_name, t.registration_opens_at, t.registration_closes_at,
    t.payment_opens_at, t.payment_closes_at, t.estimated_ready_at, v.registered_quantity, v.participant_count, v.paid_participant_count;
end;
$$;

create or replace function public.cancel_batch(
  p_batch_id uuid, p_reason text, p_ip_address text default null, p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_supplier_batch_owner(p_batch_id);
  perform public.assert_active_approved_supplier();
  if p_reason is null or trim(p_reason) = '' then
    raise exception using errcode = '22023', message = 'cancellation reason is required';
  end if;
  if exists (select 1 from public.registrations where batch_id = p_batch_id and status in ('picked_up', 'completed')) then
    raise exception using errcode = '55000', message = 'batch already has picked-up orders';
  end if;
  update public.batches set status = 'cancelled', cancelled_reason = trim(p_reason), updated_at = now()
   where id = p_batch_id and status in ('published', 'closed');
  if not found then
    raise exception using errcode = '55000', message = 'batch is not cancellable';
  end if;
  insert into public.admin_audit_logs (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
  values (auth.uid(), 'cancel_batch', 'batches', p_batch_id, jsonb_build_object('reason', trim(p_reason)), p_ip_address, p_user_agent);
end;
$$;

create or replace function public.get_supplier_dashboard_summary()
returns table (
  supplier_name text, supplier_status public.verification_status, active_batch_count bigint,
  total_participant_count bigint, collected_revenue numeric, ready_to_disburse numeric,
  average_rating numeric, rating_count bigint, recent_batches jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_active_approved_supplier();
  return query
  with own_batches as (
    select b.* from public.batches b where b.supplier_id = auth.uid()
  ), registrations as (
    select r.batch_id, coalesce(sum(r.quantity) filter (where r.status <> 'cancelled'), 0)::bigint as registered_quantity,
      count(*) filter (where r.status <> 'cancelled')::bigint as participant_count,
      coalesce(sum(r.final_amount) filter (where r.status in ('paid', 'picked_up', 'completed')), 0)::numeric as collected
    from public.registrations r join own_batches b on b.id = r.batch_id group by r.batch_id
  ), stats as (
    select count(*) filter (where b.status = 'published')::bigint as active_batch_count,
      coalesce(sum(r.participant_count), 0)::bigint as total_participant_count,
      coalesce(sum(r.collected), 0)::numeric as collected_revenue
    from own_batches b left join registrations r on r.batch_id = b.id
  ), escrow as (
    select coalesce(sum(e.amount) filter (where e.status = 'held' and e.auto_release_at <= now() and coalesce(e.release_destination, 'supplier') = 'supplier' and not exists (select 1 from public.disputes d where d.registration_id = e.registration_id and d.status in ('pending', 'under_review'))), 0)::numeric as ready_to_disburse
    from public.escrow_holds e join public.registrations r on r.id = e.registration_id
    join own_batches b on b.id = r.batch_id
  ), rating as (
    select coalesce(avg(ra.score), 0)::numeric as average_rating, count(ra.id)::bigint as rating_count
    from public.ratings ra where ra.supplier_id = auth.uid()
  ), recent as (
    select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'category', b.category,
      'status', b.status, 'min_quantity', b.min_quantity, 'product_photo_url', b.product_photo_url,
      'registration_opens_at', t.registration_opens_at, 'registered_quantity', coalesce(r.registered_quantity, 0)) order by b.created_at desc), '[]'::jsonb) as rows
    from (select * from own_batches order by created_at desc limit 3) b
    left join public.batch_timeline t on t.batch_id = b.id left join registrations r on r.batch_id = b.id
  )
  select coalesce(sp.business_name, p.full_name), sp.verification_status, stats.active_batch_count,
    stats.total_participant_count, stats.collected_revenue, escrow.ready_to_disburse,
    rating.average_rating, rating.rating_count, recent.rows
  from public.profiles p join public.supplier_profiles sp on sp.user_id = p.id
  cross join stats cross join escrow cross join rating cross join recent
  where p.id = auth.uid();
end;
$$;

create or replace function public.validate_catalog_tiers(p_tiers jsonb)
returns void
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_raw jsonb;
  v_index integer := 0;
  v_tier_number integer;
  v_min_volume integer;
  v_max_volume integer;
  v_price_per_unit numeric;
  v_previous_min integer;
  v_previous_max integer;
  v_previous_price numeric;
  v_has_previous boolean := false;
begin
  if jsonb_typeof(p_tiers) <> 'array' then
    raise exception using errcode = '22023', message = 'tiers must be an array';
  end if;
  select count(*) into v_count from jsonb_array_elements(p_tiers);
  if v_count < 2 then
    raise exception using errcode = '22023', message = 'at least two tiers are required';
  end if;

  for v_raw in select value from jsonb_array_elements(p_tiers)
  loop
    if jsonb_typeof(v_raw) <> 'object' then
      raise exception using errcode = '22023', message = 'each tier must be an object';
    end if;
    if not (v_raw ? 'tier_number')
       or jsonb_typeof(v_raw -> 'tier_number') <> 'number'
       or (v_raw ->> 'tier_number') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'tier number is required and must be an integer';
    end if;
    if not (v_raw ? 'min_volume')
       or jsonb_typeof(v_raw -> 'min_volume') <> 'number'
       or (v_raw ->> 'min_volume') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'tier minimum quantity is required and must be an integer';
    end if;
    if not (v_raw ? 'price_per_unit')
       or jsonb_typeof(v_raw -> 'price_per_unit') <> 'number'
       or (v_raw ->> 'price_per_unit') !~ '^-?[0-9]{1,10}(\.[0-9]{1,2})?$' then
      raise exception using errcode = '22023', message = 'tier price is required and must be numeric';
    end if;
    if v_raw ? 'max_volume' and jsonb_typeof(v_raw -> 'max_volume') <> 'null'
       and (jsonb_typeof(v_raw -> 'max_volume') <> 'number' or (v_raw ->> 'max_volume') !~ '^[0-9]+$') then
      raise exception using errcode = '22023', message = 'tier maximum quantity must be an integer or null';
    end if;

    begin
      v_tier_number := (v_raw ->> 'tier_number')::integer;
      v_min_volume := (v_raw ->> 'min_volume')::integer;
      v_max_volume := case when v_raw ? 'max_volume' and jsonb_typeof(v_raw -> 'max_volume') <> 'null' then (v_raw ->> 'max_volume')::integer else null end;
      v_price_per_unit := (v_raw ->> 'price_per_unit')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'tier values are out of range';
    end;

    v_index := v_index + 1;
    if v_tier_number <> v_index then
      raise exception using errcode = '22023', message = 'tier numbers must be sequential';
    end if;
    if v_min_volume <= 0 then
      raise exception using errcode = '22023', message = 'tier minimum quantity must be positive';
    end if;
    if v_max_volume is not null and v_max_volume < v_min_volume then
      raise exception using errcode = '22023', message = 'tier maximum quantity is invalid';
    end if;
    if v_price_per_unit <= 0 then
      raise exception using errcode = '22023', message = 'tier price must be positive';
    end if;
    if v_has_previous and (v_min_volume <= v_previous_min or (v_previous_max is not null and v_min_volume <= v_previous_max)) then
      raise exception using errcode = '22023', message = 'tier ranges overlap';
    end if;
    if v_has_previous and v_price_per_unit >= v_previous_price then
      raise exception using errcode = '22023', message = 'tier prices must decrease';
    end if;
    v_previous_min := v_min_volume;
    v_previous_max := v_max_volume;
    v_previous_price := v_price_per_unit;
    v_has_previous := true;
  end loop;
end;
$$;

create or replace function public.validate_catalog_timeline(
  p_registration_opens_at timestamptz, p_registration_closes_at timestamptz,
  p_payment_opens_at timestamptz, p_payment_closes_at timestamptz,
  p_estimated_ready_at timestamptz, p_require_future boolean
) returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_registration_opens_at is null or p_registration_closes_at is null
     or p_payment_opens_at is null or p_payment_closes_at is null or p_estimated_ready_at is null then
    raise exception using errcode = '22023', message = 'catalog timeline is required';
  end if;
  if p_require_future and p_registration_opens_at <= now() then
    raise exception using errcode = '22023', message = 'catalog timeline must be in the future';
  end if;
  if not (p_registration_opens_at < p_registration_closes_at and p_registration_closes_at < p_payment_opens_at
      and p_payment_opens_at < p_payment_closes_at and p_payment_closes_at < p_estimated_ready_at) then
    raise exception using errcode = '22023', message = 'catalog timeline is not linear';
  end if;
end;
$$;

create or replace function public.create_supplier_batch(
  p_title text, p_description text, p_category text, p_min_quantity integer,
  p_pickup_name text, p_pickup_address text, p_latitude numeric, p_longitude numeric,
  p_registration_opens_at timestamptz, p_registration_closes_at timestamptz,
  p_payment_opens_at timestamptz, p_payment_closes_at timestamptz,
  p_estimated_ready_at timestamptz, p_tiers jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_batch_id uuid; v_distance numeric;
begin
  perform public.assert_active_approved_supplier();
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null then
    raise exception using errcode = '22023', message = 'catalog title and description are required';
  end if;
  if p_category is null or trim(p_category) not in ('Sayur & Buah', 'Daging & Ikan', 'Makanan Siap Saji', 'Kerajinan', 'Jasa') then
    raise exception using errcode = '22023', message = 'catalog category is invalid';
  end if;
  if p_min_quantity is null or p_min_quantity <= 0 then
    raise exception using errcode = '22023', message = 'target quantity must be positive';
  end if;
  if nullif(trim(p_pickup_name), '') is null or nullif(trim(p_pickup_address), '') is null then
    raise exception using errcode = '22023', message = 'pickup name and address are required';
  end if;
  if p_latitude is null or p_longitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception using errcode = '22023', message = 'pickup coordinates are invalid';
  end if;
  v_distance := 6371 * acos(least(1.0, greatest(-1.0, sin(radians(-6.914744)) * sin(radians(p_latitude)) + cos(radians(-6.914744)) * cos(radians(p_latitude)) * cos(radians(p_longitude) - radians(107.60981)))));
  if v_distance > 50 then
    raise exception using errcode = '22023', message = 'pickup location must be within Bandung';
  end if;
  perform public.validate_catalog_timeline(p_registration_opens_at, p_registration_closes_at, p_payment_opens_at, p_payment_closes_at, p_estimated_ready_at, true);
  perform public.validate_catalog_tiers(p_tiers);
  insert into public.batches (supplier_id, title, description, category, min_quantity, pickup_name, pickup_address, latitude, longitude, status)
  values (auth.uid(), trim(p_title), trim(p_description), trim(p_category), p_min_quantity, trim(p_pickup_name), trim(p_pickup_address), p_latitude, p_longitude, 'draft') returning id into v_batch_id;
  insert into public.batch_tiers (batch_id, tier_number, min_volume, max_volume, price_per_unit)
  select v_batch_id, tier_number, min_volume, max_volume, price_per_unit from jsonb_to_recordset(p_tiers)
    as t(tier_number integer, min_volume integer, max_volume integer, price_per_unit numeric);
  insert into public.batch_timeline (batch_id, registration_opens_at, registration_closes_at, payment_opens_at, payment_closes_at, estimated_ready_at)
  values (v_batch_id, p_registration_opens_at, p_registration_closes_at, p_payment_opens_at, p_payment_closes_at, p_estimated_ready_at);
  return v_batch_id;
end;
$$;

create or replace function public.list_supplier_batches(
  p_status public.batch_status default null, p_query text default null
) returns table (
  id uuid, supplier_name text, title text, description text, category text, min_quantity integer,
  product_photo_url text, pickup_name text, pickup_address text, latitude numeric, longitude numeric,
  status public.batch_status, registration_opens_at timestamptz, registration_closes_at timestamptz,
  payment_opens_at timestamptz, payment_closes_at timestamptz, estimated_ready_at timestamptz,
  tiers jsonb, registered_quantity bigint, participant_count bigint, paid_participant_count bigint,
  cancelled_reason text, updated_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_active_approved_supplier();
  return query
    select d.* from public.batches b
    cross join lateral public.get_supplier_batch(b.id) d
    where b.supplier_id = auth.uid()
      and (p_status is null or d.status = p_status)
      and (p_query is null or p_query = '' or d.title ilike '%' || p_query || '%' or d.category ilike '%' || p_query || '%')
    order by d.created_at desc;
end;
$$;

-- Catalog writes must go through the security-definer RPCs above. Direct DML
-- would otherwise bypass the active-approved guard and cross-field validators.
revoke insert, update, delete on public.batches, public.batch_tiers, public.batch_timeline from public, anon, authenticated;
drop policy if exists "batches_supplier_all" on public.batches;
create policy "batches_supplier_approved_all" on public.batches for all to authenticated
  using (supplier_id = auth.uid() and exists (select 1 from public.profiles p join public.supplier_profiles sp on sp.user_id = p.id where p.id = auth.uid() and p.role = 'supplier' and p.status = 'active' and sp.verification_status = 'approved'))
  with check (supplier_id = auth.uid() and exists (select 1 from public.profiles p join public.supplier_profiles sp on sp.user_id = p.id where p.id = auth.uid() and p.role = 'supplier' and p.status = 'active' and sp.verification_status = 'approved'));
drop policy if exists "batch_tiers_supplier_all" on public.batch_tiers;
create policy "batch_tiers_supplier_approved_all" on public.batch_tiers for all to authenticated
  using (exists (select 1 from public.batches b join public.profiles p on p.id = b.supplier_id join public.supplier_profiles sp on sp.user_id = p.id where b.id = batch_id and b.supplier_id = auth.uid() and p.role = 'supplier' and p.status = 'active' and sp.verification_status = 'approved'))
  with check (exists (select 1 from public.batches b join public.profiles p on p.id = b.supplier_id join public.supplier_profiles sp on sp.user_id = p.id where b.id = batch_id and b.supplier_id = auth.uid() and p.role = 'supplier' and p.status = 'active' and sp.verification_status = 'approved'));
drop policy if exists "batch_timeline_supplier_all" on public.batch_timeline;
create policy "batch_timeline_supplier_approved_all" on public.batch_timeline for all to authenticated
  using (exists (select 1 from public.batches b join public.profiles p on p.id = b.supplier_id join public.supplier_profiles sp on sp.user_id = p.id where b.id = batch_id and b.supplier_id = auth.uid() and p.role = 'supplier' and p.status = 'active' and sp.verification_status = 'approved'))
  with check (exists (select 1 from public.batches b join public.profiles p on p.id = b.supplier_id join public.supplier_profiles sp on sp.user_id = p.id where b.id = batch_id and b.supplier_id = auth.uid() and p.role = 'supplier' and p.status = 'active' and sp.verification_status = 'approved'));
revoke execute on function public.catalog_supplier_approved() from public, anon, authenticated;
revoke execute on function public.validate_catalog_tiers(jsonb) from public, anon, authenticated;
revoke execute on function public.validate_catalog_timeline(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.assert_active_approved_supplier() from public, anon, authenticated;
revoke execute on function public.assert_supplier_batch_owner(uuid) from public, anon, authenticated;
revoke execute on function public.create_supplier_batch(text, text, text, integer, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.create_supplier_batch(text, text, text, integer, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) to authenticated;
revoke execute on function public.list_supplier_batches(public.batch_status, text) from public, anon;
grant execute on function public.list_supplier_batches(public.batch_status, text) to authenticated;
revoke execute on function public.publish_supplier_batch(uuid, text) from public, anon;
grant execute on function public.publish_supplier_batch(uuid, text) to authenticated;
revoke execute on function public.update_supplier_batch(uuid, text, text, text, integer, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.update_supplier_batch(uuid, text, text, text, integer, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) to authenticated;
revoke execute on function public.delete_supplier_batch(uuid) from public, anon;
grant execute on function public.delete_supplier_batch(uuid) to authenticated;
revoke execute on function public.get_supplier_batch(uuid) from public, anon;
grant execute on function public.get_supplier_batch(uuid) to authenticated;
revoke execute on function public.cancel_batch(uuid, text, text, text) from public, anon;
grant execute on function public.cancel_batch(uuid, text, text, text) to authenticated;
revoke execute on function public.get_supplier_dashboard_summary() from public, anon;
grant execute on function public.get_supplier_dashboard_summary() to authenticated;
