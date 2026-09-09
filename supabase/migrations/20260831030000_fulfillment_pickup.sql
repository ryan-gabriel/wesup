-- Wesup migration 0018: Fulfillment & Pickup
-- Covers PRD:
--   * 2.2.6 Pickup code generation + confirmation
--   * Escrow hold creation at pickup confirmation (24h auto-release window)
--   * Supplier order-dashboard list
--
-- Design notes:
--   * Lazy Evaluation: pickup flow is triggered by the UMKM/supplier's explicit
--     API calls; no cron.
--   * generate_pickup_code only issues a code once the payment row is 'paid'
--     (payment itself is out of scope here; the settled payment row is the gate).
--   * The escrow hold is created AT pickup confirmation, with
--     auto_release_at = pickup_confirmed_at + 24h. Its actual release/no-show is
--     computed on-demand by materialize_escrow_state (Slice 3).
--   * Idempotent: generating a code for an already-coded registration
--     returns the existing code; confirming twice is prevented by status.

alter type public.audit_action add value 'generate_pickup_code';
alter type public.audit_action add value 'confirm_pickup';

create or replace function public.generate_pickup_code(
  p_registration_id uuid,
  p_ip_address text default null,
  p_user_agent text default null
) returns table (
  qr_code_token text,
  pin_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_umkm_id uuid;
  v_is_supplier boolean;
  v_is_umkm boolean;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_registration_id is null then
    raise exception 'registration id is required';
  end if;

  -- The code may be requested by the UMKM owner OR the owning supplier / admin.
  select r.umkm_id, r.status into v_umkm_id, v_is_umkm
    from public.registrations r
   where r.id = p_registration_id;
  if not found then
    raise exception 'registration not found';
  end if;

  v_is_umkm := (auth.uid() = v_umkm_id);
  v_is_supplier := public.is_supplier()
    and exists (
      select 1
        from public.registrations r
        join public.batches b on b.id = r.batch_id
       where r.id = p_registration_id
         and b.supplier_id = auth.uid()
    );

  if not v_is_umkm and not v_is_supplier and not public.is_admin() then
    raise exception 'only the UMKM owner, owning supplier, or an admin may generate a pickup code';
  end if;

  -- Payment gate: code only when the registration is settled (status = 'paid').
  -- Payment integration itself is out of scope; the paid flag is the gate.
  if not exists (
    select 1 from public.registrations r
     where r.id = p_registration_id
       and r.status = 'paid'
  ) then
    raise exception 'pickup code is only available after payment is settled';
  end if;

  -- Idempotent: return existing code if present.
  if exists (
    select 1 from public.pickup_codes pc
     where pc.registration_id = p_registration_id
  ) then
    return query
      select pc.qr_code_token, pc.pin_code
        from public.pickup_codes pc
       where pc.registration_id = p_registration_id;
    return;
  end if;

  insert into public.pickup_codes (registration_id, qr_code_token, pin_code)
  values (
    p_registration_id,
    encode(gen_random_bytes(18), 'hex'),
    lpad(floor(random() * 10000)::int::text, 4, '0')
  )
  returning public.pickup_codes.qr_code_token, public.pickup_codes.pin_code
  into qr_code_token, pin_code;

  return next;
end;
$$;

-- create_escrow: internal helper that creates an escrow hold for a registration
-- that has just been picked up. auto_release_at = pickup_confirmed_at + 24h.
create or replace function public.create_escrow(
  p_registration_id uuid,
  p_pickup_confirmed_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
begin
  select r.final_amount into v_amount
    from public.registrations r
   where r.id = p_registration_id;
  if v_amount is null then
    raise exception 'registration has no settled amount';
  end if;

  insert into public.escrow_holds (
    registration_id, amount, pickup_confirmed_at, auto_release_at, status
  ) values (
    p_registration_id,
    v_amount,
    p_pickup_confirmed_at,
    p_pickup_confirmed_at + interval '24 hours',
    'held'
  )
  on conflict (registration_id) do update
    set status = 'held',
        pickup_confirmed_at = excluded.pickup_confirmed_at,
        auto_release_at = excluded.auto_release_at,
        released_at = null,
        release_destination = null;
end;
$$;

create or replace function public.confirm_pickup(
  p_registration_id uuid,
  p_method text,
  p_code text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_notes text default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_reg_umkm uuid;
  v_status public.registration_status;
  v_is_supplier boolean;
  v_is_umkm boolean;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_registration_id is null then
    raise exception 'registration id is required';
  end if;
  if p_method not in ('qr', 'pin') then
    raise exception 'method must be qr or pin';
  end if;

  select r.umkm_id, r.status into v_reg_umkm, v_status
    from public.registrations r
   where r.id = p_registration_id;
  if not found then
    raise exception 'registration not found';
  end if;

  select b.supplier_id into v_supplier_id
    from public.registrations r
    join public.batches b on b.id = r.batch_id
   where r.id = p_registration_id;

  v_is_supplier := (auth.uid() = v_supplier_id) and public.is_supplier();
  v_is_umkm := (auth.uid() = v_reg_umkm);

  if not v_is_supplier and not v_is_umkm and not public.is_admin() then
    raise exception 'only the owning supplier, the UMKM, or an admin may confirm pickup';
  end if;

  -- Only paid registrations may be picked up.
  if v_status <> 'paid' then
    if v_status = 'picked_up' then
      raise exception 'registration is already picked up';
    end if;
    raise exception 'registration is not eligible for pickup (status %s)', v_status;
  end if;

  -- Validate the presented code against pickup_codes (if provided).
  if p_method = 'qr' then
    if p_code is null then
      raise exception 'qr code is required';
    end if;
    if not exists (
      select 1 from public.pickup_codes pc
       where pc.registration_id = p_registration_id
         and pc.qr_code_token = p_code
         and pc.used_at is null
    ) then
      raise exception 'invalid or already-used qr code';
    end if;
  else
    if p_code is null then
      raise exception 'pin is required';
    end if;
    if not exists (
      select 1 from public.pickup_codes pc
       where pc.registration_id = p_registration_id
         and pc.pin_code = p_code
         and pc.used_at is null
    ) then
      raise exception 'invalid or already-used pin';
    end if;
  end if;

  update public.pickup_codes
     set used_at = now(), used_by_supplier_id = auth.uid()
   where registration_id = p_registration_id;

  insert into public.pickup_events (
    registration_id, supplier_id, method, latitude, longitude, notes
  ) values (
    p_registration_id, auth.uid(), p_method, p_latitude, p_longitude, p_notes
  );

  -- Mark the registration picked up and open the 24h escrow hold.
  update public.registrations
     set status = 'picked_up', updated_at = now()
   where id = p_registration_id;

  perform public.create_escrow(p_registration_id, now());
end;
$$;

revoke execute on function public.generate_pickup_code(uuid, text, text) from public, anon;
grant execute on function public.generate_pickup_code(uuid, text, text) to authenticated;
revoke execute on function public.confirm_pickup(uuid, text, text, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.confirm_pickup(uuid, text, text, numeric, numeric, text, text, text) to authenticated;

-- list_batch_orders: supplier order-dashboard for a batch.
create or replace function public.list_batch_orders(p_batch_id uuid)
returns table (
  registration_id uuid,
  umkm_name text,
  quantity integer,
  status public.registration_status,
  final_amount numeric,
  lock_tier integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    p.full_name,
    r.quantity,
    r.status,
    r.final_amount,
    r.locked_tier_number,
    r.created_at
    from public.registrations r
    join public.profiles p on p.id = r.umkm_id
   where r.batch_id = p_batch_id
     and (
       exists (select 1 from public.batches b where b.id = p_batch_id and b.supplier_id = auth.uid())
       or public.is_admin()
     )
   order by r.created_at;
$$;

revoke execute on function public.list_batch_orders(uuid) from public, anon;
grant execute on function public.list_batch_orders(uuid) to authenticated;
