-- A courier ("recolectora") accepts or rejects each delivery (roadmap item 4, approved
-- 2026-11-20).
--
-- Before: choosing a courier at checkout assigned her straight away, without asking her. Now
-- choosing her sends a request she accepts or rejects from her "Solicitudes" page.
--
-- Decisions:
--   * A request waits up to 2 hours. With no answer by then it is "expired". Like
--     release_expired_reservations there is no scheduler: every call that releases stale
--     reservations first expires stale requests (private.expire_courier_requests), and that
--     call already runs on the catalog, the cart, /cuenta, the panels and every reservation
--     function.
--   * IMPORTANT (money): while a request waits, the buyer cannot pay. The deposit may carry the
--     courier's fee ("with_deposit"), and she must not pay a fee to someone who then says no;
--     the seller cannot confirm a deposit whose amount can still change either. The 24-hour
--     payment clock starts when the courier accepts. Enforced in submit_deposit_proof, the
--     storage upload policy and update_reservation('confirm'), not only on screen.
--   * Rejected or expired: the buyer has 12 hours (the same grace a rejected proof gets) to ask
--     another courier or switch to a fixed point or home delivery (change_reservation_delivery);
--     otherwise the garments are released like any unpaid reservation. A courier who said no
--     is not asked again for the same reservation, and one reservation sends at most 3
--     requests, so a hold cannot be stretched by asking courier after courier.
--   * Before accepting, a courier sees what she needs to decide (store, pickup point, the
--     buyer's municipality, the garments, her fee): not the buyer's name, phone or address.
--     Those come with the job once she accepts, and so does her own phone for the buyer.
--   * Reservations made before this migration with a courier keep her: they are recorded as
--     accepted (backfill below), so deliveries already in progress do not change.
--   * The chat between buyer, seller and courier comes in a later change; it will hang off
--     courier_requests / reservations, nothing here needs to change for it.

-- ---------------------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------------------

create type public.courier_request_status as enum (
  'requested', -- waiting for the courier (2 h)
  'accepted',  -- she takes the job; the buyer can pay
  'rejected',  -- she said no (optional reason)
  'expired',   -- no answer in 2 h
  'withdrawn'  -- the buyer switched delivery or the reservation closed while it waited
);

create table public.courier_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  courier_id uuid not null references public.couriers (id) on delete cascade,
  status public.courier_request_status not null default 'requested',
  -- What she was offered, kept for her history even after the buyer switches delivery.
  fee_mxn integer not null check (fee_mxn >= 0),
  fee_payment public.courier_fee_payment not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- When it stopped waiting, whatever the outcome.
  resolved_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(rejection_reason) between 1 and 160),
  constraint courier_requests_resolved check ((status = 'requested') = (resolved_at is null)),
  constraint courier_requests_reason_only_on_reject check (rejection_reason is null or status = 'rejected')
);

-- One live request per reservation: waiting or accepted. The last line of defence against two
-- couriers holding the same delivery.
create unique index courier_requests_one_live_per_reservation
  on public.courier_requests (reservation_id) where status in ('requested', 'accepted');
create index courier_requests_courier_idx on public.courier_requests (courier_id, status, requested_at desc);
create index courier_requests_reservation_idx on public.courier_requests (reservation_id, requested_at desc);
create index courier_requests_waiting_expiry_idx on public.courier_requests (expires_at) where status = 'requested';

alter table public.reservations
  -- Set when the courier accepts. With delivery_method = 'courier':
  --   courier_id set, courier_accepted_at null  -> waiting for her answer
  --   courier_id set, courier_accepted_at set   -> she has the job; the buyer can pay
  --   courier_id null                           -> she said no or didn't answer; the buyer
  --                                                must choose again (see courier_requests)
  add column courier_accepted_at timestamptz;

grant select (courier_accepted_at) on public.reservations to authenticated;

-- Backfill: every courier assigned before this migration counts as having accepted.
update public.reservations
set courier_accepted_at = coalesce(confirmed_at, created_at)
where courier_id is not null;

insert into public.courier_requests (
  reservation_id, courier_id, status, fee_mxn, fee_payment, requested_at, expires_at, resolved_at
)
select r.id, r.courier_id, 'accepted', r.delivery_fee_mxn, coalesce(r.courier_fee_payment, 'on_delivery'),
       r.created_at, r.created_at + interval '2 hours', r.courier_accepted_at
