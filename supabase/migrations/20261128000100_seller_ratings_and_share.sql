-- Seller ratings and the "share your store" step (approved 2026-11-23).
--
-- Ratings mirror the courier ones (20261118000300: reservations.courier_rating, rate_courier,
-- courier_stats): the buyer rates the store once per reservation, after it is completed, 1 to 5
-- stars plus an optional short comment. The average and the count are public (store page,
-- "Vendido por"); the comments are for the seller and the admins only.
--
-- Decisions:
--   * Stars and comment live on the reservation, like courier_rating: one reservation, one
--     rating, enforced by "seller_rating is null" in rate_seller.
--   * Nobody rates herself: rate_seller refuses when buyer and seller are the same account (a
--     seller can't reserve her own garments anyway, but the rule must not depend on that).
--   * IMPORTANT (comments): clients never read seller_rating_comment as a column. The seller
--     reads her ratings through my_seller_ratings(), which leaves out comments an admin hid;
--     admins read them all through admin_seller_ratings() and hide one with
--     set_seller_rating_hidden(). Hiding keeps the stars (the average doesn't change).
--   * store_shared_at on the seller's private settings: the checklist on her Inicio marks
--     "Comparte tu tienda" done the first time she uses the share button on her store.

alter table public.reservations
  add column seller_rating smallint check (seller_rating between 1 and 5),
  add column seller_rating_comment text check (seller_rating_comment is null or length(seller_rating_comment) between 1 and 280),
  add column seller_rating_at timestamptz,
  add column seller_rating_hidden_at timestamptz;

-- Stars and dates only; the comment column is read through the functions below.
grant select (seller_rating, seller_rating_at) on public.reservations to authenticated;

create function public.rate_seller(target uuid, stars smallint, comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  clean_comment text := nullif(trim(coalesce(comment, '')), '');
  r record;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if stars is null or stars not between 1 and 5 then raise exception 'invalid_rating'; end if;
  if clean_comment is not null and length(clean_comment) > 280 then raise exception 'invalid_comment'; end if;
  select * into r from public.reservations where id = target for update;
  if not found or r.buyer_id is distinct from caller then raise exception 'cannot_rate'; end if;
  if r.seller_id = caller then raise exception 'own_store'; end if;
  if r.status <> 'completed' or r.seller_rating is not null then raise exception 'cannot_rate'; end if;
  update public.reservations
  set seller_rating = stars, seller_rating_comment = clean_comment, seller_rating_at = now()
  where id = target;
end;
$$;

-- Public numbers: ratings count and average per approved store.
create function public.seller_stats(seller_ids uuid[] default null)
returns table (seller_id uuid, ratings integer, rating numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select r.seller_id, count(*)::integer, round(avg(r.seller_rating), 1)
  from public.reservations r
  join public.profiles p on p.id = r.seller_id and p.status = 'approved'
  where r.seller_rating is not null and (seller_ids is null or r.seller_id = any (seller_ids))
  group by r.seller_id;
$$;

-- The caller's ratings as a seller, newest first. Hidden comments come back as null.
create function public.my_seller_ratings()
returns table (reservation_id uuid, stars smallint, comment text, rated_at timestamptz, buyer_municipality text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.seller_rating,
    case when r.seller_rating_hidden_at is null then r.seller_rating_comment end,
    r.seller_rating_at, r.buyer_municipality
  from public.reservations r
  where r.seller_id = (select auth.uid()) and r.seller_rating is not null
  order by r.seller_rating_at desc;
$$;

-- Admins: every rating with a comment, to moderate.
create function public.admin_seller_ratings()
returns table (reservation_id uuid, store_name text, stars smallint, comment text, rated_at timestamptz, hidden boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  return query
  select r.id, p.store_name, r.seller_rating, r.seller_rating_comment, r.seller_rating_at, r.seller_rating_hidden_at is not null
  from public.reservations r
  join public.profiles p on p.id = r.seller_id
  where r.seller_rating_comment is not null
  order by r.seller_rating_at desc
  limit 200;
end;
$$;

create function public.set_seller_rating_hidden(target uuid, hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'not_allowed'; end if;
  update public.reservations
  set seller_rating_hidden_at = case when hidden then now() end
  where id = target and seller_rating_comment is not null;
  if not found then raise exception 'not_found'; end if;
end;
$$;

revoke all on function public.rate_seller(uuid, smallint, text) from public, anon;
revoke all on function public.my_seller_ratings() from public, anon;
revoke all on function public.admin_seller_ratings() from public, anon;
revoke all on function public.set_seller_rating_hidden(uuid, boolean) from public, anon;
grant execute on function public.rate_seller(uuid, smallint, text) to authenticated;
grant execute on function public.seller_stats(uuid[]) to anon, authenticated;
grant execute on function public.my_seller_ratings() to authenticated;
grant execute on function public.admin_seller_ratings() to authenticated;
grant execute on function public.set_seller_rating_hidden(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------
-- "Comparte tu tienda" on the seller's checklist
-- ---------------------------------------------------------------------------------------

alter table public.seller_private_settings add column store_shared_at timestamptz;
