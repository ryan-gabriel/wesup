-- Return an authentication error before checking ownership when no session is
-- present. This keeps direct RPC calls consistent with API 401 handling.
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
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'sign in required';
  end if;
  if p_batch_id is null then
    raise exception using errcode = '22023', message = 'batch id is required';
  end if;

  select supplier_id into v_supplier_id
    from public.batches
   where id = p_batch_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'batch not found';
  end if;
  if v_supplier_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'batch access denied';
  end if;
end;
$$;
