-- Delivery for reservations: fixed meeting points, home delivery, tracking and a delivery PIN.
--
-- Decisions (2026-11-17, with the store owner):
--   * Admins manage a list of fixed points (metro stations to start). Each seller marks the
--     ones she reaches.
--   * Home delivery is the buyer's choice, offered only by sellers who enable it, at the
--     seller's own fee. The fee is paid at delivery with the rest of the price.
--   * A seller who offers neither falls back to "arranged": they agree on WhatsApp, as before.
--   * Tracking: Apartada -> En camino -> Entregada. Delivery is proven with a 4-digit PIN that
--     only the buyer sees; the seller enters it to mark the hand-off done.

create type public.delivery_method as enum ('pickup_point', 'home_delivery', 'arranged');
create type public.delivery_status as enum ('preparing', 'on_the_way', 'delivered');

create table public.delivery_points (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 80),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Fixed ids so seeds and tests can refer to them.
insert into public.delivery_points (id, name, sort_order) values
  ('60000000-0000-4000-8000-000000000001', 'Estación Padre Mier', 1),
  ('60000000-0000-4000-8000-000000000002', 'Estación San Nicolás', 2),
  ('60000000-0000-4000-8000-000000000003', 'Estación Cuauhtémoc', 3),
  ('60000000-0000-4000-8000-000000000004', 'Estación Aztlán', 4);

create table public.seller_delivery_points (
  seller_id uuid not null references public.profiles (id) on delete cascade,
  point_id uuid not null references public.delivery_points (id) on delete cascade,
  primary key (seller_id, point_id)
);

alter table public.profiles
  add column home_delivery_enabled boolean not null default false,
  add column home_delivery_fee_mxn integer not null default 0 check (home_delivery_fee_mxn between 0 and 100000),
  add column home_delivery_note text check (home_delivery_note is null or length(home_delivery_note) <= 200);

alter table public.reservations
  add column delivery_method public.delivery_method not null default 'arranged',
  add column delivery_point_id uuid references public.delivery_points (id),
  add column delivery_address text check (delivery_address is null or length(delivery_address) between 10 and 300),
  add column delivery_fee_mxn integer not null default 0 check (delivery_fee_mxn >= 0),
  add column delivery_status public.delivery_status not null default 'preparing',
  -- IMPORTANT: only the buyer may read this. Column privileges below hide it from the seller,
  -- who must hear it from the buyer at hand-off; that is what makes it proof of delivery.
  add column delivery_pin text check (delivery_pin is null or delivery_pin ~ '^[0-9]{4}$');

alter table public.delivery_points enable row level security;
alter table public.seller_delivery_points enable row level security;

create policy "Anyone reads active points, admins all"
on public.delivery_points for select to anon, authenticated
using (active or (select private.is_admin()));

create policy "Admins manage points"
on public.delivery_points for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Anyone reads which points sellers reach"
on public.seller_delivery_points for select to anon, authenticated
using (true);

create policy "Sellers manage their own points"
on public.seller_delivery_points for all to authenticated
using (seller_id = (select auth.uid()))
with check (seller_id = (select auth.uid()));

grant select on public.delivery_points, public.seller_delivery_points to anon, authenticated;
grant insert, update on public.delivery_points to authenticated;
grant insert, delete on public.seller_delivery_points to authenticated;

-- Hide the PIN column: reservations become readable column by column.
revoke select on public.reservations from authenticated;
grant select (
  id, buyer_id, seller_id, status, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe,
  seller_whatsapp, expires_at, created_at, confirmed_at, closed_at,
  delivery_method, delivery_point_id, delivery_address, delivery_fee_mxn, delivery_status
) on public.reservations to authenticated;

