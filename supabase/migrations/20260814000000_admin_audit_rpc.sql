-- Wesup migration 0009: admin audit write path & admin action RPCs
-- Closes the audit gap: admin_audit_logs was append-only but nothing wrote it.
-- Model: clients (incl. admins) can only SELECT via RLS; writes flow through
-- security-definer RPCs executed server-side, atomically with the state change
-- they log (one transaction per action, audit row can never be skipped).

-- ============================================================
-- 1. Drop the forgeable INSERT policy (any authenticated user could
--    inject rows with admin_id = auth.uid() and arbitrary action_type)
-- ============================================================
drop policy if exists "admin_audit_logs_admin_insert" on public.admin_audit_logs;

-- ============================================================
-- 2. TRUNCATE guard: statement-level trigger + explicit revoke.
--    Row-level UPDATE/DELETE is already blocked by the immutable
--    trigger; TRUNCATE fires no row triggers, so guard it separately.
-- ============================================================
create trigger admin_audit_logs_no_truncate
  before truncate on public.admin_audit_logs
  for each statement execute function public.prevent_admin_audit_logs_mutation();

revoke truncate on public.admin_audit_logs from public, anon, authenticated;

-- ============================================================
-- 3. write_audit_log: the single server-side writer. Calls only
--    allowed from security-definer functions (owner); the client
--    roles have no EXECUTE grant. Asserts the caller is an active
--    admin and that the row is attributed to the calling admin.
-- ============================================================
create or replace function public.write_audit_log(
  p_admin_id uuid,
  p_action public.audit_action,
  p_target_type text,
  p_target_id uuid,
  p_details jsonb default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() or p_admin_id is distinct from auth.uid() then
    raise exception 'only an active admin may write audit logs';
  end if;
  insert into public.admin_audit_logs
    (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
  values
    (p_admin_id, p_action, p_target_type, p_target_id, p_details, p_ip_address, p_user_agent);
end;
$$;

revoke execute on function public.write_audit_log(uuid, public.audit_action, text, uuid, jsonb, text, text) from public, anon, authenticated;

-- ============================================================
-- 4. Admin action RPCs. Each: assert active admin, mutate state with
--    absolute timestamps, then append one audit row in the same tx.
-- ============================================================

-- approve_supplier: replaces the 0000 hardening version (now audits)
create or replace function public.approve_supplier(
  p_user_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may approve suppliers';
  end if;
  update public.supplier_profiles
     set verification_status = 'approved',
         verified_by = auth.uid(),
         verified_at = now(),
         updated_at = now()
   where user_id = p_user_id;
  if not found then
    raise exception 'supplier profile not found';
  end if;
  perform public.write_audit_log(auth.uid(), 'verify_supplier', 'supplier_profiles', p_user_id, null, p_ip_address, p_user_agent);
end;
$$;

create or replace function public.reject_supplier(
  p_user_id uuid,
  p_reason text,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may reject suppliers';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'rejection reason is required';
  end if;
  update public.supplier_profiles
     set verification_status = 'rejected',
         verification_notes = p_reason,
         verified_by = auth.uid(),
         verified_at = now(),
         updated_at = now()
   where user_id = p_user_id;
  if not found then
    raise exception 'supplier profile not found';
  end if;
  perform public.write_audit_log(auth.uid(), 'reject_supplier', 'supplier_profiles', p_user_id, jsonb_build_object('reason', p_reason), p_ip_address, p_user_agent);
end;
$$;

create or replace function public.takedown_batch(
  p_batch_id uuid,
  p_reason text,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may take down batches';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'takedown reason is required';
  end if;
  update public.batches
     set status = 'takedown',
         takedown_reason = p_reason,
         takedown_by = auth.uid(),
         takedown_at = now(),
         updated_at = now()
   where id = p_batch_id
     and status not in ('takedown', 'completed', 'cancelled');
  if not found then
    raise exception 'batch not found or not takedownable';
  end if;
  perform public.write_audit_log(auth.uid(), 'takedown_batch', 'batches', p_batch_id, jsonb_build_object('reason', p_reason), p_ip_address, p_user_agent);
end;
$$;

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
    from public.disputes where id = p_dispute_id;
  if v_registration_id is null then
    raise exception 'dispute not found';
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

create or replace function public.approve_refund(
  p_refund_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may approve refunds';
  end if;
  update public.refund_requests
     set status = case when umkm_bank_account_id is null then 'waiting_bank_account' else 'processing' end,
         admin_id = auth.uid(),
         processed_at = now()
   where id = p_refund_id
     and status = 'pending';
  if not found then
    raise exception 'refund request not found or not pending';
  end if;
  perform public.write_audit_log(auth.uid(), 'approve_refund', 'refund_requests', p_refund_id, null, p_ip_address, p_user_agent);
end;
$$;

create or replace function public.complete_refund(
  p_refund_id uuid,
  p_transfer_proof_url text,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may complete refunds';
  end if;
  if p_transfer_proof_url is null or trim(p_transfer_proof_url) = '' then
    raise exception 'transfer proof url is required';
  end if;
  update public.refund_requests
     set status = 'completed',
         transfer_proof_url = p_transfer_proof_url,
         admin_id = auth.uid(),
         completed_at = now()
   where id = p_refund_id
     and status in ('processing', 'waiting_bank_account');
  if not found then
    raise exception 'refund request not found or not in a completable state';
  end if;
  perform public.write_audit_log(auth.uid(), 'complete_refund', 'refund_requests', p_refund_id, jsonb_build_object('transfer_proof_url', p_transfer_proof_url), p_ip_address, p_user_agent);
end;
$$;

create or replace function public.suspend_user(
  p_user_id uuid,
  p_suspended_until timestamptz,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may suspend users';
  end if;
  if p_suspended_until is null or p_suspended_until <= now() then
    raise exception 'suspended_until must be a future timestamp';
  end if;
  update public.profiles
     set status = 'suspended_temporary',
         updated_at = now()
   where id = p_user_id
     and status in ('active', 'suspended_temporary');
  if not found then
    raise exception 'user not found or not suspendable';
  end if;
  update public.umkm_profiles
     set suspended_until = p_suspended_until,
         updated_at = now()
   where user_id = p_user_id;
  perform public.write_audit_log(auth.uid(), 'suspend_user', 'profiles', p_user_id, jsonb_build_object('suspended_until', p_suspended_until), p_ip_address, p_user_agent);
end;
$$;

create or replace function public.ban_user(
  p_user_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may ban users';
  end if;
  update public.profiles
     set status = 'banned',
         updated_at = now()
   where id = p_user_id
     and status <> 'banned';
  if not found then
    raise exception 'user not found or already banned';
  end if;
  perform public.write_audit_log(auth.uid(), 'ban_user', 'profiles', p_user_id, null, p_ip_address, p_user_agent);
end;
$$;

create or replace function public.unban_user(
  p_user_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
  language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'only an active admin may unban users';
  end if;
  update public.profiles
     set status = 'active',
         updated_at = now()
   where id = p_user_id
     and status = 'banned';
  if not found then
    raise exception 'user not found or not banned';
  end if;
  perform public.write_audit_log(auth.uid(), 'unban_user', 'profiles', p_user_id, null, p_ip_address, p_user_agent);
end;
$$;

-- ============================================================
-- 5. Grants: action RPCs callable by authenticated (routes call
--    them with the user session); audit writer is server-side only.
-- ============================================================
revoke execute on function public.approve_supplier(uuid, text, text) from public, anon;
grant execute on function public.approve_supplier(uuid, text, text) to authenticated;

revoke execute on function public.reject_supplier(uuid, text, text, text) from public, anon;
grant execute on function public.reject_supplier(uuid, text, text, text) to authenticated;

revoke execute on function public.takedown_batch(uuid, text, text, text) from public, anon;
grant execute on function public.takedown_batch(uuid, text, text, text) to authenticated;

revoke execute on function public.resolve_dispute(uuid, text, text, text, text) from public, anon;
grant execute on function public.resolve_dispute(uuid, text, text, text, text) to authenticated;

revoke execute on function public.approve_refund(uuid, text, text) from public, anon;
grant execute on function public.approve_refund(uuid, text, text) to authenticated;

revoke execute on function public.complete_refund(uuid, text, text, text) from public, anon;
grant execute on function public.complete_refund(uuid, text, text, text) to authenticated;

revoke execute on function public.suspend_user(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.suspend_user(uuid, timestamptz, text, text) to authenticated;

revoke execute on function public.ban_user(uuid, text, text) from public, anon;
grant execute on function public.ban_user(uuid, text, text) to authenticated;

revoke execute on function public.unban_user(uuid, text, text) from public, anon;
grant execute on function public.unban_user(uuid, text, text) to authenticated;