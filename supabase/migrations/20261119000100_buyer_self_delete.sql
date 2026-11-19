-- Self-service account deletion for shoppers ("Borrar mi cuenta" in /cuenta).
--
-- Reservations used to cascade away with the buyer's auth user. That erased the seller's sales
-- history and the courier's delivery count and ratings (courier_stats reads reservations) the
-- moment a shopper left. Now a deleted buyer's reservations stay, with buyer_id set to null and
-- her address cleared: the seller keeps "a sale happened", nobody keeps who or where.

alter table public.reservations alter column buyer_id drop not null;
alter table public.reservations drop constraint reservations_buyer_id_fkey;
alter table public.reservations
  add constraint reservations_buyer_id_fkey foreign key (buyer_id) references auth.users (id) on delete set null;

-- IMPORTANT: only a shopper with a clean record can delete herself. The trust light lives in
-- her reservations; if someone with a no-show could delete and sign up again with the same
-- phone, she would come back green-on-new and sellers would lose the warning. Those accounts
-- (and sellers and couriers, whose deletion touches other people's data) go through the
-- manual request on /borrar-datos instead.
create function public.delete_my_buyer_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  override public.buyer_trust;
begin
  if caller is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where id = caller)
     or exists (select 1 from public.couriers where id = caller)
     or not exists (select 1 from public.buyer_profiles where id = caller) then
    raise exception 'not_a_buyer_account';
  end if;
  if exists (select 1 from public.reservations where buyer_id = caller and status in ('pending_deposit', 'confirmed')) then
    raise exception 'open_reservations';
  end if;
  select trust_override into override from public.buyer_profiles where id = caller;
  if override in ('red', 'yellow')
     or exists (select 1 from public.reservations where buyer_id = caller and status in ('no_show', 'expired')) then
    raise exception 'needs_manual_review';
  end if;

  perform set_config('closets.reservation_write', 'on', true);
  update public.reservations
  set delivery_address = null, buyer_municipality = null, delivery_pin = null
  where buyer_id = caller;
  perform set_config('closets.reservation_write', 'off', true);

  -- Cascades to buyer_profiles, favorites and cart_items; reservations keep their row with
  -- buyer_id = null (see the foreign key above).
  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_buyer_account() from public, anon;
grant execute on function public.delete_my_buyer_account() to authenticated;
