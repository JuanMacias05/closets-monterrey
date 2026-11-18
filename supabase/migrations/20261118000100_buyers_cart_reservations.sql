-- Project 2: buyer accounts, favorites, cart and deposit-backed reservations ("apartados").
--
-- Decisions (2026-11-17, with the store owner):
--   * Anyone browses; saving a favorite or a cart item needs an account.
--   * Buyers sign up with phone OTP plus their name and a Facebook profile link. They do not
--     get a public.profiles row: that table is the public storefront of a seller, and a
--     buyer's name must never be readable by anonymous visitors.
--   * Reserving ("apartar") is per seller. The buyer has 24 hours to transfer the deposit
--     (10% or 20%, chosen by each seller) to the seller's CLABE; the seller confirms it, then
--     marks the hand-off as delivered. The rest is paid at delivery, outside the app.
--   * An unpaid reservation releases its garments by itself after 24 hours.
--   * Trust light per buyer: automatic from her history, with an admin override.

-- ---------------------------------------------------------------------------------------
-- Buyers
-- ---------------------------------------------------------------------------------------
create type public.buyer_trust as enum ('green', 'yellow', 'red');

create table public.buyer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  facebook_url text not null,
  phone_e164 text,
  -- Set only by admins. null = use the automatic light.
  trust_override public.buyer_trust,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_full_name_length check (length(trim(full_name)) between 2 and 80),
  constraint buyer_facebook_url_format check (
    facebook_url ~* '^https://([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)/.+'
  ),
  constraint buyer_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create trigger buyer_profiles_set_updated_at
before update on public.buyer_profiles
for each row execute function private.set_updated_at();

create function private.guard_buyer_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.trust_override is distinct from old.trust_override then
      raise exception 'Only an admin can change a buyer trust light';
    end if;
    if new.phone_e164 is distinct from old.phone_e164 then
      raise exception 'The buyer phone mirrors the login phone and cannot be edited';
    end if;
  end if;
  return new;
end;
$$;

create trigger buyer_profiles_guard
before update on public.buyer_profiles
for each row execute function private.guard_buyer_profile_changes();

-- New accounts: buyers sign up with account_type = 'buyer' in their metadata; everyone else
-- keeps the original seller path (pending profile + private settings).
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

-- Sellers set how big a deposit they ask for. It lives on the public profile (not the
-- private settings) because shoppers see it in their cart before reserving.
alter table public.profiles
  add column deposit_percent smallint not null default 20,
  add constraint profiles_deposit_percent_allowed check (deposit_percent in (10, 20));

-- Whether a seller can take reservations (has a CLABE), without exposing the CLABE itself.
create function public.sellers_accepting_reservations(seller_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.seller_id from public.seller_private_settings s
  where s.seller_id = any (seller_ids) and s.clabe is not null;
$$;

grant execute on function public.sellers_accepting_reservations(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Favorites and cart (private to each account)
-- ---------------------------------------------------------------------------------------
create table public.favorites (
  buyer_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, product_id)
);

create table public.cart_items (
  buyer_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, product_id)
);

-- ---------------------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------------------
create type public.reservation_status as enum (
  'pending_deposit', -- garments held; waiting for the transfer (24 h)
  'confirmed',       -- seller saw the deposit; garments stay "Apartada"
  'completed',       -- delivered; garments become "Vendida"
  'expired',         -- no deposit in time; garments released
  'cancelled',       -- cancelled by the buyer or the seller; garments released
  'no_show'          -- seller reports the buyer flaked; garments released, light goes red
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  status public.reservation_status not null default 'pending_deposit',
  items_total_mxn integer not null check (items_total_mxn >= 0),
  deposit_percent smallint not null check (deposit_percent in (10, 20)),
  deposit_mxn integer not null check (deposit_mxn >= 0),
  -- Snapshot: the buyer must see where to transfer even if the seller edits it later.
  deposit_clabe text not null check (deposit_clabe ~ '^[0-9]{18}$'),
  -- So the buyer can reach the seller to arrange delivery.
  seller_whatsapp text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  closed_at timestamptz
);

create index reservations_buyer_idx on public.reservations (buyer_id, created_at desc);
create index reservations_seller_idx on public.reservations (seller_id, status, created_at desc);
create index reservations_pending_expiry_idx on public.reservations (expires_at) where status = 'pending_deposit';

create table public.reservation_items (
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  price_mxn integer not null check (price_mxn >= 0),
  -- true while the reservation holds the garment. The partial unique index below is the
  -- last line of defence against selling one piece twice.
  active boolean not null default true,
  primary key (reservation_id, product_id)
);

