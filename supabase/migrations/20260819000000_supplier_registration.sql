-- Wesup migration 0011: supplier registration staging and email lookup
-- Initial supplier registration collects business data and a business photo.
-- KTP/NIK remain nullable until the Admin KYC step.

alter table public.supplier_profiles
  alter column nik drop not null,
  alter column ktp_photo_url drop not null;

create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    'umkm'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(btrim(p_email))
  );
$$;

revoke execute on function public.is_email_registered(text)
  from public, anon, authenticated;
grant execute on function public.is_email_registered(text) to service_role;