from public.reservations r
where r.courier_id is not null;

alter table public.courier_requests enable row level security;

-- The courier reads her own requests; the buyer and the seller read the requests of their
-- reservations (so each sees who said no and why). Writes go only through the functions below.
create policy "Courier, buyer, seller and admins read courier requests"
on public.courier_requests for select to authenticated
using (
  courier_id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1 from public.reservations r
    where r.id = courier_requests.reservation_id
      and (r.buyer_id = (select auth.uid()) or r.seller_id = (select auth.uid()))
  )
);

-- Supabase grants new public tables to anon and authenticated in full; narrow it so the policy
-- is not the only guard.
revoke all on public.courier_requests from anon, authenticated;
grant select on public.courier_requests to authenticated;

-- ---------------------------------------------------------------------------------------
-- A courier reads a reservation only once she accepted it
-- ---------------------------------------------------------------------------------------

drop policy "Buyer, seller, courier and admins read reservations" on public.reservations;
create policy "Buyer, seller, accepted courier and admins read reservations"
on public.reservations for select to authenticated
using (
  buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
  or (courier_id = (select auth.uid()) and courier_accepted_at is not null)
  or (select private.is_admin())
);

drop policy "Readers of a reservation read its items" on public.reservation_items;
create policy "Readers of a reservation read its items"
on public.reservation_items for select to authenticated
using (exists (
  select 1 from public.reservations r
  where r.id = reservation_items.reservation_id
    and (r.buyer_id = (select auth.uid()) or r.seller_id = (select auth.uid())
         or (r.courier_id = (select auth.uid()) and r.courier_accepted_at is not null)
         or (select private.is_admin()))
));

drop policy "Buyer reads own profile, admins all, sellers and couriers their buyers" on public.buyer_profiles;
create policy "Buyer reads own profile, admins all, sellers and accepted couriers their buyers"
on public.buyer_profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1 from public.reservations r
    where r.buyer_id = buyer_profiles.id
      and (r.seller_id = (select auth.uid())
           or (r.courier_id = (select auth.uid()) and r.courier_accepted_at is not null))
  )
);

-- ---------------------------------------------------------------------------------------
-- Shared pieces
-- ---------------------------------------------------------------------------------------