create unique index reservation_items_one_active_hold
  on public.reservation_items (product_id) where active;

-- ---------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------
alter table public.buyer_profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.cart_items enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;

create policy "Buyer reads own profile, admins all, sellers their buyers"
on public.buyer_profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1 from public.reservations r
    where r.buyer_id = buyer_profiles.id and r.seller_id = (select auth.uid())
  )
);

-- A seller who also shops creates her buyer profile from the checkout form.
create policy "Account creates its own buyer profile"
on public.buyer_profiles for insert to authenticated
with check (id = (select auth.uid()) and trust_override is null);

create policy "Buyer edits own profile, admins all"
on public.buyer_profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy "Own favorites"
on public.favorites for all to authenticated
using (buyer_id = (select auth.uid()))
with check (buyer_id = (select auth.uid()));

create policy "Own cart"
on public.cart_items for all to authenticated
using (buyer_id = (select auth.uid()))
with check (buyer_id = (select auth.uid()));

create policy "Buyer, seller and admins read reservations"
on public.reservations for select to authenticated
using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select private.is_admin()));

create policy "Readers of a reservation read its items"
on public.reservation_items for select to authenticated
using (exists (
  select 1 from public.reservations r
  where r.id = reservation_items.reservation_id
    and (r.buyer_id = (select auth.uid()) or r.seller_id = (select auth.uid()) or (select private.is_admin()))
));

grant select, insert, update on public.buyer_profiles to authenticated;
grant select, insert, delete on public.favorites, public.cart_items to authenticated;
-- Reservations change only through the functions below, which hold the row locks.
grant select on public.reservations, public.reservation_items to authenticated;

-- ---------------------------------------------------------------------------------------
-- Reservation lifecycle
-- ---------------------------------------------------------------------------------------

-- Ends a reservation's hold: marks its items inactive and puts the garments back on sale.
-- Only garments still marked reserved go back to available; one a seller already sold by
-- hand stays sold.
create function private.release_reservation(target uuid, final_status public.reservation_status)
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
  perform set_config('closets.reservation_write', 'off', true);
end;
$$;

-- Releases every unpaid reservation past its 24 h. There is no scheduler: it runs lazily at
-- the start of every reservation call and on the catalog, carts and panels, so a garment is
-- back on sale the next time anyone looks at it.
create function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
  released integer := 0;
begin
  for stale in
    select id from public.reservations
    where status = 'pending_deposit' and expires_at < now()
    for update skip locked
  loop
    perform private.release_reservation(stale.id, 'expired');
    released := released + 1;
  end loop;
  return released;
end;
$$;

grant execute on function public.release_expired_reservations() to anon, authenticated;

-- Reserves the caller's cart items from one seller. All or nothing: if any garment is no
-- longer available, nothing is reserved and the caller gets 'items_unavailable'.
--
-- IMPORTANT (concurrency): the hold is a conditional UPDATE ... WHERE sale_status =
-- 'available'. Two buyers racing for the same piece serialise on that row lock; the second
-- one re-checks the condition after the first commits, matches zero rows, and fails. Never
-- replace this with a read-then-write.
create function public.reserve_cart_from_seller(target_seller uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  seller_settings record;
  wanted uuid[];
  held uuid[];
  total integer;
  new_reservation uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if caller = target_seller then raise exception 'own_products'; end if;
  if not exists (select 1 from public.buyer_profiles where id = caller) then
    raise exception 'buyer_profile_required';
  end if;

  perform public.release_expired_reservations();
  perform set_config('closets.reservation_write', 'on', true);

  select s.clabe, s.whatsapp_e164, p.deposit_percent into seller_settings
  from public.seller_private_settings s
  join public.profiles p on p.id = s.seller_id
  where s.seller_id = target_seller and p.status = 'approved';
  if not found then raise exception 'seller_unavailable'; end if;
  if seller_settings.clabe is null then raise exception 'seller_without_clabe'; end if;

  select array_agg(c.product_id) into wanted
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.buyer_id = caller and p.seller_id = target_seller;
  if wanted is null then raise exception 'empty_cart'; end if;

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
    buyer_id, seller_id, items_total_mxn, deposit_percent, deposit_mxn, deposit_clabe, seller_whatsapp, expires_at
  ) values (
    caller, target_seller, total, seller_settings.deposit_percent,
    -- Rounded up to whole pesos so the transfer amount is easy to type.
    ceil(total * seller_settings.deposit_percent / 100.0 / 100.0)::integer * 100,
    seller_settings.clabe, seller_settings.whatsapp_e164, now() + interval '24 hours'
  ) returning id into new_reservation;

  insert into public.reservation_items (reservation_id, product_id, price_mxn)
  select new_reservation, p.id, p.price_mxn from public.products p where p.id = any (held);

  delete from public.cart_items where buyer_id = caller and product_id = any (held);
  perform set_config('closets.reservation_write', 'off', true);

  return new_reservation;
