-- Verified couriers ("recolectoras"): a third delivery option. The courier collects the
-- package from the seller at a fixed point and brings it to the buyer's municipality.
--
-- Decisions (2026-11-17, with the store owner):
--   * Couriers sign up like sellers and stay pending until an admin approves them. Approval
--     is the "✓ Verificada" badge: admins check ID in person; no ID documents are stored.
--   * A courier lists the municipalities she covers, the fixed points where she collects, her
--     days, her time window and one flat fee.
--   * A buyer can pick a courier only if she covers the buyer's municipality and collects at
--     a point the seller also reaches.
--   * The buyer chooses how the fee is paid: to the courier on delivery, or added to the
--     deposit (the seller then pays the courier).
--   * Tracking adds "picked_up" (Con la recolectora). The courier completes with the PIN.
--   * After delivery the buyer rates the courier 1-5.

alter type public.delivery_method add value 'courier';
alter type public.delivery_status add value 'picked_up' before 'on_the_way';

create type public.courier_status as enum ('pending', 'approved', 'suspended');
create type public.courier_fee_payment as enum ('on_delivery', 'with_deposit');

-- The metro-area municipalities a courier can cover. Kept as a check rather than a table:
-- it changes rarely and a migration is the right place to change it.
create function private.is_known_municipality(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in (
    'Monterrey', 'San Nicolás de los Garza', 'Guadalupe', 'Apodaca', 'General Escobedo',
    'Santa Catarina', 'San Pedro Garza García', 'García', 'Juárez'
  );
$$;

create function private.are_known_municipalities(values_ text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(private.is_known_municipality(v)), true) from unnest(values_) as v;
$$;

create table public.couriers (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  status public.courier_status not null default 'pending',
  municipalities text[] not null default '{}' check (private.are_known_municipalities(municipalities)),
  -- 0 = domingo ... 6 = sábado
  days smallint[] not null default '{}' check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  time_window text check (time_window is null or length(time_window) <= 60),
  fee_mxn integer not null default 0 check (fee_mxn between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Phone lives apart so the public directory can read couriers without exposing it.
create table public.courier_private (
  courier_id uuid primary key references public.couriers (id) on delete cascade,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create table public.courier_pickup_points (
  courier_id uuid not null references public.couriers (id) on delete cascade,
  point_id uuid not null references public.delivery_points (id) on delete cascade,
  primary key (courier_id, point_id)
);

create trigger couriers_set_updated_at
before update on public.couriers
for each row execute function private.set_updated_at();

create function private.guard_courier_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() and new.status is distinct from old.status then
    raise exception 'Only an admin can approve or suspend a courier';
  end if;
  return new;
end;
$$;

create trigger couriers_guard
before update on public.couriers
for each row execute function private.guard_courier_changes();

alter table public.reservations
  add column courier_id uuid references public.couriers (id),
  add column courier_fee_payment public.courier_fee_payment,
  add column courier_whatsapp text,
  add column buyer_municipality text check (buyer_municipality is null or private.is_known_municipality(buyer_municipality)),
  add column courier_rating smallint check (courier_rating between 1 and 5);

create index reservations_courier_idx on public.reservations (courier_id, status) where courier_id is not null;

-- New accounts: account_type = 'courier' creates a pending courier.
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

-- ---------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------
alter table public.couriers enable row level security;
alter table public.courier_private enable row level security;
alter table public.courier_pickup_points enable row level security;

create policy "Anyone reads approved couriers; a courier herself; admins all"
on public.couriers for select to anon, authenticated
using (status = 'approved' or id = (select auth.uid()) or (select private.is_admin()));

create policy "Courier edits herself, admins all"
on public.couriers for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy "Courier and admins read the phone"
on public.courier_private for select to authenticated
using (courier_id = (select auth.uid()) or (select private.is_admin()));

create policy "Anyone reads courier pickup points"
on public.courier_pickup_points for select to anon, authenticated
using (true);

create policy "Courier manages her pickup points"
on public.courier_pickup_points for all to authenticated
using (courier_id = (select auth.uid()))
with check (courier_id = (select auth.uid()));

grant select on public.couriers, public.courier_pickup_points to anon, authenticated;
grant update on public.couriers to authenticated;
grant select on public.courier_private to authenticated;
grant insert, delete on public.courier_pickup_points to authenticated;

-- The courier assigned to a reservation reads it, its items and the buyer she delivers to.
drop policy "Buyer, seller and admins read reservations" on public.reservations;
create policy "Buyer, seller, courier and admins read reservations"
on public.reservations for select to authenticated
using (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
  or courier_id = (select auth.uid()) or (select private.is_admin())
);

drop policy "Readers of a reservation read its items" on public.reservation_items;
create policy "Readers of a reservation read its items"
on public.reservation_items for select to authenticated
using (exists (
  select 1 from public.reservations r
  where r.id = reservation_items.reservation_id
    and (r.buyer_id = (select auth.uid()) or r.seller_id = (select auth.uid())
         or r.courier_id = (select auth.uid()) or (select private.is_admin()))
));

drop policy "Buyer reads own profile, admins all, sellers their buyers" on public.buyer_profiles;
create policy "Buyer reads own profile, admins all, sellers and couriers their buyers"
on public.buyer_profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1 from public.reservations r
    where r.buyer_id = buyer_profiles.id
      and (r.seller_id = (select auth.uid()) or r.courier_id = (select auth.uid()))
  )
);

grant select (courier_id, courier_fee_payment, courier_whatsapp, buyer_municipality, courier_rating)
  on public.reservations to authenticated;

-- Public directory numbers: completed deliveries and average rating per courier.
create function public.courier_stats()
returns table (courier_id uuid, deliveries integer, rating numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select r.courier_id, count(*)::integer, round(avg(r.courier_rating), 1)
  from public.reservations r
  join public.couriers c on c.id = r.courier_id and c.status = 'approved'
  where r.status = 'completed'
  group by r.courier_id;
$$;

grant execute on function public.courier_stats() to anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Reserving with a courier
-- ---------------------------------------------------------------------------------------
drop function public.reserve_cart_from_seller(uuid, public.delivery_method, uuid, text);

create function public.reserve_cart_from_seller(
  target_seller uuid,
  method public.delivery_method default 'arranged',
  point uuid default null,
  address text default null,
  courier uuid default null,
  municipality text default null,
  fee_payment public.courier_fee_payment default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  seller_settings record;
  courier_row record;
  courier_phone text;
  offers_points boolean;
  wanted uuid[];
  held uuid[];
  total integer;
  fee integer := 0;
  deposit integer;
  new_reservation uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if caller = target_seller then raise exception 'own_products'; end if;
  if not exists (select 1 from public.buyer_profiles where id = caller) then
    raise exception 'buyer_profile_required';
  end if;

  perform public.release_expired_reservations();

  select s.clabe, s.whatsapp_e164, p.deposit_percent, p.home_delivery_enabled, p.home_delivery_fee_mxn
  into seller_settings
  from public.seller_private_settings s
  join public.profiles p on p.id = s.seller_id
  where s.seller_id = target_seller and p.status = 'approved';
  if not found then raise exception 'seller_unavailable'; end if;
  if seller_settings.clabe is null then raise exception 'seller_without_clabe'; end if;

  offers_points := exists (
    select 1 from public.seller_delivery_points sdp
    join public.delivery_points dp on dp.id = sdp.point_id and dp.active
    where sdp.seller_id = target_seller
  );

  if method = 'pickup_point' then
    if point is null or not exists (
      select 1 from public.seller_delivery_points sdp
      join public.delivery_points dp on dp.id = sdp.point_id and dp.active
      where sdp.seller_id = target_seller and sdp.point_id = point
    ) then raise exception 'invalid_delivery'; end if;
  elsif method = 'home_delivery' then
    if not seller_settings.home_delivery_enabled or address is null or length(trim(address)) < 10 then
      raise exception 'invalid_delivery';
    end if;
    fee := seller_settings.home_delivery_fee_mxn;
  elsif method = 'courier' then
    if courier is null or municipality is null or fee_payment is null
       or address is null or length(trim(address)) < 10 then
      raise exception 'invalid_delivery';
    end if;
    select c.* into courier_row from public.couriers c
    where c.id = courier and c.status = 'approved' and municipality = any (c.municipalities)
      and exists (
        select 1 from public.courier_pickup_points cp
        join public.seller_delivery_points sp on sp.point_id = cp.point_id and sp.seller_id = target_seller
        join public.delivery_points dp on dp.id = cp.point_id and dp.active
        where cp.courier_id = c.id
      );
    if not found then raise exception 'invalid_delivery'; end if;
    select phone_e164 into courier_phone from public.courier_private where courier_id = courier;
    fee := courier_row.fee_mxn;
  elsif method = 'arranged' then
    if offers_points or seller_settings.home_delivery_enabled then raise exception 'invalid_delivery'; end if;
  end if;

  select array_agg(c.product_id) into wanted
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.buyer_id = caller and p.seller_id = target_seller;
  if wanted is null then raise exception 'empty_cart'; end if;

  perform set_config('closets.reservation_write', 'on', true);

  -- See the concurrency note in 20261118000100: a conditional UPDATE is the hold.
  with taken as (
    update public.products p
    set sale_status = 'reserved', reserved_at = now()
    where p.id = any (wanted)
      and p.seller_id = target_seller
      and p.sale_status = 'available'
      and p.publication_status = 'published'
      and not p.hidden_by_admin
    returning p.id
  )
  select array_agg(id) into held from taken;

  if held is null or cardinality(held) <> cardinality(wanted) then
    raise exception 'items_unavailable';
  end if;

  select sum(price_mxn) into total from public.products where id = any (held);
  deposit := ceil(total * seller_settings.deposit_percent / 100.0 / 100.0)::integer * 100;
  if method = 'courier' and fee_payment = 'with_deposit' then
    deposit := deposit + fee;
  end if;

  insert into public.reservations (
    buyer_id, seller_id, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, seller_whatsapp, expires_at,
    delivery_method, delivery_point_id, delivery_address, delivery_fee_mxn, delivery_pin,
    courier_id, courier_fee_payment, courier_whatsapp, buyer_municipality
  ) values (
    caller, target_seller, total, seller_settings.deposit_percent, deposit,
    seller_settings.clabe, seller_settings.whatsapp_e164, now() + interval '24 hours',
    method,
    case when method = 'pickup_point' then point end,
    case when method in ('home_delivery', 'courier') then trim(address) end,
    fee,
    lpad((floor(random() * 10000))::integer::text, 4, '0'),
    case when method = 'courier' then courier end,
    case when method = 'courier' then fee_payment end,
    case when method = 'courier' then courier_phone end,
    case when method = 'courier' then municipality end
  ) returning id into new_reservation;

  insert into public.reservation_items (reservation_id, product_id, price_mxn)
  select new_reservation, p.id, p.price_mxn from public.products p where p.id = any (held);

  delete from public.cart_items where buyer_id = caller and product_id = any (held);
  perform set_config('closets.reservation_write', 'off', true);

  return new_reservation;
end;
$$;

grant execute on function public.reserve_cart_from_seller(uuid, public.delivery_method, uuid, text, uuid, text, public.courier_fee_payment) to authenticated;

-- Courier steps on an assigned, confirmed reservation.
create function public.courier_update_reservation(target uuid, action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select * into r from public.reservations where id = target for update;
  if not found or r.courier_id is distinct from (select auth.uid()) then raise exception 'not_found'; end if;
  if r.status <> 'confirmed' then raise exception 'invalid_transition'; end if;
  if action = 'picked_up' and r.delivery_status = 'preparing' then
    update public.reservations set delivery_status = 'picked_up' where id = target;
  elsif action = 'on_the_way' and r.delivery_status in ('preparing', 'picked_up') then
    update public.reservations set delivery_status = 'on_the_way' where id = target;
  else
    raise exception 'invalid_transition';
  end if;
end;
$$;

grant execute on function public.courier_update_reservation(uuid, text) to authenticated;

-- The assigned courier can also finish a delivery with the buyer's PIN.
create or replace function public.complete_reservation_with_pin(target uuid, pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select * into r from public.reservations where id = target for update;
  if not found or not (
    r.seller_id = (select auth.uid()) or r.courier_id = (select auth.uid()) or private.is_admin()
  ) then
    raise exception 'not_found';
  end if;
  if r.status <> 'confirmed' then raise exception 'invalid_transition'; end if;
  if r.delivery_pin is distinct from pin then raise exception 'wrong_pin'; end if;
  perform private.complete_reservation(target);
end;
$$;

-- The buyer rates her courier once, after delivery.
create function public.rate_courier(target uuid, stars smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if stars not between 1 and 5 then raise exception 'invalid_rating'; end if;
  update public.reservations
  set courier_rating = stars
  where id = target and buyer_id = (select auth.uid()) and status = 'completed'
    and courier_id is not null and courier_rating is null;
  if not found then raise exception 'cannot_rate'; end if;
end;
$$;

grant execute on function public.rate_courier(uuid, smallint) to authenticated;