-- The garments' share of the deposit, rounded up to whole pesos so the transfer is easy to
-- type. Same rule since 20261118000100.
create function private.garments_deposit(items_total_mxn integer, deposit_percent smallint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select ceil(items_total_mxn * deposit_percent / 100.0 / 100.0)::integer * 100;
$$;

-- What a delivery choice costs for one seller, or an error if she doesn't offer it. Moved out
-- of reserve_cart_from_seller (20261123000100) unchanged so change_reservation_delivery checks
-- a new choice by exactly the same rules.
create function private.quote_delivery(
  target_seller uuid,
  method public.delivery_method,
  point uuid,
  address text,
  courier uuid,
  municipality text,
  fee_payment public.courier_fee_payment,
  out fee integer,
  out fee_estimate integer,
  out origin text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  seller record;
  offers_points boolean;
begin
  fee := 0;

  -- Home delivery counts as offered only with an origin to price it from.
  select p.home_delivery_origin, (p.home_delivery_enabled and p.home_delivery_origin is not null) as offers_home
  into seller
  from public.profiles p
  where p.id = target_seller;
  if not found then raise exception 'seller_unavailable'; end if;

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
    if not seller.offers_home or municipality is null
       or address is null or length(trim(address)) < 10 then
      raise exception 'invalid_delivery';
    end if;
    select r.fee_mxn into fee
    from public.delivery_zone_rates r
    where r.origin_municipality = seller.home_delivery_origin
      and r.destination_municipality = municipality;
    if not found then raise exception 'no_delivery_rate'; end if;
    fee_estimate := fee;
    origin := seller.home_delivery_origin;
  elsif method = 'courier' then
    if courier is null or municipality is null or fee_payment is null
       or address is null or length(trim(address)) < 10 then
      raise exception 'invalid_delivery';
    end if;
    select c.fee_mxn into fee from public.couriers c
    where c.id = courier and c.status = 'approved' and municipality = any (c.municipalities)
      and exists (
        select 1 from public.courier_pickup_points cp
        join public.seller_delivery_points sp on sp.point_id = cp.point_id and sp.seller_id = target_seller
        join public.delivery_points dp on dp.id = cp.point_id and dp.active
        where cp.courier_id = c.id
      );
    if not found then raise exception 'invalid_delivery'; end if;
  elsif method = 'arranged' then
    if offers_points or seller.offers_home then raise exception 'invalid_delivery'; end if;
  end if;
end;
$$;

-- A request ended without a yes (rejected or expired): the courier is off the reservation and
-- the buyer has 12 hours from that moment to choose again. `at` is when it ended, not now():
-- a request expired lazily an hour late still gives the buyer 12 hours from its real end.
create function private.courier_request_failed(target uuid, at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reservations
  set courier_id = null, courier_accepted_at = null, courier_whatsapp = null,
      expires_at = at + interval '12 hours'
  where id = target and status = 'pending_deposit';
end;
$$;

-- Expires every request past its 2 hours. Locks the reservation before the request, the same
-- order accept/reject/change use, so they cannot deadlock against each other.
create function private.expire_courier_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
  expired integer := 0;
begin
  for stale in
    select q.id, q.reservation_id, q.expires_at
    from public.reservations r
    join public.courier_requests q on q.reservation_id = r.id
    where q.status = 'requested' and q.expires_at < now()
    for update of r skip locked
  loop
    update public.courier_requests
    set status = 'expired', resolved_at = stale.expires_at
    where id = stale.id and status = 'requested';
    if found then
      perform private.courier_request_failed(stale.reservation_id, stale.expires_at);
      expired := expired + 1;
    end if;
  end loop;
  return expired;
end;
$$;

-- Functions are executable by PUBLIC by default; these are internal.
revoke execute on function private.quote_delivery(uuid, public.delivery_method, uuid, text, uuid, text, public.courier_fee_payment) from public, anon, authenticated;
revoke execute on function private.courier_request_failed(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.expire_courier_requests() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Lifecycle functions that now know about requests
-- ---------------------------------------------------------------------------------------

-- Same as 20261118000100, plus: a request still waiting when the reservation closes is
-- withdrawn, so it leaves the courier's inbox.
create or replace function private.release_reservation(target uuid, final_status public.reservation_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('closets.reservation_write', 'on', true);
  update public.reservations
  set status = final_status, closed_at = now()
  where id = target;

  update public.products p
  set sale_status = 'available', reserved_at = null
  from public.reservation_items ri
  where ri.reservation_id = target
    and ri.active
    and p.id = ri.product_id
    and p.sale_status = 'reserved';

  update public.reservation_items set active = false where reservation_id = target and active;

  update public.courier_requests
  set status = 'withdrawn', resolved_at = now()
  where reservation_id = target and status = 'requested';
  perform set_config('closets.reservation_write', 'off', true);
end;
$$;

-- Same rules as 20261120000100 (a proof under review stops the clock), plus: stale courier
-- requests expire first, and a reservation still waiting for a courier never expires on the
-- payment clock (it isn't running yet).
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
  released integer := 0;
begin
  perform private.expire_courier_requests();

  for stale in
    select r.id from public.reservations r
    where r.status = 'pending_deposit' and r.expires_at < now()
      and (r.proof_submitted_at is null or r.proof_rejected_at is not null)
      and not exists (
        select 1 from public.courier_requests q where q.reservation_id = r.id and q.status = 'requested'
      )
    for update skip locked
  loop
    perform private.release_reservation(stale.id, 'expired');
    released := released + 1;
  end loop;
  return released;
end;
$$;

-- Same signature and checks as 20261123000100. Changes for couriers: the reservation starts
-- waiting for her answer (a request with 2 hours), her phone is not copied yet, and the
-- deadline is the request's end plus the 12 hours to choose again; accepting resets it to 24
-- hours to pay.
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
  quote record;
  wanted uuid[];
  held uuid[];
  total integer;
  deposit integer;
  request_ends timestamptz := now() + interval '2 hours';
  new_reservation uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if caller = target_seller then raise exception 'own_products'; end if;
  if not exists (select 1 from public.buyer_profiles where id = caller) then
    raise exception 'buyer_profile_required';
  end if;

  perform public.release_expired_reservations();

  select s.clabe, s.whatsapp_e164, p.deposit_percent
  into seller_settings
  from public.seller_private_settings s
  join public.profiles p on p.id = s.seller_id
  where s.seller_id = target_seller and p.status = 'approved';
  if not found then raise exception 'seller_unavailable'; end if;
  if seller_settings.clabe is null then raise exception 'seller_without_clabe'; end if;

  select * into quote from private.quote_delivery(target_seller, method, point, address, courier, municipality, fee_payment);

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
  deposit := private.garments_deposit(total, seller_settings.deposit_percent);
  -- A home-delivery fee never rides in the deposit: it is paid at the door.
  if method = 'courier' and fee_payment = 'with_deposit' then
    deposit := deposit + quote.fee;
  end if;

  insert into public.reservations (
    buyer_id, seller_id, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, seller_whatsapp, expires_at,
    delivery_method, delivery_point_id, delivery_address, delivery_fee_mxn, delivery_pin,
    courier_id, courier_fee_payment, buyer_municipality,
    delivery_fee_estimate_mxn, delivery_origin_municipality
  ) values (
    caller, target_seller, total, seller_settings.deposit_percent, deposit,
    seller_settings.clabe, seller_settings.whatsapp_e164,
    case when method = 'courier' then request_ends + interval '12 hours' else now() + interval '24 hours' end,
    method,
    case when method = 'pickup_point' then point end,
    case when method in ('home_delivery', 'courier') then trim(address) end,
    quote.fee,
    lpad((floor(random() * 10000))::integer::text, 4, '0'),
    case when method = 'courier' then courier end,
    case when method = 'courier' then fee_payment end,
    case when method in ('home_delivery', 'courier') then municipality end,
    quote.fee_estimate,
    quote.origin
  ) returning id into new_reservation;

  if method = 'courier' then
    insert into public.courier_requests (reservation_id, courier_id, fee_mxn, fee_payment, expires_at)
    values (new_reservation, courier, quote.fee, fee_payment, request_ends);
  end if;

  insert into public.reservation_items (reservation_id, product_id, price_mxn)
  select new_reservation, p.id, p.price_mxn from public.products p where p.id = any (held);

  delete from public.cart_items where buyer_id = caller and product_id = any (held);
  perform set_config('closets.reservation_write', 'off', true);

  return new_reservation;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- The courier answers
-- ---------------------------------------------------------------------------------------

create function public.accept_courier_request(request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target uuid;
  r record;
  q record;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  perform public.release_expired_reservations();

  select reservation_id into target from public.courier_requests where id = request and courier_id = caller;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.reservations where id = target for update;
  select * into q from public.courier_requests where id = request for update;
  if q.status <> 'requested' or q.expires_at <= now()
     or r.status <> 'pending_deposit' or r.courier_id is distinct from caller then
    raise exception 'request_closed';
  end if;
  if not exists (select 1 from public.couriers where id = caller and status = 'approved') then
    raise exception 'courier_not_approved';
  end if;

  update public.courier_requests set status = 'accepted', resolved_at = now() where id = request;
  update public.reservations
  set courier_accepted_at = now(),
      courier_whatsapp = (select phone_e164 from public.courier_private where courier_id = caller),
      -- The payment clock starts now.
      expires_at = now() + interval '24 hours'
  where id = target;
end;
$$;

create function public.reject_courier_request(request uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  clean_reason text := nullif(trim(coalesce(reason, '')), '');
  target uuid;
  r record;
  q record;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if clean_reason is not null and length(clean_reason) > 160 then raise exception 'invalid_reason'; end if;
  perform public.release_expired_reservations();

  select reservation_id into target from public.courier_requests where id = request and courier_id = caller;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.reservations where id = target for update;
  select * into q from public.courier_requests where id = request for update;
  if q.status <> 'requested' or q.expires_at <= now()
     or r.status <> 'pending_deposit' or r.courier_id is distinct from caller then
    raise exception 'request_closed';
  end if;

  update public.courier_requests
  set status = 'rejected', resolved_at = now(), rejection_reason = clean_reason
  where id = request;
  perform private.courier_request_failed(target, now());
end;
$$;

-- What a courier sees in "Solicitudes": enough to decide, nothing about who the buyer is.
-- Store, the points where she'd collect (hers that the seller also reaches), the buyer's
-- municipality and the garments only while the request is live; for older ones, only the
-- outcome. Recent history only (14 days).
create function public.courier_request_inbox()
returns table (
  request_id uuid,
  status public.courier_request_status,
  requested_at timestamptz,
  expires_at timestamptz,
  resolved_at timestamptz,
  rejection_reason text,
  fee_mxn integer,
  fee_payment public.courier_fee_payment,
  store_name text,
  pickup_points text[],
  buyer_municipality text,
  garments text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.id, q.status, q.requested_at, q.expires_at, q.resolved_at, q.rejection_reason, q.fee_mxn, q.fee_payment,
    p.store_name,
    array(
      select dp.name
      from public.courier_pickup_points cp
      join public.seller_delivery_points sp on sp.point_id = cp.point_id and sp.seller_id = r.seller_id
      join public.delivery_points dp on dp.id = cp.point_id and dp.active
      where cp.courier_id = q.courier_id
      order by dp.sort_order
    ),
    case when q.status = 'requested' then r.buyer_municipality end,
    case when q.status = 'requested' then array(
      select pr.name
      from public.reservation_items ri
      join public.products pr on pr.id = ri.product_id
      where ri.reservation_id = r.id
      order by pr.name
    ) end
  from public.courier_requests q
  join public.reservations r on r.id = q.reservation_id
  join public.profiles p on p.id = r.seller_id
  where q.courier_id = (select auth.uid())
    and (q.status = 'requested' or q.requested_at > now() - interval '14 days')
  order by (q.status = 'requested') desc, q.requested_at desc;
$$;

revoke all on function public.accept_courier_request(uuid) from public, anon;
revoke all on function public.reject_courier_request(uuid, text) from public, anon;
revoke all on function public.courier_request_inbox() from public, anon;
grant execute on function public.accept_courier_request(uuid) to authenticated;
grant execute on function public.reject_courier_request(uuid, text) to authenticated;
grant execute on function public.courier_request_inbox() to authenticated;

-- ---------------------------------------------------------------------------------------
-- The buyer chooses again
-- ---------------------------------------------------------------------------------------

-- Only for a courier delivery that has no yes: one still waiting (its request is withdrawn) or
-- one the courier rejected or let expire. A new courier sends a new request (2 hours again); a
-- fixed point or home delivery proceeds normally, with 24 hours to pay from now. The deposit is
-- recomputed from the reservation's own snapshot (garments total and percent), so only the
-- courier fee part can change.
create function public.change_reservation_delivery(
  target uuid,
  method public.delivery_method,
  point uuid default null,
  address text default null,
  courier uuid default null,
  municipality text default null,
  fee_payment public.courier_fee_payment default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r record;
  quote record;
  request_ends timestamptz := now() + interval '2 hours';
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  perform public.release_expired_reservations();

  select * into r from public.reservations where id = target for update;
  if not found or r.buyer_id is distinct from caller then raise exception 'not_found'; end if;
  if r.status <> 'pending_deposit' then raise exception 'not_pending'; end if;
  if r.delivery_method <> 'courier' or r.courier_accepted_at is not null or r.proof_submitted_at is not null then
    raise exception 'delivery_locked';
  end if;

  select * into quote from private.quote_delivery(r.seller_id, method, point, address, courier, municipality, fee_payment);

  if method = 'courier' then
    if courier = r.courier_id then raise exception 'courier_unchanged'; end if;
    if exists (
      select 1 from public.courier_requests
      where reservation_id = target and courier_id = courier and status = 'rejected'
    ) then
      raise exception 'courier_declined';
    end if;
    if (select count(*) from public.courier_requests where reservation_id = target) >= 3 then
      raise exception 'too_many_courier_requests';
    end if;
  end if;

  update public.courier_requests
  set status = 'withdrawn', resolved_at = now()
  where reservation_id = target and status = 'requested';

  update public.reservations
  set delivery_method = method,
      delivery_point_id = case when method = 'pickup_point' then point end,
      delivery_address = case when method in ('home_delivery', 'courier') then trim(address) end,
      delivery_fee_mxn = quote.fee,
      delivery_fee_estimate_mxn = quote.fee_estimate,
      delivery_origin_municipality = quote.origin,
      delivery_fee_adjusted_at = null,
      delivery_fee_adjusted_by = null,
      buyer_municipality = case when method in ('home_delivery', 'courier') then municipality end,
      courier_id = case when method = 'courier' then courier end,
      courier_fee_payment = case when method = 'courier' then fee_payment end,
      courier_whatsapp = null,
      courier_accepted_at = null,
      deposit_mxn = private.garments_deposit(r.items_total_mxn, r.deposit_percent)
        + case when method = 'courier' and fee_payment = 'with_deposit' then quote.fee else 0 end,
      expires_at = case when method = 'courier' then request_ends + interval '12 hours' else now() + interval '24 hours' end
  where id = target;

  if method = 'courier' then
    insert into public.courier_requests (reservation_id, courier_id, fee_mxn, fee_payment, expires_at)
    values (target, courier, quote.fee, fee_payment, request_ends);
  end if;
end;
$$;

revoke all on function public.change_reservation_delivery(uuid, public.delivery_method, uuid, text, uuid, text, public.courier_fee_payment) from public, anon;
grant execute on function public.change_reservation_delivery(uuid, public.delivery_method, uuid, text, uuid, text, public.courier_fee_payment) to authenticated;

-- ---------------------------------------------------------------------------------------
-- No payment, confirmation or courier steps without an accepted courier
-- ---------------------------------------------------------------------------------------

-- Same as 20261118000200, plus: the seller cannot confirm a deposit while the courier hasn't
-- accepted (its amount can still change, and the buyer was told not to pay yet).
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
    if r.delivery_method = 'courier' and r.courier_accepted_at is null then
      raise exception 'courier_not_accepted';
    end if;
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

-- Same as 20261120000100, plus the courier rule above.
create or replace function public.submit_deposit_proof(target uuid, path text, method text, reference text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r record;
  clean_reference text := nullif(trim(coalesce(reference, '')), '');
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  perform public.release_expired_reservations();

  select * into r from public.reservations where id = target for update;
  if not found or r.buyer_id is distinct from caller then raise exception 'not_found'; end if;
  if r.status <> 'pending_deposit' then raise exception 'not_pending'; end if;
  if r.delivery_method = 'courier' and r.courier_accepted_at is null then raise exception 'courier_pending'; end if;
  if method not in ('transfer', 'oxxo') then raise exception 'invalid_method'; end if;
  if method = 'oxxo' and r.deposit_oxxo_card is null then raise exception 'invalid_method'; end if;
  if clean_reference is not null and length(clean_reference) > 40 then raise exception 'invalid_reference'; end if;
  if private.proof_reservation_id(path) is distinct from target
     or not exists (select 1 from storage.objects o where o.bucket_id = 'payment-proofs' and o.name = path) then
    raise exception 'invalid_proof';
  end if;

  update public.reservations
  set proof_path = path,
      proof_method = method,
      proof_reference = clean_reference,
      proof_submitted_at = now(),
      proof_rejected_at = null,
      proof_rejection_reason = null
  where id = target;
end;
$$;

-- Same as 20261120000100, plus the courier rule: no proof upload before she accepts.
create or replace function private.can_upload_deposit_proof(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reservations r
    where r.id = private.proof_reservation_id(object_name)
      and r.buyer_id = (select auth.uid())
      and r.status = 'pending_deposit'
      and (r.delivery_method <> 'courier' or r.courier_accepted_at is not null)
  );
$$;

-- Same as 20261118000300: only the courier who accepted moves the delivery forward.
create or replace function public.courier_update_reservation(target uuid, action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select * into r from public.reservations where id = target for update;
  if not found or r.courier_id is distinct from (select auth.uid()) or r.courier_accepted_at is null then
    raise exception 'not_found';
  end if;
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

-- Same as 20261118000300: the seller, an admin, or the courier who accepted.
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
    r.seller_id = (select auth.uid())
    or (r.courier_id = (select auth.uid()) and r.courier_accepted_at is not null)
    or private.is_admin()
  ) then
    raise exception 'not_found';
  end if;
  if r.status <> 'confirmed' then raise exception 'invalid_transition'; end if;
  if r.delivery_pin is distinct from pin then raise exception 'wrong_pin'; end if;
  perform private.complete_reservation(target);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Fix for 20261122000100 (store search), found while running the courier e2e
-- ---------------------------------------------------------------------------------------

-- products_search_idx is an expression index over private.product_search_document, so every
-- write to products evaluates private functions as the writing role. anon and authenticated
-- have had usage on the private schema since 20261114000100; service_role (maintenance scripts
-- and the e2e resets, which put garments back on sale) did not, so its updates to products
-- failed with "permission denied for schema private".
grant usage on schema private to service_role;
