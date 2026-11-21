begin;
select plan(9);

-- Pushes for courier requests that run out on their own (20261126000300). The app claims each
-- expiry once through claim_courier_expiry_notifications().
insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('97000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '528100000491', '{"account_type":"buyer","full_name":"Compradora Vence","facebook_url":"https://facebook.com/compradora.vence"}');
insert into public.products (id, seller_id, slug, name, category, size, condition, price_mxn, publication_status) values
  ('98000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pieza-vence-uno', 'Pieza vence uno', 'tops', 'M', 'new', 30000, 'published');
insert into public.cart_items (buyer_id, product_id) values ('97000000-0000-4000-8000-0000000000b1', '98000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"97000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select public.reserve_cart_from_seller('10000000-0000-4000-8000-000000000001', 'courier', null, 'Calle Vence 1, Centro', '10000000-0000-4000-8000-000000000006', 'Monterrey', 'on_delivery');
select throws_ok($$ select * from public.claim_courier_expiry_notifications() $$, '42501', null, 'A signed-in user cannot claim the notifications.');

reset role;
create temporary table claims as select * from public.claim_courier_expiry_notifications() where false;
grant all on claims to service_role;
set local role service_role;
select is((select count(*)::integer from public.claim_courier_expiry_notifications() where buyer_id = '97000000-0000-4000-8000-0000000000b1'), 0, 'Nothing to tell while the courier still has time.');

-- Two hours pass without an answer.
reset role;
update public.courier_requests set requested_at = now() - interval '2 hours 1 minute', expires_at = now() - interval '1 minute'
where reservation_id = (select id from public.reservations where buyer_id = '97000000-0000-4000-8000-0000000000b1');
set local role service_role;
insert into claims select * from public.claim_courier_expiry_notifications() where buyer_id = '97000000-0000-4000-8000-0000000000b1';
select is(
  (select row(event, seller_id, courier_name, store_name)::text from claims),
  row('request_expired', '10000000-0000-4000-8000-000000000001'::uuid, 'Lupita Recolectora', 'Closet de Renata')::text,
  'The claim runs the expiry and hands over the expired request with who to tell.'
);
select is((select status::text from public.courier_requests where reservation_id = (select reservation_id from claims)), 'expired', 'The request is expired by the claim itself.');
select is((select count(*)::integer from public.claim_courier_expiry_notifications() where buyer_id = '97000000-0000-4000-8000-0000000000b1'), 0, 'A second ping does not notify it again.');

-- The 12 hours to choose again pass too.
reset role;
update public.reservations set expires_at = now() - interval '1 minute' where buyer_id = '97000000-0000-4000-8000-0000000000b1';
set local role service_role;
delete from claims;
insert into claims select * from public.claim_courier_expiry_notifications() where buyer_id = '97000000-0000-4000-8000-0000000000b1';
select is((select event from claims), 'released_without_delivery', 'Releasing the garments after the 12 hours is handed over once too.');
select is((select status::text from public.reservations where buyer_id = '97000000-0000-4000-8000-0000000000b1'), 'expired', 'The reservation was released.');
select is((select count(*)::integer from public.claim_courier_expiry_notifications() where buyer_id = '97000000-0000-4000-8000-0000000000b1'), 0, 'And never again.');

reset role;
select is(private.ping_courier_expiry_webhook(), null::bigint, 'Without the Vault secrets the 5-minute ping does nothing.');

select * from finish();
rollback;