end;
$$;

grant execute on function public.reserve_cart_from_seller(uuid) to authenticated;

-- Seller (or admin) moves a reservation forward or closes it.
--   action 'confirm'  : pending_deposit -> confirmed
--   action 'complete' : confirmed       -> completed (garments sold)
--   action 'cancel'   : pending/confirmed -> cancelled (garments released)
--   action 'no_show'  : pending/confirmed -> no_show  (garments released, buyer light red)
-- The buyer may 'cancel' her own reservation while it is still pending_deposit.
create function public.update_reservation(target uuid, action text)
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
  elsif action = 'complete' and is_seller_side and r.status = 'confirmed' then
    perform set_config('closets.reservation_write', 'on', true);
    update public.reservations set status = 'completed', closed_at = now() where id = target;
    update public.products p
    set sale_status = 'sold', sold_at = now(), reserved_at = null
    from public.reservation_items ri
    where ri.reservation_id = target and ri.active and p.id = ri.product_id;
    update public.reservation_items set active = false where reservation_id = target and active;
    perform set_config('closets.reservation_write', 'off', true);
  elsif action in ('cancel', 'no_show') and is_seller_side and r.status in ('pending_deposit', 'confirmed') then
    perform private.release_reservation(target, action::public.reservation_status);
  elsif action = 'cancel' and r.buyer_id = caller and r.status = 'pending_deposit' then
    perform private.release_reservation(target, 'cancelled');
  else
    raise exception 'invalid_transition';
  end if;
end;
$$;

grant execute on function public.update_reservation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------
-- Trust light
-- ---------------------------------------------------------------------------------------
-- red    : an admin set it, or any seller reported a no-show
-- yellow : an admin set it, or she let a reservation expire
-- green  : an admin set it, or she completed at least one purchase
-- new    : no history yet
-- Only the buyer, admins and sellers she has reserved from may ask.
create function public.buyer_trust_light(target uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  override public.buyer_trust;
begin
  if caller is null or not (
    caller = target
    or private.is_admin()
    or exists (select 1 from public.reservations where buyer_id = target and seller_id = caller)
  ) then
    return null;
  end if;

  select trust_override into override from public.buyer_profiles where id = target;
  if override is not null then return override::text; end if;

  if exists (select 1 from public.reservations where buyer_id = target and status = 'no_show') then return 'red'; end if;
  if exists (select 1 from public.reservations where buyer_id = target and status = 'expired') then return 'yellow'; end if;
  if exists (select 1 from public.reservations where buyer_id = target and status = 'completed') then return 'green'; end if;
  return 'new';
end;
$$;

grant execute on function public.buyer_trust_light(uuid) to authenticated;

-- Builds on the 2c version of this guard (20261115000500_admin_product_visibility): keep its
-- admin rule. Two additions:
--   * The reservation functions above are trusted; they flag their writes and pass through.
--     Without this, an admin buying from another seller would trip the admin rule.
--   * Nobody changes the sale status of a piece an open reservation holds by hand (e.g.
--     marking it sold or available); the reservation screens own those transitions.
create or replace function private.guard_product_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  -- set_config lives in pg_catalog, which PostgREST does not expose, so a client cannot set
  -- this flag; only the reservation functions do, and they switch it off when done.
  if current_setting('closets.reservation_write', true) = 'on' then
    return new;
  end if;

  if new.sale_status is distinct from old.sale_status
     and exists (select 1 from public.reservation_items ri where ri.product_id = old.id and ri.active) then
    raise exception 'product_in_reservation';
  end if;

  if (select private.is_admin()) then
    if old.seller_id <> (select auth.uid())
       and (to_jsonb(new) - 'hidden_by_admin') is distinct from (to_jsonb(old) - 'hidden_by_admin') then
      raise exception 'Admins may only change hidden_by_admin on another seller product';
    end if;
    return new;
  end if;

  if new.hidden_by_admin is distinct from old.hidden_by_admin then
    raise exception 'Only an admin can hide a product';
  end if;

  if new.seller_id is distinct from old.seller_id then
    raise exception 'A product owner cannot be changed';
  end if;

  if new.publication_status = 'published'::public.product_publication_status
     and not exists (
       select 1 from public.profiles p
       where p.id = new.seller_id and p.status = 'approved'::public.seller_status
     ) then
    raise exception 'Only approved sellers can publish products';
  end if;

  return new;
end;
$$;
