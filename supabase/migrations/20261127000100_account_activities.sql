-- One account, several activities (approved 2026-11-21, "accounts and menu" proposal).
--
-- Every account can buy. On top of that, any mix of:
--   * selling     -> a public.profiles row (the storefront), pending until an admin approves it;
--   * delivering  -> a public.couriers row, pending until an admin verifies her in person;
--   * administering -> a public.admins row (new).
--
-- Schema decision: the smallest change that lets one auth user hold any mix. Selling and
-- delivering already live in their own tables keyed by the auth user id, so one user could
-- already have both rows; nothing stopped it except the sign-up form. The one thing tied to
-- the wrong table was admin: profiles.role = 'admin' made "admin" a kind of store, so an admin
-- had to sell and could never be "just admin". Admin now has its own one-column table, and
-- private.is_admin() reads it, so every policy and function that already calls is_admin()
-- keeps working unchanged. profiles.role stays (old policies list it) but no longer grants
-- anything; every row is set back to 'seller'.
--
-- Also:
--   * added_by on profiles and couriers (and granted_by on admins): null = she signed up herself;
--     otherwise the admin who added her. The admin lists show "how she arrived".
--   * request_activity(): "Quiero vender" / "Quiero entregar" and the sign-up checkboxes create
--     the pending row for the signed-in account.
--   * admin_set_activities(): an admin grants (already approved / verified, the owner's default)
--     or removes activities. Removing selling or delivering suspends the row instead of deleting
--     it: products, reservations and ratings point at it.
--   * Accounts an admin creates by phone get account_type = 'added_by_admin', so the sign-up
--     trigger creates nothing; the admin's choices come right after through
--     admin_set_activities(). find_user_by_phone() lets the app server (secret key only) find an
--     existing account instead of failing.

-- ---------------------------------------------------------------------------------------
-- Admin as its own flag
-- ---------------------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null
);

insert into public.admins (user_id)
select id from public.profiles where role = 'admin' and status = 'approved'
on conflict do nothing;

update public.profiles set role = 'seller' where role = 'admin';

alter table public.admins enable row level security;

create policy "Each reads her own admin flag, admins read all"
on public.admins for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- Same signature as 20261114000100, so every policy that calls it keeps working.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------------------
-- How each person arrived
-- ---------------------------------------------------------------------------------------

alter table public.profiles add column added_by uuid references auth.users (id) on delete set null;
alter table public.couriers add column added_by uuid references auth.users (id) on delete set null;

-- Same rules as 20261114000300 (only admins change slug, role or status), plus added_by.
create or replace function private.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.slug is distinct from old.slug then
      raise exception 'Only an admin can change profile slugs';
    end if;
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an admin can change profile role or status';
    end if;
    if new.added_by is distinct from old.added_by then
      raise exception 'Only an admin can change who added an account';
    end if;
  end if;
  return new;
end;
$$;

-- Same as 20261118000300, plus added_by.
create or replace function private.guard_courier_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin()
     and (new.status is distinct from old.status or new.added_by is distinct from old.added_by) then
    raise exception 'Only an admin can approve or suspend a courier';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Creating the activity rows
-- ---------------------------------------------------------------------------------------

