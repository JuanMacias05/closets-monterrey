-- Home delivery priced by zone (roadmap item 3, approved 2026-11-20).
--
-- Before: each seller typed one fixed home-delivery fee (profiles.home_delivery_fee_mxn) and
-- had to guess what to charge. Now the fee comes from a table the admins manage: what it costs
-- to send from the seller's municipality (origin) to the buyer's (destination).
--
-- Decisions:
--   * Rates cover every (origin, destination) pair of the municipalities the app already knows
--     (private.is_known_municipality). The seeded $60 same municipality / $100 any other are
--     PLACEHOLDERS for the owner to replace from /panel/admin/tarifas-envio. updated_by stays
--     null until an admin saves an origin, which is how that page flags unreviewed prices.
--   * The seller says where she ships from (profiles.home_delivery_origin). Nothing else in the
--     app knows it reliably: fixed points have no municipality and the zones note is free text.
--     Without an origin there is no rate to look up, so home delivery is not offered even if
--     her switch is on; the panel asks her to pick one.
--   * Money rules do not change: the home-delivery fee is the seller's and is paid at the door
--     with the rest of the price. Only where the amount comes from changes.
--   * The reservation keeps the estimate the buyer saw (delivery_fee_estimate_mxn) and the fee
--     she will pay (delivery_fee_mxn, as before). The seller may change the latter for a
--     far-away address, but only while the buyer has not sent her deposit; see
--     adjust_delivery_fee below.
--   * profiles.home_delivery_fee_mxn is dropped so there is one source of truth. Reservations
--     already made keep their own copy in reservations.delivery_fee_mxn.

-- ---------------------------------------------------------------------------------------
-- Zone rates
-- ---------------------------------------------------------------------------------------

