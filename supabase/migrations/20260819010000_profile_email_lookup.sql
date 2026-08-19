-- Wesup migration 0012: normalized profile email lookup
-- Keep a queryable, unique email mirror in public.profiles for server-side
-- registration checks without exposing or querying the auth schema directly.

alter table public.profiles
  add column if not exists email text;

update public.profiles as profile
set email = lower(btrim(auth_user.email))
from auth.users as auth_user
where auth_user.id = profile.id
  and auth_user.email is not null;

alter table public.profiles
  add constraint profiles_email_normalized
  check (email is null or email = lower(btrim(email)));

create unique index profiles_email_lower_unique
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    lower(btrim(new.email)),
    'umkm'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_profile_email() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.profiles
  set email = lower(btrim(new.email)), updated_at = now()
  where id = new.id;
  return new;
end;
$$;

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.sync_profile_email()
  from public, anon, authenticated;

create trigger sync_profile_email_on_auth_update
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
