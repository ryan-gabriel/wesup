-- Wesup migration 0018: secure dynamic marketplace read model.
--
-- The listing/detail UI needs aggregate registration volume, but registrations
-- are intentionally hidden from UMKM and anonymous callers by RLS. These
-- security-definer functions expose only published batch aggregates and keep
-- their search_path pinned to public.

drop function if exists public.search_batches(text, pg_catalog._text, numeric, numeric, numeric, integer, integer);
drop function if exists public.get_marketplace_batch(uuid, numeric, numeric);

create function public.get_marketplace_batch(
  p_batch_id uuid,
  p_lat numeric default null,
  p_lng numeric default null
)
returns table (
  id uuid,
  supplier_name text,
  title text,
  description text,
  category text,
  min_quantity integer,
  product_photo_url text,
  pickup_address text,
  latitude numeric,
  longitude numeric,
  tiers jsonb,
  registered_quantity bigint,
  current_price_per_unit numeric,
  registration_closes_at timestamptz,
  distance_km numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with volume as (
    select r.batch_id, coalesce(sum(r.quantity), 0)::bigint as registered_quantity
      from public.registrations r
     where r.status in ('registered', 'pending_payment')
     group by r.batch_id
  ),
  visible as (
    select b.id,
           coalesce(sp.business_name, p.full_name) as supplier_name,
           b.title,
           b.description,
           b.category,
           b.min_quantity,
           b.product_photo_url,
           b.pickup_address,
           b.latitude,
           b.longitude,
           coalesce(t.tiers, '[]'::jsonb) as tiers_json,
           coalesce(v.registered_quantity, 0)::bigint as registered_quantity,
           coalesce(
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                  and bt.min_volume <= coalesce(v.registered_quantity, 0)
                order by bt.min_volume desc, bt.tier_number desc
                limit 1
             ),
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                order by bt.tier_number
                limit 1
             )
           ) as current_price_per_unit,
           btimeline.registration_closes_at,
           case
             when p_lat is null or p_lng is null then null::numeric
             else round(
               (6371 * acos(least(1.0, greatest(-1.0,
                 sin(radians(p_lat)) * sin(radians(b.latitude))
                 + cos(radians(p_lat)) * cos(radians(b.latitude))
                   * cos(radians(b.longitude) - radians(p_lng))
               ))))::numeric
             , 2)
           end as distance_km
      from public.batches b
      join public.profiles p on p.id = b.supplier_id
      left join public.supplier_profiles sp on sp.user_id = b.supplier_id
      left join public.batch_timeline btimeline on btimeline.batch_id = b.id
      left join volume v on v.batch_id = b.id
      left join lateral (
        select jsonb_agg(
                 jsonb_build_object(
                   'tier_number', bt.tier_number,
                   'min_volume', bt.min_volume,
                   'max_volume', bt.max_volume,
                   'price_per_unit', bt.price_per_unit
                 )
                 order by bt.tier_number
               ) as tiers
          from public.batch_tiers bt
         where bt.batch_id = b.id
      ) t on true
     where b.id = p_batch_id
       and b.status = 'published'
  )
  select v.id,
         v.supplier_name,
         v.title,
         v.description,
         v.category,
         v.min_quantity,
         v.product_photo_url,
         v.pickup_address,
         v.latitude,
         v.longitude,
         v.tiers_json as tiers,
         v.registered_quantity,
         v.current_price_per_unit,
         v.registration_closes_at,
         v.distance_km,
         count(*) over () as total_count
    from visible v;
$$;

