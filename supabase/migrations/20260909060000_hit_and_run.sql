-- Wesup migration: Hit & Run auto-suspend + Arbiter irreversibility
-- Covers PRD 3.4 (Auto-Suspend) and PRD 2.3.4 (Dispute Resolution):
--   * apply_hit_and_run() — lazy, on-demand strike escalation scanned after
--     the payment window closes (no cron). Strike 1 = warning, 2 = 7-day
--     suspend counted retrospectively from payment_closes_at, 3+ = permanent.
--   * resolve_dispute() — hardened to refuse re-resolution (Arbiter decision
--     is irreversible).
--
-- Design notes:
--   * Unpaid = registrations stuck in 'pending_payment' whose payment row is
--     missing or not 'paid' (webhook is the liveness signal; this RPC is the
--     accuracy sweep after the window).
--   * One strike per UMKM per run (distinct umkm_id): a single batch cannot
--     jump a user from warning straight to permanent.
--   * Dead orders are moved to 'cancelled' so a second run is a no-op.
--   * Rating-based suspend is deliberately absent (PRD 3.4 exception).

alter type public.audit_action add value 'apply_hit_and_run';

create or replace function public.apply_hit_and_run(
  p_batch_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_closes_at timestamptz;
  v_is_admin boolean;
  v_umkm_id uuid;
  v_strikes integer;
  v_until timestamptz;
  v_warned integer := 0;
  v_temp integer := 0;
  v_perm integer := 0;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_batch_id is null then
    raise exception 'batch id is required';
  end if;

  select t.payment_closes_at into v_closes_at
    from public.batch_timeline t
   where t.batch_id = p_batch_id;
  if v_closes_at is null then
    raise exception 'batch not found';
  end if;
  if now() < v_closes_at then
    raise exception 'payment window still open';
  end if;

  v_is_admin := public.is_admin();
  if not v_is_admin then
    select b.supplier_id into v_supplier_id
      from public.batches b
     where b.id = p_batch_id;
    if v_supplier_id is null or v_supplier_id <> auth.uid() then
      raise exception 'only the owning supplier or an admin may reconcile this batch';
    end if;
  end if;

  for v_umkm_id in
    select distinct reg.umkm_id
      from public.registrations reg
      left join public.payments pay on pay.registration_id = reg.id
     where reg.batch_id = p_batch_id
       and reg.status = 'pending_payment'
       and pay.status is distinct from 'paid'
  loop
    -- ponytail: umkm_profiles rows are never created at signup (no writer
    -- exists yet), so the strike upserts the row; business columns stay
    -- empty until onboarding fills them.
    insert into public.umkm_profiles (user_id, business_name, address, latitude, longitude, strike_count)
    values (v_umkm_id, '', '', 0, 0, 1)
    on conflict (user_id)
    do update set strike_count = public.umkm_profiles.strike_count + 1,
                  updated_at = now()
    returning strike_count into v_strikes;

    if v_strikes = 1 then
      insert into public.notifications (user_id, type, title, message, data)
      values (v_umkm_id, 'suspension', 'Peringatan pembayaran',
              'Anda melewatkan pembayaran. Pelanggaran berikutnya berakibat penangguhan akun 7 hari.',
              jsonb_build_object('batch_id', p_batch_id, 'strike', 1));
      v_warned := v_warned + 1;
    elsif v_strikes = 2 then
      -- Retrospective: 7 days counted from payment_closes_at, not now()
      v_until := v_closes_at + interval '7 days';
      update public.profiles
         set status = 'suspended_temporary',
             updated_at = now()
       where id = v_umkm_id
         and status in ('active', 'suspended_temporary');
      update public.umkm_profiles
         set suspended_until = v_until,
             updated_at = now()
       where user_id = v_umkm_id;
      insert into public.notifications (user_id, type, title, message, data)
      values (v_umkm_id, 'suspension', 'Akun ditangguhkan 7 hari',
              'Pelanggaran pembayaran kedua. Akun Anda ditangguhkan selama 7 hari.',
              jsonb_build_object('batch_id', p_batch_id, 'strike', 2, 'suspended_until', v_until));
      v_temp := v_temp + 1;
    else
      update public.profiles
         set status = 'suspended_permanent',
             updated_at = now()
       where id = v_umkm_id
         and status in ('active', 'suspended_temporary');
      insert into public.notifications (user_id, type, title, message, data)
      values (v_umkm_id, 'suspension', 'Akun ditangguhkan permanen',
              'Pelanggaran pembayaran ketiga. Hubungi admin melalui email untuk banding.',
              jsonb_build_object('batch_id', p_batch_id, 'strike', v_strikes));
      v_perm := v_perm + 1;
    end if;
  end loop;

  -- Dead orders can never be paid now; move them out so reruns are no-ops.
  update public.registrations reg
     set status = 'cancelled',
         updated_at = now()
    from public.payments pay
   where reg.batch_id = p_batch_id
     and reg.status = 'pending_payment'
     and pay.registration_id = reg.id
     and pay.status is distinct from 'paid';

  update public.registrations
     set status = 'cancelled',
         updated_at = now()
   where batch_id = p_batch_id
     and status = 'pending_payment'
     and not exists (select 1 from public.payments pay where pay.registration_id = registrations.id);

  if v_is_admin then
    perform public.write_audit_log(
      auth.uid(), 'apply_hit_and_run', 'batches', p_batch_id,
      jsonb_build_object('warned', v_warned, 'suspended_temporary', v_temp, 'suspended_permanent', v_perm),
      p_ip_address, p_user_agent
    );
  else
    insert into public.admin_audit_logs
      (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
    values
      (auth.uid(), 'apply_hit_and_run', 'batches', p_batch_id,
       jsonb_build_object('warned', v_warned, 'suspended_temporary', v_temp, 'suspended_permanent', v_perm),
       p_ip_address, p_user_agent);
  end if;

  return jsonb_build_object(
    'struck', v_warned + v_temp + v_perm,
    'warned', v_warned,
    'suspended_temporary', v_temp,
    'suspended_permanent', v_perm
  );
end;
$$;

revoke execute on function public.apply_hit_and_run(uuid, text, text) from public, anon;
grant execute on function public.apply_hit_and_run(uuid, text, text) to authenticated;

-- Arbiter irreversibility: a decided dispute can never be re-resolved.
create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_winner text,
  p_notes text default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
declare
  v_registration_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only an active admin may resolve disputes';
  end if;
  if p_winner not in ('supplier', 'umkm') then
    raise exception 'winner must be supplier or umkm';
  end if;
  select registration_id into v_registration_id
    from public.disputes
   where id = p_dispute_id
     and status in ('pending', 'under_review');
  if v_registration_id is null then
    raise exception 'dispute not found or already resolved';
  end if;
  update public.disputes
     set status = case when p_winner = 'supplier' then 'resolved_supplier' else 'resolved_umkm' end,
         admin_id = auth.uid(),
         admin_notes = coalesce(p_notes, admin_notes),
         decided_at = now(),
         updated_at = now()
   where id = p_dispute_id;
  update public.escrow_holds
     set release_destination = p_winner,
         dispute_id = p_dispute_id
   where registration_id = v_registration_id
     and status = 'held';
  perform public.write_audit_log(auth.uid(), 'resolve_dispute', 'disputes', p_dispute_id, jsonb_build_object('winner', p_winner, 'notes', p_notes), p_ip_address, p_user_agent);
end;
$$;