create function private.auth_phone_e164(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when u.phone is null or u.phone = '' then null
    when left(u.phone, 1) = '+' then u.phone
    else '+' || u.phone
  end
  from auth.users u where u.id = target;
$$;

-- The storefront row of a new seller, as the sign-up trigger always made it.
create function private.create_seller_row(target uuid, store text, initial_status public.seller_status, adder uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  phone text := private.auth_phone_e164(target);
begin
  insert into public.profiles (id, store_name, slug, status, added_by)
  values (
    target,
    coalesce(nullif(trim(store), ''), 'Mi closet'),
    'closet-' || right(replace(target::text, '-', ''), 8),
    initial_status,
    adder
  )
  on conflict (id) do nothing;
  insert into public.seller_private_settings (seller_id, phone_e164, whatsapp_e164)
  values (target, phone, phone)
  on conflict (seller_id) do nothing;
end;
$$;

create function private.create_courier_row(target uuid, display_name text, initial_status public.courier_status, adder uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Checked first rather than "on conflict do nothing": an existing courier may be passed no
  -- name, and the not-null check would fire before the conflict is noticed.
  if not exists (select 1 from public.couriers where id = target) then
    insert into public.couriers (id, full_name, status, added_by) values (target, display_name, initial_status, adder);
  end if;
  insert into public.courier_private (courier_id, phone_e164)
  values (target, private.auth_phone_e164(target))
  on conflict (courier_id) do nothing;
end;
$$;

-- The name to show for a courier when none is given: her buyer name, then her store name.
create function private.known_name(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(trim(full_name), '') from public.buyer_profiles where id = target),
    (select nullif(trim(store_name), '') from public.profiles where id = target)
  );
$$;

revoke execute on function private.auth_phone_e164(uuid) from public, anon, authenticated;
revoke execute on function private.create_seller_row(uuid, text, public.seller_status, uuid) from public, anon, authenticated;
revoke execute on function private.create_courier_row(uuid, text, public.courier_status, uuid) from public, anon, authenticated;
revoke execute on function private.known_name(uuid) from public, anon, authenticated;

-- "Quiero vender" / "Quiero entregar", and the sign-up checkboxes: the signed-in account asks for
-- an activity; it starts pending. Asking again is harmless (nothing changes).
create function public.request_activity(activity text, store_name text default null, full_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  name text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if activity = 'sell' then
    if store_name is not null and length(trim(store_name)) > 60 then raise exception 'invalid_store_name'; end if;
    perform private.create_seller_row(caller, store_name, 'pending', null);
  elsif activity = 'deliver' then
    name := coalesce(nullif(trim(full_name), ''), private.known_name(caller));
    if name is null or length(name) not between 2 and 80 then raise exception 'invalid_name'; end if;
    perform private.create_courier_row(caller, name, 'pending', null);
  else
    raise exception 'invalid_activity';
  end if;
end;
$$;

-- An admin grants or removes activities. true grants (already approved / verified: the owner
-- checks people before adding them), false removes (selling and delivering are suspended, not
-- deleted: products, reservations and ratings point at them), null leaves that activity as it
-- is, which is how "Agregar persona" adds to an existing account without touching the rest. An
-- admin cannot remove her own admin flag, so the site never ends up with nobody to manage it.
create function public.admin_set_activities(
  target uuid,
  sell boolean,
  deliver boolean,
  administer boolean,
  store_name text default null,
  full_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  name text;
begin
  if caller is null or not private.is_admin() then raise exception 'not_allowed'; end if;
  if not exists (select 1 from auth.users where id = target) then raise exception 'not_found'; end if;
  if target = caller and administer is false then raise exception 'own_admin'; end if;
  if store_name is not null and length(trim(store_name)) > 60 then raise exception 'invalid_store_name'; end if;

  if sell then
    perform private.create_seller_row(target, coalesce(store_name, full_name), 'approved', caller);
    update public.profiles set status = 'approved' where id = target and status <> 'approved';
  elsif sell is false then
    update public.profiles set status = 'suspended' where id = target and status <> 'suspended';
  end if;

  if deliver then
    name := coalesce(nullif(trim(full_name), ''), private.known_name(target));
    if not exists (select 1 from public.couriers where id = target) and (name is null or length(name) not between 2 and 80) then
      raise exception 'invalid_name';
    end if;
    perform private.create_courier_row(target, name, 'approved', caller);
    update public.couriers set status = 'approved' where id = target and status <> 'approved';
  elsif deliver is false then
    update public.couriers set status = 'suspended' where id = target and status <> 'suspended';
  end if;

  if administer then
    insert into public.admins (user_id, granted_by) values (target, caller) on conflict do nothing;
  elsif administer is false then
    delete from public.admins where user_id = target;
  end if;
end;
$$;

-- The app server finds an existing account by phone before creating one. Secret key only:
-- anyone else could probe which phones have an account.
create function public.find_user_by_phone(phone_e164 text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where phone = ltrim(phone_e164, '+') limit 1;
$$;

revoke all on function public.request_activity(text, text, text) from public, anon;
revoke all on function public.admin_set_activities(uuid, boolean, boolean, boolean, text, text) from public, anon;
revoke all on function public.find_user_by_phone(text) from public, anon, authenticated;
grant execute on function public.request_activity(text, text, text) to authenticated;
grant execute on function public.admin_set_activities(uuid, boolean, boolean, boolean, text, text) to authenticated;
grant execute on function public.find_user_by_phone(text) to service_role;

-- ---------------------------------------------------------------------------------------
-- Sign-up trigger: accounts an admin creates start empty
-- ---------------------------------------------------------------------------------------

-- Same as 20261118000300, plus the 'added_by_admin' branch.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_slug text := 'closet-' || right(replace(new.id::text, '-', ''), 8);
  v_phone_e164 text := case
    when new.phone is null or new.phone = '' then null
    when left(new.phone, 1) = '+' then new.phone
    else '+' || new.phone
  end;
begin
  if new.raw_user_meta_data ->> 'account_type' = 'added_by_admin' then
    return new;
  end if;

  if new.raw_user_meta_data ->> 'account_type' = 'buyer' then
    insert into public.buyer_profiles (id, full_name, facebook_url, phone_e164)
    values (
      new.id,
      trim(new.raw_user_meta_data ->> 'full_name'),
      trim(new.raw_user_meta_data ->> 'facebook_url'),
      v_phone_e164
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if new.raw_user_meta_data ->> 'account_type' = 'courier' then
    insert into public.couriers (id, full_name)
    values (new.id, trim(new.raw_user_meta_data ->> 'full_name'))
    on conflict (id) do nothing;
    insert into public.courier_private (courier_id, phone_e164)
    values (new.id, v_phone_e164)
    on conflict (courier_id) do nothing;
    return new;
  end if;

  insert into public.profiles (id, store_name, slug)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''), 'Mi closet'),
    generated_slug
  )
  on conflict (id) do nothing;

  insert into public.seller_private_settings (seller_id, phone_e164, whatsapp_e164)
  values (new.id, v_phone_e164, v_phone_e164)
  on conflict (seller_id) do update
    set phone_e164 = excluded.phone_e164,
        whatsapp_e164 = coalesce(public.seller_private_settings.whatsapp_e164, excluded.whatsapp_e164);

  return new;
end;
$$;