create function public.search_batches(
  p_query text default null,
  p_categories text[] default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_radius_km numeric default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  supplier_name text,
  title text,
  description text,
  category text,
  min_quantity integer,
  product_photo_url text,
  pickup_address text,
  latitude numeric,
  longitude numeric,
  tiers jsonb,
  registered_quantity bigint,
  current_price_per_unit numeric,
  registration_closes_at timestamptz,
  distance_km numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with volume as (
    select r.batch_id, coalesce(sum(r.quantity), 0)::bigint as registered_quantity
      from public.registrations r
     where r.status in ('registered', 'pending_payment')
     group by r.batch_id
  ),
  base as (
    select b.id,
           coalesce(sp.business_name, p.full_name) as supplier_name,
           b.title,
           b.description,
           b.category,
           b.min_quantity,
           b.product_photo_url,
           b.pickup_address,
           b.latitude,
           b.longitude,
           b.created_at,
           coalesce(t.tiers, '[]'::jsonb) as tiers_json,
           coalesce(v.registered_quantity, 0)::bigint as registered_quantity,
           coalesce(
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                  and bt.min_volume <= coalesce(v.registered_quantity, 0)
                order by bt.min_volume desc, bt.tier_number desc
                limit 1
             ),
             (
               select bt.price_per_unit
                 from public.batch_tiers bt
                where bt.batch_id = b.id
                order by bt.tier_number
                limit 1
             )
           ) as current_price_per_unit,
           btimeline.registration_closes_at,
           case
             when p_lat is null or p_lng is null then null::numeric
             else round(
               (6371 * acos(least(1.0, greatest(-1.0,
                 sin(radians(p_lat)) * sin(radians(b.latitude))
                 + cos(radians(p_lat)) * cos(radians(b.latitude))
                   * cos(radians(b.longitude) - radians(p_lng))
               ))))::numeric
             , 2)
           end as distance_km
      from public.batches b
      join public.profiles p on p.id = b.supplier_id
      left join public.supplier_profiles sp on sp.user_id = b.supplier_id
      left join public.batch_timeline btimeline on btimeline.batch_id = b.id
      left join volume v on v.batch_id = b.id
      left join lateral (
        select jsonb_agg(
                 jsonb_build_object(
                   'tier_number', bt.tier_number,
                   'min_volume', bt.min_volume,
                   'max_volume', bt.max_volume,
                   'price_per_unit', bt.price_per_unit
                 )
                 order by bt.tier_number
               ) as tiers
          from public.batch_tiers bt
         where bt.batch_id = b.id
      ) t on true
     where b.status = 'published'
       and (p_query is null or p_query = ''
            or b.title ilike '%' || p_query || '%'
            or b.description ilike '%' || p_query || '%'
            or coalesce(sp.business_name, p.full_name) ilike '%' || p_query || '%')
       and (p_categories is null
            or array_length(p_categories, 1) is null
            or b.category = any (p_categories))
       and (p_lat is null or p_lng is null or p_radius_km is null
            or (
              b.latitude between p_lat - (p_radius_km / 111.045)
                            and p_lat + (p_radius_km / 111.045)
              and b.longitude between
                    p_lng - (p_radius_km / (111.045 * greatest(0.01, cos(radians(p_lat)))))
                and p_lng + (p_radius_km / (111.045 * greatest(0.01, cos(radians(p_lat)))))
            ))
  ),
  filtered as (
    select b.*
      from base b
     where (p_lat is null or p_lng is null or p_radius_km is null
            or b.distance_km is null or b.distance_km <= p_radius_km)
       and (p_min_price is null or b.current_price_per_unit >= p_min_price)
       and (p_max_price is null or b.current_price_per_unit <= p_max_price)
  )
  select f.id,
         f.supplier_name,
         f.title,
         f.description,
         f.category,
         f.min_quantity,
         f.product_photo_url,
         f.pickup_address,
         f.latitude,
         f.longitude,
         f.tiers_json as tiers,
         f.registered_quantity,
         f.current_price_per_unit,
         f.registration_closes_at,
         f.distance_km,
         count(*) over () as total_count
    from filtered f
   order by f.distance_km asc nulls last, f.created_at desc
   limit least(greatest(coalesce(p_limit, 12), 1), 50)
   offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.get_marketplace_batch(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_batch(uuid, numeric, numeric)
  to anon, authenticated;

revoke execute on function public.search_batches(text, pg_catalog._text, numeric, numeric, numeric, numeric, numeric, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_batches(text, pg_catalog._text, numeric, numeric, numeric, numeric, numeric, integer, integer)
  to anon, authenticated;
