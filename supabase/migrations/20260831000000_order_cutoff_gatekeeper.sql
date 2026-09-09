-- Wesup migration 0015: Order atomic counter integration & cutoff Gatekeeper
-- Covers PRD modules:
--   * Order table integration with the Redis Atomic Counter (PRD 3.2)      -> cut_off_batch()
--   * Volume-Limiting API (Gatekeeper) at registration cutoff (PRD 3.1/3.2) -> cut_off_batch()
--   * Distributed Lock (SETNX) is enforced in the API route layer
--     (lib/orders/registration-counter.ts), not in SQL. This RPC is the
--     idempotent, single-run price-lock that the lock wraps.
--
-- Design notes:
--   * Lazy Evaluation: no cron. The cutoff/price-lock is triggered on-demand
--     via POST /api/batches/[id]/cutoff behind a Redis SETNX distributed lock
--     so only one concurrent request executes the mutation; the rest become
--     readers (PRD 3.1).
--   * Volume is reconciled from committed `registrations` rows (the durable
--     source), not the live Redis value. Redis INCR is the concurrent-ordering
--     mechanism; this RPC is the accuracy guarantee (PRD 3.2 "mirror").
--   * Price lock fallback: if no volume tier threshold is met, every
--     registration locks to Tier 1 (base price) (PRD 3.2).
--   * Idempotent: only transitions batches that are still 'published';
--     a second call sees 'closed' and becomes a no-op.

alter type public.audit_action add value 'cut_off_batch';

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
  -- At cutoff the only live (non-terminal) statuses are 'registered' and
  -- 'pending_payment'; anything else is excluded so a no-show/refund cannot
  -- inflate the locked tier.
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
  update public.registrations
     set locked_tier_number = v_tier.tier_number,
         locked_price_per_unit = v_tier.price_per_unit,
         final_amount = round(v_tier.price_per_unit * quantity, 2),
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

-- Least privilege: drop the default PUBLIC/anon execute grant; only signed-in
-- users may invoke the cutoff. The auth.uid() guard inside remains the backstop.
revoke execute on function public.cut_off_batch(uuid, text, text) from public, anon;
grant execute on function public.cut_off_batch(uuid, text, text) to authenticated;
