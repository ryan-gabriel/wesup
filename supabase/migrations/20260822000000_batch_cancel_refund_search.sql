-- Wesup migration 0014: batch cancellation side effects & marketplace search
-- Covers PRD modules:
--   * Catalog deletion (soft-cancel) by Supplier            -> cancel_batch()
--   * Automatic Full Refund Queue population (PRD 2.3.2/3.5) -> handle_batch_cancellation()
--   * Lightweight marketplace search (text/category/radius)  -> search_batches()
--
-- Design notes:
--   * Batches are never hard-deleted while registrations reference them;
--     suppliers soft-cancel (status -> 'cancelled') and admins takedown.
--   * A single AFTER UPDATE trigger on batches.status centralises the
--     side effects for BOTH actors, so admin takedown finally populates
--     the refund queue too (PRD 3.5 parity).
--   * write_audit_log() is admin-gated, so supplier cancellations append
--     their audit row directly from a SECURITY DEFINER function.

-- NOTE: plain ADD VALUE (no IF NOT EXISTS) keeps migrations parseable by
-- pgsql-ast-parser in tests and is safe because migrations run once.
alter type public.refund_trigger add value 'supplier_cancel';
alter type public.audit_action add value 'cancel_batch';

-- ============================================================
-- Overload cleanup: migration 0008 intended to REPLACE the 0000-era
-- approve_supplier(p_user_id uuid), but CREATE OR REPLACE with a
-- different argument list silently created an OVERLOAD. PostgREST then
-- returns 300 Multiple Choices for every rpc/approve_supplier call.
-- Drop the legacy one-arg form.
-- ============================================================
drop function if exists public.approve_supplier(uuid);
-- ============================================================
-- One refund ticket per registration, ever. Idempotency guard
-- against double-queueing during concurrent status flips.
--
-- NOTE: replaces an earlier partial guard
-- (refund_requests_registration_supplier_cancel_idx, WHERE
-- trigger_type = 'supplier_cancel') which left takedown/force_majeure
-- duplicates unguarded AND cannot be inferred by
-- ON CONFLICT (registration_id).
-- ============================================================
drop index if exists public.refund_requests_registration_supplier_cancel_idx;

create unique index if not exists refund_requests_registration_unique
  on public.refund_requests (registration_id);

-- ============================================================
-- handle_batch_cancellation: fires whenever a batch enters
-- 'cancelled' or 'takedown'.
--   paid               -> refund_pending + refund_requests row + notification
--   registered         -> cancelled + notification (no money captured)
--   pending_payment    -> cancelled + notification (no money captured)
--   picked_up/completed-> untouched (escrow/dispute flow governs)
-- Held escrows of refunded participants are routed back to the UMKM so
-- the lazy escrow evaluator releases them to the right destination.
-- ============================================================
create or replace function public.handle_batch_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trigger_type public.refund_trigger;
begin
  if new.status <> 'cancelled' and new.status <> 'takedown' then
    return null;
  end if;

  v_trigger_type := case
    when new.status = 'takedown' then 'takedown'::public.refund_trigger
    else 'supplier_cancel'::public.refund_trigger
  end;

  -- Paid participants: money captured -> Full Refund Queue + notify UMKM
  -- to submit their bank account (PRD 3.5).
  with moved as (
    update public.registrations
       set status = 'refund_pending',
           updated_at = now()
     where batch_id = new.id
       and status = 'paid'
    returning id, umkm_id, final_amount
  ), queued as (
    insert into public.refund_requests
      (registration_id, batch_id, trigger_type, amount, status)
    select m.id, new.id, v_trigger_type, m.final_amount, 'pending'
      from moved m
      on conflict (registration_id) do nothing
    returning registration_id
  )
  insert into public.notifications
    (user_id, type, title, message, data)
  select m.umkm_id,
         'refund'::public.notification_type,
         'Penawaran dibatalkan - masuk antrean Full Refund',
         'Penawaran yang Anda ikuti telah dibatalkan. Dana Anda tercatat di Antrean Full Refund dan akan ditransfer manual oleh Admin setelah Anda melengkapi data rekening tujuan.',
         jsonb_build_object(
           'batch_id', new.id,
           'registration_id', m.id,
           'amount', m.final_amount
         )
    from moved m;

  -- Unpaid participants: nothing captured, auto-cancel + notify.
  with dropped as (
    update public.registrations
       set status = 'cancelled',
           updated_at = now()
     where batch_id = new.id
       and status in ('registered', 'pending_payment')
    returning id, umkm_id
  )
  insert into public.notifications
    (user_id, type, title, message, data)
  select d.umkm_id,
         'batch_update'::public.notification_type,
         'Penawaran dibatalkan',
         'Penawaran ini dibatalkan sebelum pembayaran. Tidak ada dana yang tertahan.',
         jsonb_build_object('batch_id', new.id, 'registration_id', d.id)
    from dropped d;

  -- Route held escrow of refunded participants back to the UMKM.
  update public.escrow_holds e
     set release_destination = 'umkm'
    from public.registrations r
   where e.registration_id = r.id
     and r.batch_id = new.id
     and r.status = 'refund_pending'
     and e.status = 'held';

  return null;