create table public.delivery_zone_rates (
  origin_municipality text not null check (private.is_known_municipality(origin_municipality)),
  destination_municipality text not null check (private.is_known_municipality(destination_municipality)),
  -- Whole pesos, up to $1,000: the same ceiling the old per-seller fee had.
  fee_mxn integer not null check (fee_mxn between 0 and 100000 and fee_mxn % 100 = 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (origin_municipality, destination_municipality)
);

create function private.stamp_zone_rate_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger delivery_zone_rates_stamp
before insert or update on public.delivery_zone_rates
for each row execute function private.stamp_zone_rate_change();

-- Placeholders only (see the header). Run as the migration, so updated_by is null: "nobody
-- has reviewed these yet". The list repeats private.is_known_municipality on purpose instead
-- of reading it from a shared function: that function runs inside check constraints, and a
-- lookup into the private schema there would break writes from roles without access to it
-- (service_role). If the two lists ever differ, the checks above make this insert fail.
insert into public.delivery_zone_rates (origin_municipality, destination_municipality, fee_mxn)
select origin, destination, case when origin = destination then 6000 else 10000 end
from unnest(array[
  'Monterrey', 'San Nicolás de los Garza', 'Guadalupe', 'Apodaca', 'General Escobedo',
  'Santa Catarina', 'San Pedro Garza García', 'García', 'Juárez'
]) as origin
cross join unnest(array[
  'Monterrey', 'San Nicolás de los Garza', 'Guadalupe', 'Apodaca', 'General Escobedo',
  'Santa Catarina', 'San Pedro Garza García', 'García', 'Juárez'
]) as destination;

alter table public.delivery_zone_rates enable row level security;

-- Buyers see the estimate in the cart and sellers' storefronts show the range, signed in or not.
create policy "Anyone reads zone rates"
on public.delivery_zone_rates for select to anon, authenticated
using (true);

create policy "Admins add zone rates"
on public.delivery_zone_rates for insert to authenticated
with check ((select private.is_admin()));

create policy "Admins change zone rates"
on public.delivery_zone_rates for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

-- Supabase grants every new public table to anon and authenticated in full; narrow that so a
-- missing policy is not the only guard. No delete for anyone: a missing pair would quietly
-- switch home delivery off for it.
revoke all on public.delivery_zone_rates from anon, authenticated;
grant select on public.delivery_zone_rates to anon, authenticated;
grant insert, update on public.delivery_zone_rates to authenticated;

-- ---------------------------------------------------------------------------------------
-- Where the seller ships from; the old fixed fee goes
-- ---------------------------------------------------------------------------------------

alter table public.profiles
  add column home_delivery_origin text
    check (home_delivery_origin is null or private.is_known_municipality(home_delivery_origin));

alter table public.profiles drop column home_delivery_fee_mxn;

-- ---------------------------------------------------------------------------------------
-- Estimate, final fee and the seller's adjustment on the reservation
-- ---------------------------------------------------------------------------------------

alter table public.reservations
  -- What the rate table said when the buyer reserved. Null for reservations made before
  -- zone rates (their seller set the fee) and for every other delivery method.
  add column delivery_fee_estimate_mxn integer check (delivery_fee_estimate_mxn is null or delivery_fee_estimate_mxn >= 0),
  -- Snapshot, like deposit_clabe: the estimate stays explainable if the seller moves.
  add column delivery_origin_municipality text
    check (delivery_origin_municipality is null or private.is_known_municipality(delivery_origin_municipality)),
  add column delivery_fee_adjusted_at timestamptz,
  add column delivery_fee_adjusted_by uuid references auth.users (id) on delete set null;

-- Column-by-column reads (20261118000200). delivery_fee_adjusted_by is left out on purpose: it
-- can be an admin's id, and the screens only need when it changed, not who pressed the button.
grant select (delivery_fee_estimate_mxn, delivery_origin_municipality, delivery_fee_adjusted_at)
  on public.reservations to authenticated;

-- ---------------------------------------------------------------------------------------
-- Reserving: the home-delivery fee comes from the rate table
-- ---------------------------------------------------------------------------------------

-- Same signature as 20261118000300, so grants and callers stay. `municipality`, until now only
-- for couriers, is also the buyer's municipality for home delivery.
create or replace function public.reserve_cart_from_seller(
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

  -- Home delivery counts as offered only with an origin to price it from.
  select s.clabe, s.whatsapp_e164, p.deposit_percent, p.home_delivery_origin,
         (p.home_delivery_enabled and p.home_delivery_origin is not null) as offers_home
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
    if not seller_settings.offers_home or municipality is null
       or address is null or length(trim(address)) < 10 then
      raise exception 'invalid_delivery';
    end if;
    select r.fee_mxn into fee
    from public.delivery_zone_rates r
    where r.origin_municipality = seller_settings.home_delivery_origin
      and r.destination_municipality = municipality;
    if not found then raise exception 'no_delivery_rate'; end if;
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
    if offers_points or seller_settings.offers_home then raise exception 'invalid_delivery'; end if;
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
  -- A home-delivery fee never rides in the deposit: it is paid at the door.
  if method = 'courier' and fee_payment = 'with_deposit' then
    deposit := deposit + fee;
  end if;

  insert into public.reservations (
    buyer_id, seller_id, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, seller_whatsapp, expires_at,
    delivery_method, delivery_point_id, delivery_address, delivery_fee_mxn, delivery_pin,
    courier_id, courier_fee_payment, courier_whatsapp, buyer_municipality,
    delivery_fee_estimate_mxn, delivery_origin_municipality
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
    case when method in ('home_delivery', 'courier') then municipality end,
    case when method = 'home_delivery' then fee end,
    case when method = 'home_delivery' then seller_settings.home_delivery_origin end
  ) returning id into new_reservation;

  insert into public.reservation_items (reservation_id, product_id, price_mxn)
  select new_reservation, p.id, p.price_mxn from public.products p where p.id = any (held);

  delete from public.cart_items where buyer_id = caller and product_id = any (held);
  perform set_config('closets.reservation_write', 'off', true);

  return new_reservation;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- The seller adjusts the home-delivery fee
-- ---------------------------------------------------------------------------------------

-- IMPORTANT (when): only while the reservation waits for its deposit AND the buyer has not
-- sent a proof. Once she says she paid she has committed money on the price she saw, so the
-- price is frozen, even if the seller later rejects the proof (she may well have paid). A
-- buyer who pays without uploading a proof is not protected by this; she still sees the change
-- in /cuenta and can cancel while the reservation is pending.
--
-- The buyer gets at least 12 more hours to decide on the new price, the same grace a rejected
-- proof gives. The deposit does not change: the fee is paid at the door.
create function public.adjust_delivery_fee(target uuid, new_fee integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r record;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if new_fee is null or new_fee < 0 or new_fee > 100000 or new_fee % 100 <> 0 then
    raise exception 'invalid_fee';
  end if;
  perform public.release_expired_reservations();

  select * into r from public.reservations where id = target for update;
  if not found or not (r.seller_id = caller or private.is_admin()) then raise exception 'not_found'; end if;
  if r.delivery_method <> 'home_delivery' then raise exception 'not_home_delivery'; end if;
  if r.status <> 'pending_deposit' then raise exception 'not_pending'; end if;
  if r.proof_submitted_at is not null then raise exception 'deposit_sent'; end if;
  if new_fee = r.delivery_fee_mxn then raise exception 'fee_unchanged'; end if;

  update public.reservations
  set delivery_fee_mxn = new_fee,
      delivery_fee_adjusted_at = now(),
      delivery_fee_adjusted_by = caller,
      expires_at = greatest(expires_at, now() + interval '12 hours')
  where id = target;
end;
$$;

revoke all on function public.adjust_delivery_fee(uuid, integer) from public, anon;
grant execute on function public.adjust_delivery_fee(uuid, integer) to authenticated;