create function public.reservation_delivery_pin(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select delivery_pin from public.reservations
  where id = target and buyer_id = (select auth.uid());
$$;

grant execute on function public.reservation_delivery_pin(uuid) to authenticated;

-- Reserve now carries the delivery choice. Same all-or-nothing hold as before; see the
-- concurrency note on the original function in 20261118000100.
drop function public.reserve_cart_from_seller(uuid);

create function public.reserve_cart_from_seller(
  target_seller uuid,
  method public.delivery_method default 'arranged',
  point uuid default null,
  address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  seller_settings record;
  offers_points boolean;
  wanted uuid[];
  held uuid[];
  total integer;
  fee integer := 0;
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
  elsif method = 'arranged' then
    -- Only when the seller offers no point and no home delivery.
    if offers_points or seller_settings.home_delivery_enabled then raise exception 'invalid_delivery'; end if;
  end if;

  select array_agg(c.product_id) into wanted
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.buyer_id = caller and p.seller_id = target_seller;
  if wanted is null then raise exception 'empty_cart'; end if;

  perform set_config('closets.reservation_write', 'on', true);

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

  insert into public.reservations (
    buyer_id, seller_id, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, seller_whatsapp, expires_at,
    delivery_method, delivery_point_id, delivery_address, delivery_fee_mxn, delivery_pin
  ) values (
    caller, target_seller, total, seller_settings.deposit_percent,
    ceil(total * seller_settings.deposit_percent / 100.0 / 100.0)::integer * 100,
    seller_settings.clabe, seller_settings.whatsapp_e164, now() + interval '24 hours',
    method,
    case when method = 'pickup_point' then point end,
    case when method = 'home_delivery' then trim(address) end,
    fee,
    lpad((floor(random() * 10000))::integer::text, 4, '0')
  ) returning id into new_reservation;

  insert into public.reservation_items (reservation_id, product_id, price_mxn)
  select new_reservation, p.id, p.price_mxn from public.products p where p.id = any (held);

  delete from public.cart_items where buyer_id = caller and product_id = any (held);
  perform set_config('closets.reservation_write', 'off', true);

  return new_reservation;
end;
$$;

grant execute on function public.reserve_cart_from_seller(uuid, public.delivery_method, uuid, text) to authenticated;

-- Seller-side transitions. 'complete' without a PIN is now admin-only (for a buyer who lost
-- her code); sellers finish a delivery through complete_reservation_with_pin.
create or replace function public.update_reservation(target uuid, action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r record;
  is_seller_side boolean;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  perform public.release_expired_reservations();

  select * into r from public.reservations where id = target for update;
  if not found then raise exception 'not_found'; end if;

  is_seller_side := r.seller_id = caller or private.is_admin();

  if action = 'confirm' and is_seller_side and r.status = 'pending_deposit' then
    update public.reservations set status = 'confirmed', confirmed_at = now() where id = target;
  elsif action = 'on_the_way' and is_seller_side and r.status = 'confirmed' and r.delivery_status = 'preparing' then
    update public.reservations set delivery_status = 'on_the_way' where id = target;
  elsif action = 'complete' and private.is_admin() and r.status = 'confirmed' then
    perform private.complete_reservation(target);
  elsif action in ('cancel', 'no_show') and is_seller_side and r.status in ('pending_deposit', 'confirmed') then
    perform private.release_reservation(target, action::public.reservation_status);
  elsif action = 'cancel' and r.buyer_id = caller and r.status = 'pending_deposit' then
    perform private.release_reservation(target, 'cancelled');
  else
    raise exception 'invalid_transition';
  end if;
end;
$$;

create function private.complete_reservation(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('closets.reservation_write', 'on', true);
  update public.reservations
  set status = 'completed', delivery_status = 'delivered', closed_at = now()
  where id = target;
  update public.products p
  set sale_status = 'sold', sold_at = now(), reserved_at = null
  from public.reservation_items ri
  where ri.reservation_id = target and ri.active and p.id = ri.product_id;
  update public.reservation_items set active = false where reservation_id = target and active;
  perform set_config('closets.reservation_write', 'off', true);
end;
$$;

create function public.complete_reservation_with_pin(target uuid, pin text)
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
  if not found or not (r.seller_id = (select auth.uid()) or private.is_admin()) then
    raise exception 'not_found';
  end if;
  if r.status <> 'confirmed' then raise exception 'invalid_transition'; end if;
  if r.delivery_pin is distinct from pin then raise exception 'wrong_pin'; end if;
  perform private.complete_reservation(target);
end;
$$;

grant execute on function public.complete_reservation_with_pin(uuid, text) to authenticated;