end;
$$;

create trigger batches_cancel_side_effects
after update of status on public.batches
for each row
when ((new.status in ('cancelled', 'takedown')) and old.status is distinct from new.status)
execute function public.handle_batch_cancellation();

revoke execute on function public.handle_batch_cancellation()
  from public, anon, authenticated;

-- ============================================================
-- cancel_batch: supplier-initiated soft cancellation ("Pembatalan
-- Darurat"). Allowed until the first pickup scan; afterwards the
-- escrow/dispute flow governs. Ownership and allowed source states
-- are enforced here; the trigger above performs the refund fan-out.
-- ============================================================
create or replace function public.cancel_batch(
  p_batch_id uuid,
  p_reason text,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_picked integer;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'cancellation reason is required';
  end if;

  select count(*) into v_picked
    from public.registrations
   where batch_id = p_batch_id
     and status in ('picked_up', 'completed');
  if v_picked > 0 then
    raise exception 'batch already has picked-up orders';
  end if;

  update public.batches
     set status = 'cancelled',
         cancelled_reason = trim(p_reason),
         updated_at = now()
   where id = p_batch_id
     and supplier_id = auth.uid()
     and status in ('published', 'closed');
  if not found then
    raise exception 'batch not found or not cancellable';
  end if;

  -- write_audit_log() is admin-gated; suppliers append directly.
  insert into public.admin_audit_logs
    (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
  values
    (auth.uid(), 'cancel_batch', 'batches', p_batch_id,
     jsonb_build_object('reason', trim(p_reason)), p_ip_address, p_user_agent);
end;
$$;

-- ============================================================
-- search_batches: lightweight marketplace query.
--   * published batches only
--   * optional case-insensitive match on title/description
--   * optional category allow-list overlap
--   * optional radius: lat/lng bounding-box prefilter (index-friendly)
--     followed by an exact haversine check
--   * nearest-first ordering when coordinates are supplied,
--     newest-first otherwise
--   * total_count enables client-side pagination
-- ILIKE patterns are used verbatim (MVP scale, parameterised input).
-- ============================================================
create or replace function public.search_batches(
  p_query text default null,
  p_categories text[] default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_radius_km numeric default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  supplier_id uuid,
  title text,
  description text,
  category text,
  min_quantity integer,
  product_photo_url text,
  pickup_address text,
  latitude numeric,
  longitude numeric,
  tiers jsonb,
  distance_km numeric,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select b.id,
           b.supplier_id,
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
           case
             when p_lat is null or p_lng is null then null::numeric
             else round(
               (6371 * acos(least(1.0, greatest(-1.0,
                 sin(radians(p_lat)) * sin(radians(b.latitude))
                 + cos(radians(p_lat)) * cos(radians(b.latitude))
                   * cos(radians(b.longitude) - radians(p_lng))
               ))))::numeric
             , 2)
           end as dist_km
      from public.batches b
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
            or b.description ilike '%' || p_query || '%')
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
  )
  select d.id,
         d.supplier_id,
         d.title,
         d.description,
         d.category,
         d.min_quantity,
         d.product_photo_url,
         d.pickup_address,
         d.latitude,
         d.longitude,
         d.tiers_json as tiers,
         d.dist_km as distance_km,
         count(*) over () as total_count
    from base d
   where p_lat is null or p_lng is null or p_radius_km is null
         or d.dist_km is null or d.dist_km <= p_radius_km
   order by d.dist_km asc nulls last, d.created_at desc
   limit least(greatest(coalesce(p_limit, 12), 1), 50)
   offset greatest(coalesce(p_offset, 0), 0);
$$;
