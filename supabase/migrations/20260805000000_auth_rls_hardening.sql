create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
          new.phone, 'umkm')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke update on public.profiles from authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;

revoke insert, update on public.supplier_profiles from authenticated;
grant insert (user_id, business_name, address, latitude, longitude, business_photo_url, ktp_photo_url, nik)
  on public.supplier_profiles to authenticated;
grant update (business_name, address, latitude, longitude, business_photo_url, ktp_photo_url, nik, updated_at)
  on public.supplier_profiles to authenticated;

create or replace function public.approve_supplier(p_user_id uuid) returns void
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
end;
$$;

revoke execute on function public.approve_supplier(uuid) from public, anon;
grant execute on function public.approve_supplier(uuid) to authenticated;

create or replace function public.is_admin() returns boolean
  language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_supplier() returns boolean
  language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'supplier' and status = 'active');
$$;

create or replace function public.promote_supplier_on_approval() returns trigger
  language plpgsql security definer as $$
begin
  if new.verification_status = 'approved' then
    update public.profiles set role = 'supplier' where id = new.user_id and role = 'umkm';
  end if;
  return new;
end;
$$;

create trigger promote_supplier_on_approval
  after insert or update of verification_status on public.supplier_profiles
  for each row execute function public.promote_supplier_on_approval();
