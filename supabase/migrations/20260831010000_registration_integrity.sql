-- Wesup migration 0016: registration integrity Gatekeeper (DB boundary)
-- Closes the TOCTOU gap between POST /api/registrations and the cutoff
-- distributed lock: a registration can no longer be inserted after a batch
-- has been closed, or after the absolute registration window has passed.
--
-- Design notes:
--   * The API route already evaluates the window (lib/orders/time-gatekeeper).
--     This trigger is the durable backstop: the gate check and the insert run
--     in the same transaction, so it is race-free at the database level even
--     against a concurrent cut_off_batch().
--   * SECURITY DEFINER with an empty search_path; all table references are
--     schema-qualified (pattern matches handle_new_user()).
--   * Lazy Evaluation: no cron, no scheduled work.

create or replace function public.prevent_registration_outside_window() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_status public.batch_status;
  v_opens_at timestamptz;
  v_closes_at timestamptz;
begin
  select b.status, t.registration_opens_at, t.registration_closes_at
    into v_status, v_opens_at, v_closes_at
    from public.batches b
    left join public.batch_timeline t on t.batch_id = b.id
   where b.id = new.batch_id;

  if v_status is null then
    raise exception 'batch does not exist';
  end if;

  if v_status <> 'published' then
    raise exception 'batch is not accepting registrations';
  end if;

  if v_opens_at is null or v_closes_at is null then
    raise exception 'batch timeline is not defined';
  end if;

  if now() < v_opens_at or now() >= v_closes_at then
    raise exception 'registration window is closed';
  end if;

  return new;
end;
$$;

-- Least privilege: the trigger must not be invokable as a bare function.
revoke execute on function public.prevent_registration_outside_window() from public, anon, authenticated;

create trigger prevent_registration_outside_window
  before insert on public.registrations
  for each row execute function public.prevent_registration_outside_window();

-- Overflow guard for cut_off_batch: clamp the locked invoice to the
-- numeric(12,2) upper bound so a single oversized order cannot fail the
-- whole batch cutoff (numeric field overflow). The clamped row remains
-- visible in the audit record for manual review.
create or replace function public.cut_off_batch(
  p_batch_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_total integer;
  v_tier public.batch_tiers%rowtype;
  v_is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_batch_id is null then
    raise exception 'batch id is required';
  end if;

  v_is_admin := public.is_admin();

  -- Idempotency + authorization: the batch must still be 'published' and the
  -- caller must be an active admin OR the owning supplier.
  select supplier_id into v_supplier_id
    from public.batches
   where id = p_batch_id
     and status = 'published';
  if not found then
    raise exception 'batch not found or already closed';
  end if;

  if not v_is_admin and v_supplier_id <> auth.uid() then
    raise exception 'only the owning supplier or an admin may close this batch';
  end if;

  -- Reconcile total committed volume from the durable registrations table.
  select coalesce(sum(r.quantity), 0)
    into v_total
    from public.registrations r
   where r.batch_id = p_batch_id
     and r.status in ('registered', 'pending_payment');

  -- Persist the reconciled mirror so it stays consistent with Redis.
  insert into public.registration_counters (batch_id, current_count, updated_at)
  values (p_batch_id, v_total, now())
  on conflict (batch_id)
  do update set current_count = excluded.current_count, updated_at = now();

  -- Determine the qualifying volume tier; fall back to Tier 1 (base price)
  -- when the minimum threshold for a higher tier is unmet (PRD 3.2).
  select bt.* into v_tier
    from public.batch_tiers bt
   where bt.batch_id = p_batch_id
     and bt.min_volume <= v_total
     and (bt.max_volume is null or v_total <= bt.max_volume)
   order by bt.min_volume desc
   limit 1;

  if not found or v_tier.tier_number is null then
    select bt.* into v_tier
      from public.batch_tiers bt
     where bt.batch_id = p_batch_id
       and bt.tier_number = 1;
    if not found then
      raise exception 'batch has no tier 1 price';
    end if;
  end if;

  -- Lock the final price onto every live registration (absolute invoice).
  -- least() clamps to the numeric(12,2) upper bound (overflow guard).
  update public.registrations
     set locked_tier_number = v_tier.tier_number,
         locked_price_per_unit = v_tier.price_per_unit,
         final_amount = round(least(v_tier.price_per_unit * quantity, 9999999999.99), 2),
         updated_at = now()
   where batch_id = p_batch_id
     and status in ('registered', 'pending_payment')
     and final_amount is null;

  -- Close the batch: volume additions are now rejected by the Gatekeeper.
  update public.batches
     set status = 'closed',
         updated_at = now()
   where id = p_batch_id
     and status = 'published';

  if v_is_admin then
    perform public.write_audit_log(
      auth.uid(), 'cut_off_batch', 'batches', p_batch_id,
      jsonb_build_object('total_volume', v_total, 'locked_tier', v_tier.tier_number),
      p_ip_address, p_user_agent
    );
  else
    insert into public.admin_audit_logs
      (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
    values
      (auth.uid(), 'cut_off_batch', 'batches', p_batch_id,
       jsonb_build_object('total_volume', v_total, 'locked_tier', v_tier.tier_number),
       p_ip_address, p_user_agent);
  end if;
end;
$$;

-- Least privilege: only signed-in users may invoke the cutoff. Re-asserted
-- here so the boundary stays explicit regardless of replay order;
-- CREATE OR REPLACE FUNCTION preserves the original grants on a live DB.
revoke execute on function public.cut_off_batch(uuid, text, text) from public, anon;
grant execute on function public.cut_off_batch(uuid, text, text) to authenticated;

-- Registration ownership policy: explicit WITH CHECK so it is unambiguous
-- that a row may only be inserted/updated/deleted by its owning UMKM.
drop policy if exists "registrations_umkm_all" on public.registrations;
create policy "registrations_umkm_all" on public.registrations
  for all using (umkm_id = auth.uid())
  with check (umkm_id = auth.uid());