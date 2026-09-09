-- Keep replacement-photo updates and draft publication in a single database transaction.
create or replace function public.update_and_publish_supplier_batch(
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
begin
  perform public.assert_supplier_batch_owner(p_batch_id);
  perform public.update_supplier_batch(
    p_batch_id, p_title, p_description, p_category, p_min_quantity, p_product_photo_url,
    p_pickup_name, p_pickup_address, p_latitude, p_longitude,
    p_registration_opens_at, p_registration_closes_at, p_payment_opens_at,
    p_payment_closes_at, p_estimated_ready_at, p_tiers
  );
  perform public.publish_supplier_batch(p_batch_id, p_product_photo_url);
end;
$$;

revoke execute on function public.update_and_publish_supplier_batch(uuid, text, text, text, integer, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.update_and_publish_supplier_batch(uuid, text, text, text, integer, text, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) to authenticated;
